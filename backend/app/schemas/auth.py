from pydantic import BaseModel


class UserRead(BaseModel):
    id: int
    email: str
    display_name: str
    avatar_url: str | None = None
    home_airport: str | None = None

    model_config = {"from_attributes": True}


class HomeAirportUpdate(BaseModel):
    home_airport: str
