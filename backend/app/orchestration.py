from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta

from sqlalchemy import desc
from sqlalchemy.orm import Session

from .cognition import evaluate_cognition_cycle
from .models import (
    Asset,
    CausalityEdge,
    CoordinationAction,
    AnomalyCluster,
    Event,
    Mission,
    MissionDependency,
    OrchestrationScenarioRun,
    PredictionState,
    ReasoningEvent,
    ReplayPath,
    RerouteSuggestion,
    RiskField,
    TelemetryRecord,
    make_id,
)
from .services import create_event


SCENARIO_TYPE = "industrial_facility_intrusion"
SCENARIO_MISSION_NAMES = {
    "Investigate Sector B Intrusion",
    "Intercept Sector C Intrusion Path",
    "Ground Verification Loading Bay",
}
SCENARIO_ASSET_IDS = {
    "drone_001",
    "drone_002",
    "robot_001",
    "camera_001",
    "camera_002",
    "sensor_node_001",
    "sensor_node_002",
}
SCENARIO_ZONE_IDS = {
    "sector_a",
    "sector_b",
    "sector_c",
    "loading_bay",
    "storage_zone",
    "perimeter_route",
    "facility",
}
SCENARIO_EVENT_TYPES = {
    "camera_obstruction",
    "mission_completed",
    "mission_created",
    "mission_started",
    "motion_validation",
    "priority_rebalanced",
    "second_intrusion_path",
    "signal_fluctuation",
    "thermal_anomaly_spike",
}
SCENARIO_ACTION_TYPES = {
    "camera_coverage_rotation",
    "camera_redistribution",
    "ground_verification",
    "reroute_negotiation",
    "sensor_frequency_increase",
}
SCENARIO_EDGE_TYPES = {
    "anomaly_influence",
    "incident_resolution",
    "priority_arbitration",
    "resource_reallocation",
    "risk_propagation",
    "telemetry_influence",
}
SCENARIO_PREDICTION_TYPES = {
    "coverage_gap",
    "ground_verification_need",
    "intercept_success",
    "intrusion_escalation",
    "post_incident_stability",
    "signal_instability",
}

FACILITY_ZONES: dict[str, dict] = {
    "sector_a": {"label": "Sector A", "latitude": -26.2024, "longitude": 28.0432, "radius": 720},
    "sector_b": {"label": "Sector B", "latitude": -26.1972, "longitude": 28.0536, "radius": 980},
    "sector_c": {"label": "Sector C", "latitude": -26.2069, "longitude": 28.0606, "radius": 860},
    "loading_bay": {"label": "Loading Bay", "latitude": -26.2127, "longitude": 28.0481, "radius": 760},
    "storage_zone": {"label": "Storage Zone", "latitude": -26.2058, "longitude": 28.0374, "radius": 820},
    "perimeter_route": {"label": "Perimeter Route", "latitude": -26.2165, "longitude": 28.0589, "radius": 1200},
}

FACILITY_ASSETS = [
    {
        "id": "drone_001",
        "name": "Drone Alpha",
        "asset_type": "drone",
        "status": "idle",
        "latitude": -26.2012,
        "longitude": 28.0464,
        "battery": 91,
        "speed": 0,
        "heading": 78,
        "capabilities": ["visual_inspection", "thermal_scan", "intrusion_response"],
    },
    {
        "id": "drone_002",
        "name": "Drone Bravo",
        "asset_type": "drone",
        "status": "idle",
        "latitude": -26.2146,
        "longitude": 28.0618,
        "battery": 78,
        "speed": 0,
        "heading": 330,
        "capabilities": ["perimeter_intercept", "route_patrol", "high_wind_operation"],
    },
    {
        "id": "robot_001",
        "name": "Ground Robot Delta",
        "asset_type": "ground_robot",
        "status": "idle",
        "latitude": -26.2118,
        "longitude": 28.0427,
        "battery": 88,
        "speed": 0,
        "heading": 35,
        "capabilities": ["ground_verification", "obstacle_mapping", "loading_bay_access"],
    },
    {
        "id": "camera_001",
        "name": "Camera Grid 1",
        "asset_type": "camera",
        "status": "active",
        "latitude": -26.2039,
        "longitude": 28.0412,
        "battery": 100,
        "speed": 0,
        "heading": 112,
        "capabilities": ["fixed_video", "motion_detection", "storage_zone_coverage"],
    },
    {
        "id": "camera_002",
        "name": "Camera Grid 2",
        "asset_type": "camera",
        "status": "active",
        "latitude": -26.1988,
        "longitude": 28.0566,
        "battery": 100,
        "speed": 0,
        "heading": 238,
        "capabilities": ["fixed_video", "thermal_validation", "sector_b_coverage"],
    },
    {
        "id": "sensor_node_001",
        "name": "Static Sensor Node B1",
        "asset_type": "sensor",
        "status": "active",
        "latitude": -26.1964,
        "longitude": 28.0514,
        "battery": 96,
        "speed": 0,
        "heading": 0,
        "capabilities": ["motion_sensor", "acoustic_monitoring"],
    },
    {
        "id": "sensor_node_002",
        "name": "Static Sensor Node C1",
        "asset_type": "sensor",
        "status": "active",
        "latitude": -26.2079,
        "longitude": 28.0591,
        "battery": 94,
        "speed": 0,
        "heading": 0,
        "capabilities": ["perimeter_vibration", "motion_sensor"],
    },
]


