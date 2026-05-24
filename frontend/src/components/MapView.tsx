import { useMemo, type CSSProperties } from 'react';
import Map, { Layer, Marker, NavigationControl, Source } from 'react-map-gl/maplibre';
import type { StyleSpecification } from 'maplibre-gl';
import type { Asset, Mission, OrchestrationScenarioRun, ReplayPoint } from '../types';
import { FACILITY_PERIMETER, FACILITY_ZONES, mapFocusForPhase, phaseIndex } from '../lib/mapPresentation';
import { phaseNarrative, replayPhase } from '../lib/scenarioNarrative';

type LngLat = [number, number];
type RouteSegment = { id: string; coordinates: LngLat[]; tone: 'cyan' | 'amber'; muted?: boolean; dashed?: boolean };
type FacilityMass = { id: string; label: string; height: number; color: string; polygon: LngLat[] };

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: 'Carto'
    }
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#050910'
      }
    },
    {
      id: 'carto-dark',
      type: 'raster',
      source: 'carto',
      paint: {
        'raster-opacity': 0.32,
        'raster-saturation': -0.72,
        'raster-contrast': -0.08
      }
    }
  ]
};
const FACILITY_CENTER = { longitude: 28.049, latitude: -26.2046 };

const mapContextLines: LngLat[][] = [
  [
    [28.032, -26.1978],
    [28.0672, -26.1978]
  ],
  [
    [28.0314, -26.2026],
    [28.0676, -26.2022]
  ],
  [
    [28.0318, -26.2075],
    [28.0671, -26.2071]
  ],
  [
    [28.0324, -26.2124],
    [28.0665, -26.2118]
  ],
  [
    [28.037, -26.194],
    [28.0366, -26.2174]
  ],
  [
    [28.0438, -26.1936],
    [28.0432, -26.2172]
  ],
  [
    [28.0512, -26.1938],
    [28.0508, -26.217]
  ],
  [
    [28.0588, -26.1935],
    [28.0582, -26.2168]
  ],
  [
    [28.0332, -26.2162],
    [28.0412, -26.2143],
    [28.0505, -26.2132],
    [28.0662, -26.2138]
  ]
];

const assetHome: Record<string, LngLat> = {
  drone_001: [28.0408, -26.2052],
  drone_002: [28.0612, -26.2136],
  drone_003: [28.0355, -26.2123],
  robot_001: [28.0482, -26.2154],
  camera_001: [28.0418, -26.2051],
  camera_002: [28.0564, -26.1989],
  sensor_node_001: [28.0532, -26.1995],
  sensor_node_002: [28.0612, -26.2066]
};

const targetPoints: Record<string, LngLat> = {
  sector_b: [28.0536, -26.1972],
  sector_c: [28.0606, -26.2069],
  loading_bay: [28.0481, -26.2127],
  storage_zone: [28.0374, -26.2058]
};

const facilityMasses: FacilityMass[] = [
  {
    id: 'warehouse-b',
    label: 'Warehouse B',
    height: 42,
    color: '#193144',
    polygon: [
      [28.0478, -26.1994],
      [28.0586, -26.1994],
      [28.0586, -26.1953],
      [28.0478, -26.1953]
    ]
  },
  {
    id: 'storage-hall',
    label: 'Storage Hall',
    height: 28,
    color: '#182737',
    polygon: [
      [28.0336, -26.2082],
      [28.043, -26.2082],
      [28.043, -26.2035],
      [28.0336, -26.2035]
    ]
  },
  {
    id: 'loading-canopy',
    label: 'Loading Canopy',
    height: 18,
    color: '#243142',
    polygon: [
      [28.0436, -26.2147],
      [28.0528, -26.2147],
      [28.0528, -26.2112],
      [28.0436, -26.2112]
    ]
  },
  {
    id: 'control-block',
    label: 'Control Block',
    height: 36,
    color: '#1d3a42',
    polygon: [
      [28.0565, -26.209],
      [28.064, -26.209],
      [28.064, -26.2045],
      [28.0565, -26.2045]
    ]
  },
  {
    id: 'maintenance-bay',
    label: 'Maintenance Bay',
    height: 24,
    color: '#1b2c3a',
    polygon: [
      [28.0382, -26.2046],
      [28.047, -26.2046],
      [28.047, -26.2009],
      [28.0382, -26.2009]
    ]
  }
];

