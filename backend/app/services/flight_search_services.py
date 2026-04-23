import requests
import os
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

load_dotenv()

DUFFEL_URL = "https://api.duffel.com/air/offer_requests?return_offers=true"


class DuffelOriginError(RuntimeError):
    """Raised when a Duffel call for a specific origin fails with an HTTP error.

    Distinct from 'zero flights found' — lets callers aggregate per-origin failures
    instead of treating API outages as empty-result days.
    """
    def __init__(self, origin: str, status_code: int | None = None):
        self.origin = origin
        self.status_code = status_code
        super().__init__(f"Duffel call failed for origin {origin} (status={status_code})")


class GroupSearchError(RuntimeError):
    """Aggregated per-origin failures from a group search run."""
    def __init__(self, failed_origins: list[str]):
        self.failed_origins = failed_origins
        super().__init__(f"Duffel calls failed for: {', '.join(failed_origins)}")

def _get_headers():
    env = os.getenv("ENVIRONMENT", "test")
    if env == "live":
        token = os.getenv("DUFFEL_LIVE_KEY")
    else:
        token = os.getenv("DUFFEL_TEST_KEY")

    if not token:
        raise RuntimeError("Duffel API key not set")
    return {
        "Authorization": f"Bearer {token}",
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
    }


def _search_duffel(origin, destination, departure_date, arrival_window=None, direct_only=False, raise_on_error=False):
    """raw duffel search, returns list of raw offers.

    When raise_on_error=True, HTTP failures raise DuffelOriginError instead of
    silently collapsing to []. Kept opt-in so existing legacy callers keep their
    pre-existing tolerance to empty results.
    """
    slice_data = {
        "origin": origin,
        "destination": destination,
        "departure_date": departure_date,
    }
    if arrival_window:
        slice_data["arrival_time"] = arrival_window

    payload = {
        "data": {
            "slices": [slice_data],
            "passengers": [{"type": "adult"}],
            **({"max_connections": 0} if direct_only else {}),
        }
    }

    try:
        response = requests.post(DUFFEL_URL, headers=_get_headers(), json=payload, timeout=15)
    except requests.RequestException as exc:
        if raise_on_error:
            raise DuffelOriginError(origin) from exc
        return []

    if response.status_code not in [200, 201]:
        if raise_on_error:
            raise DuffelOriginError(origin, status_code=response.status_code)
        return []

    return response.json()["data"].get("offers", [])


def basic_flight_search(origin, destination, departure_date, direct_only=False):
    offers = _search_duffel(origin, destination, departure_date, direct_only=direct_only)
    normalized = [normalize_offer(o) for o in offers]

    if direct_only:
        normalized = [o for o in normalized if len(o["segments"]) == 1]

    # Duffel returns many offers for the same physical flight (different fare
    # classes/booking codes). Deduplicate by itinerary — the ordered tuple of
    # (flight_number, departing_at) across all segments — keeping the cheapest.
    seen: dict[tuple, dict] = {}
    for offer in normalized:
        key = tuple((seg["flight_number"], seg["departing_at"]) for seg in offer["segments"])
        if key not in seen or float(offer["total_amount"]) < float(seen[key]["total_amount"]):
            seen[key] = offer

    return list(seen.values())[:200]


def group_flight_search(origins, destination, departure_date, arrival_window):
    """
    search flights for multiple origins going to the same destination.
    dedupes origins so we dont hit duffel twice for the same airport.
    arrival_window: {"from": "13:00", "to": "15:00"}
    """
    results = {}

    for origin in origins:
        if origin in results:
            continue

        offers = _search_duffel(origin, destination, departure_date, arrival_window)
        offers = sort_by_arrival(offers)
        results[origin] = [normalize_offer(o) for o in offers[:10]]

    return results


