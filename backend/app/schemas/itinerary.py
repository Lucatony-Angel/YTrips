from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ItineraryItemBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    description: str = Field(default="", max_length=2000)
    scheduled_at: datetime
    location: str = Field(..., min_length=1, max_length=150)
    category: str = Field(..., min_length=1, max_length=80)

    @field_validator("description", mode="before")
    @classmethod
    def default_empty_description(cls, value):
        return "" if value is None else value


class ItineraryItemCreate(ItineraryItemBase):
    pass


class ItineraryItemUpdate(ItineraryItemBase):
    pass


class ItineraryItemResponse(ItineraryItemBase):
    id: int
    trip_id: int
    created_by_user_id: int
    created_at: datetime
    yes_votes: int = 0
    no_votes: int = 0
    user_vote: bool | None = None

    class Config:
        from_attributes = True
