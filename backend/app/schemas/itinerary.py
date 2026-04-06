from datetime import datetime

from pydantic import BaseModel, Field


class ItineraryItemBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    description: str = Field(..., min_length=1, max_length=2000)
    scheduled_at: datetime
    location: str = Field(..., min_length=1, max_length=150)
    category: str = Field(..., min_length=1, max_length=80)


class ItineraryItemCreate(ItineraryItemBase):
    pass


class ItineraryItemUpdate(ItineraryItemBase):
    pass


class ItineraryItemResponse(ItineraryItemBase):
    id: int
    trip_id: int
    created_by_user_id: int
    created_at: datetime

    class Config:
        from_attributes = True
