[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/D8kToVOh)

# How to run

### Backend

```bash
cd backend
python -m venv benv
source benv/bin/activate
pip install -r requirements.txt
python run_https.py
```

The API will be available at https://localhost:8000.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The website will be available at https://localhost:5173.

Your browser will show a certificate warning because the certificate is self-signed. That is expected for local development.

# Deliverable features implemented

- Group flight search for a trip (extra feature not required for MVP)
- User registration and login with session management 
- Create a trip (name, destination, dates, arrival window) 
- Dashboard showing all trips a user belongs to 
- Generate a unique invite code per trip 
- Join a trip via the invite link 
- Basic database with all core tables and many-to-many relationships
- Basic flight search for a single departure airport and destination 


# Timeline

March 25 - Deadline for MVP
* User registration and login with session management
* Create a trip (name, destination, dates, arrival window) 
* Dashboard showing all trips a user belongs to 
* Generate a unique invite code per trip 
* Join a trip via the invite link 
* Basic database with all core tables and many-to-many relationships
* Basic flight search for a single departure airport and destination 


April 8 - Deadline for alpha version of app:
* Group flight search: individual results per traveler filtered by the shared arrival window
*Itinerary items organized into a day-by-day view
*Polished trip view integrating members, itinerary, and flight search in one page
*Input validation, error handling, and edge case coverage
UI/UX refinements across all flows

April 22 - Deadline for beta version of app

May 3 - Deadline for final version of app

# Third-party data and APIs

The app relies on a few external data sources beyond our own code:

- **Duffel Flights API** — all live flight offers (search, pricing, segments) come from [Duffel](https://duffel.com/). Test and live keys are read from `DUFFEL_TEST_KEY` / `DUFFEL_LIVE_KEY` in the backend env. Used in `backend/app/services/flight_search_services.py`.

- **Airport reference data** (`backend/app/data/airports.csv`) — the IATA/ICAO/name/city/country table that drives airport-code validation and the typeahead suggestions. The `Information` column points to [worlddata.info](https://www.worlddata.info/), which is the most likely origin of this dataset. Loaded by `backend/app/services/airport_registry.py`.

- **Curated airport coordinates** (`backend/app/services/airport_coords.py`) — a hand-curated lookup of (latitude, longitude) for ~80 major international hubs. Values are approximate (~0.01°) and were sourced from general public knowledge, not a single dataset. Used by the group-flight-search algorithm to compute origin-to-destination distance and pick how many days back to query Duffel for departures. Airports not in this table fall back to a safe default.

# How the airport (IATA) suggestions work

Anywhere you'd type an airport code in the app — your home airport on onboarding, the "From"/"To" boxes in the individual flight search, the destination box in the group search, and the per-member home airport overrides — there's a small typeahead that lets you type something like "madrid" or "new york" instead of having to know the IATA code off the top of your head. Pick something from the dropdown and it fills the input with the correct IATA (e.g. "Madrid" -> "MAD").

To get the suggestions, it calls a backend endpoint. `GET /api/airports/suggest?q=<text>&limit=8`. The workflow is:

1. The frontend has a shared component, `frontend/src/components/AirportInput.jsx`, used everywhere an airport code is needed. As you type, it waits ~180ms (debounce, so we don't fire a request on every keystroke) and then calls the backend.
2. The endpoint is `GET /api/airports/suggest?q=<your text>&limit=8`. It lives in `backend/app/routers/airports.py` and just delegates to the registry.
3. The backend (`backend/app/services/airport_registry.py`) scans the airports CSV (about 8,400 airports) and gives each one a score based on how well it matches what you typed. The scoring rules are:
    - exact IATA match (you typed "JFK"): highest score
    - exact ICAO match: very high
    - IATA starts with your text, exact city match, city starts with your text, airport name starts with, etc.: progressively lower
    - your text appears anywhere in the city / name / country: lowest non-zero
4. Major hubs get a **+25 score boost**. The list of "major hubs" is just whatever's in `airport_coords.py` (the ~80 hubs we use for distance calculations elsewhere). This is why typing "sydney" gives you SYD first instead of the small Bankstown airport, and "madrid" gives you MAD before some niche regional field.
5. The top-scoring 8 airports come back as JSON. The dropdown shows them as `IATA · City · Airport name · Country`. You arrow-key/click to pick, or just hit Enter on the highlighted one.
6. Accents are folded out before matching, so typing "cancun" still finds "Cancún International Airport". You don't have to type weird characters.

If you type something the backend doesn't recognize at all, the dropdown is empty and the form will throw a "not a recognized airport code" validation error on submit, the same as before.
