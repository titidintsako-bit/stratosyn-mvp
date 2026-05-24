import { SCENARIO_PHASE_ORDER } from '../lib/scenarioNarrative';
import type {
  Asset,
  CoreCognitionState,
  EventLog,
  IndustrialResetResult,
  IndustrialScenarioExport,
  Mission,
  MissionReplay,
  OperationalPathPoint,
  OperationalState,
  OrchestrationScenarioRun,
  ParsedMission,
  ReplayPath
} from '../types';

const missionId = 'mission_sector_b';
const scenarioId = 'scenario_sector_b_intrusion';
const startedAt = '2026-05-24T16:00:00.000Z';

const confidenceByPhase: Record<string, number> = {
  intent_parsed: 38,
  asset_selected: 38,
  alpha_dispatched: 38,
  support_retasked: 38,
  motion_validation: 61,
  thermal_validation: 79,
  incident_escalated: 74,
  bravo_rerouted: 77,
  ground_robot_assigned: 82,
  priority_arbitration: 86,
  incident_resolved: 88
};

const messageByPhase: Record<string, string> = {
  intent_parsed: 'Operator intent converted into a Sector B investigation.',
  asset_selected: 'Drone Alpha selected by proximity, readiness, battery, and sensor fit.',
  alpha_dispatched: 'Drone Alpha dispatched to Sector B.',
  support_retasked: 'Camera Grid 2 and Sensor Node B1 retasked for corroboration.',
  motion_validation: 'Motion trace validated near Sector B.',
  thermal_validation: 'Thermal evidence increased incident confidence.',
  incident_escalated: 'Signal degradation and camera obstruction created a coverage risk.',
  bravo_rerouted: 'Drone Bravo rerouted to close the projected Sector C gap.',
  ground_robot_assigned: 'Ground Robot Delta assigned for physical verification.',
  priority_arbitration: 'Camera coverage redistributed to stabilize the response.',
  incident_resolved: 'Multi-asset evidence confirmed the intrusion and closed generated tasks.'
};

const replayCoordinates: Array<[number, number]> = [
  [-26.2052, 28.0408],
  [-26.2036, 28.0432],
  [-26.2011, 28.0484],
  [-26.1994, 28.0512],
  [-26.1972, 28.0536],
  [-26.1972, 28.0536],
  [-26.1985, 28.0554],
  [-26.2069, 28.0606],
  [-26.2127, 28.0481],
  [-26.2069, 28.0588],
  [-26.1972, 28.0536]
];

let scenarioStep = SCENARIO_PHASE_ORDER.length - 1;
let scenarioStarted = true;

function timestampForStep(index: number) {
  return new Date(Date.parse(startedAt) + index * 45_000).toISOString();
}

function currentPhase() {
  return SCENARIO_PHASE_ORDER[Math.max(0, Math.min(scenarioStep, SCENARIO_PHASE_ORDER.length - 1))];
}

function baseAssets(): Asset[] {
  return [
    asset('drone_001', 'Drone Alpha', 'drone', -26.1972, 28.0536, 81, ['visual', 'thermal', 'intrusion-response']),
    asset('drone_002', 'Drone Bravo', 'drone', -26.2069, 28.0606, 76, ['visual', 'rapid-reroute']),
    asset('drone_003', 'Drone Charlie', 'drone', -26.2123, 28.0355, 68, ['patrol', 'perimeter']),
    asset('robot_001', 'Ground Robot Delta', 'ground_robot', -26.2127, 28.0481, 72, ['ground-verification', 'loading-bay']),
    asset('camera_001', 'Camera Grid 1', 'camera', -26.2051, 28.0418, 100, ['fixed-video', 'coverage-redistribution']),
    asset('camera_002', 'Camera Grid 2', 'camera', -26.1989, 28.0564, 100, ['thermal', 'fixed-video']),
    asset('sensor_node_001', 'Sensor Node B1', 'sensor', -26.1995, 28.0532, 100, ['motion', 'perimeter']),
    asset('sensor_node_002', 'Sensor Node C1', 'sensor', -26.2066, 28.0612, 100, ['motion', 'secondary-path'])
  ];
}

