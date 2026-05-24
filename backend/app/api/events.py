from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Event
from ..schemas import EventAcknowledge, EventOut


router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[EventOut])
def list_events(
    asset_id: str | None = None,
    mission_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[Event]:
    query = db.query(Event)
    if asset_id:
        query = query.filter(Event.asset_id == asset_id)
    if mission_id:
        query = query.filter(Event.mission_id == mission_id)
    return query.order_by(Event.timestamp.desc()).limit(limit).all()


@router.post("/{event_id}/acknowledge", response_model=EventOut)
def acknowledge_event(event_id: str, payload: EventAcknowledge, db: Session = Depends(get_db)) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Event not found")

    event.acknowledged = True
    event.acknowledged_at = datetime.now(UTC)
    event.acknowledged_by = payload.acknowledged_by
    db.commit()
    db.refresh(event)
    return event
