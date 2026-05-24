import type { Severity } from '../types';

export const RESPONSE_CHAIN = [
  { phase: 'intent_parsed', stage: 'Detect', label: 'Sector B report', detail: 'Possible intrusion reported near Sector B.' },
  { phase: 'asset_selected', stage: 'Score', label: 'Responder selected', detail: 'Drone Alpha selected by proximity, readiness, and payload fit.' },
  { phase: 'alpha_dispatched', stage: 'Dispatch', label: 'Alpha assigned', detail: 'Aerial inspection begins without overloading other assets.' },
  { phase: 'support_retasked', stage: 'Corroborate', label: 'Sensors aligned', detail: 'Camera Grid 2 and nearby sensors retasked for validation.' },
  { phase: 'motion_validation', stage: 'Validate', label: 'Motion confirmed', detail: 'Sensor motion trace raises anomaly confidence.' },
  { phase: 'thermal_validation', stage: 'Thermal', label: 'Heat signature', detail: 'Thermal evidence increases likelihood of a real intrusion.' },
  { phase: 'incident_escalated', stage: 'Degrade', label: 'Signal risk', detail: 'Camera obstruction and signal degradation reduce aerial certainty.' },
  { phase: 'bravo_rerouted', stage: 'Reroute', label: 'Bravo covers gap', detail: 'Drone Bravo closes the projected Sector C coverage gap.' },
  { phase: 'ground_robot_assigned', stage: 'Verify', label: 'Delta assigned', detail: 'Ground Robot Delta is dispatched for physical confirmation.' },
  { phase: 'priority_arbitration', stage: 'Rebalance', label: 'Coverage restored', detail: 'Camera coverage is redistributed to stabilize the topology.' },
  { phase: 'incident_resolved', stage: 'Resolve', label: 'Intrusion confirmed', detail: 'Multi-source evidence crosses the confirmation threshold.' }
];

export const PHASE_STAGE_INDEX: Record<string, number> = RESPONSE_CHAIN.reduce(
  (accumulator, item, index) => ({ ...accumulator, [item.phase]: index }),
  {} as Record<string, number>
);

export interface EvidenceState {
  verdict: string;
  confidence: number;
  assetCount: number;
  lock: string;
  summary: string;
  operationalRisk: string;
  operatorPosture: string;
  reason: string;
  chainDetail: string;
  items: string[];
}

export function severityTone(severity?: Severity) {
  if (severity === 'critical') return 'text-command-red';
  if (severity === 'warning') return 'text-command-amber';
  return 'text-command-cyan';
}

export function evidenceForPhase(phase: string, scenarioConfidence: number): EvidenceState {
  if (phase === 'incident_resolved') {
    return {
      verdict: 'Confirmed intrusion',
      confidence: Math.round(scenarioConfidence || 88),
      assetCount: 4,
      lock: 'verified intrusion',
      summary: 'The Sector B report has been verified by aerial, fixed, sensor, and ground observations.',
      operationalRisk: 'Intrusion is confirmed. The operational topology is stable and no generated task remains unresolved.',
      operatorPosture: 'Review replay and export evidence. No immediate manual control action is required.',
      reason: 'Four independent evidence sources converge above the confirmation threshold.',
      chainDetail: 'Aerial, camera, sensor, and ground evidence converge above threshold.',
      items: ['Drone Alpha visual confirmation', 'Camera Grid 2 thermal signature', 'Sensor Node B1 motion trace', 'Ground Robot Delta physical verification']
    };
  }
  if (['ground_robot_assigned', 'priority_arbitration'].includes(phase)) {
    return {
      verdict: 'Ground verification required',
      confidence: Math.round(scenarioConfidence || 82),
      assetCount: 4,
      lock: 'ground verification requested',
      summary: 'Aerial evidence is strong but degraded by signal and camera reliability.',
      operationalRisk: 'Escalating before physical confirmation would increase false-positive risk.',
      operatorPosture: 'Allow Delta to verify while Bravo protects the possible Sector C path.',
      reason: 'Aerial validation is useful but degraded, so the system requests physical confirmation.',
      chainDetail: 'Ground Robot Delta is assigned because aerial evidence is insufficient.',
      items: ['Delta assigned to Loading Bay', 'Bravo covers Sector C path', 'Camera coverage redistributed']
    };
  }
  if (['incident_escalated', 'bravo_rerouted'].includes(phase)) {
    return {
      verdict: 'Validation degraded',
      confidence: Math.round(scenarioConfidence || 74),
      assetCount: 3,
      lock: 'secondary path watch',
      summary: 'Signal degradation and camera obstruction reduce confidence in aerial-only validation.',
      operationalRisk: 'A possible second path near Sector C could create a coverage gap.',
      operatorPosture: 'Keep Alpha on Sector B and let Bravo close the Sector C gap.',
      reason: 'Camera obstruction and signal instability reduce trust in aerial-only confirmation.',
      chainDetail: 'The system detects camera obstruction and a possible second path.',
      items: ['Alpha signal degraded', 'Camera Grid 2 partially obstructed', 'Second path risk appears near Sector C']
    };
  }
  if (['motion_validation', 'thermal_validation', 'support_retasked'].includes(phase)) {
    return {
      verdict: 'Corroboration active',
      confidence: Math.round(scenarioConfidence || (phase === 'thermal_validation' ? 79 : 61)),
      assetCount: 3,
      lock: 'multi-sensor validation',
      summary: 'The system is gathering independent evidence before escalating the incident.',
      operationalRisk: 'Early confirmation would be premature without sensor corroboration.',
      operatorPosture: 'Monitor confidence and allow the system to continue validation.',
      reason: 'The system is seeking independent sensor evidence before escalation.',
      chainDetail: 'Camera Grid 2 and nearby sensors are retasked for corroboration.',
      items: ['Camera Grid 2 retasked', 'Sensor cadence increased', 'Drone Alpha remains primary observer']
    };
  }
  return {
    verdict: 'Investigation staged',
    confidence: Math.round(scenarioConfidence || 38),
    assetCount: 1,
    lock: 'initial track',
    summary: 'The command identifies an incident type, sector, and inspection requirement.',
    operationalRisk: 'Unknown contact near Sector B. Confidence is not high enough for escalation.',
    operatorPosture: 'Run the incident scenario to execute the validation chain.',
    reason: 'The system has enough information to begin an inspection but not enough to confirm.',
    chainDetail: 'Possible intrusion reported near Sector B.',
    items: ['Sector B selected', 'Drone Alpha scored highest', 'Operator approval path staged']
  };
}