function asset(id: string, name: string, assetType: Asset['asset_type'], latitude: number, longitude: number, battery: number, capabilities: string[]): Asset {
  return {
    id,
    name,
    asset_type: assetType,
    status: 'idle',
    latitude,
    longitude,
    battery,
    speed: 0,
    heading: id === 'drone_001' ? 42 : id === 'drone_002' ? 312 : 0,
    current_mission_id: null,
    capabilities,
    created_at: startedAt,
    updated_at: timestampForStep(scenarioStep)
  };
}

function assetsForPhase(phase = currentPhase()): Asset[] {
  return baseAssets().map((item) => {
    if (item.id === 'drone_001') {
      return { ...item, status: phase === 'incident_resolved' ? 'idle' : 'mission', current_mission_id: missionId, speed: phase === 'incident_resolved' ? 0 : 18 };
    }
    if (item.id === 'drone_002' && ['bravo_rerouted', 'ground_robot_assigned', 'priority_arbitration', 'incident_resolved'].includes(phase)) {
      return { ...item, status: phase === 'incident_resolved' ? 'idle' : 'mission', current_mission_id: 'mission_sector_c_intercept', speed: phase === 'incident_resolved' ? 0 : 16 };
    }
    if (item.id === 'robot_001' && ['ground_robot_assigned', 'priority_arbitration', 'incident_resolved'].includes(phase)) {
      return { ...item, status: phase === 'incident_resolved' ? 'idle' : 'mission', current_mission_id: 'mission_ground_verify', speed: phase === 'incident_resolved' ? 0 : 4 };
    }
    if (['camera_001', 'camera_002', 'sensor_node_001', 'sensor_node_002'].includes(item.id) && phase !== 'intent_parsed') {
      return { ...item, status: 'active' };
    }
    return item;
  });
}

function buildTimeline(step = scenarioStep) {
  return SCENARIO_PHASE_ORDER.slice(0, step + 1).map((phase, index) => ({
    phase,
    confidence: confidenceByPhase[phase],
    message: messageByPhase[phase],
    timestamp: timestampForStep(index),
    asset_id: index >= 7 ? 'drone_002' : 'drone_001',
    mission_id: missionId,
    score: confidenceByPhase[phase] / 100
  }));
}

function scenarioForStep(step = scenarioStep): OrchestrationScenarioRun | null {
  if (!scenarioStarted) return null;
  const phase = SCENARIO_PHASE_ORDER[step];
  const completed = phase === 'incident_resolved';
  return {
    id: scenarioId,
    scenario_type: 'industrial_intrusion',
    command: 'Investigate possible intrusion near Sector B.',
    status: completed ? 'completed' : 'running',
    current_step: step,
    phase,
    selected_asset_id: step >= 8 ? 'robot_001' : step >= 7 ? 'drone_002' : 'drone_001',
    primary_mission_id: missionId,
    confidence: confidenceByPhase[phase],
    outcome: completed ? 'confirmed_intrusion' : null,
    timeline: buildTimeline(step),
    started_at: startedAt,
    updated_at: timestampForStep(step),
    completed_at: completed ? timestampForStep(step) : null
  };
}

function missionsForPhase(phase = currentPhase()): Mission[] {
  const completed = phase === 'incident_resolved';
  return [
    mission('Sector B intrusion investigation', missionId, 'drone_001', 'Sector B', -26.1972, 28.0536, completed ? 'completed' : 'running'),
    mission('Sector C coverage intercept', 'mission_sector_c_intercept', 'drone_002', 'Sector C', -26.2069, 28.0606, ['bravo_rerouted', 'ground_robot_assigned', 'priority_arbitration'].includes(phase) ? 'running' : completed ? 'completed' : 'pending'),
    mission('Loading bay ground verification', 'mission_ground_verify', 'robot_001', 'Loading Bay', -26.2127, 28.0481, ['ground_robot_assigned', 'priority_arbitration'].includes(phase) ? 'running' : completed ? 'completed' : 'pending')
  ];
}