def normalize_offer(offer):
    all_segments = []

    for slice_ in offer.get("slices", []):
        for segment in slice_.get("segments", []):
            carrier = segment.get("marketing_carrier") or {}
            all_segments.append({
                "origin": segment['origin']['iata_code'],
                "destination": segment['destination']['iata_code'],
                "departing_at": segment["departing_at"],
                "arriving_at": segment["arriving_at"],
                "marketing_carrier": carrier.get("name"),
                "marketing_carrier_iata_code": carrier.get("iata_code"),
                "flight_number": segment.get("marketing_carrier_flight_number"),
            })
    return {
        'total_amount': offer['total_amount'],
        'total_currency': offer['total_currency'],
        "owner_name": (offer.get("owner") or {}).get("name"),
        "slices_count": len(offer.get("slices", [])),
        "segments": all_segments,
    }

def get_arrival_time(offer):
    return offer["slices"][0]["segments"][-1]["arriving_at"]

def sort_by_arrival(offers):
    return sorted(offers, key=get_arrival_time)

def sort_by_price(offers):
    return sorted(offers, key=lambda o: float(o["total_amount"]))



def _arrival_hour(offer):
    """Returns arrival time as a float (e.g. 14.5 = 14:30) from the last segment."""
    segments = offer.get("segments", [])
    if not segments:
        return None
    arriving_at = segments[-1].get("arriving_at", "")
    if len(arriving_at) < 16:
        return None
    h, m = int(arriving_at[11:13]), int(arriving_at[14:16])
    return h + m / 60


def _fmt_hour(h):
    """Convert float hour to HH:MM string."""
    hh = int(h) % 24
    mm = int((h % 1) * 60)
    return f"{hh:02d}:{mm:02d}"


def find_group_windows(origins, destination, departure_date, window_hours=3, step_minutes=30):
    """
    Search flights for each origin and find time windows where every person
    has at least one flight arriving. Returns windows ranked by cheapest
    combined price (one cheapest flight per origin).

    Raises GroupSearchError if any origin's Duffel call fails (surfaces partial
    outages instead of silently producing "no windows"). Windows whose best
    offers span multiple currencies are skipped — the combined total would be
    meaningless.
    """
    unique_origins = list(set(origins))

    # Step 1: fetch offers for each unique origin in parallel
    flights_by_origin: dict[str, list] = {}
    failed: list[str] = []

    def _fetch(origin: str):
        return origin, _search_duffel(origin, destination, departure_date, raise_on_error=True)

    max_workers = min(len(unique_origins), 8) or 1
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        for future in [ex.submit(_fetch, o) for o in unique_origins]:
            try:
                origin, offers = future.result()
                flights_by_origin[origin] = [normalize_offer(o) for o in offers]
            except DuffelOriginError as err:
                failed.append(err.origin)

    if failed:
        raise GroupSearchError(failed)

    # Step 2: pre-bucket each offer into its arrival hour slot for fast lookup
    bucketed = {
        origin: [
            (h, o)
            for o in offers
            if (h := _arrival_hour(o)) is not None
        ]
        for origin, offers in flights_by_origin.items()
    }

    # Step 3: generate sliding windows across 24h
    step = step_minutes / 60
    num_steps = int(24 / step)
    windows = [(i * step, i * step + window_hours) for i in range(num_steps)]

    # Step 4: for each window check every origin has coverage, collect results
    results = []
    for win_start, win_end in windows:
        best_per_origin = {}
        all_covered = True

        for origin, bucket in bucketed.items():
            in_window = [o for h, o in bucket if win_start <= h < win_end]
            if not in_window:
                all_covered = False
                break
            best_per_origin[origin] = min(in_window, key=lambda o: float(o["total_amount"]))

        if not all_covered:
            continue

        currencies = {o["total_currency"] for o in best_per_origin.values()}
        if len(currencies) != 1:
            # Mixed currencies — summing is meaningless without FX, skip this window
            continue
        currency = next(iter(currencies))
        total = sum(float(o["total_amount"]) for o in best_per_origin.values())

        results.append({
            "window_start": _fmt_hour(win_start),
            "window_end": _fmt_hour(win_end % 24),
            "total_cheapest_combined": round(total, 2),
            "currency": currency,
            "options_count_per_origin": {
                origin: len([o for h, o in bucketed[origin] if win_start <= h < win_end])
                for origin in best_per_origin
            },
            "best_offer_per_origin": best_per_origin,
        })

    # Step 5: rank by cheapest combined price, return top 10
    results.sort(key=lambda r: r["total_cheapest_combined"])
    return results[:10]
