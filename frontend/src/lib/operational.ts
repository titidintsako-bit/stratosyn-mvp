import type { Asset, EventLog, Mission, MissionWaypoint } from '../types';

export const STATUS_COLOR = {
  idle: '#64748b',
  active: '#2dd4ff',
  mission: '#2dd4ff',
  warning: '#f6c75f',
  offline: '#ff4d6d'
} as const;

export const STATUS_RGBA = {
  idle: [100, 116, 139, 180],
  active: [45, 212, 255, 230],
  mission: [45, 212, 255, 240],
  warning: [246, 199, 95, 240],
  offline: [255, 77, 109, 220]
} as const;

export const OPERATING_ZONE: [number, number][] = [
  [27.85, -26.35],
  [28.25, -26.35],
  [28.25, -26.05],
  [27.85, -26.05]
];

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function signalQuality(asset: Asset, events: EventLog[]) {
  const recentWarnings = events.filter((event) => event.asset_id === asset.id && event.severity !== 'info' && !event.acknowledged).length;
  const statusPenalty = asset.status === 'offline' ? 68 : asset.status === 'warning' ? 24 : 0;
  const mobilityNoise = asset.status === 'mission' ? 6 + Math.abs(Math.sin(asset.heading / 35)) * 9 : 2;
  return Math.round(clamp(96 - statusPenalty - recentWarnings * 9 - mobilityNoise));
}

export function operationalConfidence(asset: Asset, events: EventLog[]) {
  const signal = signalQuality(asset, events);
  const battery = asset.battery;
  const stateBonus = asset.status === 'mission' || asset.status === 'active' ? 6 : asset.status === 'offline' ? -35 : 0;
  return Math.round(clamp(signal * 0.48 + battery * 0.44 + stateBonus));
}

export function failureProbability(asset: Asset, events: EventLog[]) {
  const signalRisk = 100 - signalQuality(asset, events);
  const batteryRisk = Math.max(0, 35 - asset.battery) * 1.8;
  const eventRisk = events.filter((event) => event.asset_id === asset.id && event.severity !== 'info' && !event.acknowledged).length * 10;
  return Math.round(clamp(signalRisk * 0.45 + batteryRisk + eventRisk));
}

export function missionProgress(mission: Mission | null) {
  if (!mission) return 0;
  if (mission.status === 'completed') return 100;
  if (mission.status === 'running') return 62;
  if (mission.status === 'approved') return 32;
  if (mission.status === 'pending') return 14;
  return 0;
}

export function latestEventFor(asset: Asset | null, events: EventLog[]) {
  if (!asset) return null;
  return events.find((event) => event.asset_id === asset.id) ?? null;
}

export function distanceScore(a: Asset, b: Asset) {
  const lat = a.latitude - b.latitude;
  const lon = a.longitude - b.longitude;
  return Math.sqrt(lat * lat + lon * lon);
}

export function nearestRelatedAssets(asset: Asset | null, assets: Asset[]) {
  if (!asset) return [];
  return assets
    .filter((candidate) => candidate.id !== asset.id)
    .map((candidate) => ({ asset: candidate, distance: distanceScore(asset, candidate) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map((item) => item.asset);
}

export function aiInterpretation(asset: Asset | null, mission: Mission | null, events: EventLog[]) {
  if (!asset) return 'No asset selected. Coordination model is standing by.';
  const signal = signalQuality(asset, events);
  const risk = failureProbability(asset, events);
  const latest = latestEventFor(asset, events);
  if (asset.status === 'offline') return `${asset.name} is isolated from the coordination mesh. Reassignment is recommended before mission tasking.`;
  if (risk > 45) return `${asset.name} is showing elevated mission risk from signal degradation and battery reserve pressure.`;
  if (latest?.severity === 'warning') return `${asset.name} is being monitored for anomaly propagation: ${latest.event_type.replace(/_/g, ' ')}.`;
  if (mission?.status === 'running') return `${asset.name} is executing ${mission.target_zone}; route projection remains viable with ${signal}% signal integrity.`;
  if (asset.asset_type === 'camera') return `${asset.name} is maintaining fixed coverage and can validate nearby mobile asset observations.`;
  return `${asset.name} is available for reassignment with ${signal}% mesh signal and stable operational confidence.`;
}

export function causalityChain(asset: Asset | null, mission: Mission | null, related: Asset[], events: EventLog[]) {
  if (!asset) return [];
  const latest = latestEventFor(asset, events);
  const chain = [
    `${asset.name} telemetry normalized into coordination mesh.`,
    mission ? `${mission.name} depends on ${asset.name} coverage and target-zone availability.` : `${asset.name} is unbound and can support emergent incidents.`,
    latest ? `${latest.event_type.replace(/_/g, ' ')} is influencing current confidence scoring.` : 'No recent anomaly is influencing current asset state.'
  ];
  if (related[0]) chain.push(`${related[0].name} is the nearest supporting asset for secondary verification.`);
  return chain;
}

export function routeProjection(asset: Asset, mission: Mission | null, waypoints: MissionWaypoint[]): [number, number][] {
  if (!mission) return [[asset.longitude, asset.latitude]];
  const routeWaypoints = waypoints
    .filter((waypoint) => waypoint.mission_id === mission.id)
    .sort((a, b) => a.sequence - b.sequence)
    .map((waypoint): [number, number] => [waypoint.longitude, waypoint.latitude]);
  return [[asset.longitude, asset.latitude], ...routeWaypoints, [mission.target_longitude, mission.target_latitude]];
}

export function coverageCone(asset: Asset) {
  const span = asset.asset_type === 'camera' ? 34 : asset.asset_type === 'sensor' ? 360 : 26;
  const range = asset.asset_type === 'camera' ? 0.034 : asset.asset_type === 'sensor' ? 0.016 : 0.024;
  const center = [asset.longitude, asset.latitude];
  const points: [number, number][] = [center as [number, number]];
  const start = asset.heading - span / 2;
  const steps = asset.asset_type === 'sensor' ? 18 : 5;
  for (let i = 0; i <= steps; i += 1) {
    const angle = ((start + (span / steps) * i) * Math.PI) / 180;
    points.push([asset.longitude + Math.sin(angle) * range, asset.latitude + Math.cos(angle) * range]);
  }
  points.push(center as [number, number]);
  return points;
}

export function operationalHeatPoints(assets: Asset[], events: EventLog[]) {
  const eventAssetIds = new Set(events.filter((event) => event.severity !== 'info').map((event) => event.asset_id));
  return assets.flatMap((asset) => {
    const baseWeight = asset.status === 'mission' ? 0.8 : asset.status === 'warning' ? 1 : eventAssetIds.has(asset.id) ? 0.9 : 0.35;
    return [
      { position: [asset.longitude, asset.latitude] as [number, number], weight: baseWeight },
      { position: [asset.longitude + 0.006, asset.latitude - 0.004] as [number, number], weight: baseWeight * 0.55 },
      { position: [asset.longitude - 0.005, asset.latitude + 0.003] as [number, number], weight: baseWeight * 0.42 }
    ];
  });
}
