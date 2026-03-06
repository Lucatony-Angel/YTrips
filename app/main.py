from fastapi import FastAPI
from app.routers import health

app = FastAPI(title="My API")

app.include_router(health.router)

@app.get("/")
async def root():
    return {"message": "API is running"}