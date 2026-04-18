from datetime import date
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List
import re
from app.services.airport_registry import is_valid_airport_code

class ArrivalWindow(BaseModel):
    from_time: str = Field(..., alias="from")
    to_time: str = Field(..., alias="to")

    model_config = {"populate_by_name": True}

    @field_validator("from_time", "to_time")
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        if not re.match(r"^\d{2}:\d{2}$", v):
            raise ValueError("must be in HH:MM format")
        hour, minute = int(v[:2]), int(v[3:])
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            raise ValueError("invalid time value")
        return v
    
    @model_validator(mode="after")
    def validate_window_order(self):
        if self.from_time >= self.to_time:
            raise ValueError("arrival window 'from' must be before 'to'")
        return self

# request schemas
class FlightSearchRequest(BaseModel):
    origin: str = Field(..., min_length=3, max_length=4)
    destination: str = Field(..., min_length=3, max_length=4)
    departure_date: str  # "YYYY-MM-DD"

    @field_validator("origin", "destination")
    @classmethod
    def normalize_airports(cls, v: str) -> str:
        code = v.strip().upper()
        if not is_valid_airport_code(code):
            raise ValueError(f"'{code}' is not a recognized airport code")
        return code
    
    @field_validator("departure_date")
    @classmethod
    def validate_departure_date(cls, v: str) -> str:
        try:
            parsed = date.fromisoformat(v)
        except ValueError:
            raise ValueError("must be in YYYY-MM-DD format")
        if parsed < date.today():
            raise ValueError("departure_date cannot be in the past")
        return v

class GroupFlightSearchRequest(BaseModel):
    origins: List[str] = Field(..., min_length=1)   # one IATA per member, e.g. ["JFK", etc etc]
    destination: str = Field(..., min_length=3, max_length=4)
    departure_date: str
    arrival_window: ArrivalWindow  # {"from": "13:00", "to": "15:00"}

    @field_validator("origins")
    @classmethod
    def normalize_orgins(cls, v: List[str]) -> List[str]:
        codes = [c.strip().upper() for c in v]
        for code in codes:
            if not is_valid_airport_code(code):
                raise ValueError(f"'{code}' is not a recognized airport code")
        return codes

    @field_validator("destination")
    @classmethod
    def normalize_destination(cls, v: str) -> str:
        code = v.strip().upper()
        if not is_valid_airport_code(code):
            raise ValueError(f"'{code}' is not a recognized airport code")
        return code

    @field_validator("departure_date")
    @classmethod
    def validate_departure_date(cls, v: str) -> str:
        try:
            parsed = date.fromisoformat(v)
        except ValueError:
            raise ValueError("must be in YYYY-MM-DD format")
        if parsed < date.today():
            raise ValueError("departure_date cannot be in the past")
        return v

# response schemas
class FlightSegmentRead(BaseModel):
    origin: str
    destination: str
    departing_at: str
    arriving_at: str
    marketing_carrier: str | None = None
    flight_number: str | None = None

class FlightOfferRead(BaseModel):
    total_amount: str
    total_currency: str
    owner_name: str | None = None
    slices_count: int
    segments: List[FlightSegmentRead]

class GroupWindow(BaseModel):
    window_start: str          # "14:00"
    window_end: str            # "17:00"
    total_cheapest_combined: float
    currency: str
    options_count_per_origin: dict[str, int]
    best_offer_per_origin: dict[str, FlightOfferRead]
