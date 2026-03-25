from datetime import datetime
from pydantic import BaseModel


class FlightCreate(BaseModel):
    trip_id: int
    airline: str
    flight_number: str
    departure_airport: str
    arrival_airport: str
    departure_time: datetime
    arrival_time: datetime


class FlightResponse(FlightCreate):
    id: int

    class Config:
        from_attributes = True