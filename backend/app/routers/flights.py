from fastapi import APIRouter, HTTPException
from app.schemas.flight_search import *
from app.services.flight_search_services import *

# Set up router
router = APIRouter()

@router.post("/search", response_model=List[FlightOfferRead])
def search_flights(body: FlightSearchRequest): # body is req body
    offers = basic_flight_search(
        body.origin,
        body.destination,
        body.departure_date,
    ) # pre-nomrmalized within function
    if offers is None:
          raise HTTPException(status_code=502, detail="Flightsearch failed")
    return offers

@router.post("/group-search", response_model=dict[str, List[FlightOfferRead]])
def group_search_flights(body: GroupFlightSearchRequest):
    results = group_flight_search(
        body.origins,
        body.destination,
        body.departure_date,
        body.arrival_window
    )
    return results