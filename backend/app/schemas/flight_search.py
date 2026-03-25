from pydantic import BaseModel
from typing import List

# request schemas
class FlightSearchRequest(BaseModel):
    origin: str
    destination: str
    departure_date: str  # "YYYY-MM-DD"

class GroupFlightSearchRequest(BaseModel):
    origins: List[str]   # one IATA per member, e.g. ["JFK", etc etc]
    destination: str
    departure_date: str
    arrival_window: dict  # {"from": "13:00", "to": "15:00"}

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