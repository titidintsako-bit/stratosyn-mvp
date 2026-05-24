from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import OrchestrationScenarioRun
from ..orchestration import (
    advance_industrial_incident,
    export_latest_industrial_demo,
    get_active_scenario,
    reset_industrial_demo,
    start_industrial_incident,
)
from ..schemas import OrchestrationScenarioRunOut, StartIndustrialIncidentIn


router = APIRouter(prefix="/orchestration", tags=["orchestration"])


@router.post(
    "/industrial-incident/start",
    response_model=OrchestrationScenarioRunOut,
    status_code=status.HTTP_201_CREATED,
)
def start_industrial_incident_scenario(payload: StartIndustrialIncidentIn, db: Session = Depends(get_db)) -> OrchestrationScenarioRun:
    run = start_industrial_incident(db, payload.command)
    db.commit()
    db.refresh(run)
    return run


@router.post("/industrial/reset")
def reset_industrial_scenario(db: Session = Depends(get_db)) -> dict:
    reset = reset_industrial_demo(db)
    db.commit()
    return jsonable_encoder(reset)


@router.get("/industrial/latest/export")
def export_industrial_scenario(db: Session = Depends(get_db)) -> dict:
    exported = export_latest_industrial_demo(db)
    if exported is None:
        raise HTTPException(status_code=404, detail="No industrial incident scenario has been run.")
    return jsonable_encoder(exported)


@router.get("/scenarios/active", response_model=OrchestrationScenarioRunOut | None)
def active_scenario(db: Session = Depends(get_db)) -> OrchestrationScenarioRun | None:
    return get_active_scenario(db)


@router.get("/scenarios", response_model=list[OrchestrationScenarioRunOut])
def list_scenarios(db: Session = Depends(get_db)) -> list[OrchestrationScenarioRun]:
    return db.query(OrchestrationScenarioRun).order_by(desc(OrchestrationScenarioRun.started_at)).limit(20).all()


@router.get("/scenarios/{scenario_id}", response_model=OrchestrationScenarioRunOut)
def get_scenario(scenario_id: str, db: Session = Depends(get_db)) -> OrchestrationScenarioRun:
    run = db.get(OrchestrationScenarioRun, scenario_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return run


@router.post("/scenarios/{scenario_id}/advance", response_model=OrchestrationScenarioRunOut)
def advance_scenario(scenario_id: str, db: Session = Depends(get_db)) -> OrchestrationScenarioRun:
    run = db.get(OrchestrationScenarioRun, scenario_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    advance_industrial_incident(db, run)
    db.commit()
    db.refresh(run)
    return run