const yardLaneLines: LngLat[][] = [
  [
    [28.0342, -26.2149],
    [28.066, -26.2142]
  ],
  [
    [28.0344, -26.2132],
    [28.066, -26.2126]
  ],
  [
    [28.0346, -26.2114],
    [28.066, -26.2109]
  ],
  [
    [28.0325, -26.1995],
    [28.0662, -26.1993]
  ],
  [
    [28.0468, -26.2165],
    [28.0474, -26.1932]
  ],
  [
    [28.055, -26.2163],
    [28.0548, -26.1934]
  ]
];

const activePhaseAssets: Record<string, string[]> = {
  intent_parsed: ['drone_001'],
  asset_selected: ['drone_001'],
  alpha_dispatched: ['drone_001'],
  support_retasked: ['drone_001', 'camera_002', 'sensor_node_001'],
  motion_validation: ['drone_001', 'sensor_node_001'],
  thermal_validation: ['drone_001', 'camera_002'],
  incident_escalated: ['drone_001', 'camera_002', 'sensor_node_002'],
  bravo_rerouted: ['drone_001', 'drone_002'],
  ground_robot_assigned: ['drone_001', 'robot_001'],
  priority_arbitration: ['drone_002', 'camera_001', 'camera_002'],
  incident_resolved: ['drone_001', 'drone_002', 'robot_001', 'camera_001', 'camera_002']
};

interface MapViewProps {
  assets: Asset[];
  missions: Mission[];
  scenario: OrchestrationScenarioRun | null;
  selectedAssetId: string | null;
  replayPoint: ReplayPoint | null;
  replayPointCount: number;
  replayIndex: number;
  onSelectAsset: (assetId: string) => void;
  immersive?: boolean;
  className?: string;
}

