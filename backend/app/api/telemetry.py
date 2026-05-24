from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from ..cognition import core_cognition_state
from ..database import SessionLocal, get_db
from ..models import Asset
from ..simulator import telemetry_payload
from ..websocket import manager


router = APIRouter(tags=["telemetry"])


@router.get("/telemetry/latest")
def latest_telemetry(db: Session = Depends(get_db)) -> list[dict]:
    timestamp = datetime.now(UTC)
    assets = db.query(Asset).order_by(Asset.id).all()
    return [telemetry_payload(asset, timestamp) for asset in assets]


@router.websocket("/ws/telemetry")
async def telemetry_websocket(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        await _send_current_snapshot(websocket)
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=1.0)
            except asyncio.TimeoutError:
                await _send_current_snapshot(websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)


async def _send_current_snapshot(websocket: WebSocket) -> None:
    timestamp = datetime.now(UTC)
    with SessionLocal() as db:
        assets = db.query(Asset).order_by(Asset.id).all()
        telemetry = [telemetry_payload(asset, timestamp) for asset in assets]
        cognition = core_cognition_state(db)

    await websocket.send_json({"type": "telemetry_snapshot", "payload": telemetry})
    await websocket.send_json(jsonable_encoder({"type": "cognition", "payload": cognition}))
