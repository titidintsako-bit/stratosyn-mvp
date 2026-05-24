import type { ScenarioTimelineEvent } from '../types';

export const SCENARIO_PHASE_ORDER = [
  'intent_parsed',
  'asset_selected',
  'alpha_dispatched',
  'support_retasked',
  'motion_validation',
  'thermal_validation',
  'incident_escalated',
  'bravo_rerouted',
  'ground_robot_assigned',
  'priority_arbitration',
  'incident_resolved'
] as const;

export interface PhaseNarrative {
  title: string;
  happened: string;
  why: string;
  trigger: string;
  affectedAssets: string[];
  decision: string;
  reasoning: string;
  confidence: string;
  action: string;
  next: string;
}

export const PHASE_NARRATIVE: Record<string, PhaseNarrative> = {
  intent_parsed: {
    title: 'Intent Parsed',
    happened: 'The operator request was decomposed into an intrusion investigation centered on Sector B.',
    why: 'The command contains a location, incident type, and urgency class that can be converted into an inspection task.',
    trigger: 'Operator entered possible intrusion near Sector B.',
    affectedAssets: ['Drone Alpha', 'Camera Grid 2', 'Sensor Node B1'],
    decision: 'Create an aerial investigation with supporting validation assets.',
    reasoning: 'A possible intrusion needs fast aerial inspection plus fixed sensor corroboration before escalation.',
    confidence: '0% -> 38%',
    action: 'Stage Sector B investigation.',
    next: 'Score available assets and select the first responder.'
  },
  asset_selected: {
    title: 'Asset Selected',
    happened: 'Drone Alpha was selected as the first responder.',
    why: 'It was closest to Sector B, had high battery, healthy signal, no active workload, and thermal inspection capability.',
    trigger: 'Mission requires a mobile asset with intrusion-response and visual/thermal capabilities.',
    affectedAssets: ['Drone Alpha', 'Drone Bravo'],
    decision: 'Dispatch Drone Alpha and keep Drone Bravo available for contingency.',
    reasoning: 'Alpha has the best weighted score across proximity, battery, signal, workload, and suitability.',
    confidence: '38% -> 38%',
    action: 'Bind Drone Alpha to the primary mission.',
    next: 'Dispatch Alpha toward Sector B.'
  },
  alpha_dispatched: {
    title: 'Alpha Dispatched',
    happened: 'Drone Alpha began moving toward Sector B.',
    why: 'The system needed direct visual inspection before raising incident severity.',
    trigger: 'Best responder selected and mission execution began.',
    affectedAssets: ['Drone Alpha'],
    decision: 'Start the Sector B investigation mission.',
    reasoning: 'Aerial inspection is the fastest way to reduce uncertainty without interrupting other assets.',
    confidence: '38% -> 38%',
    action: 'Create replay path and mission execution edge.',
    next: 'Retask nearby fixed sensors for corroboration.'
  },
  support_retasked: {
    title: 'Support Retasked',
    happened: 'Camera Grid 2 rotated toward Sector B and nearby sensors increased monitoring cadence.',
    why: 'The system needed independent validation before treating the motion trace as a real incident.',
    trigger: 'Primary asset entered investigation state.',
    affectedAssets: ['Camera Grid 2', 'Sensor Node B1', 'Drone Alpha'],
    decision: 'Attach camera and sensor dependencies to the Alpha mission.',
    reasoning: 'Multiple independent observations reduce false positive risk.',
    confidence: '38% -> 38%',
    action: 'Create validation dependencies and coordination actions.',
    next: 'Wait for motion validation.'
  },
  motion_validation: {
    title: 'Motion Validation',
    happened: 'Motion evidence increased anomaly confidence.',
    why: 'Sensor evidence aligned with Drone Alpha position near Sector B.',
    trigger: 'Motion trace validated near Sector B.',
    affectedAssets: ['Drone Alpha', 'Sensor Node B1'],
    decision: 'Increase incident confidence and expand Sector B risk field.',
    reasoning: 'Motion validation is meaningful but not sufficient for final escalation.',
    confidence: '38% -> 61%',
    action: 'Update anomaly confidence, prediction, risk field, and replay path.',
    next: 'Seek thermal validation.'
  },
  thermal_validation: {
    title: 'Thermal Validation',
    happened: 'Thermal signal raised anomaly confidence to high likelihood.',
    why: 'Camera Grid 2 thermal evidence reinforced Alpha observations.',
    trigger: 'Thermal anomaly spike.',
    affectedAssets: ['Drone Alpha', 'Camera Grid 2'],
    decision: 'Treat the incident as escalating but still require cross-checking.',
    reasoning: 'Thermal evidence raises confidence, but a camera obstruction risk still exists.',
    confidence: '61% -> 79%',
    action: 'Record thermal evidence and raise the incident confidence.',
    next: 'Monitor for degradation or secondary paths.'
  },
  incident_escalated: {
    title: 'Incident Escalated',
    happened: 'Alpha signal degraded, Camera Grid 2 became partially obstructed, and Sensor Node C1 detected a possible second path.',
    why: 'The system saw inconsistent telemetry during high-confidence anomaly validation.',
    trigger: 'Signal degradation plus camera obstruction plus possible Sector C path.',
    affectedAssets: ['Drone Alpha', 'Camera Grid 2', 'Sensor Node C1'],
    decision: 'Reduce mission confidence and create a Sector C coverage-gap prediction.',
    reasoning: 'Aerial validation alone is now insufficient because the best camera support is degraded.',
    confidence: '79% -> 74%',
    action: 'Raise warnings and extend coverage toward Sector C.',
    next: 'Reroute a second drone to close the projected gap.'
  },
  bravo_rerouted: {
    title: 'Bravo Rerouted',
    happened: 'Drone Bravo was rerouted toward the possible Sector C intrusion path.',
    why: 'The projected coverage gap crossed the threshold for autonomous resource reallocation.',
    trigger: 'Coverage gap projected in Sector C in 4m.',
    affectedAssets: ['Drone Bravo', 'Drone Alpha'],
    decision: 'Create an intercept mission and bind Bravo as a supporting responder.',
    reasoning: 'Bravo can close the gap while Alpha continues primary investigation.',
    confidence: '74% -> 77%',
    action: 'Create reroute suggestion, intercept mission, and priority-arbitration edge.',
    next: 'Assign a ground asset because aerial validation remains partially degraded.'
  },
  ground_robot_assigned: {
    title: 'Ground Verification Assigned',
    happened: 'Ground Robot Delta was assigned to verify the loading bay path.',
    why: 'Physical confirmation was needed before final escalation.',
    trigger: 'Aerial validation insufficient due to camera obstruction.',
    affectedAssets: ['Ground Robot Delta', 'Drone Alpha'],
    decision: 'Dispatch ground verification to the likely secondary path.',
    reasoning: 'Ground verification reduces uncertainty when aerial telemetry is inconsistent.',
    confidence: '77% -> 82%',
    action: 'Create ground verification mission, risk field, and resource reallocation edge.',
    next: 'Rebalance mission priority and redistribute camera coverage.'
  },
  priority_arbitration: {
    title: 'Priority Arbitration',
    happened: 'The priority graph elevated Sector C intercept and redistributed camera coverage.',
    why: 'The system had to protect coverage continuity while the primary incident remained active.',
    trigger: 'Ground verification and Bravo reroute changed operational load.',
    affectedAssets: ['Camera Grid 1', 'Camera Grid 2', 'Drone Bravo'],
    decision: 'Use Camera Grid 1 to compensate for Camera Grid 2 obstruction.',
    reasoning: 'Coverage continuity is restored by redistributing fixed sensors rather than overloading Alpha.',
    confidence: '82% -> 86%',
    action: 'Create camera redistribution action and reduce Sector C coverage-gap prediction.',
    next: 'Resolve incident once cross-validation stabilizes.'
  },
  incident_resolved: {
    title: 'Incident Resolved',
    happened: 'The incident resolved as a confirmed intrusion with all assigned tasks closed.',
    why: 'Aerial, camera, sensor, and ground verification converged above the confirmation threshold.',
    trigger: 'Multi-asset validation reached final confidence threshold.',
    affectedAssets: ['Drone Alpha', 'Drone Bravo', 'Ground Robot Delta', 'Camera Grid 1', 'Camera Grid 2'],
    decision: 'Close the incident as confirmed intrusion and complete generated missions.',
    reasoning: 'The system reduced uncertainty through independent validation and coordinated resource reallocation.',
    confidence: '86% -> 88%',
    action: 'Complete missions, preserve replay, and prepare the evidence record.',
    next: 'Replay the incident and inspect exported evidence.'
  }
};

export function phaseNarrative(phase?: string): PhaseNarrative {
  return PHASE_NARRATIVE[phase ?? ''] ?? PHASE_NARRATIVE.intent_parsed;
}

export function replayPhase(timeline: ScenarioTimelineEvent[], replayIndex: number, replayPointCount: number): ScenarioTimelineEvent | null {
  if (timeline.length === 0) return null;
  if (replayPointCount <= 1) return timeline[timeline.length - 1];
  const index = Math.min(timeline.length - 1, Math.round((replayIndex / Math.max(replayPointCount - 1, 1)) * (timeline.length - 1)));
  return timeline[index];
}
