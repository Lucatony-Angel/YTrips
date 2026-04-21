from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator, model_validator
import re
from app.services.airport_registry import is_valid_airport_code

class GroupWindowSave(BaseModel):
    window_start: str
    window_end: str
    total_cheapest_combined: float = Field(..., ge=0)
    currency: str = Field(..., min_length=3, max_length=3)


class VoteCast(BaseModel):
    vote: bool | None = None


class MemberHomeAirportUpdate(BaseModel):
    home_airport: str = Field(..., min_length=3, max_length=4)

    @field_validator("home_airport")
    @classmethod
    def normalize_airport(cls, v: str) -> str:
        code = v.strip().upper()
        if not is_valid_airport_code(code):
            raise ValueError(f"'{code}' is not a recognized airport code")
        return code


class TripBannerUpdate(BaseModel):
    banner_color: str | None = None
    banner_image_url: str | None = None

    @field_validator("banner_color")
    @classmethod
    def validate_hex_colors(cls, v: str | None) -> str | None:
        if v is not None and not re.match(r"^#[0-9A-Fa-f]{6}$", v):
            raise ValueError("must be a valid hex color like #2D3BE8")
        return v

class TripCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    destination_name: str = Field(..., min_length=1, max_length=100)
    start_date: date
    end_date: date
    arrival_window_start: datetime | None = None
    arrival_window_end: datetime | None = None
    banner_color: str = "#2D3BE8"
    banner_image_url: str | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date < date.today():
            raise ValueError("start_date cannot be in the past")
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        if self.arrival_window_start and self.arrival_window_end:
            if self.arrival_window_end <= self.arrival_window_start:
                raise ValueError("arrival_window_end must be after arrival_window_start")
        return self
    
    @field_validator("banner_color")
    @classmethod
    def validate_hex_colors(cls, v: str) -> str:
        if not re.match(r"^#[0-9A-Fa-f]{6}$", v):
            raise ValueError("must be a valid hex color like #2D3BE8")
        return v

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
    created_by_user_id: int
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
    is_finalized: bool = False

    class Config:
        from_attributes = True
