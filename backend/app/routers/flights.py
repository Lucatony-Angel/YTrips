from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.schemas.flight_search import FlightSearchRequest, FlightOfferRead, GroupFlightSearchRequest
from app.schemas.flight import FlightCreate, FlightResponse
from app.services.flight_search_services import basic_flight_search, group_flight_search
from app.services.flight_services import add_flight

router = APIRouter()


@router.post("/search", response_model=List[FlightOfferRead])
def search_flights(body: FlightSearchRequest):
    offers = basic_flight_search(
        body.origin,
        body.destination,
        body.departure_date,
    )
    if offers is None:
        raise HTTPException(status_code=502, detail="Flight search failed")
    return offers


@router.post("/add", response_model=FlightResponse)
def add_flight_endpoint(
    flight: FlightCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return add_flight(db, flight, current_user.id)

@router.post("/group-search", response_model=dict[str, List[FlightOfferRead]])
def group_search_flights(body: GroupFlightSearchRequest):
    results = group_flight_search(
        body.origins,
        body.destination,
        body.departure_date,
        body.arrival_window,
    )
    return results