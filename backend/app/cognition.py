from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta

from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from .models import (
    AnomalyCluster,
    Asset,
    CausalityEdge,
    CoordinationAction,
    EcosystemSnapshot,
    Event,
    Mission,
    MissionDependency,
    PredictionState,
    ReasoningEvent,
    ReplayPath,
    RerouteSuggestion,
    RiskField,
    TelemetryRecord,
    make_id,
)


COGNITION_EVENT_TYPES = {
    "signal_fluctuation",
    "battery_warning",
    "obstacle_detected",
    "mission_delay",
    "camera_feed_interrupted",
    "camera_obstruction",
    "mission_rejected",
    "motion_validation",
    "second_intrusion_path",
    "thermal_anomaly_spike",
    "waypoint_rejected",
}

REROUTE_EVENT_TYPES = {
    "signal_fluctuation",
    "battery_warning",
    "obstacle_detected",
    "mission_delay",
    "camera_feed_interrupted",
}


def _now() -> datetime:
    return datetime.now(UTC)


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _older_than(value: datetime, now: datetime, seconds: int) -> bool:
    cutoff = now - timedelta(seconds=seconds)
    if value.tzinfo is None and cutoff.tzinfo is not None:
        cutoff = cutoff.replace(tzinfo=None)
    return value < cutoff


def _distance(a: Asset, b: Asset) -> float:
    return math.sqrt((a.latitude - b.latitude) ** 2 + (a.longitude - b.longitude) ** 2)


def _path_point(
    latitude: float,
    longitude: float,
    timestamp: datetime | None = None,
    heading: float | None = None,
    speed: float | None = None,
    battery: float | None = None,
) -> dict:
    point = {
        "latitude": round(latitude, 6),
        "longitude": round(longitude, 6),
        "timestamp": (timestamp or _now()).isoformat(),
    }
    if heading is not None:
        point["heading"] = round(heading, 2)
    if speed is not None:
        point["speed"] = round(speed, 2)
    if battery is not None:
        point["battery"] = round(battery, 2)
    return point


def persist_replay_point(db: Session, asset: Asset, mission_id: str | None, timestamp: datetime) -> ReplayPath | None:
    if not mission_id:
        return None

    path = db.query(ReplayPath).filter(ReplayPath.mission_id == mission_id).first()
    point = _path_point(asset.latitude, asset.longitude, timestamp, asset.heading, asset.speed, asset.battery)
    if path is None:
        path = ReplayPath(
            id=make_id("replay"),
            mission_id=mission_id,
            asset_id=asset.id,
            path=[point],
            point_count=1,
            source="telemetry",
        )
        db.add(path)
        db.flush()
        return path

    next_path = [*(path.path or []), point]
    path.asset_id = path.asset_id or asset.id
    path.path = next_path[-240:]
    path.point_count = len(path.path)
    path.updated_at = timestamp
    return path


def build_replay_path_from_records(db: Session, mission: Mission) -> ReplayPath:
    existing = db.query(ReplayPath).filter(ReplayPath.mission_id == mission.id).first()
    if existing is not None:
        return existing

    records = (
        db.query(TelemetryRecord)
        .filter(TelemetryRecord.mission_id == mission.id)
        .order_by(asc(TelemetryRecord.timestamp), asc(TelemetryRecord.id))
        .all()
    )
    path_points = [
        _path_point(record.latitude, record.longitude, record.timestamp, record.heading, record.speed, record.battery)
        for record in records
    ]
    if not path_points and mission.start_latitude is not None and mission.start_longitude is not None:
        path_points.append(_path_point(mission.start_latitude, mission.start_longitude, mission.started_at))
    if mission.completed_at is not None or path_points:
        path_points.append(_path_point(mission.target_latitude, mission.target_longitude, mission.completed_at))

    replay = ReplayPath(
        id=make_id("replay"),
        mission_id=mission.id,
        asset_id=mission.assigned_asset_id,
        path=path_points,
        point_count=len(path_points),
        source="telemetry" if records else "mission_projection",
    )
    db.add(replay)
    db.flush()
    return replay


