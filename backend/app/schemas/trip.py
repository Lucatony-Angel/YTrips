from datetime import date, datetime
from pydantic import BaseModel


class TripCreate(BaseModel):
    name: str
    destination_name: str
    start_date: date
    end_date: date
    arrival_window_start: datetime | None = None
    arrival_window_end: datetime | None = None

class TripResponse(BaseModel):
    id: int
    name: str
    destination_name: str
    start_date: date
    end_date: date
    arrival_window_start: datetime | None
    arrival_window_end: datetime | None

    class Config:
        from_attributes = True