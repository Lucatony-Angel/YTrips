from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.trip import TripCreate, TripResponse
from app.services.trip_services import create_trip, get_user_trips

router = APIRouter(prefix="/trips", tags=["Trips"])


@router.post("/", response_model=TripResponse)
def create_trip_endpoint(
    trip: TripCreate,
    db: Session = Depends(get_db)
):
    user_id = 1
    return create_trip(db, trip, user_id)


@router.get("/my-trips", response_model=list[TripResponse])
def get_my_trips(
    db: Session = Depends(get_db)
):
    user_id = 1
    return get_user_trips(db, user_id)