def create_mission_dependencies(db: Session, mission: Mission, source_asset: Asset) -> list[MissionDependency]:
    candidates = (
        db.query(Asset)
        .filter(Asset.id != source_asset.id, Asset.status != "offline")
        .all()
    )
    ranked = sorted(
        candidates,
        key=lambda asset: (
            0 if asset.asset_type == "camera" else 1 if asset.asset_type == "sensor" else 2,
            _distance(source_asset, asset),
        ),
    )[:4]

    dependencies: list[MissionDependency] = []
    for index, target_asset in enumerate(ranked):
        existing = (
            db.query(MissionDependency)
            .filter(
                MissionDependency.mission_id == mission.id,
                MissionDependency.source_asset_id == source_asset.id,
                MissionDependency.target_asset_id == target_asset.id,
            )
            .first()
        )
        strength = round(_clamp(0.92 - index * 0.11 - _distance(source_asset, target_asset) * 1.5, 0.32, 0.92), 2)
        reason = (
            f"{target_asset.name} assigned as supporting node for {mission.target_zone}; "
            f"dependency strength {strength:.2f} based on proximity and sensing capability."
        )
        if existing is None:
            existing = MissionDependency(
                id=make_id("dependency"),
                mission_id=mission.id,
                source_asset_id=source_asset.id,
                target_asset_id=target_asset.id,
                dependency_type="validation_support" if target_asset.asset_type == "camera" else "coordination_support",
                strength=strength,
                active=True,
                reason=reason,
            )
            db.add(existing)
        else:
            existing.active = True
            existing.strength = strength
            existing.reason = reason
        dependencies.append(existing)

    db.flush()
    return dependencies


def deactivate_mission_dependencies(db: Session, mission_id: str) -> None:
    dependencies = db.query(MissionDependency).filter(MissionDependency.mission_id == mission_id).all()
    for dependency in dependencies:
        dependency.active = False


def record_operational_event(db: Session, event: Event) -> None:
    if event.event_type not in COGNITION_EVENT_TYPES and event.severity == "info":
        return

    coordinates = _event_coordinates(db, event)
    if coordinates is None:
        return

    latitude, longitude = coordinates
    cluster = (
        db.query(AnomalyCluster)
        .filter(
            AnomalyCluster.event_type == event.event_type,
            AnomalyCluster.asset_id == event.asset_id,
            AnomalyCluster.mission_id == event.mission_id,
            AnomalyCluster.status == "active",
        )
        .order_by(desc(AnomalyCluster.last_seen_at))
        .first()
    )
    severity_radius = {"critical": 1450, "warning": 950, "info": 650}.get(event.severity, 850)
    confidence = {"critical": 0.82, "warning": 0.66, "info": 0.48}.get(event.severity, 0.55)

    if cluster is None:
        cluster = AnomalyCluster(
            id=make_id("cluster"),
            event_type=event.event_type,
            severity=event.severity,
            asset_id=event.asset_id,
            mission_id=event.mission_id,
            latitude=latitude,
            longitude=longitude,
            radius=severity_radius,
            event_count=1,
            confidence=confidence,
            message=event.message,
            first_seen_at=event.timestamp,
            last_seen_at=event.timestamp,
        )
        db.add(cluster)
    else:
        cluster.severity = _max_severity(cluster.severity, event.severity)
        cluster.latitude = round((cluster.latitude * cluster.event_count + latitude) / (cluster.event_count + 1), 6)
        cluster.longitude = round((cluster.longitude * cluster.event_count + longitude) / (cluster.event_count + 1), 6)
        cluster.event_count += 1
        cluster.radius = min(2400, cluster.radius + 85)
        cluster.confidence = round(_clamp(cluster.confidence + 0.06, 0.1, 0.96), 2)
        cluster.message = event.message
        cluster.last_seen_at = event.timestamp

    if event.event_type in REROUTE_EVENT_TYPES and event.asset_id and event.mission_id:
        _upsert_reroute_suggestion(db, event)

    db.flush()


def _event_coordinates(db: Session, event: Event) -> tuple[float, float] | None:
    if event.asset_id:
        asset = db.get(Asset, event.asset_id)
        if asset is not None:
            return asset.latitude, asset.longitude

    if event.mission_id:
        mission = db.get(Mission, event.mission_id)
        if mission is not None:
            return mission.target_latitude, mission.target_longitude

    return None


def _max_severity(current: str, incoming: str) -> str:
    order = {"info": 0, "warning": 1, "critical": 2}
    return incoming if order.get(incoming, 0) > order.get(current, 0) else current


