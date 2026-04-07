from datetime import date, datetime, timezone
import uuid

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base

class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    destination_name: Mapped[str] = mapped_column(String(150), nullable=False)

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    arrival_window_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    arrival_window_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    invite_code: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()), index=True)

    banner_color: Mapped[str] = mapped_column(String(7), nullable=False, default="#2D3BE8", server_default="#2D3BE8")
    banner_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    group_window_start: Mapped[str | None] = mapped_column(String(5), nullable=True)
    group_window_end: Mapped[str | None] = mapped_column(String(5), nullable=True)
    group_window_checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    group_window_combined_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    group_window_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
