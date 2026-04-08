from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class ItineraryVote(Base):
    __tablename__ = "itinerary_votes"
    __table_args__ = (UniqueConstraint("item_id", "user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("itinerary_items.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    vote: Mapped[bool] = mapped_column(Boolean, nullable=False)
    