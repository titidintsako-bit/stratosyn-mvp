from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from ..cognition import build_replay_path_from_records, core_cognition_state, evaluate_cognition_cycle, telemetry_trails
from ..database import get_db
from ..models import AnomalyCluster, MissionDependency, ReplayPath, RerouteSuggestion
from ..schemas import (
    AnomalyClusterOut,
    CoreCognitionStateOut,
    MissionDependencyOut,
    OperationalStateOut,
    ReplayPathOut,
    RerouteSuggestionOut,
    TelemetryTrailOut,
)
from ..services import get_mission_or_404


router = APIRouter(prefix="/cognition", tags=["cognition"])


@router.get("/operational-state", response_model=OperationalStateOut)
def operational_state(db: Session = Depends(get_db)) -> dict:
    return {
        "telemetry_trails": telemetry_trails(db),
        "anomaly_clusters": _anomaly_clusters(db),
        "mission_dependencies": _mission_dependencies(db),
        "reroute_suggestions": _reroute_suggestions(db),
        "replay_paths": _replay_paths(db),
    }


@router.get("/core-state", response_model=CoreCognitionStateOut)
def core_state(db: Session = Depends(get_db)) -> dict:
    state = evaluate_cognition_cycle(db)
    db.commit()
    return state


@router.get("/telemetry-trails", response_model=list[TelemetryTrailOut])
def list_telemetry_trails(db: Session = Depends(get_db)) -> list[dict]:
    return telemetry_trails(db)


@router.get("/anomaly-clusters", response_model=list[AnomalyClusterOut])
def list_anomaly_clusters(db: Session = Depends(get_db)) -> list[AnomalyCluster]:
    return _anomaly_clusters(db)


@router.get("/mission-dependencies", response_model=list[MissionDependencyOut])
def list_mission_dependencies(db: Session = Depends(get_db)) -> list[MissionDependency]:
    return _mission_dependencies(db)


@router.get("/reroute-suggestions", response_model=list[RerouteSuggestionOut])
def list_reroute_suggestions(db: Session = Depends(get_db)) -> list[RerouteSuggestion]:
    return _reroute_suggestions(db)


@router.get("/replay-paths", response_model=list[ReplayPathOut])
def list_replay_paths(db: Session = Depends(get_db)) -> list[ReplayPath]:
    return _replay_paths(db)


@router.get("/replay-paths/{mission_id}", response_model=ReplayPathOut)
def get_replay_path(mission_id: str, db: Session = Depends(get_db)) -> ReplayPath:
    mission = get_mission_or_404(db, mission_id)
    replay_path = build_replay_path_from_records(db, mission)
    db.commit()
    db.refresh(replay_path)
    return replay_path


def _anomaly_clusters(db: Session) -> list[AnomalyCluster]:
    return (
        db.query(AnomalyCluster)
        .order_by(desc(AnomalyCluster.last_seen_at), desc(AnomalyCluster.event_count))
        .limit(40)
        .all()
    )


def _mission_dependencies(db: Session) -> list[MissionDependency]:
    return (
        db.query(MissionDependency)
        .order_by(desc(MissionDependency.active), desc(MissionDependency.updated_at), asc(MissionDependency.target_asset_id))
        .limit(80)
        .all()
    )


def _reroute_suggestions(db: Session) -> list[RerouteSuggestion]:
    return (
        db.query(RerouteSuggestion)
        .order_by(desc(RerouteSuggestion.updated_at), desc(RerouteSuggestion.risk_score))
        .limit(40)
        .all()
    )


def _replay_paths(db: Session) -> list[ReplayPath]:
    return db.query(ReplayPath).order_by(desc(ReplayPath.updated_at)).limit(40).all()
