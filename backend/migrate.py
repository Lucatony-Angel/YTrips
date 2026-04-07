"""
One-off migration: adds banner_color and banner_image_url columns to trips table.
Run once from the backend/ directory:
    python migrate.py
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in .env")

engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    conn.execute(text(
        "ALTER TABLE trips ADD COLUMN IF NOT EXISTS banner_color VARCHAR(7) NOT NULL DEFAULT '#2D3BE8'"
    ))
    conn.execute(text(
        "ALTER TABLE trips ADD COLUMN IF NOT EXISTS banner_image_url TEXT"
    ))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS itinerary_items (
            id SERIAL PRIMARY KEY,
            trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
            created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(150) NOT NULL,
            description TEXT NOT NULL,
            scheduled_at TIMESTAMP NOT NULL,
            location VARCHAR(150) NOT NULL,
            category VARCHAR(80) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """))
    conn.execute(text(
        "ALTER TABLE trip_members ADD COLUMN IF NOT EXISTS home_airport VARCHAR(10)"
    ))
    conn.execute(text("ALTER TABLE trips ADD COLUMN IF NOT EXISTS group_window_start VARCHAR(5)"))
    conn.execute(text("ALTER TABLE trips ADD COLUMN IF NOT EXISTS group_window_end VARCHAR(5)"))
    conn.execute(text("ALTER TABLE trips ADD COLUMN IF NOT EXISTS group_window_checked_at TIMESTAMP"))
    conn.execute(text("ALTER TABLE trips ADD COLUMN IF NOT EXISTS group_window_combined_price FLOAT"))
    conn.execute(text("ALTER TABLE trips ADD COLUMN IF NOT EXISTS group_window_currency VARCHAR(3)"))
