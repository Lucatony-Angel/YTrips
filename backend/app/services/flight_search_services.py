import requests
import os
from dotenv import load_dotenv

load_dotenv()

def basic_flight_search(origin, destination, departure_date):

    payload = {
        "data": {
            "slices": [
                {
                    "origin": origin,
                    "destination": destination,
                    "departure_date": departure_date,
                }
            ],
            "passengers": [{"type": "adult"}],
        }
    }

    env = os.getenv("ENVIRONMENT", "test")
    if env == "live":
        token = os.getenv("DUFFEL_LIVE_KEY")
    else:
        token = os.getenv("DUFFEL_TEST_KEY")

    if not token:
        raise RuntimeError("Duffel API key not set")
    headers = {
        "Authorization": f"Bearer {token}",
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
    }

    response = requests.post(
        "https://api.duffel.com/air/offer_requests?return_offers=true",
        headers=headers,
        json=payload,
    )

    if response.status_code not in [200, 201]:
        return []

    offers = response.json()["data"].get("offers", [])

    top_offers = offers[:5]
    return [normalize_offer(o) for o in top_offers]
    
def normalize_offer(offer):
    all_segments = []

    for slice_ in offer.get("slices", []):
        for segment in slice_.get("segments", []):
            all_segments.append({
                "origin": segment['origin']['iata_code'],
                "destination": segment['destination']['iata_code'],
                "departing_at": segment["departing_at"],
                "arriving_at": segment["arriving_at"],
                "marketing_carrier": (
                    segment.get("marketing_carrier", {})
                ).get("name"),
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