def start_industrial_incident(db: Session, command: str) -> OrchestrationScenarioRun:
    now = datetime.now(UTC)
    for active_run in (
        db.query(OrchestrationScenarioRun)
        .filter(OrchestrationScenarioRun.scenario_type == SCENARIO_TYPE, OrchestrationScenarioRun.status == "running")
        .all()
    ):
        active_run.status = "completed"
        active_run.outcome = active_run.outcome or "superseded"
        active_run.completed_at = now

    assets = _ensure_facility_assets(db)
    target = FACILITY_ZONES["sector_b"]
    selected = _select_initial_asset(assets, target["latitude"], target["longitude"])
    mission = Mission(
        id=make_id("mission"),
        name="Investigate Sector B Intrusion",
        mission_type="investigate_alert",
        status="running",
        assigned_asset_id=selected.id,
        target_zone="Sector B",
        target_latitude=target["latitude"],
        target_longitude=target["longitude"],
        priority="high",
        start_latitude=selected.latitude,
        start_longitude=selected.longitude,
        started_at=now,
    )
    db.add(mission)

    selected.status = "mission"
    selected.current_mission_id = mission.id
    selected.speed = 10.5
    selected.heading = _heading(selected.latitude, selected.longitude, mission.target_latitude, mission.target_longitude)

    camera_grid_2 = db.get(Asset, "camera_002")
    sensor_b1 = db.get(Asset, "sensor_node_001")
    if camera_grid_2 is not None:
        camera_grid_2.heading = _heading(camera_grid_2.latitude, camera_grid_2.longitude, target["latitude"], target["longitude"])
    if sensor_b1 is not None:
        sensor_b1.status = "active"

    run = OrchestrationScenarioRun(
        id=make_id("scenario"),
        scenario_type=SCENARIO_TYPE,
        command=command,
        status="running",
        current_step=2,
        phase="support_retasked",
        selected_asset_id=selected.id,
        primary_mission_id=mission.id,
        confidence=38,
        timeline=[],
        started_at=now,
        updated_at=now,
    )
    db.add(run)
    db.flush()

    _timeline(run, "intent_parsed", 38, "Mission intent decomposed: possible intrusion near Sector B.", now)
    _timeline(
        run,
        "asset_selected",
        38,
        "Drone Alpha selected from proximity, battery, signal health, workload, and intrusion-response suitability.",
        now,
        asset_id=selected.id,
        score=91.4,
    )
    _timeline(run, "alpha_dispatched", 38, "Drone Alpha dispatched to Sector B investigation vector.", now, asset_id=selected.id, mission_id=mission.id)
    _timeline(
        run,
        "support_retasked",
        38,
        "Camera Grid 2 and nearby static sensors retasked to validate the anomaly.",
        now,
        asset_id="camera_002",
        mission_id=mission.id,
    )

    create_event(db, "mission_created", "info", "Sector B intrusion mission decomposed and created.", selected.id, mission.id)
    create_event(db, "mission_started", "info", "Drone Alpha dispatched for Sector B intrusion investigation.", selected.id, mission.id)
    create_event(db, "motion_validation", "info", "Initial anomaly confidence 38%; motion trace detected near Sector B.", selected.id, mission.id)

    _upsert_dependency(db, mission.id, selected.id, "camera_002", "visual_validation", 0.82, "Camera Grid 2 validates Drone Alpha observations in Sector B.")
    _upsert_dependency(db, mission.id, selected.id, "sensor_node_001", "sensor_frequency_increase", 0.74, "Static Sensor Node B1 increases monitoring frequency for Sector B.")
    _upsert_action(
        db,
        "camera_coverage_rotation",
        selected.id,
        "camera_002",
        mission.id,
        "high",
        76,
        "Camera Grid 2 rotated coverage toward Sector B to validate motion evidence.",
        now,
    )
    _upsert_action(
        db,
        "sensor_frequency_increase",
        selected.id,
        "sensor_node_001",
        mission.id,
        "high",
        69,
        "Nearby static sensors increased monitoring cadence after intrusion intent was parsed.",
        now,
    )
    _reason(db, "mission_decomposition", "info", "Mission decomposed into aerial inspection, camera validation, and sensor cadence increase.", selected.id, mission.id, 78, now)
    _reason(db, "asset_selection", "info", "Drone Alpha selected as initial responder: closest qualified asset with 91% battery and low workload.", selected.id, mission.id, 84, now)
    _risk(db, "sector_b", "intrusion_uncertainty", 38, 62, 1800, "Initial Sector B intrusion uncertainty field established.", now)
    _prediction(db, 5, "zone", "sector_b", "intrusion_escalation", 38, 72, 28, "Sector B anomaly escalation probability in 5m: 38%.", now)
    _edge(db, "anomaly", "sector_b_motion", "mission", mission.id, "anomaly_influence", 0.38, 62, "Initial Sector B motion anomaly caused mission decomposition.", now)
    _edge(db, "mission", mission.id, "asset", "camera_002", "resource_reallocation", 0.72, 76, "Mission retasked Camera Grid 2 coverage toward Sector B.", now)
    _append_replay(db, mission.id, selected.id, selected.latitude, selected.longitude, now, selected.heading, selected.speed, selected.battery)

    evaluate_cognition_cycle(db, now)
    db.flush()
    return run


def get_active_scenario(db: Session) -> OrchestrationScenarioRun | None:
    return (
        db.query(OrchestrationScenarioRun)
        .filter(OrchestrationScenarioRun.scenario_type == SCENARIO_TYPE)
        .order_by(desc(OrchestrationScenarioRun.started_at))
        .first()
    )


def reset_industrial_demo(db: Session) -> dict:
    mission_ids = _scenario_mission_ids(db)

    if mission_ids:
        db.query(TelemetryRecord).filter(TelemetryRecord.mission_id.in_(mission_ids)).delete(synchronize_session=False)
        db.query(ReplayPath).filter(ReplayPath.mission_id.in_(mission_ids)).delete(synchronize_session=False)
        db.query(RerouteSuggestion).filter(RerouteSuggestion.mission_id.in_(mission_ids)).delete(synchronize_session=False)
        db.query(MissionDependency).filter(MissionDependency.mission_id.in_(mission_ids)).delete(synchronize_session=False)
        db.query(Event).filter(Event.mission_id.in_(mission_ids)).delete(synchronize_session=False)
        db.query(AnomalyCluster).filter(AnomalyCluster.mission_id.in_(mission_ids)).delete(synchronize_session=False)
        db.query(ReasoningEvent).filter(ReasoningEvent.mission_id.in_(mission_ids)).delete(synchronize_session=False)
        db.query(CoordinationAction).filter(CoordinationAction.mission_id.in_(mission_ids)).delete(synchronize_session=False)
        db.query(Mission).filter(Mission.id.in_(mission_ids)).delete(synchronize_session=False)

    db.query(OrchestrationScenarioRun).filter(OrchestrationScenarioRun.scenario_type == SCENARIO_TYPE).delete(synchronize_session=False)
    db.query(Event).filter(Event.event_type.in_(SCENARIO_EVENT_TYPES), Event.asset_id.in_(SCENARIO_ASSET_IDS)).delete(synchronize_session=False)
    db.query(AnomalyCluster).filter(AnomalyCluster.event_type.in_(SCENARIO_EVENT_TYPES), AnomalyCluster.asset_id.in_(SCENARIO_ASSET_IDS)).delete(synchronize_session=False)
    db.query(ReasoningEvent).filter(ReasoningEvent.asset_id.in_(SCENARIO_ASSET_IDS)).delete(synchronize_session=False)
    db.query(CausalityEdge).filter(CausalityEdge.edge_type.in_(SCENARIO_EDGE_TYPES)).delete(synchronize_session=False)
    db.query(PredictionState).filter(PredictionState.prediction_type.in_(SCENARIO_PREDICTION_TYPES)).delete(synchronize_session=False)
    db.query(CoordinationAction).filter(CoordinationAction.action_type.in_(SCENARIO_ACTION_TYPES)).delete(synchronize_session=False)
    db.query(RiskField).filter(RiskField.zone_id.in_(SCENARIO_ZONE_IDS)).delete(synchronize_session=False)
    db.query(RerouteSuggestion).filter(RerouteSuggestion.asset_id.in_(SCENARIO_ASSET_IDS)).delete(synchronize_session=False)

    assets = _ensure_facility_assets(db)
    db.flush()
    return {"status": "reset", "active_scenario": None, "assets": assets}


