import csv
import unicodedata
from pathlib import Path

from app.services.airport_coords import _COORDS as _MAJOR_HUB_COORDS

_DATA_FILE = Path(__file__).parent.parent / "data" / "airports.csv"

_by_iata: dict[str, dict] = {}
_by_icao: dict[str, dict] = {}
_MAJOR_HUBS: set[str] = set(_MAJOR_HUB_COORDS.keys())

def _load():
    with open(_DATA_FILE, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            iata = row["IATA"].strip().upper()
            icao = row["ICAO"].strip().upper()
            if iata:
                _by_iata[iata] = row
            if icao:
                _by_icao[icao] = row

_load()

def is_valid_airport_code(code: str) -> bool:
    normalized = code.strip().upper()
    return normalized in _by_iata or normalized in _by_icao

def lookup_airport(code: str) -> dict | None:
    normalized = code.strip().upper()

    return _by_iata.get(normalized) or _by_icao.get(normalized)


def _slim(row: dict) -> dict:
    return {
        "iata": row.get("IATA", "").strip().upper(),
        "icao": (row.get("ICAO") or "").strip().upper() or None,
        "name": row.get("Airport name", "").strip(),
        "city": row.get("City", "").strip(),
        "country": row.get("Country", "").strip(),
    }


def _fold(s: str) -> str:
    """Lowercase + strip diacritics so 'Cancún' matches 'cancun'."""
    nfd = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in nfd if not unicodedata.combining(c)).lower().strip()


def _match_score(q: str, row: dict) -> int:
    """Higher = better match. 0 means skip. Both q and row fields are accent-folded."""
    iata = _fold(row.get("IATA", ""))
    icao = _fold(row.get("ICAO") or "")
    city = _fold(row.get("City", ""))
    name = _fold(row.get("Airport name", ""))
    country = _fold(row.get("Country", ""))

    if iata == q:        score = 100
    elif icao == q:      score = 90
    elif iata.startswith(q): score = 80
    elif city == q:      score = 75
    elif city.startswith(q): score = 60
    elif name.startswith(q): score = 50
    elif q in city:      score = 40
    elif q in name:      score = 30
    elif q in country:   score = 10
    else: return 0

    # Strong curated-hub bias — a partial city match on a major hub should
    # outrank an exact match on an obscure regional field of the same name.
    if iata.upper() in _MAJOR_HUBS:
        score += 25
    return score


def search_airports(query: str, limit: int = 10) -> list[dict]:
    q = _fold(query)
    if not q:
        return []

    scored: list[tuple[int, str, dict]] = []
    for iata, row in _by_iata.items():
        score = _match_score(q, row)
        if score > 0:
            scored.append((score, iata, row))

    # Tiebreak alphabetically by IATA so results are stable.
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [_slim(r) for _, _, r in scored[:limit]]