from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.trip import Trip
from app.models.trip_member import TripMember
from app.models.flight import Flight
from app.schemas.trip import TripCreate, TripResponse, TripMemberResponse
from app.schemas.flight import FlightResponse
from app.services.trip_services import create_trip, get_user_trips

router = APIRouter()


@router.post("/", response_model=TripResponse)
def create_trip_endpoint(
    trip: TripCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_trip(db, trip, current_user.id)


@router.get("/my-trips", response_model=list[TripResponse])
def get_my_trips(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_user_trips(db, current_user.id)


@router.get("/{trip_id}", response_model=TripResponse)
def get_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = (
        db.query(Trip)
        .join(TripMember, Trip.id == TripMember.trip_id)
        .filter(Trip.id == trip_id, TripMember.user_id == current_user.id)
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.get("/{trip_id}/members", response_model=list[TripMemberResponse])
def get_trip_members(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = db.query(TripMember).filter(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this trip")

    rows = (
        db.query(TripMember, User)
        .join(User, TripMember.user_id == User.id)
        .filter(TripMember.trip_id == trip_id)
        .all()
    )
    return [
        TripMemberResponse(
            user_id=u.id,
            display_name=u.display_name,
            avatar_url=u.avatar_url,
            role=tm.role,
        )
        for tm, u in rows
    ]


@router.get("/{trip_id}/flights", response_model=list[FlightResponse])
def get_trip_flights(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = db.query(TripMember).filter(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this trip")

    return db.query(Flight).filter(Flight.trip_id == trip_id).all()


@router.delete("/{trip_id}/flights/{flight_id}")
def delete_trip_flight(
    trip_id: int,
    flight_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flight = db.query(Flight).filter(Flight.id == flight_id, Flight.trip_id == trip_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    if flight.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own flights")
    db.delete(flight)
    db.commit()
    return {"message": "Flight deleted"}


@router.post("/join/{invite_code}")
def join_trip(
    invite_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = db.query(Trip).filter(Trip.invite_code == invite_code).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    existing = db.query(TripMember).filter(
        TripMember.trip_id == trip.id,
        TripMember.user_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already a member")

    new_member = TripMember(trip_id=trip.id, user_id=current_user.id)
    db.add(new_member)
    db.commit()
    return {"message": "Joined successfully"}