def export_latest_industrial_demo(db: Session) -> dict | None:
    run = (
        db.query(OrchestrationScenarioRun)
        .filter(OrchestrationScenarioRun.scenario_type == SCENARIO_TYPE)
        .order_by(desc(OrchestrationScenarioRun.started_at))
        .first()
    )
    if run is None:
        return None

    mission_ids = _scenario_mission_ids(db, run)
    asset_ids = _scenario_asset_ids(run)
    missions = db.query(Mission).filter(Mission.id.in_(mission_ids)).order_by(Mission.started_at.asc().nulls_last(), Mission.created_at.asc()).all()
    replay = (
        db.query(ReplayPath)
        .filter(ReplayPath.mission_id == run.primary_mission_id)
        .order_by(desc(ReplayPath.updated_at))
        .first()
    )
    return {
        "scenario": run,
        "phases": run.timeline or [],
        "assets_involved": db.query(Asset).filter(Asset.id.in_(asset_ids)).order_by(Asset.id).all(),
        "missions_created": missions,
        "reasoning_events": _scenario_reasoning_events(db, mission_ids, asset_ids),
        "causality_edges": _scenario_causality_edges(db, mission_ids, asset_ids),
        "predictions": _scenario_predictions(db, mission_ids, asset_ids),
        "coordination_actions": _scenario_coordination_actions(db, mission_ids),
        "risk_fields": db.query(RiskField).filter(RiskField.zone_id.in_(SCENARIO_ZONE_IDS)).order_by(desc(RiskField.risk_score)).all(),
        "replay_path": replay,
        "final_outcome": run.outcome,
    }


def _scenario_mission_ids(db: Session, run: OrchestrationScenarioRun | None = None) -> set[str]:
    mission_ids = {
        mission_id
        for (mission_id,) in db.query(Mission.id).filter(Mission.name.in_(SCENARIO_MISSION_NAMES)).all()
        if mission_id
    }
    runs = [run] if run is not None else db.query(OrchestrationScenarioRun).filter(OrchestrationScenarioRun.scenario_type == SCENARIO_TYPE).all()
    for scenario in runs:
        if scenario is None:
            continue
        if scenario.primary_mission_id:
            mission_ids.add(scenario.primary_mission_id)
        for item in scenario.timeline or []:
            if item.get("mission_id"):
                mission_ids.add(item["mission_id"])
    return mission_ids


def _scenario_asset_ids(run: OrchestrationScenarioRun) -> set[str]:
    asset_ids = set(SCENARIO_ASSET_IDS)
    if run.selected_asset_id:
        asset_ids.add(run.selected_asset_id)
    for item in run.timeline or []:
        if item.get("asset_id"):
            asset_ids.add(item["asset_id"])
    return asset_ids


def _scenario_reasoning_events(db: Session, mission_ids: set[str], asset_ids: set[str]) -> list[ReasoningEvent]:
    query = db.query(ReasoningEvent)
    if mission_ids:
        query = query.filter((ReasoningEvent.mission_id.in_(mission_ids)) | (ReasoningEvent.asset_id.in_(asset_ids)))
    else:
        query = query.filter(ReasoningEvent.asset_id.in_(asset_ids))
    return query.order_by(ReasoningEvent.timestamp.asc()).limit(120).all()


def _scenario_causality_edges(db: Session, mission_ids: set[str], asset_ids: set[str]) -> list[CausalityEdge]:
    ids = set(mission_ids) | set(asset_ids) | SCENARIO_ZONE_IDS | {"sector_b_motion", "sector_b_thermal"}
    return (
        db.query(CausalityEdge)
        .filter((CausalityEdge.edge_type.in_(SCENARIO_EDGE_TYPES)) | (CausalityEdge.source_id.in_(ids)) | (CausalityEdge.target_id.in_(ids)))
        .order_by(CausalityEdge.updated_at.asc())
        .limit(160)
        .all()
    )


def _scenario_predictions(db: Session, mission_ids: set[str], asset_ids: set[str]) -> list[PredictionState]:
    ids = set(mission_ids) | set(asset_ids) | SCENARIO_ZONE_IDS
    return (
        db.query(PredictionState)
        .filter((PredictionState.prediction_type.in_(SCENARIO_PREDICTION_TYPES)) | (PredictionState.entity_id.in_(ids)))
        .order_by(PredictionState.horizon_minutes.asc(), desc(PredictionState.probability))
        .limit(160)
        .all()
    )


def _scenario_coordination_actions(db: Session, mission_ids: set[str]) -> list[CoordinationAction]:
    query = db.query(CoordinationAction).filter(CoordinationAction.action_type.in_(SCENARIO_ACTION_TYPES))
    if mission_ids:
        query = query.union(db.query(CoordinationAction).filter(CoordinationAction.mission_id.in_(mission_ids)))
    return query.order_by(CoordinationAction.created_at.asc()).limit(120).all()


def advance_active_scenarios(db: Session, timestamp: datetime | None = None) -> list[OrchestrationScenarioRun]:
    now = timestamp or datetime.now(UTC)
    runs = (
        db.query(OrchestrationScenarioRun)
        .filter(OrchestrationScenarioRun.scenario_type == SCENARIO_TYPE, OrchestrationScenarioRun.status == "running")
        .order_by(OrchestrationScenarioRun.started_at)
        .all()
    )
    for run in runs:
        advance_industrial_incident(db, run, now)
    return runs


