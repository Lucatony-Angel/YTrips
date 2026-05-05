# An itinerary item is one event or activity on a trip — a restaurant, a hike,
# a museum visit, etc. Members can propose items and then vote on them if there
# are conflicts at the same time slot.
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class ItineraryItem(Base):
    __tablename__ = "itinerary_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    location: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