def _upsert_reroute_suggestion(db: Session, event: Event) -> None:
    mission = db.get(Mission, event.mission_id)
    asset = db.get(Asset, event.asset_id)
    if mission is None or asset is None:
        return

    suggested_path = _suggested_path(asset, mission, event.event_type)
    risk_score = round(
        _clamp(
            (100 - asset.battery) * 0.24
            + (18 if event.severity == "warning" else 30 if event.severity == "critical" else 8)
            + (12 if event.event_type in {"obstacle_detected", "mission_delay"} else 4),
            18,
            94,
        ),
        2,
    )
    confidence = round(_clamp(0.58 + risk_score / 220, 0.55, 0.92), 2)
    reason = f"{event.event_type.replace('_', ' ')} near {mission.target_zone}; projected route updated from persisted telemetry."

    suggestion = (
        db.query(RerouteSuggestion)
        .filter(
            RerouteSuggestion.mission_id == mission.id,
            RerouteSuggestion.asset_id == asset.id,
            RerouteSuggestion.status == "pending",
        )
        .first()
    )
    if suggestion is None:
        suggestion = RerouteSuggestion(
            id=make_id("reroute"),
            mission_id=mission.id,
            asset_id=asset.id,
            reason=reason,
            status="pending",
            risk_score=risk_score,
            confidence=confidence,
            suggested_path=suggested_path,
        )
        db.add(suggestion)
    else:
        suggestion.reason = reason
        suggestion.risk_score = risk_score
        suggestion.confidence = confidence
        suggestion.suggested_path = suggested_path
        suggestion.updated_at = event.timestamp


def _suggested_path(asset: Asset, mission: Mission, event_type: str) -> list[dict]:
    direction = -1 if event_type in {"signal_fluctuation", "camera_feed_interrupted"} else 1
    midpoint_latitude = (asset.latitude + mission.target_latitude) / 2 + direction * 0.006
    midpoint_longitude = (asset.longitude + mission.target_longitude) / 2 - direction * 0.006
    return [
        _path_point(asset.latitude, asset.longitude),
        _path_point(midpoint_latitude, midpoint_longitude),
        _path_point(mission.target_latitude, mission.target_longitude),
    ]


def telemetry_trails(db: Session, limit_per_asset: int = 48) -> list[dict]:
    records = (
        db.query(TelemetryRecord)
        .order_by(desc(TelemetryRecord.timestamp), desc(TelemetryRecord.id))
        .limit(limit_per_asset * 16)
        .all()
    )
    grouped: dict[str, list[TelemetryRecord]] = {}
    for record in records:
        grouped.setdefault(record.asset_id, [])
        if len(grouped[record.asset_id]) < limit_per_asset:
            grouped[record.asset_id].append(record)

    trails = []
    for asset_id, asset_records in grouped.items():
        ordered = list(reversed(asset_records))
        latest = ordered[-1]
        trails.append(
            {
                "asset_id": asset_id,
                "mission_id": latest.mission_id,
                "point_count": len(ordered),
                "points": [
                    _path_point(record.latitude, record.longitude, record.timestamp, record.heading, record.speed, record.battery)
                    for record in ordered
                ],
                "updated_at": latest.timestamp,
            }
        )
    return sorted(trails, key=lambda item: item["updated_at"], reverse=True)


def signal_quality(asset: Asset, events: list[Event]) -> float:
    recent_penalty = sum(1 for event in events if event.asset_id == asset.id and event.severity != "info") * 8
    status_penalty = 68 if asset.status == "offline" else 22 if asset.status == "warning" else 0
    mobility_noise = 8 if asset.status == "mission" else 2
    return round(_clamp(96 - recent_penalty - status_penalty - mobility_noise, 0, 100), 2)


def operational_confidence(asset: Asset, events: list[Event]) -> float:
    signal = signal_quality(asset, events)
    state_bonus = 7 if asset.status == "mission" else -35 if asset.status == "offline" else 0
    return round(_clamp(signal * 0.48 + asset.battery * 0.44 + state_bonus, 0, 100), 2)


def failure_probability(asset: Asset, events: list[Event]) -> float:
    signal_risk = 100 - signal_quality(asset, events)
    battery_risk = max(0, 35 - asset.battery) * 1.8
    event_risk = sum(1 for event in events if event.asset_id == asset.id and event.severity != "info") * 9
    return round(_clamp(signal_risk * 0.45 + battery_risk + event_risk, 0, 100), 2)