def advance_industrial_incident(db: Session, run: OrchestrationScenarioRun, timestamp: datetime | None = None) -> OrchestrationScenarioRun:
    now = timestamp or datetime.now(UTC)
    if run.status != "running":
        return run

    handlers = {
        3: _motion_validation,
        4: _thermal_validation,
        5: _incident_escalation,
        6: _bravo_reroute,
        7: _ground_robot_assignment,
        8: _priority_arbitration,
        9: _incident_resolution,
    }
    next_step = run.current_step + 1
    handler = handlers.get(next_step)
    if handler is None:
        return run
    handler(db, run, now)
    run.current_step = next_step
    run.updated_at = now
    evaluate_cognition_cycle(db, now)
    db.flush()
    return run


def _motion_validation(db: Session, run: OrchestrationScenarioRun, now: datetime) -> None:
    mission = db.get(Mission, run.primary_mission_id)
    alpha = db.get(Asset, "drone_001")
    if mission is None or alpha is None:
        return
    _move_asset(alpha, FACILITY_ZONES["sector_b"]["latitude"], FACILITY_ZONES["sector_b"]["longitude"], 0.42)
    run.phase = "motion_validation"
    run.confidence = 61
    _timeline(run, "motion_validation", 61, "Motion validation increased anomaly confidence to 61%.", now, asset_id=alpha.id, mission_id=mission.id)
    create_event(db, "motion_validation", "warning", "Motion validation increased anomaly confidence to 61%.", alpha.id, mission.id)
    _reason(db, "anomaly_validation", "warning", "Motion validation raised Sector B anomaly confidence from 38% to 61%.", alpha.id, mission.id, 61, now)
    _risk(db, "sector_b", "intrusion_uncertainty", 61, 70, 2100, "Motion validation expanded Sector B intrusion risk.", now)
    _prediction(db, 5, "zone", "sector_b", "intrusion_escalation", 61, 75, 25, "Sector B anomaly escalation probability in 5m: 61%.", now)
    _edge(db, "anomaly", "sector_b_motion", "asset", alpha.id, "anomaly_influence", 0.61, 70, "Motion validation increased Drone Alpha task risk.", now)
    _append_replay(db, mission.id, alpha.id, alpha.latitude, alpha.longitude, now, alpha.heading, alpha.speed, alpha.battery)


def _thermal_validation(db: Session, run: OrchestrationScenarioRun, now: datetime) -> None:
    mission = db.get(Mission, run.primary_mission_id)
    alpha = db.get(Asset, "drone_001")
    camera = db.get(Asset, "camera_002")
    if mission is None or alpha is None:
        return
    _move_asset(alpha, FACILITY_ZONES["sector_b"]["latitude"], FACILITY_ZONES["sector_b"]["longitude"], 0.7)
    run.phase = "thermal_validation"
    run.confidence = 79
    _timeline(run, "thermal_validation", 79, "Thermal validation raised anomaly confidence to 79%.", now, asset_id=alpha.id, mission_id=mission.id)
    create_event(db, "thermal_anomaly_spike", "warning", "Thermal anomaly spike detected; confidence increased to 79%.", alpha.id, mission.id)
    _reason(db, "thermal_validation", "warning", "Thermal validation raised Sector B anomaly confidence to 79%; escalation path opened.", alpha.id, mission.id, 79, now)
    if camera is not None:
        _edge(db, "asset", camera.id, "anomaly", "sector_b_thermal", "telemetry_influence", 0.79, 82, "Camera Grid 2 thermal validation reinforced the Sector B anomaly.", now)
    _risk(db, "sector_b", "thermal_anomaly", 79, 78, 2300, "Thermal anomaly spike concentrated in Sector B.", now)
    _prediction(db, 15, "zone", "sector_b", "intrusion_escalation", 79, 78, 22, "Thermal anomaly escalation risk increasing.", now)
    _append_replay(db, mission.id, alpha.id, alpha.latitude, alpha.longitude, now, alpha.heading, alpha.speed, alpha.battery)


def _incident_escalation(db: Session, run: OrchestrationScenarioRun, now: datetime) -> None:
    mission = db.get(Mission, run.primary_mission_id)
    alpha = db.get(Asset, "drone_001")
    camera = db.get(Asset, "camera_002")
    if mission is None or alpha is None:
        return
    alpha.status = "warning"
    alpha.speed = 7.5
    if camera is not None:
        camera.status = "warning"
    run.phase = "incident_escalated"
    run.confidence = 74
    _timeline(run, "incident_escalated", 74, "Signal degradation and camera obstruction reduced mission confidence.", now, asset_id=alpha.id, mission_id=mission.id)
    create_event(db, "signal_fluctuation", "warning", "Drone Alpha signal instability increasing near Sector B.", alpha.id, mission.id)
    create_event(db, "camera_obstruction", "warning", "Camera Grid 2 partially obstructed during Sector B validation.", "camera_002", mission.id)
    create_event(db, "second_intrusion_path", "warning", "Possible second intrusion path detected toward Sector C.", "sensor_node_002", mission.id)
    _reason(db, "prediction", "warning", "Drone Alpha signal instability increasing.", alpha.id, mission.id, 68, now)
    _reason(db, "prediction", "warning", "Coverage gap projected in Sector C in 4m.", "sensor_node_002", mission.id, 71, now)
    _reason(db, "confidence", "warning", "Mission confidence reduced due to telemetry inconsistency.", alpha.id, mission.id, 66, now)
    _risk(db, "sector_c", "coverage_gap", 67, 71, 1900, "Coverage gap probability in Sector C: 67%.", now)
    _prediction(db, 5, "asset", alpha.id, "signal_instability", 64, 68, 32, "Drone Alpha signal instability increasing.", now)
    _prediction(db, 5, "zone", "sector_c", "coverage_gap", 67, 71, 29, "Coverage gap projected in Sector C in 4m.", now)
    _edge(db, "anomaly", "sector_b_thermal", "zone", "sector_c", "risk_propagation", 0.67, 71, "Sector B anomaly created a possible Sector C coverage gap.", now)
    _append_replay(db, mission.id, alpha.id, alpha.latitude, alpha.longitude, now, alpha.heading, alpha.speed, alpha.battery)


