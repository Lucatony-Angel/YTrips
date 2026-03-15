from fastapi import FastAPI
from app.routers import health
from app.db.database import Base, engine
from app.models import User, Trip, TripMember, FlightSearch

app = FastAPI(title="My API")

app.include_router(health.router)

@app.get("/")
async def root():
    return {"message": "API is running"}

@app.on_event("startup") # on startup make the db if not already existed.
def on_startup():
    Base.metadata.create_all(bind=engine)