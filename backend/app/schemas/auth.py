from pydantic import BaseModel, field_validator
from app.services.airport_registry import is_valid_airport_code

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
        if not is_valid_airport_code(code):
            raise ValueError(f"'{code}' is not a recognized airport code")
        return code