def _bravo_reroute(db: Session, run: OrchestrationScenarioRun, now: datetime) -> None:
    primary = db.get(Mission, run.primary_mission_id)
    bravo = db.get(Asset, "drone_002")
    if primary is None or bravo is None:
        return
    target = FACILITY_ZONES["sector_c"]
    mission = Mission(
        id=make_id("mission"),
        name="Intercept Sector C Intrusion Path",
        mission_type="investigate_alert",
        status="running",
        assigned_asset_id=bravo.id,
        target_zone="Sector C",
        target_latitude=target["latitude"],
        target_longitude=target["longitude"],
        priority="critical",
        start_latitude=bravo.latitude,
        start_longitude=bravo.longitude,
        started_at=now,
    )
    db.add(mission)
    bravo.status = "mission"
    bravo.current_mission_id = mission.id
    _move_asset(bravo, target["latitude"], target["longitude"], 0.46)
    run.phase = "bravo_rerouted"
    run.confidence = 77
    _timeline(run, "bravo_rerouted", 77, "Drone Bravo rerouted to intercept possible Sector C intrusion path.", now, asset_id=bravo.id, mission_id=mission.id)
    create_event(db, "mission_started", "warning", "Drone Bravo rerouted toward possible second intrusion path in Sector C.", bravo.id, mission.id)
    _upsert_action(
        db,
        "reroute_negotiation",
        "drone_001",
        bravo.id,
        mission.id,
        "critical",
        77,
        "Drone Bravo rerouted after Sector C coverage gap prediction crossed 67%.",
        now,
    )
    _upsert_dependency(db, mission.id, "drone_001", bravo.id, "cross_asset_intercept", 0.88, "Drone Bravo intercept path depends on Drone Alpha anomaly confirmation.")
    _reason(db, "reroute", "warning", "Drone Bravo rerouted due to projected Sector C coverage gap and Alpha signal degradation.", bravo.id, mission.id, 77, now)
    _prediction(db, 15, "mission", mission.id, "intercept_success", 72, 77, 23, "Drone Bravo intercept success probability in 15m: 72%.", now)
    _edge(db, "mission", primary.id, "mission", mission.id, "priority_arbitration", 0.86, 77, "Sector C intercept mission preempted lower-priority patrol capacity.", now)
    _edge(db, "asset", "drone_001", "asset", bravo.id, "resource_reallocation", 0.83, 77, "Drone Alpha state triggered Drone Bravo reroute negotiation.", now)
    _append_replay(db, mission.id, bravo.id, bravo.latitude, bravo.longitude, now, bravo.heading, bravo.speed, bravo.battery)
    _upsert_reroute(db, primary.id, bravo.id, now)


def _ground_robot_assignment(db: Session, run: OrchestrationScenarioRun, now: datetime) -> None:
    primary = db.get(Mission, run.primary_mission_id)
    robot = db.get(Asset, "robot_001")
    if primary is None or robot is None:
        return
    target = FACILITY_ZONES["loading_bay"]
    mission = Mission(
        id=make_id("mission"),
        name="Ground Verification Loading Bay",
        mission_type="investigate_alert",
        status="running",
        assigned_asset_id=robot.id,
        target_zone="Loading Bay",
        target_latitude=target["latitude"],
        target_longitude=target["longitude"],
        priority="high",
        start_latitude=robot.latitude,
        start_longitude=robot.longitude,
        started_at=now,
    )
    db.add(mission)
    robot.status = "mission"
    robot.current_mission_id = mission.id
    _move_asset(robot, target["latitude"], target["longitude"], 0.38)
    run.phase = "ground_robot_assigned"
    run.confidence = 82
    _timeline(run, "ground_robot_assigned", 82, "Ground Robot Delta assigned for physical verification before escalation.", now, asset_id=robot.id, mission_id=mission.id)
    create_event(db, "mission_started", "warning", "Ground Robot Delta assigned for physical verification before escalation.", robot.id, mission.id)
    _upsert_action(
        db,
        "ground_verification",
        "drone_001",
        robot.id,
        mission.id,
        "high",
        82,
        "Ground verification required before escalation.",
        now,
    )
    _reason(db, "coordination", "warning", "Ground verification required before escalation.", robot.id, mission.id, 82, now)
    _risk(db, "loading_bay", "secondary_path", 58, 73, 1600, "Loading Bay risk elevated by possible secondary path.", now)
    _prediction(db, 15, "zone", "loading_bay", "ground_verification_need", 76, 82, 18, "Ground verification required before escalation.", now)
    _edge(db, "mission", primary.id, "mission", mission.id, "resource_reallocation", 0.81, 82, "Primary aerial mission delegated ground verification to Delta.", now)
    _append_replay(db, mission.id, robot.id, robot.latitude, robot.longitude, now, robot.heading, robot.speed, robot.battery)


def _priority_arbitration(db: Session, run: OrchestrationScenarioRun, now: datetime) -> None:
    primary = db.get(Mission, run.primary_mission_id)
    camera_1 = db.get(Asset, "camera_001")
    sensor_c = db.get(Asset, "sensor_node_002")
    if primary is None:
        return
    if camera_1 is not None:
        camera_1.heading = _heading(camera_1.latitude, camera_1.longitude, FACILITY_ZONES["sector_c"]["latitude"], FACILITY_ZONES["sector_c"]["longitude"])
    run.phase = "priority_arbitration"
    run.confidence = 86
    _timeline(run, "priority_arbitration", 86, "Mission priority graph elevated Sector C intercept and redistributed coverage.", now, asset_id="camera_001", mission_id=primary.id)
    create_event(db, "priority_rebalanced", "info", "Mission priority graph elevated Sector C intercept and redistributed camera coverage.", "camera_001", primary.id)
    _upsert_action(
        db,
        "camera_redistribution",
        "camera_002",
        "camera_001",
        primary.id,
        "high",
        86,
        "Camera Grid 1 redistributed coverage to compensate for Camera Grid 2 obstruction.",
        now,
    )
    _reason(db, "priority_arbitration", "info", "Coverage continuity restored through autonomous sensor redistribution.", sensor_c.id if sensor_c else None, primary.id, 86, now)
    _prediction(db, 30, "zone", "sector_c", "coverage_gap", 24, 86, 14, "Sector C coverage gap reduced after camera redistribution.", now)
    _edge(db, "asset", "camera_002", "asset", "camera_001", "resource_reallocation", 0.78, 86, "Camera Grid 1 compensated for Camera Grid 2 partial obstruction.", now)