def evaluate_cognition_cycle(db: Session, timestamp: datetime | None = None) -> dict:
    now = timestamp or _now()
    assets = db.query(Asset).order_by(Asset.id).all()
    missions = db.query(Mission).order_by(desc(Mission.created_at)).all()
    active_missions = [mission for mission in missions if mission.status in {"approved", "running"}]
    recent_events = db.query(Event).filter(Event.timestamp >= now - timedelta(minutes=20)).order_by(desc(Event.timestamp)).all()
    clusters = db.query(AnomalyCluster).filter(AnomalyCluster.status == "active").all()

    for mission in active_missions:
        asset = db.get(Asset, mission.assigned_asset_id) if mission.assigned_asset_id else None
        if asset is not None:
            create_mission_dependencies(db, mission, asset)

    _upsert_causality_edges(db, assets, active_missions, clusters, now)
    _upsert_predictions(db, assets, active_missions, recent_events, now)
    _upsert_risk_fields(db, assets, clusters, recent_events, now)
    _upsert_coordination_actions(db, assets, active_missions, clusters, recent_events, now)
    _create_reasoning_events(db, assets, active_missions, clusters, recent_events, now)
    ecosystem = _create_ecosystem_snapshot(db, assets, active_missions, recent_events, now)
    db.flush()
    return core_cognition_state(db, ecosystem)


def core_cognition_state(db: Session, ecosystem: EcosystemSnapshot | None = None) -> dict:
    latest_ecosystem = ecosystem or db.query(EcosystemSnapshot).order_by(desc(EcosystemSnapshot.timestamp)).first()
    if latest_ecosystem is None:
        latest_ecosystem = _create_ecosystem_snapshot(db, db.query(Asset).all(), db.query(Mission).all(), [], _now())
        db.flush()

    return {
        "reasoning_events": db.query(ReasoningEvent).order_by(desc(ReasoningEvent.timestamp)).limit(40).all(),
        "causality_graph": {
            "nodes": _causality_nodes(db),
            "edges": db.query(CausalityEdge).filter(CausalityEdge.active.is_(True)).order_by(desc(CausalityEdge.updated_at)).limit(120).all(),
        },
        "predictions": db.query(PredictionState).order_by(PredictionState.horizon_minutes.asc(), desc(PredictionState.probability)).limit(120).all(),
        "coordination_actions": db.query(CoordinationAction).order_by(desc(CoordinationAction.updated_at)).limit(60).all(),
        "risk_fields": db.query(RiskField).order_by(desc(RiskField.risk_score), desc(RiskField.updated_at)).limit(80).all(),
        "ecosystem": latest_ecosystem,
    }


def _upsert_causality_edges(
    db: Session,
    assets: list[Asset],
    active_missions: list[Mission],
    clusters: list[AnomalyCluster],
    now: datetime,
) -> None:
    active_ids: set[str] = set()
    for mission in active_missions:
        if mission.assigned_asset_id:
            active_ids.add(
                _upsert_edge(
                    db,
                    "asset",
                    mission.assigned_asset_id,
                    "mission",
                    mission.id,
                    "mission_execution",
                    0.88 if mission.status == "running" else 0.62,
                    86,
                    f"{mission.assigned_asset_id} is operationally coupled to {mission.name}.",
                    now,
                ).id
            )

    for asset in assets:
        if asset.status == "offline":
            continue
        active_ids.add(
            _upsert_edge(
                db,
                "asset",
                asset.id,
                "zone",
                "johannesburg_core",
                "coverage_continuity",
                0.38 + asset.battery / 240,
                54 + asset.battery * 0.34,
                f"{asset.name} contributes autonomous coverage continuity to the Johannesburg operating zone.",
                now,
            ).id
        )

    for dependency in db.query(MissionDependency).filter(MissionDependency.active.is_(True)).all():
        active_ids.add(
            _upsert_edge(
                db,
                "asset",
                dependency.source_asset_id,
                "asset",
                dependency.target_asset_id,
                dependency.dependency_type,
                dependency.strength,
                dependency.strength * 100,
                dependency.reason,
                now,
            ).id
        )

    for cluster in clusters:
        if cluster.asset_id:
            active_ids.add(
                _upsert_edge(
                    db,
                    "anomaly",
                    cluster.id,
                    "asset",
                    cluster.asset_id,
                    "anomaly_pressure",
                    _clamp(cluster.confidence, 0.1, 1),
                    cluster.confidence * 100,
                    cluster.message,
                    now,
                ).id
            )
        if cluster.mission_id:
            active_ids.add(
                _upsert_edge(
                    db,
                    "anomaly",
                    cluster.id,
                    "mission",
                    cluster.mission_id,
                    "mission_risk_propagation",
                    _clamp(cluster.confidence, 0.1, 1),
                    cluster.confidence * 100,
                    cluster.message,
                    now,
                ).id
            )

    for edge in db.query(CausalityEdge).filter(CausalityEdge.active.is_(True)).all():
        if edge.id not in active_ids and _older_than(edge.updated_at, now, 8):
            edge.active = False


