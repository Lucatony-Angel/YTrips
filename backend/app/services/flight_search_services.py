import requests
import os
import math
from datetime import date, datetime, time, timedelta
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

from app.services.airport_coords import coords_for

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


# ---------------------------------------------------------------------------
# Arrival-anchored group search (v2). Coexists with find_group_windows above.
# ---------------------------------------------------------------------------

SCORE_COST_WEIGHT = 0.6
SCORE_SPREAD_WEIGHT = 0.4
DEFAULT_TOP_K = 10


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    d_lat, d_lon = lat2 - lat1, lon2 - lon1
    h = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def lead_days_for(origin: str, destination: str) -> int:
    """How many days before the target arrival date a flight could plausibly depart.

    Distance buckets approximate flight duration; lead = max departure-day shift
    we need to query Duffel for. Falls back to 1 when either airport is missing
    from the coords table — covers transcontinental redeyes but misses
    ultra-long-haul (lead 2) cases until coords are populated.
    """
    a, b = coords_for(origin), coords_for(destination)
    if a is None or b is None:
        return 1
    km = _haversine_km(a, b)
    if km < 1500:
        return 0
    if km < 6500:
        return 1
    return 2


def _parse_offer_arrival(offer: dict) -> datetime | None:
    """Parse last-segment arriving_at (Duffel local-airport time, no tz) to naive datetime."""
    segments = offer.get("segments") or []
    if not segments:
        return None
    arriving_at = segments[-1].get("arriving_at") or ""
    try:
        return datetime.fromisoformat(arriving_at.replace("Z", "+00:00")).replace(tzinfo=None)
    except (ValueError, AttributeError):
        return None


