from fastapi import FastAPI
from app.routers import health, flights
from app.db.database import Base, engine
from fastapi.middleware.cors import CORSMiddleware               
# from app.models import User, Trip, TripMember, FlightSearch

from app.routers import trips

app = FastAPI(title="My API")
app.include_router(health.router)
app.include_router(flights.router, prefix="/api/flights", tags=["flights"])

# Rishi's Dashboard Creation
app.include_router(trips.router)

app.add_middleware(
    CORSMiddleware,                                              
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "API is running"}

@app.on_event("startup") # on startup make the db if not already existed.
def on_startup():
    Base.metadata.create_all(bind=engine)