def _upsert_edge(
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
) -> CausalityEdge:
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
            weight=round(_clamp(weight, 0.05, 1), 2),
            confidence=round(_clamp(confidence, 0, 100), 2),
            active=True,
            message=message,
        )
        db.add(edge)
    else:
        edge.weight = round(_clamp(weight, 0.05, 1), 2)
        edge.confidence = round(_clamp(confidence, 0, 100), 2)
        edge.active = True
        edge.message = message
        edge.updated_at = now
    return edge


def _upsert_predictions(
    db: Session,
    assets: list[Asset],
    active_missions: list[Mission],
    recent_events: list[Event],
    now: datetime,
) -> None:
    mission_by_asset = {mission.assigned_asset_id: mission for mission in active_missions if mission.assigned_asset_id}
    for asset in assets:
        for horizon in (5, 15, 30):
            mission = mission_by_asset.get(asset.id)
            drain = (0.22 if asset.status == "mission" else 0.04) * horizon * 60
            projected_battery = max(0, asset.battery - drain)
            probability = _clamp((35 - projected_battery) * 2.2 + failure_probability(asset, recent_events) * 0.42, 0, 100)
            confidence = operational_confidence(asset, recent_events)
            lat, lon = _project_position(asset, mission, horizon)
            _upsert_prediction(
                db,
                horizon,
                "asset",
                asset.id,
                "battery_exhaustion",
                probability,
                confidence,
                100 - confidence,
                lat,
                lon,
                f"{asset.name} battery exhaustion probability in {horizon}m: {probability:.0f}%.",
                now,
            )
            signal_prob = _clamp((100 - signal_quality(asset, recent_events)) * 0.75 + horizon * 0.55, 0, 100)
            _upsert_prediction(
                db,
                horizon,
                "asset",
                asset.id,
                "signal_degradation",
                signal_prob,
                confidence,
                100 - confidence,
                lat,
                lon,
                f"{asset.name} signal degradation projection in {horizon}m: {signal_prob:.0f}%.",
                now,
            )

    running = [mission for mission in active_missions if mission.status == "running"]
    if len(running) > 1:
        for horizon in (5, 15, 30):
            probability = _clamp(28 + len(running) * 9 + horizon * 0.7, 0, 100)
            _upsert_prediction(
                db,
                horizon,
                "zone",
                "johannesburg_core",
                "mission_collision",
                probability,
                72,
                28,
                -26.2041,
                28.0473,
                f"Projected mission interaction pressure in {horizon}m: {probability:.0f}%.",
                now,
            )


def _upsert_prediction(
    db: Session,
    horizon: int,
    entity_type: str,
    entity_id: str,
    prediction_type: str,
    probability: float,
    confidence: float,
    uncertainty: float,
    projected_latitude: float | None,
    projected_longitude: float | None,
    message: str,
    now: datetime,
) -> None:
    prediction = (
        db.query(PredictionState)
        .filter(
            PredictionState.horizon_minutes == horizon,
            PredictionState.entity_type == entity_type,
            PredictionState.entity_id == entity_id,
            PredictionState.prediction_type == prediction_type,
        )
        .first()
    )
    if prediction is None:
        prediction = PredictionState(
            id=make_id("prediction"),
            horizon_minutes=horizon,
            entity_type=entity_type,
            entity_id=entity_id,
            prediction_type=prediction_type,
            probability=round(_clamp(probability, 0, 100), 2),
            confidence=round(_clamp(confidence, 0, 100), 2),
            uncertainty=round(_clamp(uncertainty, 0, 100), 2),
            projected_latitude=projected_latitude,
            projected_longitude=projected_longitude,
            message=message,
            projected_at=now + timedelta(minutes=horizon),
        )
        db.add(prediction)
    else:
        prediction.probability = round(_clamp(probability, 0, 100), 2)
        prediction.confidence = round(_clamp(confidence, 0, 100), 2)
        prediction.uncertainty = round(_clamp(uncertainty, 0, 100), 2)
        prediction.projected_latitude = projected_latitude
        prediction.projected_longitude = projected_longitude
        prediction.message = message
        prediction.projected_at = now + timedelta(minutes=horizon)
        prediction.updated_at = now


