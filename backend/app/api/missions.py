from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

from fastapi import APIRouter, Depends, status
from sqlalchemy import asc
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Asset, Mission, MissionWaypoint, TelemetryRecord, make_id
from ..schemas import MissionCreate, MissionOut, MissionReplayOut, MissionUpdate, MissionWaypointCreate, MissionWaypointOut, TelemetryOut
from ..cognition import create_mission_dependencies, deactivate_mission_dependencies
from ..services import (
    create_event,
    get_mission_or_404,
    in_operating_zone,
    reject_action,
    validate_mission_safety,
)


router = APIRouter(prefix="/missions", tags=["missions"])


@router.get("", response_model=list[MissionOut])
def list_missions(db: Session = Depends(get_db)) -> list[Mission]:
    return db.query(Mission).order_by(Mission.created_at.desc()).all()


@router.get("/{mission_id}", response_model=MissionOut)
def get_mission(mission_id: str, db: Session = Depends(get_db)) -> Mission:
    return get_mission_or_404(db, mission_id)


@router.post("", response_model=MissionOut, status_code=status.HTTP_201_CREATED)
def create_mission(payload: MissionCreate, db: Session = Depends(get_db)) -> Mission:
    if not in_operating_zone(payload.target_latitude, payload.target_longitude):
        reject_action(
            db,
            "Mission creation rejected: target coordinates are outside the Johannesburg operating zone.",
            asset_id=payload.assigned_asset_id,
            event_type="mission_rejected",
        )

    mission = Mission(id=payload.id or make_id("mission"), status="pending", **payload.model_dump(exclude={"id"}))
    validate_mission_safety(db, mission, "creation")

    db.add(mission)
    create_event(
        db,
        "mission_created",
        "info",
        f"Mission {mission.name} created and awaiting approval.",
        asset_id=mission.assigned_asset_id,
        mission_id=mission.id,
    )
    db.commit()
    db.refresh(mission)
    return mission


@router.patch("/{mission_id}", response_model=MissionOut)
def update_mission(mission_id: str, payload: MissionUpdate, db: Session = Depends(get_db)) -> Mission:
    mission = get_mission_or_404(db, mission_id)
    updates = payload.model_dump(exclude_unset=True)
    draft = SimpleNamespace(
        id=mission.id,
        assigned_asset_id=updates.get("assigned_asset_id", mission.assigned_asset_id),
        target_latitude=updates.get("target_latitude", mission.target_latitude),
        target_longitude=updates.get("target_longitude", mission.target_longitude),
    )

    if not in_operating_zone(draft.target_latitude, draft.target_longitude):
        reject_action(
            db,
            "Mission update rejected: target coordinates are outside the Johannesburg operating zone.",
            asset_id=draft.assigned_asset_id,
            mission_id=mission.id,
            event_type="mission_rejected",
        )

    if draft.assigned_asset_id:
        validate_mission_safety(db, draft, "update")

    for field, value in updates.items():
        setattr(mission, field, value)

    db.commit()
    db.refresh(mission)
    return mission


@router.get("/{mission_id}/waypoints", response_model=list[MissionWaypointOut])
def list_waypoints(mission_id: str, db: Session = Depends(get_db)) -> list[MissionWaypoint]:
    get_mission_or_404(db, mission_id)
    return (
        db.query(MissionWaypoint)
        .filter(MissionWaypoint.mission_id == mission_id)
        .order_by(asc(MissionWaypoint.sequence), asc(MissionWaypoint.created_at))
        .all()
    )


