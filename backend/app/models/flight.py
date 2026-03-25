from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Flight(Base):
    __tablename__ = "flights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    airline: Mapped[str] = mapped_column(String(100), nullable=False)
    flight_number: Mapped[str] = mapped_column(String(50), nullable=False)

    departure_airport: Mapped[str] = mapped_column(String(10), nullable=False)
    arrival_airport: Mapped[str] = mapped_column(String(10), nullable=False)

    departure_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    arrival_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)