function mission(name: string, id: string, assetId: string, zone: string, latitude: number, longitude: number, status: Mission['status']): Mission {
  return {
    id,
    name,
    mission_type: 'investigate_alert',
    status,
    assigned_asset_id: assetId,
    target_zone: zone,
    target_latitude: latitude,
    target_longitude: longitude,
    priority: id === missionId ? 'critical' : 'high',
    start_latitude: id === 'mission_ground_verify' ? -26.2154 : -26.2052,
    start_longitude: id === 'mission_ground_verify' ? 28.0482 : 28.0408,
    created_at: startedAt,
    started_at: status === 'pending' ? null : timestampForStep(2),
    completed_at: status === 'completed' ? timestampForStep(SCENARIO_PHASE_ORDER.length - 1) : null
  };
}

function eventsForPhase(phase = currentPhase()): EventLog[] {
  const resolved = phase === 'incident_resolved';
  return [
    {
      id: 'event_intrusion_resolved',
      event_type: resolved ? 'incident_resolved' : 'incident_update',
      severity: resolved ? 'info' : 'warning',
      asset_id: 'drone_001',
      mission_id: missionId,
      message: resolved ? 'Sector B intrusion confirmed and generated tasks closed.' : messageByPhase[phase],
      timestamp: timestampForStep(scenarioStep),
      acknowledged: resolved,
      acknowledged_at: resolved ? timestampForStep(scenarioStep) : null,
      acknowledged_by: resolved ? 'public_demo' : null
    },
    {
      id: 'event_motion_trace',
      event_type: 'motion_trace',
      severity: 'warning',
      asset_id: 'sensor_node_001',
      mission_id: missionId,
      message: 'Motion trace registered near Sector B perimeter.',
      timestamp: timestampForStep(4),
      acknowledged: true,
      acknowledged_at: timestampForStep(5),
      acknowledged_by: 'system'
    }
  ];
}

function replayPath(): ReplayPath {
  const path: OperationalPathPoint[] = SCENARIO_PHASE_ORDER.map((phase, index) => {
    const [latitude, longitude] = replayCoordinates[index];
    return {
      latitude,
      longitude,
      timestamp: timestampForStep(index),
      heading: index < 7 ? 42 : 305,
      speed: index === SCENARIO_PHASE_ORDER.length - 1 ? 0 : 14 + index,
      battery: 88 - index,
      phase,
      confidence: confidenceByPhase[phase],
      message: messageByPhase[phase],
      asset_id: index >= 7 ? 'drone_002' : 'drone_001',
      mission_id: missionId,
      decision_index: index
    };
  });

  return {
    id: 'replay_sector_b',
    mission_id: missionId,
    asset_id: 'drone_001',
    path,
    point_count: path.length,
    source: 'public_demo',
    created_at: startedAt,
    updated_at: timestampForStep(SCENARIO_PHASE_ORDER.length - 1)
  };
}

function operationalStateForPhase(): OperationalState {
  const replay = replayPath();
  return {
    telemetry_trails: [
      {
        asset_id: 'drone_001',
        mission_id: missionId,
        point_count: replay.point_count,
        points: replay.path,
        updated_at: timestampForStep(scenarioStep)
      }
    ],
    anomaly_clusters: [
      {
        id: 'cluster_sector_b',
        event_type: 'possible_intrusion',
        severity: currentPhase() === 'incident_resolved' ? 'info' : 'warning',
        asset_id: 'sensor_node_001',
        mission_id: missionId,
        latitude: -26.1972,
        longitude: 28.0536,
        radius: 220,
        event_count: 4,
        confidence: confidenceByPhase[currentPhase()] / 100,
        status: currentPhase() === 'incident_resolved' ? 'resolved' : 'active',
        message: 'Sector B anomaly cluster built from motion, thermal, and ground observations.',
        first_seen_at: timestampForStep(4),
        last_seen_at: timestampForStep(scenarioStep),
        updated_at: timestampForStep(scenarioStep)
      }
    ],
    mission_dependencies: [],
    reroute_suggestions: [],
    replay_paths: [replay]
  };
}

