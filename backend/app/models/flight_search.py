from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base

class FlightSearch(Base):
    __tablename__ = "flight_searches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True,index=True)

    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    origin: Mapped[str] = mapped_column(String(10), nullable=False)
    destination: Mapped[str] = mapped_column(String(10), nullable=False)
    airline: Mapped[str] = mapped_column(String(100), nullable=True)
    flight_number: Mapped[str] = mapped_column(String(20), nullable=True)

    departure_at: Mapped[datetime] = mapped_column(DateTime,nullable=False)
    arrival_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    total_amount: Mapped[str] = mapped_column(String(20), nullable=False)
    total_currency: Mapped[str] = mapped_column(String(10), nullable=False)

    selected_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)