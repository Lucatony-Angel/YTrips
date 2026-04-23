from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.schemas.flight_search import FlightSearchRequest, FlightOfferRead, GroupFlightSearchRequest
from app.schemas.flight import FlightCreate, FlightResponse, FlightAssignBulkRequest
from app.services.flight_search_services import basic_flight_search, group_flight_search
from app.services.flight_services import add_flight
from app.models.flight import Flight
from app.models.trip_member import TripMember

router = APIRouter()


@router.post("/search", response_model=List[FlightOfferRead])
def search_flights(body: FlightSearchRequest):
    offers = basic_flight_search(
        body.origin,
        body.destination,
        body.departure_date,
        direct_only=body.direct_only,
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


@router.post("/add-to-all", response_model=List[FlightResponse])
def add_flight_to_all(
    flight: FlightCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    caller = db.query(TripMember).filter(
        TripMember.trip_id == flight.trip_id,
        TripMember.user_id == current_user.id,
    ).first()
    if not caller:
        raise HTTPException(status_code=403, detail="Not a member of this trip")

    member_ids = [
        row.user_id for row in
        db.query(TripMember).filter(TripMember.trip_id == flight.trip_id).all()
    ]

    existing = {
        (f.user_id, f.flight_number) for f in
        db.query(Flight).filter(
            Flight.trip_id == flight.trip_id,
            Flight.flight_number == flight.flight_number,
        ).all()
    }

    created: List[Flight] = []
    for uid in member_ids:
        if (uid, flight.flight_number) in existing:
            continue
        row = Flight(
            trip_id=flight.trip_id,
            user_id=uid,
            airline=flight.airline,
            flight_number=flight.flight_number,
            departure_airport=flight.departure_airport,
            arrival_airport=flight.arrival_airport,
            departure_time=flight.departure_time,
            arrival_time=flight.arrival_time,
        )
        db.add(row)
        created.append(row)

    db.commit()
    for row in created:
        db.refresh(row)
    return created


@router.post("/assign-bulk", response_model=List[FlightResponse])
def assign_flights_bulk(
    body: FlightAssignBulkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    caller = db.query(TripMember).filter(
        TripMember.trip_id == body.trip_id,
        TripMember.user_id == current_user.id,
    ).first()
    if not caller:
        raise HTTPException(status_code=403, detail="Not a member of this trip")

    member_ids = {
        row.user_id for row in
        db.query(TripMember).filter(TripMember.trip_id == body.trip_id).all()
    }
    for a in body.assignments:
        if a.user_id not in member_ids:
            raise HTTPException(
                status_code=400,
                detail=f"User {a.user_id} is not a member of this trip",
            )

    user_ids = {a.user_id for a in body.assignments}
    existing_routes = {
        (f.user_id, f.departure_airport, f.arrival_airport) for f in
        db.query(Flight).filter(
            Flight.trip_id == body.trip_id,
            Flight.user_id.in_(user_ids),
        ).all()
    }

    created: List[Flight] = []
    for a in body.assignments:
        dep = a.departure_airport.upper()
        arr = a.arrival_airport.upper()
        if (a.user_id, dep, arr) in existing_routes:
            continue
        row = Flight(
            trip_id=body.trip_id,
            user_id=a.user_id,
            airline=a.airline,
            flight_number=a.flight_number,
            departure_airport=dep,
            arrival_airport=arr,
            departure_time=a.departure_time,
            arrival_time=a.arrival_time,
        )
        db.add(row)
        existing_routes.add((a.user_id, dep, arr))
        created.append(row)

    db.commit()
    for row in created:
        db.refresh(row)
    return created

@router.post("/group-search", response_model=dict[str, List[FlightOfferRead]])
def group_search_flights(body: GroupFlightSearchRequest):
    results = group_flight_search(
        body.origins,
        body.destination,
        body.departure_date,
        body.arrival_window.model_dump(by_alias=True),
    )
    return results