function coreStateForPhase(): CoreCognitionState {
  const phase = currentPhase();
  const confidence = confidenceByPhase[phase] / 100;
  return {
    reasoning_events: [
      {
        id: `reasoning_${phase}`,
        category: 'coordination',
        severity: phase === 'incident_resolved' ? 'info' : 'warning',
        message: messageByPhase[phase],
        asset_id: scenarioStep >= 8 ? 'robot_001' : 'drone_001',
        mission_id: missionId,
        confidence,
        uncertainty: Math.max(0.08, 1 - confidence),
        timestamp: timestampForStep(scenarioStep)
      }
    ],
    causality_graph: {
      nodes: [
        node('asset:drone_001', 'asset', 'Drone Alpha', confidence),
        node('zone:sector_b', 'zone', 'Sector B', confidence),
        node('mission:sector_b', 'mission', 'Sector B investigation', confidence)
      ],
      edges: [
        {
          id: 'edge_alpha_sector_b',
          source_type: 'asset',
          source_id: 'drone_001',
          target_type: 'zone',
          target_id: 'sector_b',
          edge_type: 'observes',
          weight: confidence,
          confidence,
          active: phase !== 'incident_resolved',
          message: 'Drone Alpha observations are linked to Sector B incident confidence.',
          created_at: timestampForStep(2),
          updated_at: timestampForStep(scenarioStep)
        }
      ]
    },
    predictions: [
      {
        id: 'prediction_sector_c_gap',
        horizon_minutes: 5,
        entity_type: 'zone',
        entity_id: 'sector_c',
        prediction_type: 'coverage_gap',
        probability: phase === 'incident_resolved' ? 0.08 : 0.42,
        confidence,
        uncertainty: 0.14,
        projected_latitude: -26.2069,
        projected_longitude: 28.0606,
        message: 'Sector C coverage gap falls after Bravo reroute and camera redistribution.',
        projected_at: timestampForStep(Math.min(scenarioStep + 1, SCENARIO_PHASE_ORDER.length - 1)),
        updated_at: timestampForStep(scenarioStep)
      }
    ],
    coordination_actions: [
      {
        id: 'coordination_bravodelta',
        action_type: 'multi_asset_response',
        status: phase === 'incident_resolved' ? 'completed' : 'active',
        initiator_asset_id: 'drone_001',
        target_asset_id: scenarioStep >= 8 ? 'robot_001' : 'drone_002',
        mission_id: missionId,
        priority: 'critical',
        confidence,
        rationale: 'Coordinate aerial, camera, sensor, and ground assets before incident closure.',
        created_at: timestampForStep(7),
        updated_at: timestampForStep(scenarioStep)
      }
    ],
    risk_fields: [
      {
        id: 'risk_sector_b',
        zone_id: 'sector_b',
        latitude: -26.1972,
        longitude: 28.0536,
        radius: phase === 'incident_resolved' ? 120 : 260,
        risk_type: 'intrusion',
        risk_score: phase === 'incident_resolved' ? 0.22 : confidence,
        confidence,
        uncertainty: 0.1,
        message: phase === 'incident_resolved' ? 'Incident confirmed and contained.' : 'Sector B confidence is still changing.',
        updated_at: timestampForStep(scenarioStep)
      }
    ],
    ecosystem: {
      id: 1,
      system_state: phase === 'incident_resolved' ? 'nominal' : 'coordinating',
      operational_load: phase === 'incident_resolved' ? 0.22 : 0.64,
      resource_contention: phase === 'incident_resolved' ? 0.18 : 0.43,
      coverage_continuity: phase === 'incident_resolved' ? 0.94 : 0.78,
      mean_confidence: confidence,
      risk_index: phase === 'incident_resolved' ? 0.2 : 0.62,
      active_reasoning_count: 1,
      timestamp: timestampForStep(scenarioStep)
    }
  };
}