@router.post("/{mission_id}/waypoints", response_model=MissionWaypointOut, status_code=status.HTTP_201_CREATED)
def create_waypoint(mission_id: str, payload: MissionWaypointCreate, db: Session = Depends(get_db)) -> MissionWaypoint:
    mission = get_mission_or_404(db, mission_id)
    if mission.status not in {"pending", "approved"}:
        reject_action(
            db,
            f"Waypoint creation rejected: mission is {mission.status}, not pending or approved.",
            asset_id=mission.assigned_asset_id,
            mission_id=mission.id,
            event_type="waypoint_rejected",
        )

    if not in_operating_zone(payload.latitude, payload.longitude):
        reject_action(
            db,
            "Waypoint creation rejected: target coordinates are outside the Johannesburg operating zone.",
            asset_id=mission.assigned_asset_id,
            mission_id=mission.id,
            event_type="waypoint_rejected",
        )

    last_sequence = (
        db.query(MissionWaypoint.sequence)
        .filter(MissionWaypoint.mission_id == mission_id)
        .order_by(MissionWaypoint.sequence.desc())
        .first()
    )
    sequence = (last_sequence[0] if last_sequence else 0) + 1
    waypoint = MissionWaypoint(
        id=make_id("waypoint"),
        mission_id=mission.id,
        sequence=sequence,
        label=payload.label,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    db.add(waypoint)
    create_event(
        db,
        "waypoint_created",
        "info",
        f"Waypoint {waypoint.label} added to mission {mission.name}.",
        asset_id=mission.assigned_asset_id,
        mission_id=mission.id,
    )
    db.commit()
    db.refresh(waypoint)
    return waypoint


@router.post("/{mission_id}/approve", response_model=MissionOut)
def approve_mission(mission_id: str, db: Session = Depends(get_db)) -> Mission:
    mission = get_mission_or_404(db, mission_id)
    if mission.status != "pending":
        reject_action(
            db,
            f"Mission approval rejected: mission is {mission.status}, not pending.",
            asset_id=mission.assigned_asset_id,
            mission_id=mission.id,
            event_type="mission_rejected",
        )

    asset = validate_mission_safety(db, mission, "approval")
    mission.status = "approved"
    create_event(
        db,
        "mission_approved",
        "info",
        f"Mission {mission.name} approved for {asset.name}.",
        asset_id=asset.id,
        mission_id=mission.id,
    )
    db.commit()
    db.refresh(mission)
    return mission


@router.post("/{mission_id}/start", response_model=MissionOut)
def start_mission(mission_id: str, db: Session = Depends(get_db)) -> Mission:
    mission = get_mission_or_404(db, mission_id)
    if mission.status != "approved":
        reject_action(
            db,
            f"Mission start rejected: mission is {mission.status}, not approved.",
            asset_id=mission.assigned_asset_id,
            mission_id=mission.id,
            event_type="mission_rejected",
        )

    asset = validate_mission_safety(db, mission, "start")
    now = datetime.now(UTC)
    mission.status = "running"
    mission.started_at = now
    mission.start_latitude = asset.latitude
    mission.start_longitude = asset.longitude
    asset.status = "mission"
    asset.current_mission_id = mission.id
    asset.speed = 8
    create_mission_dependencies(db, mission, asset)
    create_event(
        db,
        "mission_started",
        "info",
        f"Mission {mission.name} started with {asset.name}.",
        asset_id=asset.id,
        mission_id=mission.id,
    )
    db.commit()
    db.refresh(mission)
    return mission


@router.post("/{mission_id}/abort", response_model=MissionOut)
def abort_mission(mission_id: str, db: Session = Depends(get_db)) -> Mission:
    mission = get_mission_or_404(db, mission_id)
    asset = None
    if mission.assigned_asset_id:
        asset = db.get(Asset, mission.assigned_asset_id)

    mission.status = "aborted"
    mission.completed_at = datetime.now(UTC)
    if asset is not None:
        asset.status = "idle"
        asset.current_mission_id = None
        asset.speed = 0

    deactivate_mission_dependencies(db, mission.id)
    create_event(
        db,
        "mission_aborted",
        "warning",
        f"Mission {mission.name} aborted by operator.",
        asset_id=asset.id if asset else mission.assigned_asset_id,
        mission_id=mission.id,
    )
    db.commit()
    db.refresh(mission)
    return mission


@router.get("/{mission_id}/telemetry", response_model=list[TelemetryOut])
def mission_telemetry(mission_id: str, db: Session = Depends(get_db)) -> list[TelemetryRecord]:
    get_mission_or_404(db, mission_id)
    return (
        db.query(TelemetryRecord)
        .filter(TelemetryRecord.mission_id == mission_id)
        .order_by(asc(TelemetryRecord.timestamp), asc(TelemetryRecord.id))
        .all()
    )


@router.get("/{mission_id}/replay", response_model=MissionReplayOut)
def mission_replay(mission_id: str, db: Session = Depends(get_db)) -> dict:
    mission = get_mission_or_404(db, mission_id)
    points = (
        db.query(TelemetryRecord)
        .filter(TelemetryRecord.mission_id == mission_id)
        .order_by(asc(TelemetryRecord.timestamp), asc(TelemetryRecord.id))
        .all()
    )
    return {
        "mission_id": mission.id,
        "asset_id": mission.assigned_asset_id,
        "point_count": len(points),
        "points": points,
    }
