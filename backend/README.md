## How the requests are processed
When the frontend makes a request to the server, this is the journey it takes: 
1. HTTPS Request
2. FastAPI (main.py)
3. Router 
4. Services (main legwork)
5. Schema (to shape the response)
6. HTTPS Response


## Database Tables

1. User Table
| Field | Description |
|---|---|
| id (PK) | unique user id |
| 