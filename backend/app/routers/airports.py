from fastapi import APIRouter, Query
from app.services.airport_registry import search_airports

router = APIRouter()


@router.get("/suggest")
def suggest_airports(
    q: str = Query(..., min_length=1, max_length=80),
    limit: int = Query(10, ge=1, le=25),
):
    return search_airports(q, limit)
