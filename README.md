[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/D8kToVOh)

# How to run the app

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

# Navigating the app

Here's the general flow from the moment you open it for the first time:

**1. Login page (`/login`)**
The landing page. Hit "Get Started Free" or "Sign in with Google" — both do the same thing and kick off the Google OAuth flow. You'll be redirected to Google to pick your account, then bounced back to the app automatically.

**2. Onboarding (`/onboarding`)**
First-time users land here after signing in. You just set your home airport (the city you usually fly out of). Type a city name or IATA code into the typeahead, pick from the dropdown, and hit Continue. You only see this page once — returning users skip straight to the dashboard.

**3. Dashboard (`/`)**
Your home base. Shows a card for every trip you're part of, with the destination, dates, member count, and invite code. From here you can:
- Click **+ New Trip** to create a trip
- Click **Join Trip** in the navbar to join someone else's trip with an invite code
- Click any trip card to open that trip

**4. Create Trip (`/trips/new`)**
Fill in the trip name, destination, start/end dates, and an optional arrival window (the time range you want everyone to land within). You can also pick a banner color here. Hit Create and you're the owner.

**5. Join Trip (`/join`)**
Paste in the invite code a trip owner shared with you. If the code is valid and you're not already a member, you're in and immediately redirected to that trip's page. Invite links from the dashboard copy the code directly to your clipboard.

**6. Trip page (`/trips/:id`)**
The main event. Everything about a single trip lives here, split across four tabs:

- **My Flight** — shows your saved flights and a flight search box. Search by origin, destination, and date, then click "Add to Trip" on any result to save it. There's also a "Direct flights only" toggle and pagination if there are a lot of results. You can delete flights you've added.

- **Group Flights** — the coordinated arrival search. Each member is listed with their home airport (you can override it for this search only). Check the members you want to include, pick an arrival date and destination, and hit "Run group search." It comes back with ranked time windows where everyone has a flight, sorted by cheapest combined price and tightest arrival spread. Click "Assign flights" on a window to save the best offer for each member in one go.

- **Itinerary** — a day-by-day plan. Add items with a title, description, date/time, location, and category. Everyone on the trip can vote yes/no on each item. If two items are scheduled at the same time and all members have voted, the one with more yes votes wins and the other is automatically removed. The owner can finalize the trip, which locks the itinerary.

- **Members** — lists everyone on the trip with their role and home airport.

**7. Finalizing and exporting**
Once the owner clicks **Finalize** in the trip banner, the itinerary is locked (only the owner can make changes). An **Export PDF** button appears — clicking it generates a two-page PDF in the browser: page 1 is the itinerary, page 2 is a flight cost summary. The owner can also Unlock the trip if plans change.

# Deliverable features implemented

- Group flight search for a trip (extra feature not required for MVP)
- User registration and login with session management 
- Create a trip (name, destination, dates, arrival window) 
- Dashboard showing all trips a user belongs to 
- Generate a unique invite code per trip 
- Join a trip via the invite link 
- Basic database with all core tables and many-to-many relationships
- Basic flight search for a single departure airport and destination 


# Timeline (and our expectations for each)

March 25 - Deadline for MVP
* User registration and login with session management
* Create a trip (name, destination, dates, arrival window) 
* Dashboard showing all trips a user belongs to 
* Generate a unique invite code per trip 
* Join a trip via the invite link 
* Basic database with all core tables and many-to-many relationships
* Basic flight search for a single departure airport and destination 


April 8 - Deadline for alpha version of app:
* Member list view within a trip + frontend improvements
* Per-member departure airport entry
* Add, edit, and remove itinerary items (title, description, date/time, location, category)
* Upvote/downvote on itinerary items with a vote tally display

April 22 - Deadline for beta version of app
* Group flight search: individual results per traveler filtered by the shared arrival window
* Itinerary items organized into a day-by-day view
* Polished trip view integrating members, itinerary, and flight search in one page
* Input validation, error handling, and edge case coverage - Luca
* UI/UX refinements across all flows

May 3 - Deadline for final version of app
* All Features in the MVP + Alpha + Beta Feature Lists
* Final UI polish
* Thorough bug check
* Demo-ready presentation of full user flow

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

# How the PDF export works

When a trip is finalized, an **Export PDF** button appears in the trip banner. Clicking it generates and downloads a PDF entirely in the browser — no server involved — using [jsPDF](https://github.com/parallax/jsPDF).

The export is built by `buildPDFDoc()` in `frontend/src/pages/TripPage.jsx`. It produces a two-page document:

**Page 1 — Trip Itinerary**
1. A full-width color header (using the trip's banner color, or the banner image if one is set) with the trip name, destination, dates, and member count.
2. A **Members** section listing everyone on the trip.
3. A **Flights** section listing each member's saved flight — airline, flight number, route, and departure/arrival times.
4. An **Itinerary** section with approved items (score >= 0) grouped by day. Each item shows its time, title, category, location, description summary, and yes/no vote tallies.

**Page 2 — Flight Cost Summary**
Lists every saved flight with the member's name, airline, flight number, and route on the left, and the price on the right with a dotted leader line between them. Flights are grouped by currency so the per-currency total is always meaningful (summing USD and GBP would be nonsensical). Flights added before cost tracking was introduced show a `—` in a separate "No price recorded" section. A bold **Total** line closes each currency group.

A footer with the trip name and page number is stamped on every page after the document is fully assembled.

One gotcha worth knowing: jsPDF's built-in Helvetica font only covers basic ASCII. Any Unicode character outside that range (like `≥`) renders as garbage, so the code uses plain ASCII equivalents (`>=`) wherever it needs to render text in the PDF.