export function MapView({ assets, missions, scenario, selectedAssetId, replayPoint, replayPointCount, replayIndex, onSelectAsset, immersive = false, className = '' }: MapViewProps) {
  const currentPhase = useMemo(() => {
    if (replayPoint && scenario?.timeline?.length) {
      return replayPoint.phase ?? replayPhase(scenario.timeline, replayIndex, replayPointCount)?.phase ?? scenario.phase;
    }
    return scenario?.phase ?? 'intent_parsed';
  }, [replayIndex, replayPoint, replayPointCount, scenario]);

  const focus = useMemo(() => mapFocusForPhase(currentPhase), [currentPhase]);
  const activeAssetSet = new Set(activePhaseAssets[currentPhase] ?? focus.activeAssetIds);
  const activeZoneSet = new Set(focus.activeZoneIds);
  const narrative = phaseNarrative(currentPhase);
  const phaseNumber = Math.max(1, phaseIndex(currentPhase) + 1);
  const displayConfidence = replayPoint?.confidence ?? scenario?.confidence ?? 0;
  const routes = routeSegments(currentPhase);
  const activeMissions = missions.filter((mission) => ['approved', 'running'].includes(mission.status));

  const zoneData = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: FACILITY_ZONES.map((zone) => ({
        type: 'Feature',
        properties: {
          id: zone.id,
          label: zone.label,
          active: activeZoneSet.has(zone.id),
          resolved: currentPhase === 'incident_resolved' && activeZoneSet.has(zone.id)
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[...zone.polygon, zone.polygon[0]]]
        }
      }))
    }),
    [activeZoneSet, currentPhase]
  );

  const perimeterData = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: FACILITY_PERIMETER
          }
        }
      ]
    }),
    []
  );

  const contextData = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: mapContextLines.map((coordinates, index) => ({
        type: 'Feature',
        properties: { id: `context-${index}` },
        geometry: {
          type: 'LineString',
          coordinates
        }
      }))
    }),
    []
  );

  const routeData = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: routes.map((route) => ({
        type: 'Feature',
        properties: {
          id: route.id,
          tone: route.tone,
          muted: Boolean(route.muted),
          dashed: Boolean(route.dashed)
        },
        geometry: {
          type: 'LineString',
          coordinates: route.coordinates
        }
      }))
    }),
    [routes]
  );

  const buildingData = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: facilityMasses.map((mass) => ({
        type: 'Feature',
        properties: {
          id: mass.id,
          label: mass.label,
          height: mass.height,
          color: mass.color
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[...mass.polygon, mass.polygon[0]]]
        }
      }))
    }),
    []
  );

  const yardLaneData = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: yardLaneLines.map((coordinates, index) => ({
        type: 'Feature',
        properties: { id: `yard-lane-${index}` },
        geometry: {
          type: 'LineString',
          coordinates
        }
      }))
    }),
    []
  );

  const focusData = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: focusFeatures(currentPhase)
    }),
    [currentPhase]
  );

  const positionedAssets = useMemo(
    () =>
      assets.map((asset) => ({
        asset,
        coordinates: assetCoordinates(asset, currentPhase, replayPoint)
      })),
    [assets, currentPhase, replayPoint]
  );

  return (
    <section className={`${immersive ? 'immersive-map-shell' : 'clarity-panel relative min-h-0 overflow-hidden p-4'} ${className}`}>
      {!immersive ? (
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-command-text">Area of operations</p>
            <p className="mt-1 max-w-[48rem] text-sm leading-5 text-command-muted">
              {narrative.title}: {narrative.happened}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-command-muted">Phase {phaseNumber}/11</p>
            <p className="mt-1 text-sm font-semibold text-command-cyan">
              {displayConfidence ? `${Math.round(displayConfidence)}% incident confidence` : 'No active run'}
            </p>
          </div>
        </div>
      ) : null}

      <div className={immersive ? 'relative h-full min-h-0 overflow-hidden bg-[#050910]' : 'relative h-[calc(100%-64px)] min-h-[320px] overflow-hidden border border-command-line/70 bg-[#050910]'}>
        <Map
          initialViewState={{ longitude: 28.0502, latitude: -26.2055, zoom: 13.72, pitch: 48, bearing: -24 }}
          mapStyle={MAP_STYLE}
          attributionControl={false}
          dragRotate={false}
          touchPitch={false}
          minZoom={13.1}
          maxZoom={17}
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl position="bottom-right" showCompass={false} />

          <Source id="map-context" type="geojson" data={contextData as never}>
            <Layer
              id="map-context-line"
              type="line"
              paint={{
                'line-color': '#61748b',
                'line-opacity': 0.23,
                'line-width': 1.4
              }}
            />
          </Source>

          <Source id="yard-lanes" type="geojson" data={yardLaneData as never}>
            <Layer
              id="yard-lane-line"
              type="line"
              paint={{
                'line-color': '#7d91a5',
                'line-opacity': 0.22,
                'line-width': 1.2
              }}
            />
          </Source>

          <Source id="facility-massing" type="geojson" data={buildingData as never}>
            <Layer
              id="facility-massing-extrusion"
              type="fill-extrusion"
              paint={{
                'fill-extrusion-color': ['get', 'color'],
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.68
              }}
            />
            <Layer
              id="facility-massing-outline"
              type="line"
              paint={{
                'line-color': '#7f95aa',
                'line-opacity': 0.28,
                'line-width': 1
              }}
            />
          </Source>

          <Source id="facility-zones" type="geojson" data={zoneData as never}>
            <Layer
              id="facility-zone-fill"
              type="fill"
              paint={{
                'fill-color': ['case', ['get', 'resolved'], '#3f8f67', ['get', 'active'], '#1f7f98', '#162536'],
                'fill-opacity': ['case', ['get', 'resolved'], 0.2, ['get', 'active'], 0.22, 0.13]
              }}
            />
            <Layer
              id="facility-zone-line"
              type="line"
              paint={{
                'line-color': ['case', ['get', 'resolved'], '#5fb98b', ['get', 'active'], '#58c6dd', '#61748b'],
                'line-opacity': ['case', ['get', 'active'], 0.82, 0.42],
                'line-width': ['case', ['get', 'active'], 1.8, 1]
              }}
            />
            <Layer
              id="facility-zone-label"
              type="symbol"
              layout={{
                'text-field': ['get', 'label'],
                'text-size': 12,
                'text-anchor': 'center',
                'text-allow-overlap': false
              }}
              paint={{
                'text-color': ['case', ['get', 'active'], '#d7e6f7', '#8aa0b8'],
                'text-halo-color': '#050910',
                'text-halo-width': 1.2
              }}
            />
          </Source>

          <Source id="facility-perimeter" type="geojson" data={perimeterData as never}>
            <Layer
              id="facility-perimeter-line"
              type="line"
              paint={{
                'line-color': '#8aa0b8',
                'line-opacity': 0.5,
                'line-width': 2,
                'line-dasharray': [2, 2]
              }}
            />
          </Source>

          {focusData.features.length ? (
            <Source id="phase-focus" type="geojson" data={focusData as never}>
              <Layer
                id="phase-focus-fill"
                type="fill"
                paint={{
                  'fill-color': ['match', ['get', 'tone'], 'red', '#b85a64', 'green', '#52a27b', '#c89d45'],
                  'fill-opacity': ['case', ['==', ['get', 'kind'], 'coverage'], 0.08, 0.13]
                }}
              />
              <Layer
                id="phase-focus-line"
                type="line"
                paint={{
                  'line-color': ['match', ['get', 'tone'], 'red', '#b85a64', 'green', '#52a27b', '#c89d45'],
                  'line-opacity': 0.58,
                  'line-width': 1.4,
                  'line-dasharray': ['case', ['==', ['get', 'kind'], 'degradation'], ['literal', [2, 2]], ['literal', [1, 0]]]
                }}
              />
            </Source>
          ) : null}

          {routes.length ? (
            <Source id="mission-routes" type="geojson" data={routeData as never}>
              <Layer
                id="mission-route-line"
                type="line"
                paint={{
                  'line-color': ['match', ['get', 'tone'], 'amber', '#c89d45', '#52bcd3'],
                  'line-opacity': ['case', ['get', 'muted'], 0.34, 0.82],
                  'line-width': ['case', ['get', 'muted'], 2, 3],
                  'line-dasharray': ['case', ['get', 'dashed'], ['literal', [2, 2]], ['literal', [1, 0]]]
                }}
              />
            </Source>
          ) : null}

          <Marker longitude={targetPoints.sector_b[0]} latitude={targetPoints.sector_b[1]} anchor="center">
            <div className={`incident-lock-marker ${currentPhase === 'incident_resolved' ? 'incident-lock-resolved' : ''}`}>
              <span className="incident-lock-corner incident-lock-corner-a" />
              <span className="incident-lock-corner incident-lock-corner-b" />
              <span className="incident-lock-corner incident-lock-corner-c" />
              <span className="incident-lock-corner incident-lock-corner-d" />
              <span className="incident-lock-dot" />
            </div>
          </Marker>

          {positionedAssets.map(({ asset, coordinates }) => {
            const active = activeAssetSet.has(asset.id) || selectedAssetId === asset.id;
            const showLabel = selectedAssetId === asset.id || (active && activeAssetSet.size <= 3 && currentPhase !== 'incident_resolved');
            return (
              <Marker key={asset.id} longitude={coordinates[0]} latitude={coordinates[1]} anchor="center">
                <button
                  type="button"
                  aria-label={asset.name}
                  onClick={() => onSelectAsset(asset.id)}
                  style={{ '--asset-heading': `${Math.round(asset.heading || 0)}deg` } as CSSProperties}
                  className={`map-asset-marker map-asset-${asset.asset_type} ${active ? 'map-asset-active' : ''} ${selectedAssetId === asset.id ? 'map-asset-selected' : ''} ${currentPhase === 'incident_resolved' ? 'map-asset-resolved' : ''}`}
                >
                  <span className="map-asset-shape" />
                  {showLabel ? <span className="map-asset-label">{asset.name.replace('Static ', '')}</span> : null}
                </button>
              </Marker>
            );
          })}
        </Map>

        <div className={immersive ? 'scene-map-annotation' : 'absolute left-4 top-4 max-w-sm border border-command-line/70 bg-[#070d15]/90 p-3'}>
          <p className="text-sm font-semibold text-command-text">{narrative.decision}</p>
          <p className="mt-1 text-xs leading-5 text-command-muted">{narrative.action}</p>
        </div>

        <div className={immersive ? 'scene-map-status' : 'absolute bottom-4 left-4 rounded-none border border-command-line/70 bg-[#070d15]/90 px-3 py-2 text-xs text-command-muted'}>
          {scenario?.status === 'completed'
            ? 'Incident closed'
            : activeMissions.length > 0
            ? `${activeMissions.length} task${activeMissions.length === 1 ? '' : 's'} active`
            : 'Perimeter stable'}
        </div>
      </div>
    </section>
  );
}