def _project_position(asset: Asset, mission: Mission | None, horizon: int) -> tuple[float, float]:
    if mission is None:
        return asset.latitude, asset.longitude
    factor = _clamp(horizon / 18, 0.08, 1)
    return (
        round(asset.latitude + (mission.target_latitude - asset.latitude) * factor, 6),
        round(asset.longitude + (mission.target_longitude - asset.longitude) * factor, 6),
    )


def _upsert_risk_fields(db: Session, assets: list[Asset], clusters: list[AnomalyCluster], recent_events: list[Event], now: datetime) -> None:
    active_zone_ids: set[str] = set()
    for asset in assets:
        risk = failure_probability(asset, recent_events)
        active_zone_ids.add(asset.id)
        _upsert_risk_field(
            db,
            asset.id,
            asset.latitude,
            asset.longitude,
            650 + risk * 8,
            "asset_operational_risk",
            risk,
            operational_confidence(asset, recent_events),
            100 - operational_confidence(asset, recent_events),
            f"{asset.name} operational risk field at {risk:.0f}%.",
            now,
        )
    for cluster in clusters:
        zone_id = f"cluster:{cluster.id}"
        active_zone_ids.add(zone_id)
        risk = _clamp(cluster.confidence * 100 + cluster.event_count * 4, 0, 100)
        _upsert_risk_field(
            db,
            zone_id,
            cluster.latitude,
            cluster.longitude,
            cluster.radius,
            "anomaly_propagation",
            risk,
            cluster.confidence * 100,
            100 - cluster.confidence * 100,
            cluster.message,
            now,
        )
    for field in db.query(RiskField).all():
        if field.zone_id not in active_zone_ids and _older_than(field.updated_at, now, 15):
            field.risk_score = max(0, field.risk_score - 8)
            field.updated_at = now


def _upsert_risk_field(
    db: Session,
    zone_id: str,
    latitude: float,
    longitude: float,
    radius: float,
    risk_type: str,
    risk_score: float,
    confidence: float,
    uncertainty: float,
    message: str,
    now: datetime,
) -> None:
    field = db.query(RiskField).filter(RiskField.zone_id == zone_id, RiskField.risk_type == risk_type).first()
    if field is None:
        field = RiskField(
            id=make_id("risk"),
            zone_id=zone_id,
            latitude=latitude,
            longitude=longitude,
            radius=round(radius, 2),
            risk_type=risk_type,
            risk_score=round(_clamp(risk_score, 0, 100), 2),
            confidence=round(_clamp(confidence, 0, 100), 2),
            uncertainty=round(_clamp(uncertainty, 0, 100), 2),
            message=message,
        )
        db.add(field)
    else:
        field.latitude = latitude
        field.longitude = longitude
        field.radius = round(radius, 2)
        field.risk_score = round(_clamp(risk_score, 0, 100), 2)
        field.confidence = round(_clamp(confidence, 0, 100), 2)
        field.uncertainty = round(_clamp(uncertainty, 0, 100), 2)
        field.message = message
        field.updated_at = now


