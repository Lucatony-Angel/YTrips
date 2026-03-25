from pydantic import BaseModel
from datetime import date

class TripCreate(BaseModel):
    name: str
    destination_name: str
    start_date: date
    end_date: date
    created_by_user_id: int 