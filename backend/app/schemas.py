from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


AssetType = Literal["drone", "ground_robot", "camera", "sensor"]
AssetStatus = Literal["idle", "active", "mission", "warning", "offline"]
MissionType = Literal["inspect_zone", "patrol_route", "investigate_alert", "return_home"]
MissionStatus = Literal["pending", "approved", "running", "completed", "failed", "aborted"]
Severity = Literal["info", "warning", "critical"]
Priority = Literal["low", "medium", "high", "critical"]


class AssetBase(BaseModel):
    name: str
    asset_type: AssetType
    status: AssetStatus = "idle"
    latitude: float
    longitude: float
    battery: float = Field(default=100, ge=0, le=100)
    speed: float = Field(default=0, ge=0)
    heading: float = Field(default=0, ge=0, le=360)
    current_mission_id: str | None = None
    capabilities: list[str] = Field(default_factory=list)


class AssetCreate(AssetBase):
    id: str | None = None


class AssetUpdate(BaseModel):
    name: str | None = None
    asset_type: AssetType | None = None
    status: AssetStatus | None = None
    latitude: float | None = None
    longitude: float | None = None
    battery: float | None = Field(default=None, ge=0, le=100)
    speed: float | None = Field(default=None, ge=0)
    heading: float | None = Field(default=None, ge=0, le=360)
    current_mission_id: str | None = None
    capabilities: list[str] | None = None


class AssetOut(AssetBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime


class MissionBase(BaseModel):
    name: str
    mission_type: MissionType
    assigned_asset_id: str | None = None
    target_zone: str
    target_latitude: float
    target_longitude: float
    priority: Priority = "medium"


class MissionCreate(MissionBase):
    id: str | None = None


class MissionUpdate(BaseModel):
    name: str | None = None
    mission_type: MissionType | None = None
    status: MissionStatus | None = None
    assigned_asset_id: str | None = None
    target_zone: str | None = None
    target_latitude: float | None = None
    target_longitude: float | None = None
    priority: Priority | None = None


class MissionOut(MissionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: MissionStatus
    start_latitude: float | None = None
    start_longitude: float | None = None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None


class MissionWaypointCreate(BaseModel):
    label: str
    latitude: float
    longitude: float


class MissionWaypointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    mission_id: str
    sequence: int
    label: str
    latitude: float
    longitude: float
    reached_at: datetime | None = None
    created_at: datetime


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_type: str
    severity: Severity
    asset_id: str | None = None
    mission_id: str | None = None
    message: str
    timestamp: datetime
    acknowledged: bool
    acknowledged_at: datetime | None = None
    acknowledged_by: str | None = None


class EventAcknowledge(BaseModel):
    acknowledged_by: str = "operator"


class TelemetryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    asset_id: str
    latitude: float
    longitude: float
    battery: float
    speed: float
    heading: float
    status: AssetStatus
    mission_id: str | None = None
    timestamp: datetime


class OperationalPathPoint(BaseModel):
    latitude: float
    longitude: float
    timestamp: datetime
    heading: float | None = None
    speed: float | None = None
    battery: float | None = None
    phase: str | None = None
    confidence: float | None = None
    message: str | None = None
    asset_id: str | None = None
    mission_id: str | None = None
    decision_index: int | None = None


class TelemetryTrailOut(BaseModel):
    asset_id: str
    mission_id: str | None = None
    point_count: int
    points: list[OperationalPathPoint]
    updated_at: datetime


class AnomalyClusterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_type: str
    severity: Severity
    asset_id: str | None = None
    mission_id: str | None = None
    latitude: float
    longitude: float
    radius: float
    event_count: int
    confidence: float
    status: str
    message: str
    first_seen_at: datetime
    last_seen_at: datetime
    updated_at: datetime


class MissionDependencyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    mission_id: str
    source_asset_id: str
    target_asset_id: str
    dependency_type: str
    strength: float
    active: bool
    reason: str
    created_at: datetime
    updated_at: datetime


class RerouteSuggestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    mission_id: str
    asset_id: str
    reason: str
    status: str
    risk_score: float
    confidence: float
    suggested_path: list[OperationalPathPoint]
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None = None


class ReplayPathOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    mission_id: str
    asset_id: str | None = None
    path: list[OperationalPathPoint]
    point_count: int
    source: str
    created_at: datetime
    updated_at: datetime


class OperationalStateOut(BaseModel):
    telemetry_trails: list[TelemetryTrailOut]
    anomaly_clusters: list[AnomalyClusterOut]
    mission_dependencies: list[MissionDependencyOut]
    reroute_suggestions: list[RerouteSuggestionOut]
    replay_paths: list[ReplayPathOut]


class ReasoningEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    category: str
    severity: Severity
    message: str
    asset_id: str | None = None
    mission_id: str | None = None
    confidence: float
    uncertainty: float
    timestamp: datetime


class CausalityNodeOut(BaseModel):
    id: str
    node_type: str
    label: str
    status: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    confidence: float
    uncertainty: float
    risk_score: float


class CausalityEdgeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source_type: str
    source_id: str
    target_type: str
    target_id: str
    edge_type: str
    weight: float
    confidence: float
    active: bool
    message: str
    created_at: datetime
    updated_at: datetime


class CausalityGraphOut(BaseModel):
    nodes: list[CausalityNodeOut]
    edges: list[CausalityEdgeOut]


class PredictionStateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    horizon_minutes: int
    entity_type: str
    entity_id: str
    prediction_type: str
    probability: float
    confidence: float
    uncertainty: float
    projected_latitude: float | None = None
    projected_longitude: float | None = None
    message: str
    projected_at: datetime
    updated_at: datetime


class CoordinationActionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    action_type: str
    status: str
    initiator_asset_id: str | None = None
    target_asset_id: str | None = None
    mission_id: str | None = None
    priority: Priority
    confidence: float
    rationale: str
    created_at: datetime
    updated_at: datetime


class RiskFieldOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    zone_id: str
    latitude: float
    longitude: float
    radius: float
    risk_type: str
    risk_score: float
    confidence: float
    uncertainty: float
    message: str
    updated_at: datetime


class EcosystemSnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    system_state: str
    operational_load: float
    resource_contention: float
    coverage_continuity: float
    mean_confidence: float
    risk_index: float
    active_reasoning_count: int
    timestamp: datetime


class CoreCognitionStateOut(BaseModel):
    reasoning_events: list[ReasoningEventOut]
    causality_graph: CausalityGraphOut
    predictions: list[PredictionStateOut]
    coordination_actions: list[CoordinationActionOut]
    risk_fields: list[RiskFieldOut]
    ecosystem: EcosystemSnapshotOut


class StartIndustrialIncidentIn(BaseModel):
    command: str = "Investigate possible intrusion near Sector B."


class OrchestrationScenarioRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    scenario_type: str
    command: str
    status: str
    current_step: int
    phase: str
    selected_asset_id: str | None = None
    primary_mission_id: str | None = None
    confidence: float
    outcome: str | None = None
    timeline: list[dict[str, Any]]
    started_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None


class MissionReplayOut(BaseModel):
    mission_id: str
    asset_id: str | None = None
    point_count: int
    points: list[TelemetryOut]


class ParseMissionIn(BaseModel):
    command: str


class ParsedMissionOut(BaseModel):
    mission_type: MissionType = "inspect_zone"
    target_zone: str = "Zone A"
    priority: Priority = "medium"
    recommended_asset_type: AssetType = "drone"
    requires_operator_approval: bool = True
