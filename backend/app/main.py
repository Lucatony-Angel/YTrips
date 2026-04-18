from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.routers import health, flights, trips, auth
from app.db.database import Base, engine
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="YTrips API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO update for deployment
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = [
        {"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]}
        for e in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": "Validation error", "errors": errors})

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

@app.exception_handler(Exception)
async def unhandled_excpeption_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "An enexpected error occurred"})

app.include_router(health.router)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(trips.router, prefix="/api/trips", tags=["trips"])
app.include_router(flights.router, prefix="/api/flights", tags=["flights"])

@app.get("/")
async def root():
    return {"message": "API is running"}

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
