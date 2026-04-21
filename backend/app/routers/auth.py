import urllib.parse
import httpx
from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from app.auth import (
    FRONTEND_URL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    create_access_token,
    get_current_user,
)
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import HomeAirportUpdate, UserRead

router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/google")
async def login():
    # google oauth redirect
    params = urllib.parse.urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    })
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{params}")


@router.get("/google/callback")
async def callback(code: str = Query(None), db: Session = Depends(get_db)):
    if not code:
        return RedirectResponse("/api/auth/google")
    # google sends user back here with a code, we swap it for tokens
    try:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            })
            token_data = token_resp.json()
            access_token_google = token_data.get("access_token")
            if not access_token_google:
                return RedirectResponse(f"{FRONTEND_URL}/login?error=auth_failed")

            userinfo_resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token_google}"},
            )
            userinfo = userinfo_resp.json()
    except Exception:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=auth_failed")

    google_id = userinfo.get("sub")
    if not google_id:
        return RedirectResponse(f"{FRONTEND_URL}/login?error=auth_failed")
    user = db.query(User).filter(User.google_id == google_id).first()
    is_new = user is None

    if is_new:
        user = User(
            google_id=google_id,
            email=userinfo.get("email", ""),
            display_name=userinfo.get("name", ""),
            avatar_url=userinfo.get("picture"),
        )
        db.add(user)
    else:
        user.avatar_url = userinfo.get("picture")
    db.commit()
    db.refresh(user)

    access_token = create_access_token(user.id)

    redirect_url = f"{FRONTEND_URL}/auth/callback?token={access_token}"
    if is_new:
        redirect_url += "&is_new=true"
    return RedirectResponse(redirect_url)


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me/home-airport", response_model=UserRead)
async def update_home_airport(
    body: HomeAirportUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.home_airport = body.home_airport
    db.commit()
    db.refresh(current_user)
    return current_user
