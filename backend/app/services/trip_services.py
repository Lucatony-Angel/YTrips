from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.trip import Trip
from app.models.trip_member import TripMember
from app.schemas.trip import TripCreate

def create_trip(db: Session, trip_data: TripCreate, user_id: int):
    trip = Trip(
        name=trip_data.name,
        destination_name=trip_data.destination_name,
        start_date=trip_data.start_date,
        end_date=trip_data.end_date,
        arrival_window_start=trip_data.arrival_window_start,
        arrival_window_end=trip_data.arrival_window_end,
        banner_color=trip_data.banner_color,
        banner_image_url=trip_data.banner_image_url,
        created_by_user_id=user_id
    )

    db.add(trip)
    db.flush()  # writes the trip row and populates trip.id without committing
    assert trip.id is not None, "trip.id was not populated after flush — check trips.id has a SERIAL/IDENTITY default"

    membership = TripMember(
        trip_id=trip.id,
        user_id=user_id,
        role="owner"
    )

    db.add(membership)
    db.commit()
    db.refresh(trip)

    return trip

def get_user_trips(db: Session, user_id: int):
    stmt = (
        select(Trip)
        .join(TripMember, Trip.id == TripMember.trip_id)
        .where(TripMember.user_id == user_id)
    )

    return db.scalars(stmt).all()