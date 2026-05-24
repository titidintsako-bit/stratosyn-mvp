import { SCENARIO_PHASE_ORDER } from './scenarioNarrative';

export type Position2D = [number, number];

export interface FacilityZone {
  id: string;
  label: string;
  center: Position2D;
  polygon: Position2D[];
}

export interface PhaseMapFocus {
  activeAssetIds: string[];
  activeZoneIds: string[];
  showRoutes: boolean;
  showPredictions: boolean;
  showRisk: boolean;
  showAnomaly: boolean;
  showCoverage: boolean;
  showDegradation: boolean;
  showReroutes: boolean;
  showCausality: boolean;
  showResolution: boolean;
}

function box(center: Position2D, lonRadius: number, latRadius: number): Position2D[] {
  const [longitude, latitude] = center;
  return [
    [longitude - lonRadius, latitude - latRadius],
    [longitude + lonRadius, latitude - latRadius],
    [longitude + lonRadius, latitude + latRadius],
    [longitude - lonRadius, latitude + latRadius]
  ];
}

export const FACILITY_ZONES: FacilityZone[] = [
  { id: 'sector_a', label: 'Sector A', center: [28.0432, -26.2024], polygon: box([28.0432, -26.2024], 0.0062, 0.0045) },
  { id: 'sector_b', label: 'Sector B', center: [28.0536, -26.1972], polygon: box([28.0536, -26.1972], 0.0068, 0.0048) },
  { id: 'sector_c', label: 'Sector C', center: [28.0606, -26.2069], polygon: box([28.0606, -26.2069], 0.0062, 0.0046) },
  { id: 'loading_bay', label: 'Loading Bay', center: [28.0481, -26.2127], polygon: box([28.0481, -26.2127], 0.0068, 0.0039) },
  { id: 'storage_zone', label: 'Storage Zone', center: [28.0374, -26.2058], polygon: box([28.0374, -26.2058], 0.0064, 0.0046) }
];

export const FACILITY_PERIMETER: Position2D[] = [
  [28.0312, -26.2168],
  [28.0667, -26.2168],
  [28.0667, -26.1921],
  [28.0312, -26.1921],
  [28.0312, -26.2168]
];

const phaseFocus: Record<string, PhaseMapFocus> = {
  intent_parsed: {
    activeAssetIds: [],
    activeZoneIds: ['sector_b'],
    showRoutes: false,
    showPredictions: false,
    showRisk: false,
    showAnomaly: false,
    showCoverage: false,
    showDegradation: false,
    showReroutes: false,
    showCausality: false,
    showResolution: false
  },
  asset_selected: {
    activeAssetIds: ['drone_001'],
    activeZoneIds: ['sector_b'],
    showRoutes: false,
    showPredictions: false,
    showRisk: false,
    showAnomaly: false,
    showCoverage: false,
    showDegradation: false,
    showReroutes: false,
    showCausality: false,
    showResolution: false
  },
  alpha_dispatched: {
    activeAssetIds: ['drone_001'],
    activeZoneIds: ['sector_b'],
    showRoutes: true,
    showPredictions: false,
    showRisk: false,
    showAnomaly: false,
    showCoverage: false,
    showDegradation: false,
    showReroutes: false,
    showCausality: false,
    showResolution: false
  },
  support_retasked: {
    activeAssetIds: ['drone_001', 'camera_002', 'sensor_node_001'],
    activeZoneIds: ['sector_b'],
    showRoutes: true,
    showPredictions: false,
    showRisk: false,
    showAnomaly: false,
    showCoverage: true,
    showDegradation: false,
    showReroutes: false,
    showCausality: true,
    showResolution: false
  },
  motion_validation: {
    activeAssetIds: ['drone_001', 'sensor_node_001'],
    activeZoneIds: ['sector_b'],
    showRoutes: true,
    showPredictions: true,
    showRisk: true,
    showAnomaly: true,
    showCoverage: false,
    showDegradation: false,
    showReroutes: false,
    showCausality: true,
    showResolution: false
  },
  thermal_validation: {
    activeAssetIds: ['drone_001', 'camera_002'],
    activeZoneIds: ['sector_b'],
    showRoutes: true,
    showPredictions: true,
    showRisk: true,
    showAnomaly: true,
    showCoverage: true,
    showDegradation: false,
    showReroutes: false,
    showCausality: true,
    showResolution: false
  },
  incident_escalated: {
    activeAssetIds: ['drone_001', 'camera_002', 'sensor_node_002'],
    activeZoneIds: ['sector_b', 'sector_c'],
    showRoutes: true,
    showPredictions: true,
    showRisk: true,
    showAnomaly: true,
    showCoverage: true,
    showDegradation: true,
    showReroutes: false,
    showCausality: true,
    showResolution: false
  },
  bravo_rerouted: {
    activeAssetIds: ['drone_001', 'drone_002'],
    activeZoneIds: ['sector_b', 'sector_c', 'perimeter_route'],
    showRoutes: true,
    showPredictions: true,
    showRisk: true,
    showAnomaly: true,
    showCoverage: false,
    showDegradation: true,
    showReroutes: true,
    showCausality: true,
    showResolution: false
  },
  ground_robot_assigned: {
    activeAssetIds: ['drone_001', 'robot_001'],
    activeZoneIds: ['sector_b', 'loading_bay'],
    showRoutes: true,
    showPredictions: true,
    showRisk: true,
    showAnomaly: true,
    showCoverage: false,
    showDegradation: true,
    showReroutes: false,
    showCausality: true,
    showResolution: false
  },
  priority_arbitration: {
    activeAssetIds: ['drone_002', 'camera_001', 'camera_002'],
    activeZoneIds: ['sector_c', 'storage_zone'],
    showRoutes: true,
    showPredictions: true,
    showRisk: true,
    showAnomaly: false,
    showCoverage: true,
    showDegradation: false,
    showReroutes: false,
    showCausality: true,
    showResolution: false
  },
  incident_resolved: {
    activeAssetIds: ['drone_001', 'drone_002', 'robot_001', 'camera_001', 'camera_002'],
    activeZoneIds: ['sector_b', 'sector_c', 'loading_bay'],
    showRoutes: false,
    showPredictions: false,
    showRisk: true,
    showAnomaly: false,
    showCoverage: false,
    showDegradation: false,
    showReroutes: false,
    showCausality: true,
    showResolution: true
  }
};

export function mapFocusForPhase(phase: string | undefined): PhaseMapFocus {
  return phaseFocus[phase ?? ''] ?? phaseFocus.intent_parsed;
}

export function phaseIndex(phase: string | undefined) {
  return Math.max(0, SCENARIO_PHASE_ORDER.findIndex((item) => item === phase));
}

