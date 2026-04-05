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
    print("Migration complete: banner_color and banner_image_url added to trips.")
