from fastapi import FastAPI
from app.routers import health, flights, auth
from app.db.database import Base, engine
from fastapi.middleware.cors import CORSMiddleware
# from app.models import User, Trip, TripMember, FlightSearch

app = FastAPI(title="My API")
app.include_router(health.router)
app.include_router(flights.router, prefix="/api/flights", tags=["flights"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

app.add_middleware(
    CORSMiddleware,                                              
    allow_origins=["*"], # TODO need to update this to the frontend url
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "API is running"}

@app.on_event("startup") # on startup make the db if not already existed.
def on_startup():
    Base.metadata.create_all(bind=engine)