def _upsert_coordination_actions(
    db: Session,
    assets: list[Asset],
    active_missions: list[Mission],
    clusters: list[AnomalyCluster],
    recent_events: list[Event],
    now: datetime,
) -> None:
    asset_by_id = {asset.id: asset for asset in assets}
    cameras = [asset for asset in assets if asset.asset_type == "camera" and asset.status != "offline"]
    robots = [asset for asset in assets if asset.asset_type == "ground_robot" and asset.status != "offline"]
    for mission in active_missions:
        source = asset_by_id.get(mission.assigned_asset_id or "")
        if source is None:
            continue
        target = min(cameras, key=lambda camera: _distance(source, camera), default=None)
        if target is not None:
            _upsert_action(
                db,
                "verification_chain",
                source.id,
                target.id,
                mission.id,
                mission.priority,
                operational_confidence(source, recent_events),
                f"{source.name} requested {target.name} to maintain validation continuity for {mission.target_zone}.",
                now,
            )

    for cluster in clusters:
        if cluster.severity == "info":
            continue
        target = min(robots, key=lambda robot: math.sqrt((robot.latitude - cluster.latitude) ** 2 + (robot.longitude - cluster.longitude) ** 2), default=None)
        if target is not None:
            _upsert_action(
                db,
                "secondary_verification",
                cluster.asset_id,
                target.id,
                cluster.mission_id,
                "high" if cluster.severity == "critical" else "medium",
                cluster.confidence * 100,
                f"{target.name} reserved for secondary verification of {cluster.event_type.replace('_', ' ')}.",
                now,
            )

    if not active_missions:
        mobile_assets = [asset for asset in assets if asset.asset_type in {"drone", "ground_robot"} and asset.status != "offline"]
        fixed_assets = [asset for asset in assets if asset.asset_type in {"camera", "sensor"} and asset.status != "offline"]
        source = max(mobile_assets, key=lambda asset: operational_confidence(asset, recent_events), default=None)
        target = min(fixed_assets, key=lambda asset: _distance(source, asset), default=None) if source is not None else None
        if source is not None and target is not None:
            confidence = operational_confidence(source, recent_events)
            _upsert_action(
                db,
                "coverage_rebalance",
                source.id,
                target.id,
                None,
                "low",
                confidence,
                f"{source.name} and {target.name} are maintaining autonomous coverage continuity while the mission queue is idle.",
                now,
            )


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
            CoordinationAction.status == "active",
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
            priority=priority if priority in {"low", "medium", "high", "critical"} else "medium",
            confidence=round(_clamp(confidence, 0, 100), 2),
            rationale=rationale,
        )
        db.add(action)
    else:
        action.confidence = round(_clamp(confidence, 0, 100), 2)
        action.priority = priority if priority in {"low", "medium", "high", "critical"} else "medium"
        action.rationale = rationale
        action.updated_at = now


def _create_reasoning_events(
    db: Session,
    assets: list[Asset],
    active_missions: list[Mission],
    clusters: list[AnomalyCluster],
    recent_events: list[Event],
    now: datetime,
) -> None:
    candidates: list[tuple[str, str, str, float, float, str | None, str | None]] = []
    for mission in active_missions:
        asset = next((item for item in assets if item.id == mission.assigned_asset_id), None)
        if asset is None:
            continue
        risk = failure_probability(asset, recent_events)
        confidence = operational_confidence(asset, recent_events)
        if risk > 35:
            candidates.append((
                "prediction",
                "warning",
                f"{asset.name} rerouted due to projected instability around {mission.target_zone}; mission confidence {confidence:.0f}%.",
                confidence,
                100 - confidence,
                asset.id,
                mission.id,
            ))
        else:
            candidates.append((
                "coordination",
                "info",
                f"{mission.name} in {mission.target_zone} is being coordinated through autonomous support links.",
                confidence,
                100 - confidence,
                asset.id,
                mission.id,
            ))

    for cluster in clusters[:4]:
        candidates.append((
            "anomaly",
            cluster.severity,
            f"{cluster.event_type.replace('_', ' ').title()} confidence {cluster.confidence * 100:.0f}% with propagation radius {cluster.radius:.0f}m.",
            cluster.confidence * 100,
            100 - cluster.confidence * 100,
            cluster.asset_id,
            cluster.mission_id,
        ))

    if not candidates:
        mean_confidence = sum(operational_confidence(asset, recent_events) for asset in assets) / max(len(assets), 1)
        candidates.append((
            "ecosystem",
            "info",
            f"Coverage continuity stable; autonomous infrastructure mesh confidence {mean_confidence:.0f}%.",
            mean_confidence,
            100 - mean_confidence,
            None,
            None,
        ))

    existing_messages = {
        event.message
        for event in db.query(ReasoningEvent).filter(ReasoningEvent.timestamp >= now - timedelta(seconds=12)).all()
    }
    for category, severity, message, confidence, uncertainty, asset_id, mission_id in candidates[:4]:
        if message in existing_messages:
            continue
        db.add(
            ReasoningEvent(
                id=make_id("reasoning"),
                category=category,
                severity=severity,
                message=message,
                asset_id=asset_id,
                mission_id=mission_id,
                confidence=round(_clamp(confidence, 0, 100), 2),
                uncertainty=round(_clamp(uncertainty, 0, 100), 2),
                timestamp=now,
            )
        )