def _incident_resolution(db: Session, run: OrchestrationScenarioRun, now: datetime) -> None:
    run.phase = "incident_resolved"
    run.status = "completed"
    run.outcome = "confirmed_intrusion"
    run.confidence = 88
    run.completed_at = now
    _timeline(run, "incident_resolved", 88, "Incident resolved as confirmed intrusion; autonomous assets stabilized the facility topology.", now)
    for mission in db.query(Mission).filter(Mission.status == "running").all():
        if mission.name in {"Investigate Sector B Intrusion", "Intercept Sector C Intrusion Path", "Ground Verification Loading Bay"}:
            mission.status = "completed"
            mission.completed_at = now
            asset = db.get(Asset, mission.assigned_asset_id) if mission.assigned_asset_id else None
            if asset is not None:
                asset.status = "idle" if asset.asset_type != "camera" else "active"
                asset.current_mission_id = None
                asset.speed = 0
            create_event(db, "mission_completed", "info", f"{mission.name} completed during confirmed intrusion resolution.", mission.assigned_asset_id, mission.id)
    for asset_id in SCENARIO_ASSET_IDS:
        asset = db.get(Asset, asset_id)
        if asset is None:
            continue
        asset.status = "active" if asset.asset_type in {"camera", "sensor"} else "idle"
        asset.current_mission_id = None
        asset.speed = 0

    for suggestion in db.query(RerouteSuggestion).filter(RerouteSuggestion.asset_id.in_(SCENARIO_ASSET_IDS)).all():
        suggestion.status = "resolved"
        suggestion.resolved_at = now
    _reason(db, "resolution", "info", "Confirmed intrusion resolved; operational confidence recovered to 88%.", None, run.primary_mission_id, 88, now)
    _risk(db, "sector_b", "intrusion_uncertainty", 26, 88, 950, "Sector B risk receded after ground and aerial verification.", now)
    _risk(db, "sector_c", "coverage_gap", 22, 86, 900, "Sector C coverage gap closed by reroute and camera redistribution.", now)
    _prediction(db, 30, "zone", "facility", "post_incident_stability", 88, 84, 16, "Facility stability probability after incident resolution: 88%.", now)
    _edge(db, "mission", run.primary_mission_id or "", "zone", "facility", "incident_resolution", 0.88, 88, "Confirmed intrusion resolved through autonomous multi-asset coordination.", now)
    _sync_decision_replay(db, run, now)
    _close_resolved_incident_alerts(db, run, now)


def _ensure_facility_assets(db: Session) -> list[Asset]:
    assets: list[Asset] = []
    for data in FACILITY_ASSETS:
        asset = db.get(Asset, data["id"])
        if asset is None:
            asset = Asset(**data)
            db.add(asset)
        else:
            for field, value in data.items():
                if field == "id":
                    continue
                setattr(asset, field, value)
            asset.current_mission_id = None
        assets.append(asset)
    db.flush()
    return assets


def _select_initial_asset(assets: list[Asset], target_latitude: float, target_longitude: float) -> Asset:
    candidates = [asset for asset in assets if asset.asset_type == "drone" and asset.status != "offline" and asset.battery >= 30]
    return max(
        candidates,
        key=lambda asset: (
            _suitability(asset) * 0.36
            + asset.battery * 0.28
            + _signal_health(asset) * 0.21
            + (1 / max(_distance(asset.latitude, asset.longitude, target_latitude, target_longitude), 0.001)) * 0.05
            - (18 if asset.current_mission_id else 0)
        ),
    )


def _suitability(asset: Asset) -> float:
    capabilities = set(asset.capabilities or [])
    score = 55
    if "intrusion_response" in capabilities:
        score += 28
    if "thermal_scan" in capabilities:
        score += 12
    if "perimeter_intercept" in capabilities:
        score += 6
    return min(score, 100)


def _signal_health(asset: Asset) -> float:
    return 94 if asset.status in {"idle", "active"} else 72 if asset.status == "warning" else 38


def _move_asset(asset: Asset, target_latitude: float, target_longitude: float, progress: float) -> None:
    asset.latitude = round(asset.latitude + (target_latitude - asset.latitude) * progress, 6)
    asset.longitude = round(asset.longitude + (target_longitude - asset.longitude) * progress, 6)
    asset.heading = _heading(asset.latitude, asset.longitude, target_latitude, target_longitude)
    asset.speed = 11.5 if asset.asset_type == "drone" else 2.8
    asset.battery = max(0, asset.battery - (1.2 if asset.asset_type == "drone" else 0.45))


def _heading(latitude: float, longitude: float, target_latitude: float, target_longitude: float) -> float:
    return round((math.degrees(math.atan2(target_longitude - longitude, target_latitude - latitude)) + 360) % 360, 2)