function assetCoordinates(asset: Asset, phase: string, replayPoint: ReplayPoint | null): LngLat {
  const replayApplies = replayPoint?.assetId === asset.id || (!replayPoint?.assetId && replayPoint?.missionId === asset.current_mission_id);
  if (replayPoint && replayApplies && isFacilityCoordinate(replayPoint.longitude, replayPoint.latitude)) {
    return [replayPoint.longitude, replayPoint.latitude];
  }

  const liveRelevant = Boolean(asset.current_mission_id) || ['active', 'mission', 'warning'].includes(asset.status);
  if (liveRelevant && isFacilityCoordinate(asset.longitude, asset.latitude)) {
    return [asset.longitude, asset.latitude];
  }

  return assetPoint(asset.id, phase);
}

function isFacilityCoordinate(longitude: number | undefined, latitude: number | undefined) {
  if (typeof longitude !== 'number' || typeof latitude !== 'number') return false;
  return latitude >= -26.218 && latitude <= -26.192 && longitude >= 28.031 && longitude <= 28.067;
}

function assetPoint(assetId: string, phase: string): LngLat {
  if (assetId === 'drone_001') {
    if (['alpha_dispatched', 'support_retasked'].includes(phase)) return [28.0484, -26.2011];
    if (['motion_validation', 'thermal_validation', 'incident_escalated', 'bravo_rerouted', 'ground_robot_assigned', 'priority_arbitration', 'incident_resolved'].includes(phase)) {
      return targetPoints.sector_b;
    }
  }
  if (assetId === 'drone_002' && ['bravo_rerouted', 'ground_robot_assigned', 'priority_arbitration', 'incident_resolved'].includes(phase)) {
    return targetPoints.sector_c;
  }
  if (assetId === 'robot_001' && ['ground_robot_assigned', 'priority_arbitration', 'incident_resolved'].includes(phase)) {
    return targetPoints.loading_bay;
  }
  return assetHome[assetId] ?? [28.049, -26.2046];
}