def _create_ecosystem_snapshot(
    db: Session,
    assets: list[Asset],
    active_missions: list[Mission],
    recent_events: list[Event],
    now: datetime,
) -> EcosystemSnapshot:
    confidences = [operational_confidence(asset, recent_events) for asset in assets]
    risks = [failure_probability(asset, recent_events) for asset in assets]
    mean_confidence = sum(confidences) / max(len(confidences), 1)
    risk_index = sum(risks) / max(len(risks), 1)
    operational_load = _clamp(len(active_missions) / max(len(assets), 1) * 100, 0, 100)
    resource_contention = _clamp(max(0, len(active_missions) - 1) * 22 + risk_index * 0.25, 0, 100)
    coverage_continuity = _clamp(mean_confidence - resource_contention * 0.18, 0, 100)
    if risk_index > 68 or coverage_continuity < 38:
        system_state = "critical"
    elif risk_index > 42 or resource_contention > 58:
        system_state = "stressed"
    elif active_missions:
        system_state = "coordinating"
    else:
        system_state = "nominal"
    snapshot = EcosystemSnapshot(
        system_state=system_state,
        operational_load=round(operational_load, 2),
        resource_contention=round(resource_contention, 2),
        coverage_continuity=round(coverage_continuity, 2),
        mean_confidence=round(mean_confidence, 2),
        risk_index=round(risk_index, 2),
        active_reasoning_count=db.query(ReasoningEvent).filter(ReasoningEvent.timestamp >= now - timedelta(minutes=2)).count(),
        timestamp=now,
    )
    db.add(snapshot)
    return snapshot


def _causality_nodes(db: Session) -> list[dict]:
    recent_events = db.query(Event).order_by(desc(Event.timestamp)).limit(40).all()
    nodes: list[dict] = []
    for asset in db.query(Asset).order_by(Asset.id).all():
        confidence = operational_confidence(asset, recent_events)
        nodes.append(
            {
                "id": asset.id,
                "node_type": "asset",
                "label": asset.name,
                "status": asset.status,
                "latitude": asset.latitude,
                "longitude": asset.longitude,
                "confidence": confidence,
                "uncertainty": 100 - confidence,
                "risk_score": failure_probability(asset, recent_events),
            }
        )
    for mission in db.query(Mission).order_by(desc(Mission.created_at)).limit(20).all():
        status_risk = {"pending": 18, "approved": 24, "running": 38, "completed": 4, "failed": 82, "aborted": 48}.get(mission.status, 20)
        nodes.append(
            {
                "id": mission.id,
                "node_type": "mission",
                "label": mission.name,
                "status": mission.status,
                "latitude": mission.target_latitude,
                "longitude": mission.target_longitude,
                "confidence": max(10, 100 - status_risk),
                "uncertainty": status_risk,
                "risk_score": status_risk,
            }
        )
    for cluster in db.query(AnomalyCluster).filter(AnomalyCluster.status == "active").order_by(desc(AnomalyCluster.last_seen_at)).limit(20).all():
        nodes.append(
            {
                "id": cluster.id,
                "node_type": "anomaly",
                "label": cluster.event_type.replace("_", " "),
                "status": cluster.severity,
                "latitude": cluster.latitude,
                "longitude": cluster.longitude,
                "confidence": cluster.confidence * 100,
                "uncertainty": 100 - cluster.confidence * 100,
                "risk_score": _clamp(cluster.confidence * 100 + cluster.event_count * 4, 0, 100),
            }
        )
    nodes.append(
        {
            "id": "johannesburg_core",
            "node_type": "zone",
            "label": "Johannesburg operating zone",
            "status": "active",
            "latitude": -26.2041,
            "longitude": 28.0473,
            "confidence": 82,
            "uncertainty": 18,
            "risk_score": 22,
        }
    )
    for zone_id, label, latitude, longitude, risk_score in [
        ("sector_a", "Sector A", -26.2024, 28.0432, 18),
        ("sector_b", "Sector B", -26.1972, 28.0536, 42),
        ("sector_c", "Sector C", -26.2069, 28.0606, 36),
        ("loading_bay", "Loading Bay", -26.2127, 28.0481, 31),
        ("storage_zone", "Storage Zone", -26.2058, 28.0374, 22),
        ("perimeter_route", "Perimeter Route", -26.2165, 28.0589, 28),
        ("facility", "Industrial facility", -26.2041, 28.0503, 24),
    ]:
        nodes.append(
            {
                "id": zone_id,
                "node_type": "zone",
                "label": label,
                "status": "active",
                "latitude": latitude,
                "longitude": longitude,
                "confidence": 78,
                "uncertainty": 22,
                "risk_score": risk_score,
            }
        )
    return nodes
