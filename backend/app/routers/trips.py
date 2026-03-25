from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.trip import Trip
from app.models.trip_member import TripMember
from app.schemas.trips import TripCreate

router = APIRouter()

@router.post("/")
def create_trip(trip_data: TripCreate,db: Session = Depends(get_db)):
    new_trip = Trip(name = trip_data.name, destination_name = trip_data.destination_name, start_date = trip_data.start_date, end_date = trip_data.end_date, created_by_user_id = trip_data.created_by_user_id)

    db.add(new_trip)
    db.commit()
    db.refresh(new_trip)

    return new_trip

@router.post("/join/{invite_code}")
def join_trip(invite_code: str, user_id: int, db: Session = Depends(get_db)):
    #look up trip by invite code
    trip = db.query(Trip).filter(Trip.invite_code == invite_code).first()
    #check if user is already a member - 400 if not found
    if not trip:
        raise HTTPException(status_code = 404, detail = "Invalid invite code")

    existing = db.query(TripMember).filter(TripMember.trip_id == trip.id, TripMember.user_id == user_id).first()
    if existing:
        raise HTTPException(status_code = 400, detail = "Already a member")
    #create a new TripMember row linkingthis user to the trip
    new_member = TripMember(trip_id = trip.id, user_id = user_id)
    #db.add(member), db.commit()
    db.add(new_member)
    db.commit()
    #return success
    return {"message": "joined successfully"}

