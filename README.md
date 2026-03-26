[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/D8kToVOh)

# How to run

### Backend

```bash
cd backend
python -m venv benv
source benv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The website will be available at http://localhost:5173.

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


April 8 - Deadline for alpha version of app

April 22 - Deadline for beta version of app

May 3 - Deadline for final version of app
