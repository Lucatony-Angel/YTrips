from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.trip import Trip
from app.models.trip_member import TripMember
from app.models.flight import Flight
from app.schemas.trip import TripCreate, TripBannerUpdate, TripResponse, TripMemberResponse, GroupWindowSave
from app.schemas.flight import FlightResponse
from app.schemas.itinerary import ItineraryItemCreate, ItineraryItemUpdate, ItineraryItemResponse
from app.models.itinerary_item import ItineraryItem
from app.services.trip_services import create_trip, get_user_trips
from app.services.flight_search_services import find_group_windows
from app.schemas.flight_search import GroupWindow

router = APIRouter()


@router.post("/", response_model=TripResponse)
def create_trip_endpoint(
    trip: TripCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_trip(db, trip, current_user.id)


@router.get("/my-trips", response_model=list[TripResponse])
def get_my_trips(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trips = get_user_trips(db, current_user.id)
    counts = dict(
        db.query(TripMember.trip_id, func.count(TripMember.id))
        .filter(TripMember.trip_id.in_([t.id for t in trips]))
        .group_by(TripMember.trip_id)
        .all()
    )
    results = []
    for trip in trips:
        r = TripResponse.model_validate(trip)
        r.member_count = counts.get(trip.id, 0)
        results.append(r)
    return results


@router.get("/{trip_id}", response_model=TripResponse)
def get_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = (
        db.query(Trip)
        .join(TripMember, Trip.id == TripMember.trip_id)
        .filter(Trip.id == trip_id, TripMember.user_id == current_user.id)
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.get("/{trip_id}/members", response_model=list[TripMemberResponse])
def get_trip_members(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = db.query(TripMember).filter(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this trip")

    rows = (
        db.query(TripMember, User)
        .join(User, TripMember.user_id == User.id)
        .filter(TripMember.trip_id == trip_id)
        .all()
    )
    return [
        TripMemberResponse(
            user_id=u.id,
            display_name=u.display_name,
            avatar_url=u.avatar_url,
            role=tm.role,
            home_airport=tm.home_airport or u.home_airport,
        )
        for tm, u in rows
    ]


@router.get("/{trip_id}/flights", response_model=list[FlightResponse])
def get_trip_flights(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = db.query(TripMember).filter(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this trip")

    return db.query(Flight).filter(Flight.trip_id == trip_id).all()


@router.delete("/{trip_id}/flights/{flight_id}")
def delete_trip_flight(
    trip_id: int,
    flight_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flight = db.query(Flight).filter(
        Flight.id == flight_id,
        Flight.trip_id == trip_id
    ).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    if flight.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own flights")
    db.delete(flight)
    db.commit()
    return {"message": "Flight deleted"}


@router.patch("/{trip_id}/banner", response_model=TripResponse)
def update_trip_banner(
    trip_id: int,
    body: TripBannerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = (
        db.query(Trip)
        .join(TripMember, Trip.id == TripMember.trip_id)
        .filter(Trip.id == trip_id, TripMember.user_id == current_user.id)
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if body.banner_color is not None:
        trip.banner_color = body.banner_color
    if body.banner_image_url is not None or "banner_image_url" in body.model_fields_set:
        trip.banner_image_url = body.banner_image_url

    db.commit()
    db.refresh(trip)
    return trip


@router.delete("/{trip_id}")
def delete_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = db.query(Trip).filter(
        Trip.id == trip_id,
        Trip.created_by_user_id == current_user.id
    ).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found or you are not the owner")

    db.query(Flight).filter(Flight.trip_id == trip_id).delete()
    db.query(TripMember).filter(TripMember.trip_id == trip_id).delete()
    db.delete(trip)
    db.commit()

    return {"message": "Trip deleted"}


@router.post("/join/{invite_code}")
def join_trip(
    invite_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = db.query(Trip).filter(Trip.invite_code == invite_code).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    existing = db.query(TripMember).filter(
        TripMember.trip_id == trip.id,
        TripMember.user_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already a member")

    new_member = TripMember(trip_id=trip.id, user_id=current_user.id)
    db.add(new_member)
    db.commit()

    return {"message": "Joined successfully"}


# -------- ITINERARY ROUTES --------

@router.get("/{trip_id}/itinerary", response_model=list[ItineraryItemResponse])
def get_trip_itinerary(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = db.query(TripMember).filter(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this trip")

    return db.query(ItineraryItem)\
        .filter(ItineraryItem.trip_id == trip_id)\
        .order_by(ItineraryItem.scheduled_at)\
        .all()


@router.post("/{trip_id}/itinerary", response_model=ItineraryItemResponse)
def create_itinerary_item(
    trip_id: int,
    body: ItineraryItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = db.query(TripMember).filter(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this trip")

    item = ItineraryItem(
        trip_id=trip_id,
        created_by_user_id=current_user.id,
        **body.model_dump()
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return item


@router.put("/{trip_id}/itinerary/{item_id}", response_model=ItineraryItemResponse)
def update_itinerary_item(
    trip_id: int,
    item_id: int,
    body: ItineraryItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(ItineraryItem).filter(
        ItineraryItem.id == item_id,
        ItineraryItem.trip_id == trip_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.created_by_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your item")

    for field, value in body.model_dump().items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)

    return item


@router.delete("/{trip_id}/itinerary/{item_id}")
def delete_itinerary_item(
    trip_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(ItineraryItem).filter(
        ItineraryItem.id == item_id,
        ItineraryItem.trip_id == trip_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.created_by_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your item")

    db.delete(item)
    db.commit()

    return {"message": "Deleted"}


# -------- GROUP FLIGHT SEARCH --------

@router.patch("/{trip_id}/members/me/home-airport")
def set_my_home_airport(
    trip_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = db.query(TripMember).filter(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this trip")

    airport = body.get("home_airport", "").strip().upper()
    if not airport:
        raise HTTPException(status_code=422, detail="home_airport is required")

    member.home_airport = airport
    db.commit()
    return {"home_airport": member.home_airport}


@router.get("/{trip_id}/group-search", response_model=list[GroupWindow])
def group_search_for_trip(
    trip_id: int,
    departure_date: str,
    destination_iata: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = (
        db.query(Trip)
        .join(TripMember, Trip.id == TripMember.trip_id)
        .filter(Trip.id == trip_id, TripMember.user_id == current_user.id)
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    rows = (
        db.query(TripMember, User)
        .join(User, TripMember.user_id == User.id)
        .filter(TripMember.trip_id == trip_id)
        .all()
    )

    origins = list({
        tm.home_airport or u.home_airport
        for tm, u in rows
        if (tm.home_airport or u.home_airport)
    })

    if not origins:
        raise HTTPException(status_code=400, detail="No members have a home airport set")

    return find_group_windows(origins, destination_iata.upper(), departure_date)


@router.patch("/{trip_id}/group-window", response_model=TripResponse)
def save_group_window(
    trip_id: int,
    body: GroupWindowSave,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = (
        db.query(Trip)
        .join(TripMember, Trip.id == TripMember.trip_id)
        .filter(Trip.id == trip_id, TripMember.user_id == current_user.id)
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    trip.group_window_start = body.window_start
    trip.group_window_end = body.window_end
    trip.group_window_combined_price = body.total_cheapest_combined
    trip.group_window_currency = body.currency
    trip.group_window_checked_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(trip)
    return trip