def _distance(lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
    return math.sqrt((lat_a - lat_b) ** 2 + (lon_a - lon_b) ** 2)


def _timeline(
    run: OrchestrationScenarioRun,
    phase: str,
    confidence: float,
    message: str,
    timestamp: datetime,
    **extra,
) -> None:
    run.timeline = [
        *(run.timeline or []),
        {
            "phase": phase,
            "confidence": confidence,
            "message": message,
            "timestamp": timestamp.isoformat(),
            **extra,
        },
    ]


def _reason(
    db: Session,
    category: str,
    severity: str,
    message: str,
    asset_id: str | None,
    mission_id: str | None,
    confidence: float,
    now: datetime,
) -> None:
    db.add(
        ReasoningEvent(
            id=make_id("reasoning"),
            category=category,
            severity=severity,
            message=message,
            asset_id=asset_id,
            mission_id=mission_id,
            confidence=round(confidence, 2),
            uncertainty=round(max(0, 100 - confidence), 2),
            timestamp=now,
        )
    )


def _risk(
    db: Session,
    zone_id: str,
    risk_type: str,
    risk_score: float,
    confidence: float,
    radius: float,
    message: str,
    now: datetime,
) -> None:
    zone = FACILITY_ZONES.get(zone_id, {"latitude": -26.2041, "longitude": 28.0473})
    field = db.query(RiskField).filter(RiskField.zone_id == zone_id, RiskField.risk_type == risk_type).first()
    if field is None:
        field = RiskField(
            id=make_id("risk"),
            zone_id=zone_id,
            latitude=zone["latitude"],
            longitude=zone["longitude"],
            radius=radius,
            risk_type=risk_type,
            risk_score=round(risk_score, 2),
            confidence=round(confidence, 2),
            uncertainty=round(max(0, 100 - confidence), 2),
            message=message,
            updated_at=now,
        )
        db.add(field)
    else:
        field.risk_score = round(risk_score, 2)
        field.confidence = round(confidence, 2)
        field.uncertainty = round(max(0, 100 - confidence), 2)
        field.radius = radius
        field.message = message
        field.updated_at = now


def _prediction(
    db: Session,
    horizon_minutes: int,
    entity_type: str,
    entity_id: str,
    prediction_type: str,
    probability: float,
    confidence: float,
    uncertainty: float,
    message: str,
    now: datetime,
) -> None:
    zone = FACILITY_ZONES.get(entity_id, {"latitude": -26.2041, "longitude": 28.0473})
    prediction = (
        db.query(PredictionState)
        .filter(
            PredictionState.horizon_minutes == horizon_minutes,
            PredictionState.entity_type == entity_type,
            PredictionState.entity_id == entity_id,
            PredictionState.prediction_type == prediction_type,
        )
        .first()
    )
    if prediction is None:
        prediction = PredictionState(
            id=make_id("prediction"),
            horizon_minutes=horizon_minutes,
            entity_type=entity_type,
            entity_id=entity_id,
            prediction_type=prediction_type,
            probability=round(probability, 2),
            confidence=round(confidence, 2),
            uncertainty=round(uncertainty, 2),
            projected_latitude=zone["latitude"],
            projected_longitude=zone["longitude"],
            message=message,
            projected_at=now + timedelta(minutes=horizon_minutes),
            updated_at=now,
        )
        db.add(prediction)
    else:
        prediction.probability = round(probability, 2)
        prediction.confidence = round(confidence, 2)
        prediction.uncertainty = round(uncertainty, 2)
        prediction.message = message
        prediction.projected_at = now + timedelta(minutes=horizon_minutes)
        prediction.updated_at = now


def _edge(
    db: Session,
    source_type: str,
    source_id: str,
    target_type: str,
    target_id: str,
    edge_type: str,
    weight: float,
    confidence: float,
    message: str,
    now: datetime,
) -> None:
    edge = (
        db.query(CausalityEdge)
        .filter(
            CausalityEdge.source_type == source_type,
            CausalityEdge.source_id == source_id,
            CausalityEdge.target_type == target_type,
            CausalityEdge.target_id == target_id,
            CausalityEdge.edge_type == edge_type,
        )
        .first()
    )
    if edge is None:
        edge = CausalityEdge(
            id=make_id("edge"),
            source_type=source_type,
            source_id=source_id,
            target_type=target_type,
            target_id=target_id,
            edge_type=edge_type,
            weight=round(weight, 2),
            confidence=round(confidence, 2),
            active=True,
            message=message,
            created_at=now,
            updated_at=now,
        )
        db.add(edge)
    else:
        edge.weight = round(weight, 2)
        edge.confidence = round(confidence, 2)
        edge.active = True
        edge.message = message
        edge.updated_at = now


def _upsert_action(
    db: Session,
    action_type: str,
    initiator_asset_id: str | None,
    target_asset_id: str | None,
    mission_id: str | None,
    priority: str,
    confidence: float,
    rationale: str,
    now: datetime,
) -> None:
    action = (
        db.query(CoordinationAction)
        .filter(
            CoordinationAction.action_type == action_type,
            CoordinationAction.initiator_asset_id == initiator_asset_id,
            CoordinationAction.target_asset_id == target_asset_id,
            CoordinationAction.mission_id == mission_id,
        )
        .first()
    )
    if action is None:
        action = CoordinationAction(
            id=make_id("coordination"),
            action_type=action_type,
            status="active",
            initiator_asset_id=initiator_asset_id,
            target_asset_id=target_asset_id,
            mission_id=mission_id,
            priority=priority,
            confidence=round(confidence, 2),
            rationale=rationale,
            created_at=now,
            updated_at=now,
        )
        db.add(action)
    else:
        action.status = "active"
        action.priority = priority
        action.confidence = round(confidence, 2)
        action.rationale = rationale
        action.updated_at = now


def _upsert_dependency(db: Session, mission_id: str, source_asset_id: str, target_asset_id: str, dependency_type: str, strength: float, reason: str) -> None:
    dependency = (
        db.query(MissionDependency)
        .filter(
            MissionDependency.mission_id == mission_id,
            MissionDependency.source_asset_id == source_asset_id,
            MissionDependency.target_asset_id == target_asset_id,
            MissionDependency.dependency_type == dependency_type,
        )
        .first()
    )
    if dependency is None:
        db.add(
            MissionDependency(
                id=make_id("dependency"),
                mission_id=mission_id,
                source_asset_id=source_asset_id,
                target_asset_id=target_asset_id,
                dependency_type=dependency_type,
                strength=round(strength, 2),
                active=True,
                reason=reason,
            )
        )
    else:
        dependency.strength = round(strength, 2)
        dependency.active = True
        dependency.reason = reason


def _append_replay(
    db: Session,
    mission_id: str,
    asset_id: str,
    latitude: float,
    longitude: float,
    timestamp: datetime,
    heading: float,
    speed: float,
    battery: float,
) -> None:
    point = {
        "latitude": round(latitude, 6),
        "longitude": round(longitude, 6),
        "timestamp": timestamp.isoformat(),
        "heading": round(heading, 2),
        "speed": round(speed, 2),
        "battery": round(battery, 2),
    }
    path = db.query(ReplayPath).filter(ReplayPath.mission_id == mission_id).first()
    if path is None:
        path = ReplayPath(
            id=make_id("replay"),
            mission_id=mission_id,
            asset_id=asset_id,
            path=[point],
            point_count=1,
            source="orchestration",
            created_at=timestamp,
            updated_at=timestamp,
        )
        db.add(path)
    else:
        path.path = [*(path.path or []), point]
        path.point_count = len(path.path)
        path.updated_at = timestamp
    db.add(
        TelemetryRecord(
            asset_id=asset_id,
            mission_id=mission_id,
            latitude=latitude,
            longitude=longitude,
            battery=battery,
            speed=speed,
            heading=heading,
            status="mission",
            timestamp=timestamp,
        )
    )


def _sync_decision_replay(db: Session, run: OrchestrationScenarioRun, now: datetime) -> None:
    if not run.primary_mission_id:
        return

    points = [_decision_replay_point(db, run, item, index) for index, item in enumerate(run.timeline or [], start=1)]
    path = db.query(ReplayPath).filter(ReplayPath.mission_id == run.primary_mission_id).first()
    if path is None:
        path = ReplayPath(
            id=make_id("replay"),
            mission_id=run.primary_mission_id,
            asset_id=run.selected_asset_id,
            path=points,
            point_count=len(points),
            source="scenario_decision",
            created_at=run.started_at or now,
            updated_at=now,
        )
        db.add(path)
        return

    path.asset_id = run.selected_asset_id
    path.path = points
    path.point_count = len(points)
    path.source = "scenario_decision"
    path.updated_at = now


def _decision_replay_point(db: Session, run: OrchestrationScenarioRun, item: dict, index: int) -> dict:
    latitude, longitude = _decision_replay_coordinates(db, item)
    asset_id = item.get("asset_id")
    asset = db.get(Asset, asset_id) if asset_id else None
    return {
        "latitude": round(latitude, 6),
        "longitude": round(longitude, 6),
        "timestamp": item.get("timestamp") or (run.started_at or datetime.now(UTC)).isoformat(),
        "heading": round(asset.heading, 2) if asset is not None else None,
        "speed": round(asset.speed, 2) if asset is not None else None,
        "battery": round(asset.battery, 2) if asset is not None else None,
        "phase": item["phase"],
        "confidence": item.get("confidence"),
        "message": item.get("message"),
        "asset_id": asset_id,
        "mission_id": item.get("mission_id") or run.primary_mission_id,
        "decision_index": index,
    }


def _decision_replay_coordinates(db: Session, item: dict) -> tuple[float, float]:
    phase = item.get("phase")
    phase_coordinates = {
        "intent_parsed": (FACILITY_ZONES["sector_b"]["latitude"], FACILITY_ZONES["sector_b"]["longitude"]),
        "asset_selected": _asset_home_coordinates("drone_001"),
        "alpha_dispatched": (-26.2011, 28.0484),
        "support_retasked": (FACILITY_ZONES["sector_b"]["latitude"], FACILITY_ZONES["sector_b"]["longitude"]),
        "motion_validation": (-26.1995, 28.0504),
        "thermal_validation": (FACILITY_ZONES["sector_b"]["latitude"], FACILITY_ZONES["sector_b"]["longitude"]),
        "incident_escalated": (FACILITY_ZONES["sector_b"]["latitude"], FACILITY_ZONES["sector_b"]["longitude"]),
        "bravo_rerouted": (FACILITY_ZONES["sector_c"]["latitude"], FACILITY_ZONES["sector_c"]["longitude"]),
        "ground_robot_assigned": (FACILITY_ZONES["loading_bay"]["latitude"], FACILITY_ZONES["loading_bay"]["longitude"]),
        "priority_arbitration": (FACILITY_ZONES["sector_c"]["latitude"], FACILITY_ZONES["sector_c"]["longitude"]),
        "incident_resolved": (FACILITY_ZONES["sector_b"]["latitude"], FACILITY_ZONES["sector_b"]["longitude"]),
    }
    if phase in phase_coordinates:
        return phase_coordinates[phase]

    if item.get("asset_id"):
        asset = db.get(Asset, item["asset_id"])
        if asset is not None:
            return asset.latitude, asset.longitude
    if item.get("mission_id"):
        mission = db.get(Mission, item["mission_id"])
        if mission is not None:
            return mission.target_latitude, mission.target_longitude
    return FACILITY_ZONES["sector_b"]["latitude"], FACILITY_ZONES["sector_b"]["longitude"]


def _asset_home_coordinates(asset_id: str) -> tuple[float, float]:
    for asset in FACILITY_ASSETS:
        if asset["id"] == asset_id:
            return asset["latitude"], asset["longitude"]
    return FACILITY_ZONES["sector_b"]["latitude"], FACILITY_ZONES["sector_b"]["longitude"]


def _close_resolved_incident_alerts(db: Session, run: OrchestrationScenarioRun, now: datetime) -> None:
    mission_ids = _run_mission_ids(run)
    if not mission_ids:
        return

    for event in db.query(Event).filter(Event.mission_id.in_(mission_ids), Event.severity != "info").all():
        event.acknowledged = True
        event.acknowledged_at = now
        event.acknowledged_by = "autonomous_resolution"

    for cluster in db.query(AnomalyCluster).filter(AnomalyCluster.mission_id.in_(mission_ids)).all():
        cluster.status = "resolved"
        cluster.updated_at = now


def _run_mission_ids(run: OrchestrationScenarioRun) -> set[str]:
    mission_ids = {run.primary_mission_id} if run.primary_mission_id else set()
    for item in run.timeline or []:
        if item.get("mission_id"):
            mission_ids.add(item["mission_id"])
    return mission_ids


def _upsert_reroute(db: Session, mission_id: str, asset_id: str, now: datetime) -> None:
    suggestion = db.query(RerouteSuggestion).filter(RerouteSuggestion.mission_id == mission_id, RerouteSuggestion.asset_id == asset_id).first()
    path = [
        {"latitude": FACILITY_ZONES["perimeter_route"]["latitude"], "longitude": FACILITY_ZONES["perimeter_route"]["longitude"], "timestamp": now.isoformat()},
        {"latitude": FACILITY_ZONES["sector_c"]["latitude"], "longitude": FACILITY_ZONES["sector_c"]["longitude"], "timestamp": (now + timedelta(minutes=3)).isoformat()},
    ]
    if suggestion is None:
        db.add(
            RerouteSuggestion(
                id=make_id("reroute"),
                mission_id=mission_id,
                asset_id=asset_id,
                reason="Sector C coverage gap projected in 4m; reroute Drone Bravo through perimeter route.",
                status="pending",
                risk_score=67,
                confidence=0.77,
                suggested_path=path,
                created_at=now,
                updated_at=now,
            )
        )
    else:
        suggestion.reason = "Sector C coverage gap projected in 4m; reroute Drone Bravo through perimeter route."
        suggestion.risk_score = 67
        suggestion.confidence = 0.77
        suggestion.suggested_path = path
        suggestion.updated_at = now
