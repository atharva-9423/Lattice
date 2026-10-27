from contextlib import asynccontextmanager
from fastapi import FastAPI
from .db import Base, engine, SessionLocal
from .seed import seed_database
from .routers import auth, overview, complaints, institutions, alerts


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db, reset=False)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Lattice — AICTE Complaint Intelligence API",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(auth.router, prefix="/api")
app.include_router(overview.router, prefix="/api")
app.include_router(complaints.router, prefix="/api")
app.include_router(institutions.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