def find_group_arrivals(
    origins: list[str],
    destination: str,
    target_arrival_date: date,
    window_hours: float = 3.0,
    step_minutes: int = 30,
    direct_only: bool = False,
    top_k: int = DEFAULT_TOP_K,
) -> dict:
    """Arrival-anchored group flight search.

    Find sliding arrival-time windows on `target_arrival_date` (windows may
    spill into the next calendar day) where every origin has at least one
    flight landing inside. Each window picks the cheapest offer per origin,
    skips mixed-currency windows, and is scored by a normalized weighted
    combination of total cost and arrival spread (lower = better).

    Returns dict with: windows (top-k by score), skipped_mixed_currency_count,
    infeasible_origins (origins with zero qualifying offers — windows is [] in
    that case).
    """
    unique_origins = list(set(origins))

    # Step 1: per-origin lead days based on great-circle distance.
    leads = {o: lead_days_for(o, destination) for o in unique_origins}

    # Step 2: parallel Duffel fetch across all (origin, departure_date) pairs.
    calls: list[tuple[str, str]] = []
    for o in unique_origins:
        for i in range(leads[o] + 1):
            calls.append((o, (target_arrival_date - timedelta(days=i)).isoformat()))

    raw_by_origin: dict[str, list] = {o: [] for o in unique_origins}
    failed: list[str] = []

    def _fetch(args: tuple[str, str]):
        origin, dep = args
        return origin, _search_duffel(
            origin, destination, dep,
            direct_only=direct_only, raise_on_error=True,
        )

    max_workers = min(len(calls), 8) or 1
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        for fut in [ex.submit(_fetch, c) for c in calls]:
            try:
                origin, offers = fut.result()
                raw_by_origin[origin].extend(offers)
            except DuffelOriginError as err:
                failed.append(err.origin)

    if failed:
        # Surface partial outage rather than silently producing "no windows".
        raise GroupSearchError(sorted(set(failed)))

    # Step 3: filter to arrivals inside the searchable domain (day A + spillover
    # of one window width into A+1), normalize, dedupe Duffel fare-class clones.
    domain_start = datetime.combine(target_arrival_date, time(0, 0))
    domain_end = domain_start + timedelta(days=1) + timedelta(hours=window_hours)

    offers_by_origin: dict[str, list[tuple[datetime, dict]]] = {}
    infeasible: list[str] = []

    for origin, raw in raw_by_origin.items():
        normalized = (normalize_offer(o) for o in raw)
        in_domain: list[tuple[datetime, dict]] = []
        for o in normalized:
            arr = _parse_offer_arrival(o)
            if arr is None:
                continue
            if domain_start <= arr < domain_end:
                in_domain.append((arr, o))
        # Dedupe by itinerary, keep cheapest fare class.
        seen: dict[tuple, tuple[datetime, dict]] = {}
        for arr, o in in_domain:
            key = tuple((seg.get("flight_number"), seg.get("departing_at")) for seg in o["segments"])
            if key not in seen or float(o["total_amount"]) < float(seen[key][1]["total_amount"]):
                seen[key] = (arr, o)
        offers_by_origin[origin] = list(seen.values())
        if not offers_by_origin[origin]:
            infeasible.append(origin)

    if infeasible:
        return {
            "windows": [],
            "skipped_mixed_currency_count": 0,
            "infeasible_origins": sorted(infeasible),
        }

    # Step 4: build candidate windows. Starts strictly inside day A; ends may
    # spill into day A+1 (caller renders the +1 day-offset on the frontend).
    step = timedelta(minutes=step_minutes)
    width = timedelta(hours=window_hours)
    end_of_day_a = domain_start + timedelta(days=1)
    starts: list[datetime] = []
    s = domain_start
    while s < end_of_day_a:
        starts.append(s)
        s += step

    # Step 5: feasibility check + per-window scoring inputs.
    feasible: list[dict] = []
    skipped_mixed_currency = 0

    for w_start in starts:
        w_end = w_start + width
        best_per_origin: dict[str, tuple[datetime, dict]] = {}
        counts: dict[str, int] = {}
        covered = True
        for origin, offers in offers_by_origin.items():
            in_window = [(arr, o) for arr, o in offers if w_start <= arr < w_end]
            if not in_window:
                covered = False
                break
            best_per_origin[origin] = min(in_window, key=lambda x: float(x[1]["total_amount"]))
            counts[origin] = len(in_window)
        if not covered:
            continue

        currencies = {o["total_currency"] for _, o in best_per_origin.values()}
        if len(currencies) != 1:
            skipped_mixed_currency += 1
            continue

        arrivals = [arr for arr, _ in best_per_origin.values()]
        spread_min = int((max(arrivals) - min(arrivals)).total_seconds() // 60)
        total = sum(float(o["total_amount"]) for _, o in best_per_origin.values())

        feasible.append({
            "window_start": w_start,
            "window_end": w_end,
            "best_per_origin": best_per_origin,
            "counts_per_origin": counts,
            "currency": next(iter(currencies)),
            "total_combined": total,
            "spread_min": spread_min,
        })

    if not feasible:
        return {
            "windows": [],
            "skipped_mixed_currency_count": skipped_mixed_currency,
            "infeasible_origins": [],
        }

    # Step 6: collapse windows that pick the exact same offer set — only the
    # earliest+tightest representative survives. Avoids the top-k filling up
    # with shifted copies of the same flight combination.
    grouped: dict[tuple, dict] = {}
    for w in feasible:
        key = tuple(sorted(
            (origin, id(o)) for origin, (_, o) in w["best_per_origin"].items()
        ))
        existing = grouped.get(key)
        if existing is None or (
            (w["spread_min"], w["total_combined"], w["window_start"])
            < (existing["spread_min"], existing["total_combined"], existing["window_start"])
        ):
            grouped[key] = w
    survivors = list(grouped.values())

    # Step 7: per-search normalization of cost + spread, weighted score, top-k.
    costs = [w["total_combined"] for w in survivors]
    spreads = [w["spread_min"] for w in survivors]
    cmin, cmax = min(costs), max(costs)
    smin, smax = min(spreads), max(spreads)
    crange = (cmax - cmin) or 1.0
    srange = (smax - smin) or 1.0

    scored: list[dict] = []
    for w in survivors:
        cost_norm = (w["total_combined"] - cmin) / crange
        spread_norm = (w["spread_min"] - smin) / srange
        score = SCORE_COST_WEIGHT * cost_norm + SCORE_SPREAD_WEIGHT * spread_norm
        scored.append(_serialize_arrival_window(w, target_arrival_date, score, cost_norm, spread_norm))

    scored.sort(key=lambda r: (r["score"], r["total_combined"], r["window_start"]))
    return {
        "windows": scored[:top_k],
        "skipped_mixed_currency_count": skipped_mixed_currency,
        "infeasible_origins": [],
    }


def _serialize_arrival_window(
    w: dict,
    target_date: date,
    score: float,
    cost_norm: float,
    spread_norm: float,
) -> dict:
    end_day_offset = (w["window_end"].date() - target_date).days
    offers_out: dict[str, dict] = {}
    for origin, (arr, offer) in w["best_per_origin"].items():
        offers_out[origin] = {
            **offer,
            "arrival_day_offset": (arr.date() - target_date).days,
        }
    return {
        "window_start": w["window_start"].isoformat(),
        "window_end": w["window_end"].isoformat(),
        "end_day_offset": end_day_offset,
        "best_offer_per_origin": offers_out,
        "options_count_per_origin": w["counts_per_origin"],
        "total_combined": round(w["total_combined"], 2),
        "currency": w["currency"],
        "arrival_spread_minutes": w["spread_min"],
        "score": round(score, 4),
        "cost_norm": round(cost_norm, 4),
        "spread_norm": round(spread_norm, 4),
    }
