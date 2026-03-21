from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.schemas.flight_search import *
from app.schemas.flight import FlightCreate, FlightResponse
from app.services.flight_search_services import *
from app.services.flight_services import add_flight

# Set up router
router = APIRouter(prefix="/api/flights", tags=["Flights"])


# 🔍 SEARCH FLIGHTS
@router.post("/search", response_model=List[FlightOfferRead])
def search_flights(body: FlightSearchRequest):
    offers = basic_flight_search(
        body.origin,
        body.destination,
        body.departure_date,
    )
    if offers is None:
        raise HTTPException(status_code=502, detail="Flightsearch failed")
    return offers


# 👥 GROUP SEARCH
@router.post("/group-search", response_model=dict[str, List[FlightOfferRead]])
def group_search_flights(body: GroupFlightSearchRequest):
    results = group_flight_search(
        body.origins,
        body.destination,
        body.departure_date,
        body.arrival_window
    )
    return results


# 💾 ADD FLIGHT (NEW)
@router.post("/add", response_model=FlightResponse)
def add_flight_endpoint(
    flight: FlightCreate,
    db: Session = Depends(get_db)
):
    user_id = 1  # temporary until auth

    return add_flight(db, flight, user_id)