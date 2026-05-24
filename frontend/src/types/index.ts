export type AssetType = 'drone' | 'ground_robot' | 'camera' | 'sensor';
export type AssetStatus = 'idle' | 'active' | 'mission' | 'warning' | 'offline';
export type MissionType = 'inspect_zone' | 'patrol_route' | 'investigate_alert' | 'return_home';
export type MissionStatus = 'pending' | 'approved' | 'running' | 'completed' | 'failed' | 'aborted';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type Severity = 'info' | 'warning' | 'critical';

export interface Asset {
  id: string;
  name: string;
  asset_type: AssetType;
  status: AssetStatus;
  latitude: number;
  longitude: number;
  battery: number;
  speed: number;
  heading: number;
  current_mission_id: string | null;
  capabilities: string[];
  created_at: string;
  updated_at: string;
}

export interface Mission {
  id: string;
  name: string;
  mission_type: MissionType;
  status: MissionStatus;
  assigned_asset_id: string | null;
  target_zone: string;
  target_latitude: number;
  target_longitude: number;
  priority: Priority;
  start_latitude: number | null;
  start_longitude: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface MissionWaypoint {
  id: string;
  mission_id: string;
  sequence: number;
  label: string;
  latitude: number;
  longitude: number;
  reached_at: string | null;
  created_at: string;
}

export interface EventLog {
  id: string;
  event_type: string;
  severity: Severity;
  asset_id: string | null;
  mission_id: string | null;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

export interface TelemetryPayload {
  asset_id: string;
  latitude: number;
  longitude: number;
  battery: number;
  speed: number;
  heading: number;
  status: AssetStatus;
  mission_id: string | null;
  timestamp: string;
}

export interface OperationalPathPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  heading?: number | null;
  speed?: number | null;
  battery?: number | null;
  phase?: string | null;
  confidence?: number | null;
  message?: string | null;
  asset_id?: string | null;
  mission_id?: string | null;
  decision_index?: number | null;
}

export interface TelemetryTrail {
  asset_id: string;
  mission_id: string | null;
  point_count: number;
  points: OperationalPathPoint[];
  updated_at: string;
}

export interface AnomalyCluster {
  id: string;
  event_type: string;
  severity: Severity;
  asset_id: string | null;
  mission_id: string | null;
  latitude: number;
  longitude: number;
  radius: number;
  event_count: number;
  confidence: number;
  status: string;
  message: string;
  first_seen_at: string;
  last_seen_at: string;
  updated_at: string;
}

export interface MissionDependency {
  id: string;
  mission_id: string;
  source_asset_id: string;
  target_asset_id: string;
  dependency_type: string;
  strength: number;
  active: boolean;
  reason: string;
  created_at: string;
  updated_at: string;
}

export interface RerouteSuggestion {
  id: string;
  mission_id: string;
  asset_id: string;
  reason: string;
  status: string;
  risk_score: number;
  confidence: number;
  suggested_path: OperationalPathPoint[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface ReplayPath {
  id: string;
  mission_id: string;
  asset_id: string | null;
  path: OperationalPathPoint[];
  point_count: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface OperationalState {
  telemetry_trails: TelemetryTrail[];
  anomaly_clusters: AnomalyCluster[];
  mission_dependencies: MissionDependency[];
  reroute_suggestions: RerouteSuggestion[];
  replay_paths: ReplayPath[];
}

export interface ReasoningEvent {
  id: string;
  category: string;
  severity: Severity;
  message: string;
  asset_id: string | null;
  mission_id: string | null;
  confidence: number;
  uncertainty: number;
  timestamp: string;
}

export interface CausalityNode {
  id: string;
  node_type: 'asset' | 'mission' | 'anomaly' | 'zone' | string;
  label: string;
  status: string | null;
  latitude: number | null;
  longitude: number | null;
  confidence: number;
  uncertainty: number;
  risk_score: number;
}

export interface CausalityEdge {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  edge_type: string;
  weight: number;
  confidence: number;
  active: boolean;
  message: string;
  created_at: string;
  updated_at: string;
}

export interface CausalityGraph {
  nodes: CausalityNode[];
  edges: CausalityEdge[];
}

export interface PredictionState {
  id: string;
  horizon_minutes: 5 | 15 | 30 | number;
  entity_type: string;
  entity_id: string;
  prediction_type: string;
  probability: number;
  confidence: number;
  uncertainty: number;
  projected_latitude: number | null;
  projected_longitude: number | null;
  message: string;
  projected_at: string;
  updated_at: string;
}

export interface CoordinationAction {
  id: string;
  action_type: string;
  status: string;
  initiator_asset_id: string | null;
  target_asset_id: string | null;
  mission_id: string | null;
  priority: Priority;
  confidence: number;
  rationale: string;
  created_at: string;
  updated_at: string;
}

export interface RiskField {
  id: string;
  zone_id: string;
  latitude: number;
  longitude: number;
  radius: number;
  risk_type: string;
  risk_score: number;
  confidence: number;
  uncertainty: number;
  message: string;
  updated_at: string;
}

export interface EcosystemSnapshot {
  id: number;
  system_state: 'nominal' | 'coordinating' | 'stressed' | 'critical' | string;
  operational_load: number;
  resource_contention: number;
  coverage_continuity: number;
  mean_confidence: number;
  risk_index: number;
  active_reasoning_count: number;
  timestamp: string;
}

export interface CoreCognitionState {
  reasoning_events: ReasoningEvent[];
  causality_graph: CausalityGraph;
  predictions: PredictionState[];
  coordination_actions: CoordinationAction[];
  risk_fields: RiskField[];
  ecosystem: EcosystemSnapshot | null;
}

export interface ScenarioTimelineEvent {
  phase: string;
  confidence: number;
  message: string;
  timestamp: string;
  asset_id?: string;
  mission_id?: string;
  score?: number;
}

export interface OrchestrationScenarioRun {
  id: string;
  scenario_type: string;
  command: string;
  status: string;
  current_step: number;
  phase: string;
  selected_asset_id: string | null;
  primary_mission_id: string | null;
  confidence: number;
  outcome: string | null;
  timeline: ScenarioTimelineEvent[];
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface IndustrialResetResult {
  status: 'reset' | string;
  active_scenario: OrchestrationScenarioRun | null;
  assets: Asset[];
}

export interface IndustrialScenarioExport {
  scenario: OrchestrationScenarioRun;
  phases: ScenarioTimelineEvent[];
  assets_involved: Asset[];
  missions_created: Mission[];
  reasoning_events: ReasoningEvent[];
  causality_edges: CausalityEdge[];
  predictions: PredictionState[];
  coordination_actions: CoordinationAction[];
  risk_fields: RiskField[];
  replay_path: ReplayPath | null;
  final_outcome: string | null;
}

export interface ParsedMission {
  mission_type: MissionType;
  target_zone: string;
  priority: Priority;
  recommended_asset_type: AssetType;
  requires_operator_approval: boolean;
}

export interface MissionFormState {
  name: string;
  mission_type: MissionType;
  target_zone: string;
  target_latitude: number;
  target_longitude: number;
  assigned_asset_id: string;
  priority: Priority;
}

export interface ReplayPoint {
  latitude: number;
  longitude: number;
  missionId: string;
  timestamp?: string;
  phase?: string | null;
  confidence?: number | null;
  message?: string | null;
  assetId?: string | null;
  decisionIndex?: number | null;
}

export interface MissionReplay {
  mission_id: string;
  asset_id: string | null;
  point_count: number;
  points: TelemetryPayload[];
}

export interface WaypointFormState {
  label: string;
  latitude: number;
  longitude: number;
}
