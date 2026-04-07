from datetime import date, datetime
from pydantic import BaseModel


class GroupWindowSave(BaseModel):
    window_start: str
    window_end: str
    total_cheapest_combined: float
    currency: str


class TripBannerUpdate(BaseModel):
    banner_color: str | None = None
    banner_image_url: str | None = None


class TripCreate(BaseModel):
    name: str
    destination_name: str
    start_date: date
    end_date: date
    arrival_window_start: datetime | None = None
    arrival_window_end: datetime | None = None
    banner_color: str = "#2D3BE8"
    banner_image_url: str | None = None

class TripMemberResponse(BaseModel):
    user_id: int
    display_name: str
    avatar_url: str | None = None
    role: str
    home_airport: str | None = None

    class Config:
        from_attributes = True


class TripResponse(BaseModel):
    id: int
    name: str
    destination_name: str
    start_date: date
    end_date: date
    arrival_window_start: datetime | None
    arrival_window_end: datetime | None
    invite_code: str
    banner_color: str
    banner_image_url: str | None = None
    member_count: int | None = None
    group_window_start: str | None = None
    group_window_end: str | None = None
    group_window_checked_at: datetime | None = None
    group_window_combined_price: float | None = None
    group_window_currency: str | None = None

    class Config:
        from_attributes = True