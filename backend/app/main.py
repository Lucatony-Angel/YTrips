from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import health, flights, trips, auth
from app.db.database import Base, engine
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="YTrips API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO update for deployment
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(trips.router, prefix="/api/trips", tags=["trips"])
app.include_router(flights.router, prefix="/api/flights", tags=["flights"])

@app.get("/")
async def root():
    return {"message": "API is running"}

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
