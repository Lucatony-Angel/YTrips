"""
File to request data from Duffel API
"""
import requests
import os
from dotenv import load_dotenv

load_dotenv()  # Loads .env file

TOKEN = os.getenv("live_key")
headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Duffel-Version": "v2",
    "Content-Type": "application/json",
}


# request payload
default_payload = {
    "data": {
    "slices": [
        {
        "origin": "JFK",
        "destination": "LAX",
        "departure_date": "2026-07-18",
        }
    ],
    "passengers": [{"type": "adult"}],
    }
}


def basic_flight_search(origin, 
                        destination, 
                        departure_date, 
                        arrival_time=None, 
                        headers=headers):
    """
    Single person, single origin and destination flight search
    """

    # TODO: Implement Arrive by this time: feature.

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

    response = requests.post(
        "https://api.duffel.com/air/offer_requests?return_offers=true",
        headers=headers,
        json=payload
    )
    if response.status_code not in [200, 201]:
        print(f"Error: {response.text}")
        return None
    else:
        data = response.json()["data"]
        offers = data.get("offers", [])
        return normalize_offer(offers)
    
def normalize_offer(offer):
    all_segments = []

    # get each slice from the response
    for slice_ in offer.get("slices", []):
        for segment in slice_.get("segments", []):
            # marketing carrier is the seller flight code, but for codeshare
            # it will not necessarily show the carrier actually flying it. 
            all_segments.append({
                "origin": segment['origin']['iata_code'], # airport code for origin
                "destination":  segment['destination']['iata_code'], # airport code destination
                "destination": segment["destination"]["iata_code"],
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


def group_flight_search(origins, destination, departure_date, arrival_window, headers=headers):
    """
    Search flights for multiple group members departing from different airports.
    Works by iterating over each origin, getting flights that arrive in a certain window. 
    
    origins: list of IATA codes, e.g. ["JFK", "LAX", "ORD"]
    destination: single IATA code, e.g. "BCN"
    departure_date: "YYYY-MM-DD"
    arrival_window: dict like {"from": "13:00", "to": "15:00"}
    """
    results = {} 

    for origin in origins:
        if origin in results:
            # this is to avoid repeated calculations for an origin.
            continue
        payload = {
            "data": {
                "slices": [{
                    "origin": origin,
                    "destination": destination,
                    "departure_date": departure_date,
                    "arrival_time": arrival_window,
                }],
                "passengers": [{"type": "adult"}],
            }
        }

        response = requests.post(
            "https://api.duffel.com/air/offer_requests?return_offers=true",
            headers=headers,
            json=payload,
        )

        if response.status_code not in [200, 201]:
            print(f"  Error ({response.status_code}): {response.text[:200]}")
            results[origin] = []
            continue

        offers = response.json()["data"].get("offers", [])
        offers = sort_by_arrival(offers)
        results[origin] = [normalize_offer(off) for off in offers]

        if not offers:
            print("  No flights found in this window.")
            continue

    return results
    
# Sorting functions below: 
def get_arrival_time(offer):
    return offer["slices"][0]["segments"][-1]["arriving_at"]

def sort_by_arrival(offers):
    return sorted(offers, key=get_arrival_time)

def sort_by_price(offers):
    return sorted(offers, key=lambda o: float(o["total_amount"]))

if __name__ == '__main__':
    # basic_flight_search('JFK', 'LAX', '2026-03-07')
    group_flight_search(
        origins=["JFK", "LAX", "ORD"],
        destination="MIA",
        departure_date="2026-07-18",
        arrival_window={"from": "13:00", "to": "15:00"},
    )