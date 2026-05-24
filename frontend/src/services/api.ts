import type {
  Asset,
  CoreCognitionState,
  EventLog,
  IndustrialResetResult,
  IndustrialScenarioExport,
  Mission,
  MissionFormState,
  OperationalState,
  OrchestrationScenarioRun,
  ReplayPath,
  MissionReplay,
  MissionWaypoint,
  ParsedMission,
  TelemetryPayload,
  WaypointFormState
} from '../types';
import { demoRequest } from './demo';

const explicitApiUrl = import.meta.env.VITE_API_URL;
const isLocalHost =
  typeof window === 'undefined' ||
  ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);

export const PUBLIC_DEMO =
  import.meta.env.VITE_PUBLIC_DEMO === '1' ||
  (!explicitApiUrl && !isLocalHost);

export const API_BASE = PUBLIC_DEMO ? 'demo://stratosyn' : explicitApiUrl ?? 'http://127.0.0.1:8000';
export const WS_URL = PUBLIC_DEMO ? '' : import.meta.env.VITE_WS_URL ?? 'ws://127.0.0.1:8000/ws/telemetry';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (PUBLIC_DEMO) {
    return demoRequest<T>(path, options);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {})
    },
    ...options
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(errorPayload.detail ?? 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  assets: () => request<Asset[]>('/assets'),
  missions: () => request<Mission[]>('/missions'),
  events: () => request<EventLog[]>('/events?limit=80'),
  createMission: (payload: MissionFormState) =>
    request<Mission>('/missions', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        assigned_asset_id: payload.assigned_asset_id || null
      })
    }),
  approveMission: (missionId: string) => request<Mission>(`/missions/${missionId}/approve`, { method: 'POST' }),
  startMission: (missionId: string) => request<Mission>(`/missions/${missionId}/start`, { method: 'POST' }),
  abortMission: (missionId: string) => request<Mission>(`/missions/${missionId}/abort`, { method: 'POST' }),
  waypoints: (missionId: string) => request<MissionWaypoint[]>(`/missions/${missionId}/waypoints`),
  createWaypoint: (missionId: string, payload: WaypointFormState) =>
    request<MissionWaypoint>(`/missions/${missionId}/waypoints`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  acknowledgeEvent: (eventId: string, acknowledgedBy = 'operator_console') =>
    request<EventLog>(`/events/${eventId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ acknowledged_by: acknowledgedBy })
    }),
  parseMission: (command: string) =>
    request<ParsedMission>('/ai/parse-mission', {
      method: 'POST',
      body: JSON.stringify({ command })
    }),
  missionTelemetry: (missionId: string) => request<TelemetryPayload[]>(`/missions/${missionId}/telemetry`),
  missionReplay: (missionId: string) => request<MissionReplay>(`/missions/${missionId}/replay`),
  operationalState: () => request<OperationalState>('/cognition/operational-state'),
  coreCognitionState: () => request<CoreCognitionState>('/cognition/core-state'),
  replayPath: (missionId: string) => request<ReplayPath>(`/cognition/replay-paths/${missionId}`),
  activeScenario: () => request<OrchestrationScenarioRun | null>('/orchestration/scenarios/active'),
  startIndustrialIncident: (command: string) =>
    request<OrchestrationScenarioRun>('/orchestration/industrial-incident/start', {
      method: 'POST',
      body: JSON.stringify({ command })
    }),
  advanceScenario: (scenarioId: string) =>
    request<OrchestrationScenarioRun>(`/orchestration/scenarios/${scenarioId}/advance`, {
      method: 'POST'
    }),
  resetIndustrialDemo: () => request<IndustrialResetResult>('/orchestration/industrial/reset', { method: 'POST' }),
  exportIndustrialDemo: () => request<IndustrialScenarioExport>('/orchestration/industrial/latest/export')
};
