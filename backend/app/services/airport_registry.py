import csv
from pathlib import Path

_DATA_FILE = Path(__file__).parent.parent / "data" / "airports.csv"

_by_iata: dict[str, dict] = {}
_by_icao: dict[str, dict] = {}

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