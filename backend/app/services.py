from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import Asset, Event, Mission, make_id


MIN_LATITUDE = -26.35
MAX_LATITUDE = -26.05
MIN_LONGITUDE = 27.85
MAX_LONGITUDE = 28.25


def in_operating_zone(latitude: float, longitude: float) -> bool:
    return MIN_LATITUDE <= latitude <= MAX_LATITUDE and MIN_LONGITUDE <= longitude <= MAX_LONGITUDE


def create_event(
    db: Session,
    event_type: str,
    severity: str,
    message: str,
    asset_id: str | None = None,
    mission_id: str | None = None,
) -> Event:
    event = Event(
        id=make_id("event"),
        event_type=event_type,
        severity=severity,
        asset_id=asset_id,
        mission_id=mission_id,
        message=message,
    )
    db.add(event)
    db.flush()
    from .cognition import record_operational_event

    record_operational_event(db, event)
    return event


def reject_action(
    db: Session,
    message: str,
    asset_id: str | None = None,
    mission_id: str | None = None,
    event_type: str = "action_rejected",
    status_code: int = 400,
) -> None:
    create_event(db, event_type, "warning", message, asset_id=asset_id, mission_id=mission_id)
    db.commit()
    raise HTTPException(status_code=status_code, detail=message)


def get_asset_or_404(db: Session, asset_id: str) -> Asset:
    asset = db.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


def get_mission_or_404(db: Session, mission_id: str) -> Mission:
    mission = db.get(Mission, mission_id)
    if mission is None:
        raise HTTPException(status_code=404, detail="Mission not found")
    return mission


def validate_mission_safety(db: Session, mission: Mission, action: str) -> Asset:
    if not in_operating_zone(mission.target_latitude, mission.target_longitude):
        reject_action(
            db,
            f"Mission {action} rejected: target coordinates are outside the Johannesburg operating zone.",
            asset_id=mission.assigned_asset_id,
            mission_id=mission.id,
            event_type="mission_rejected",
        )

    if not mission.assigned_asset_id:
        reject_action(
            db,
            f"Mission {action} rejected: no asset is assigned.",
            mission_id=mission.id,
            event_type="mission_rejected",
        )

    asset = db.get(Asset, mission.assigned_asset_id)
    if asset is None:
        reject_action(
            db,
            f"Mission {action} rejected: assigned asset does not exist.",
            asset_id=mission.assigned_asset_id,
            mission_id=mission.id,
            event_type="mission_rejected",
        )

    if asset.status == "offline":
        reject_action(
            db,
            f"Mission {action} rejected: asset {asset.id} is offline.",
            asset_id=asset.id,
            mission_id=mission.id,
            event_type="mission_rejected",
        )

    if asset.battery < 30:
        reject_action(
            db,
            f"Mission {action} rejected: asset {asset.id} battery is below 30%.",
            asset_id=asset.id,
            mission_id=mission.id,
            event_type="mission_rejected",
        )

    if asset.current_mission_id and asset.current_mission_id != mission.id:
        reject_action(
            db,
            f"Mission {action} rejected: asset {asset.id} is already assigned to another mission.",
            asset_id=asset.id,
            mission_id=mission.id,
            event_type="mission_rejected",
        )

    return asset