function routeSegments(phase: string): RouteSegment[] {
  const alpha: LngLat[] = [assetHome.drone_001, [28.0474, -26.2016], targetPoints.sector_b];
  const bravo: LngLat[] = [assetHome.drone_002, [28.061, -26.2104], targetPoints.sector_c];
  const robot: LngLat[] = [assetHome.robot_001, [28.0482, -26.2142], targetPoints.loading_bay];

  if (['alpha_dispatched', 'support_retasked', 'motion_validation', 'thermal_validation', 'incident_escalated'].includes(phase)) {
    return [{ id: 'alpha-route', coordinates: alpha, tone: 'cyan' }];
  }
  if (phase === 'bravo_rerouted') {
    return [
      { id: 'alpha-route-muted', coordinates: alpha, tone: 'cyan', muted: true },
      { id: 'bravo-route', coordinates: bravo, tone: 'amber', dashed: true }
    ];
  }
  if (phase === 'ground_robot_assigned') {
    return [
      { id: 'alpha-route-muted', coordinates: alpha, tone: 'cyan', muted: true },
      { id: 'robot-route', coordinates: robot, tone: 'amber' }
    ];
  }
  if (phase === 'incident_resolved') {
    return [];
  }
  return [];
}

function focusFeatures(phase: string) {
  if (phase === 'motion_validation') {
    return [circleFeature(targetPoints.sector_b, 0.002, 'anomaly', 'amber')];
  }
  if (phase === 'thermal_validation') {
    return [circleFeature(targetPoints.sector_b, 0.0027, 'anomaly', 'amber')];
  }
  if (phase === 'incident_escalated') {
    return [
      circleFeature(targetPoints.sector_b, 0.0032, 'risk', 'amber'),
      circleFeature(targetPoints.sector_c, 0.0028, 'degradation', 'red')
    ];
  }
  if (phase === 'bravo_rerouted') {
    return [circleFeature(targetPoints.sector_c, 0.0027, 'risk', 'amber')];
  }
  if (phase === 'ground_robot_assigned') {
    return [circleFeature(targetPoints.loading_bay, 0.0026, 'risk', 'amber')];
  }
  if (phase === 'priority_arbitration') {
    return [circleFeature(targetPoints.sector_c, 0.0024, 'coverage', 'amber')];
  }
  if (phase === 'incident_resolved') {
    return [circleFeature([28.0532, -26.2048], 0.005, 'resolution', 'green')];
  }
  if (phase === 'support_retasked') {
    return [circleFeature(targetPoints.sector_b, 0.0033, 'coverage', 'cyan')];
  }
  return [];
}

function circleFeature(center: LngLat, radius: number, kind: string, tone: string) {
  const coordinates: LngLat[] = [];
  for (let index = 0; index <= 64; index += 1) {
    const angle = (index / 64) * Math.PI * 2;
    const xRadius = radius * Math.cos(angle);
    const yRadius = radius * Math.sin(angle) * 0.72;
    coordinates.push([center[0] + xRadius, center[1] + yRadius]);
  }
  return {
    type: 'Feature',
    properties: { kind, tone },
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates]
    }
  };
}
