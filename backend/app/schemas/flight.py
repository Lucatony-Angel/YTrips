from datetime import datetime
from pydantic import BaseModel, Field, model_validator
from app.services.airport_registry import is_valid_airport_code


class FlightCreate(BaseModel):
    trip_id: int = Field(..., gt=0)
    airline: str = Field(..., min_length=1, max_length=100)
    flight_number: str = Field(..., min_length=2, max_length=10)
    departure_airport: str = Field(..., min_length=3, max_length=4)
    arrival_airport: str = Field(..., min_length=3, max_length=4)
    departure_time: datetime
    arrival_time: datetime

    @model_validator(mode="after")
    def validate_times(self):
        if self.arrival_time <= self.departure_time:
            raise ValueError("arrival_time must be after departure_time")
        if self.departure_airport.upper() == self.arrival_airport.upper():
            raise ValueError("departure and arrival airports cannot be the same")
        return self
    
    @model_validator(mode="after")
    def normalize_airports(self):
        dep = self.departure_airport.strip().upper()
        arr = self.arrival_airport.strip().upper()
        if not is_valid_airport_code(dep):
            raise ValueError(f"'{dep}' is not a recognized airport code")
        if not is_valid_airport_code(arr):
            raise ValueError(f"'{arr}' is not a recognized airport code")
        self.departure_airport = dep
        self.arrival_airport = arr
        return self


class FlightResponse(FlightCreate):
    id: int
    user_id: int

    class Config:
        from_attributes = True
