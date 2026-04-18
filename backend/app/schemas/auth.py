from pydantic import BaseModel, field_validator
import re

class UserRead(BaseModel):
    id: int
    email: str
    display_name: str
    avatar_url: str | None = None
    home_airport: str | None = None

    model_config = {"from_attributes": True}


class HomeAirportUpdate(BaseModel):
    home_airport: str

    @field_validator("home_airport")
    @classmethod
    def validate_airport_code(cls, v: str) -> str:
        code = v.strip().upper()
        if not re.match(r"^[A-Z]{3,4}$", code):
            raise ValueError("must be a 3 or 4 letter iATA/ICAO airport code")
        return code
