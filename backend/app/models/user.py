from datetime import datetime, timezone
from sqlalchemy import JSON

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now(timezone.utc), nullable=False)
    # Personal (optional for flight bookings)
    date_of_birth: Mapped[date | None] = mapped_column(Date,
    nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10),
    nullable=True)  # "male" "female" "other"
    nationality: Mapped[str | None] = mapped_column(String(100),
    nullable=True)  # e.g. "American"

    # Preferences (optional)
    preferred_currency: Mapped[str | None] = mapped_column(String(10), nullable=True)  # e.g. "USD"

    # stores a JSON with people's preferred activites (useful later for itinerary matching)
    preferred_activities: Mapped[str | None] = mapped_column(JSON, nullable=True) 
    