function node(id: string, nodeType: string, label: string, confidence: number) {
  return {
    id,
    node_type: nodeType,
    label,
    status: currentPhase() === 'incident_resolved' ? 'resolved' : 'active',
    latitude: id.includes('sector_b') ? -26.1972 : null,
    longitude: id.includes('sector_b') ? 28.0536 : null,
    confidence,
    uncertainty: 1 - confidence,
    risk_score: id.includes('sector_b') ? confidence : 0.32
  };
}

function resetDemo(): IndustrialResetResult {
  scenarioStarted = false;
  scenarioStep = 0;
  return {
    status: 'reset',
    active_scenario: null,
    assets: baseAssets()
  };
}

function startDemo() {
  scenarioStarted = true;
  scenarioStep = 0;
  return scenarioForStep();
}

function advanceDemo() {
  scenarioStarted = true;
  scenarioStep = Math.min(scenarioStep + 1, SCENARIO_PHASE_ORDER.length - 1);
  return scenarioForStep();
}

function exportDemo(): IndustrialScenarioExport {
  const scenario = scenarioForStep(SCENARIO_PHASE_ORDER.length - 1) as OrchestrationScenarioRun;
  return {
    scenario,
    phases: buildTimeline(SCENARIO_PHASE_ORDER.length - 1),
    assets_involved: assetsForPhase('incident_resolved'),
    missions_created: missionsForPhase('incident_resolved'),
    reasoning_events: coreStateForPhase().reasoning_events,
    causality_edges: coreStateForPhase().causality_graph.edges,
    predictions: coreStateForPhase().predictions,
    coordination_actions: coreStateForPhase().coordination_actions,
    risk_fields: coreStateForPhase().risk_fields,
    replay_path: replayPath(),
    final_outcome: 'confirmed_intrusion'
  };
}

export async function demoRequest<T>(path: string, options?: RequestInit): Promise<T> {
  await new Promise((resolve) => window.setTimeout(resolve, 80));

  if (path === '/assets') return assetsForPhase() as T;
  if (path === '/missions') return missionsForPhase() as T;
  if (path.startsWith('/events')) return eventsForPhase() as T;
  if (path === '/telemetry/latest') return [] as T;
  if (path === '/cognition/operational-state') return operationalStateForPhase() as T;
  if (path === '/cognition/core-state') return coreStateForPhase() as T;
  if (path === '/orchestration/scenarios/active') return scenarioForStep() as T;
  if (path === '/orchestration/industrial/reset') return resetDemo() as T;
  if (path === '/orchestration/industrial-incident/start') return startDemo() as T;
  if (path.match(/^\/orchestration\/scenarios\/[^/]+\/advance$/)) return advanceDemo() as T;
  if (path === '/orchestration/industrial/latest/export') return exportDemo() as T;
  if (path.match(/^\/cognition\/replay-paths\/[^/]+$/)) return replayPath() as T;
  if (path.match(/^\/missions\/[^/]+\/replay$/)) {
    const replay = replayPath();
    return {
      mission_id: replay.mission_id,
      asset_id: replay.asset_id,
      point_count: replay.point_count,
      points: replay.path.map((point) => ({
        asset_id: point.asset_id ?? 'drone_001',
        latitude: point.latitude,
        longitude: point.longitude,
        battery: point.battery ?? 80,
        speed: point.speed ?? 0,
        heading: point.heading ?? 0,
        status: 'mission',
        mission_id: point.mission_id ?? null,
        timestamp: point.timestamp
      }))
    } satisfies MissionReplay as T;
  }
  if (path === '/ai/parse-mission') {
    return {
      mission_type: 'investigate_alert',
      target_zone: 'Sector B',
      priority: 'critical',
      recommended_asset_type: 'drone',
      requires_operator_approval: true
    } satisfies ParsedMission as T;
  }

  const method = options?.method ?? 'GET';
  throw new Error(`Public demo does not implement ${method} ${path}`);
}
