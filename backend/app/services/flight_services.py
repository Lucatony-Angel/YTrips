# Thin service layer for saving a flight to the database. Sits between the
# router and the ORM so flight-creation logic isn't scattered across endpoints.
from sqlalchemy.orm import Session

from app.models.flight import Flight
from app.schemas.flight import FlightCreate


def add_flight(db: Session, flight_data: FlightCreate, user_id: int):
    flight = Flight(
        trip_id=flight_data.trip_id,
        user_id=user_id,
        airline=flight_data.airline,
        flight_number=flight_data.flight_number,
        departure_airport=flight_data.departure_airport,
        arrival_airport=flight_data.arrival_airport,
        departure_time=flight_data.departure_time,
        arrival_time=flight_data.arrival_time,
        total_amount=flight_data.total_amount,
        total_currency=flight_data.total_currency,
    )

    db.add(flight)
    db.commit()
    db.refresh(flight)

    return flight