from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import ai, assets, cognition, events, missions, orchestration, telemetry
from .database import SessionLocal, init_db
from .seed import seed_data
from .simulator import TelemetrySimulator
from .websocket import manager


simulator = TelemetrySimulator(manager)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with SessionLocal() as db:
        seed_data(db)

    if os.getenv("STRATOSYN_DISABLE_SIMULATOR") != "1":
        simulator.start()

    yield

    if os.getenv("STRATOSYN_DISABLE_SIMULATOR") != "1":
        await simulator.stop()


app = FastAPI(title="Stratosyn MVP API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "stratosyn-mvp"}


app.include_router(assets.router)
app.include_router(missions.router)
app.include_router(events.router)
app.include_router(ai.router)
app.include_router(telemetry.router)
app.include_router(cognition.router)
app.include_router(orchestration.router)
