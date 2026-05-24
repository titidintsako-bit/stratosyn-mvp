import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Play, RotateCcw } from 'lucide-react';
import { EvidenceFeed } from './components/EvidenceFeed';
import { MapView } from './components/MapView';
import { api, PUBLIC_DEMO, WS_URL } from './services/api';
import type {
  Asset,
  CoreCognitionState,
  EventLog as EventLogType,
  IndustrialScenarioExport,
  Mission,
  OrchestrationScenarioRun,
  ReplayPoint,
  TelemetryPayload
} from './types';
import { useCognitionStore } from './store/cognitionStore';
import { evidenceForPhase, PHASE_STAGE_INDEX, RESPONSE_CHAIN } from './lib/evidence';
import { phaseNarrative, replayPhase } from './lib/scenarioNarrative';

const DEMO_PHASE_DELAY_MS = 1450;
const DEMO_COMMAND = 'Investigate possible intrusion near Sector B.';
const EVIDENCE_VIDEO_SRC = import.meta.env.VITE_EVIDENCE_VIDEO_SRC || '';

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function friendlyError(nextError: unknown) {
  const message = nextError instanceof Error ? nextError.message : String(nextError);
  if (message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('networkerror')) {
    return 'Backend connection unavailable. Start the FastAPI service on port 8000, then retry.';
  }
  return message || 'Action failed';
}

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [events, setEvents] = useState<EventLogType[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedReplayMissionId, setSelectedReplayMissionId] = useState('');
  const [scenario, setScenario] = useState<OrchestrationScenarioRun | null>(null);
  const [, setScenarioExport] = useState<IndustrialScenarioExport | null>(null);
  const [scenarioRunning, setScenarioRunning] = useState(false);
  const [demoModeRunning, setDemoModeRunning] = useState(false);
  const [replayPoints, setReplayPoints] = useState<ReplayPoint[]>([]);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [apiState, setApiState] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const { operationalState, coreState, setCoreState, setOperationalState } = useCognitionStore();

  const refreshOperationalData = useCallback(async () => {
    const [nextAssets, nextMissions, nextEvents, nextOperationalState, nextCoreState, nextScenario] = await Promise.all([
      api.assets(),
      api.missions(),
      api.events(),
      api.operationalState(),
      api.coreCognitionState(),
      api.activeScenario()
    ]);

    setAssets(nextAssets);
    setMissions(nextMissions);
    setEvents(nextEvents);
    setOperationalState(nextOperationalState);
    setCoreState(nextCoreState);
    setScenario(nextScenario);
    setApiState('open');
    setError(null);

    if (nextScenario?.selected_asset_id) {
      setSelectedAssetId(nextScenario.selected_asset_id);
    } else if (!selectedAssetId && nextAssets[0]) {
      setSelectedAssetId(nextAssets[0].id);
    }
  }, [selectedAssetId, setCoreState, setOperationalState]);

  useEffect(() => {
    refreshOperationalData().catch(() => {
      setApiState('closed');
      setError('Backend connection unavailable. Start the FastAPI service on port 8000, then retry.');
    });

    const poll = window.setInterval(() => {
      refreshOperationalData().catch(() => {
        setApiState('closed');
      });
    }, 3500);

    return () => window.clearInterval(poll);
  }, [refreshOperationalData]);

  useEffect(() => {
    if (PUBLIC_DEMO) {
      setConnectionState('open');
      return;
    }

    const socket = new WebSocket(WS_URL);
    let cancelled = false;
    setConnectionState('connecting');

    const applyTelemetry = (telemetry: TelemetryPayload) => {
      if (cancelled) return;
      setConnectionState('open');
      setAssets((currentAssets) =>
        currentAssets.map((asset) =>
          asset.id === telemetry.asset_id
            ? {
                ...asset,
                latitude: telemetry.latitude,
                longitude: telemetry.longitude,
                battery: telemetry.battery,
                speed: telemetry.speed,
                heading: telemetry.heading,
                status: telemetry.status,
                current_mission_id: telemetry.mission_id,
                updated_at: telemetry.timestamp
              }
            : asset
        )
      );
    };

    socket.onopen = () => {
      if (cancelled) {
        socket.close();
        return;
      }
      setConnectionState('connecting');
    };
    socket.onclose = () => {
      if (!cancelled) setConnectionState('closed');
    };
    socket.onerror = () => {
      if (!cancelled) setConnectionState('closed');
    };
    socket.onmessage = (event) => {
      if (cancelled) return;
      const envelope = JSON.parse(event.data) as { type?: string; payload?: TelemetryPayload | TelemetryPayload[] | CoreCognitionState };
      if (envelope.type === 'telemetry_snapshot' && Array.isArray(envelope.payload)) {
        envelope.payload.forEach((telemetry) => applyTelemetry(telemetry));
        return;
      }
      if (envelope.type === 'cognition' && envelope.payload && !Array.isArray(envelope.payload)) {
        setCoreState(envelope.payload as CoreCognitionState);
        return;
      }
      if (envelope.type !== 'telemetry' || !envelope.payload) return;

      applyTelemetry(envelope.payload as TelemetryPayload);
    };

    return () => {
      cancelled = true;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.CONNECTING) {
        socket.onopen = () => socket.close();
      } else {
        socket.close();
      }
    };
  }, [setCoreState]);

  useEffect(() => {
    if (!replayPlaying || replayPoints.length === 0) return;

    const timer = window.setInterval(() => {
      setReplayIndex((current) => {
        if (current >= replayPoints.length - 1) {
          setReplayPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 900);

    return () => window.clearInterval(timer);
  }, [replayPlaying, replayPoints.length]);

  const activeMissionCount = useMemo(() => missions.filter((mission) => ['approved', 'running'].includes(mission.status)).length, [missions]);
  const warningCount = useMemo(() => events.filter((event) => event.severity !== 'info' && !event.acknowledged).length, [events]);
  const currentReplayPoint = replayPlaying || replayIndex > 0 ? replayPoints[replayIndex] ?? null : null;
  const replayTimelinePhase = replayPhase(scenario?.timeline ?? [], replayIndex, replayPoints.length);
  const displayPhase = currentReplayPoint?.phase ?? (replayPlaying || replayIndex > 0 ? replayTimelinePhase?.phase ?? scenario?.phase : scenario?.phase);
  const currentPhase = displayPhase ?? 'intent_parsed';
  const displayConfidence = currentReplayPoint?.confidence ?? scenario?.confidence ?? 0;
  const narrative = phaseNarrative(currentPhase);
  const selectedAsset =
    assets.find((asset) => asset.id === currentReplayPoint?.assetId) ??
    assets.find((asset) => asset.id === selectedAssetId) ??
    assets.find((asset) => asset.id === scenario?.selected_asset_id) ??
    null;
  const finalOutcome = scenario?.outcome?.replace(/_/g, ' ') ?? 'pending';
  const replayAvailable = Boolean(replayPoints.length || scenario?.primary_mission_id);
  const stageIndex = PHASE_STAGE_INDEX[currentPhase] ?? 0;
  const evidence = evidenceForPhase(currentPhase, displayConfidence);
  const latestEvent = events[0] ?? null;

  async function guardedAction(action: () => Promise<unknown>) {
    try {
      setError(null);
      await action();
      await refreshOperationalData();
    } catch (nextError) {
      setApiState('closed');
      setError(friendlyError(nextError));
    }
  }

  async function resetIndustrialScenario() {
    setReplayPlaying(false);
    setReplayPoints([]);
    setReplayIndex(0);
    setSelectedReplayMissionId('');
    setScenarioExport(null);
    const reset = await api.resetIndustrialDemo();
    setScenario(reset.active_scenario);
    setAssets(reset.assets);
  }

  async function startIndustrialScenario() {
    setScenarioRunning(true);
    setError(null);
    try {
      const nextScenario = await api.startIndustrialIncident(DEMO_COMMAND);
      setScenario(nextScenario);
      setScenarioExport(null);
      setSelectedAssetId(nextScenario.selected_asset_id);
      if (nextScenario.primary_mission_id) {
        setSelectedReplayMissionId(nextScenario.primary_mission_id);
      }
      await refreshOperationalData();
    } catch (nextError) {
      setApiState('closed');
      setError(friendlyError(nextError));
    } finally {
      setScenarioRunning(false);
    }
  }

  async function runDemoMode() {
    setDemoModeRunning(true);
    setScenarioRunning(true);
    setError(null);
    try {
      await resetIndustrialScenario();
      await refreshOperationalData();
      let nextScenario = await api.startIndustrialIncident(DEMO_COMMAND);
      setScenario(nextScenario);
      setSelectedAssetId(nextScenario.selected_asset_id);
      if (nextScenario.primary_mission_id) {
        setSelectedReplayMissionId(nextScenario.primary_mission_id);
      }
      await refreshOperationalData();

      while (nextScenario.status === 'running') {
        await wait(DEMO_PHASE_DELAY_MS);
        nextScenario = await api.advanceScenario(nextScenario.id);
        setScenario(nextScenario);
        setSelectedAssetId(nextScenario.selected_asset_id);
        await refreshOperationalData();
      }

      const exported = await api.exportIndustrialDemo();
      setScenarioExport(exported);
      await refreshOperationalData();
      if (exported.scenario.primary_mission_id) {
        await loadReplay(exported.scenario.primary_mission_id, false);
      }
    } catch (nextError) {
      setApiState('closed');
      setError(friendlyError(nextError));
    } finally {
      setScenarioRunning(false);
      setDemoModeRunning(false);
    }
  }

  async function advanceScenario() {
    if (!scenario) return;
    const nextScenario = await api.advanceScenario(scenario.id);
    setScenario(nextScenario);
    setSelectedAssetId(nextScenario.selected_asset_id);
    await refreshOperationalData();
  }

  async function loadReplay(missionId: string, autoPlay = false) {
    if (!missionId) return;
    setSelectedReplayMissionId(missionId);
    const persistedReplay = await api.replayPath(missionId).catch(() => null);
    const missionList = persistedReplay ? missions : missions.some((item) => item.id === missionId) ? missions : await api.missions();
    const mission = missionList.find((item) => item.id === missionId);
    const legacyReplay = persistedReplay || !mission ? null : await api.missionReplay(missionId).catch(() => ({ points: [] }));
    const telemetry = legacyReplay?.points ?? [];
    const path =
      persistedReplay && persistedReplay.path.length > 0
        ? persistedReplay.path.map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude,
            missionId,
            timestamp: point.timestamp,
            phase: point.phase,
            confidence: point.confidence,
            message: point.message,
            assetId: point.asset_id,
            decisionIndex: point.decision_index
          }))
        : telemetry.length > 0
          ? telemetry.map((point) => ({ latitude: point.latitude, longitude: point.longitude, missionId }))
          : mission
            ? [
              {
                latitude: mission.start_latitude ?? mission.target_latitude,
                longitude: mission.start_longitude ?? mission.target_longitude,
                missionId
              },
              { latitude: mission.target_latitude, longitude: mission.target_longitude, missionId }
            ]
            : [];

    if (path.length === 0) return;

    setReplayPoints(path);
    setReplayIndex(0);
    setReplayPlaying(autoPlay && path.length > 1);
  }

  useEffect(() => {
    if (scenario?.status !== 'completed' || !scenario.primary_mission_id || replayPoints.length > 0) return;
    void loadReplay(scenario.primary_mission_id, false);
  }, [scenario?.status, scenario?.primary_mission_id, replayPoints.length]);

  return (
    <div className="stratosyn-scene h-[100dvh] overflow-hidden bg-command-bg text-command-text">
      <MapView
        assets={assets}
        missions={missions}
        scenario={scenario}
        selectedAssetId={currentReplayPoint?.assetId ?? selectedAssetId}
        replayPoint={currentReplayPoint}
        replayPointCount={replayPoints.length}
        replayIndex={replayIndex}
        onSelectAsset={setSelectedAssetId}
        immersive
        className="absolute inset-0"
      />

      <div className="scene-scrim" />
      <div className="scene-noise" />
      <FacilityHero currentPhase={currentPhase} confidence={displayConfidence} />

      <SceneHeader
        scenario={scenario}
        confidence={displayConfidence}
        outcome={finalOutcome}
        connectionState={connectionState}
        apiState={apiState}
        activeMissionCount={activeMissionCount}
        warningCount={warningCount}
        replayAvailable={replayAvailable}
        demoRunning={demoModeRunning}
        onDemoMode={() => void runDemoMode()}
        onReset={() => void guardedAction(resetIndustrialScenario)}
      />

      <main className="scene-layer">
        <section className="scene-brief">
          <p className="scene-kicker">Incident command</p>
          <h2>Possible intrusion near Sector B</h2>
          <p className="scene-copy">
            Stratosyn selected the first responder, retasked fixed sensors, closed a coverage gap, and verified the intrusion through ground confirmation.
          </p>
          <div className="scene-confidence">
            <span>Incident confidence</span>
            <strong>{Math.round(displayConfidence)}%</strong>
          </div>
          <div className="scene-confidence-rail">
            {[38, 61, 79, 88].map((value) => (
              <span key={value} className={displayConfidence >= value ? 'is-active' : ''}>
                {value}
              </span>
            ))}
          </div>
          <div className="scene-current">
            <span>Current decision</span>
            <strong>{narrative.title}</strong>
            <p>{narrative.happened}</p>
          </div>
        </section>

        <section className="scene-decision">
          <p className="scene-kicker">Why the system acted</p>
          <h2>{narrative.decision}</h2>
          <dl>
            <div>
              <dt>Trigger</dt>
              <dd>{narrative.trigger}</dd>
            </div>
            <div>
              <dt>Reasoning</dt>
              <dd>{evidence.reason}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{narrative.confidence}</dd>
            </div>
            <div>
              <dt>Action</dt>
              <dd>{narrative.action}</dd>
            </div>
          </dl>
        </section>

        <aside className="scene-evidence">
          <EvidenceFeed phase={currentPhase} evidence={evidence} selectedAssetName={selectedAsset?.name} videoSrc={EVIDENCE_VIDEO_SRC} />
          <div className="scene-metrics">
            <SceneMetric label="Assets" value={`${evidence.assetCount}`} />
            <SceneMetric label="Decisions" value={`${coreState.coordination_actions.length}`} />
            <SceneMetric label="Edges" value={`${coreState.causality_graph.edges.length}`} />
            <SceneMetric label="Replay" value={`${replayPoints.length || operationalState.replay_paths.length}`} />
          </div>
        </aside>

        <section className="scene-timeline">
          <div className="scene-timeline-head">
            <div>
              <p className="scene-kicker">Decision timeline</p>
              <h2>{evidence.verdict}</h2>
            </div>
            <div className="scene-replay-controls">
              <button type="button" onClick={() => void loadReplay(selectedReplayMissionId || scenario?.primary_mission_id || '', false)} disabled={!(selectedReplayMissionId || scenario?.primary_mission_id)}>
                Load
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!replayPoints.length && (selectedReplayMissionId || scenario?.primary_mission_id)) {
                    void loadReplay(selectedReplayMissionId || scenario?.primary_mission_id || '', true);
                    return;
                  }
                  setReplayPlaying((current) => !current);
                }}
                disabled={!(selectedReplayMissionId || scenario?.primary_mission_id)}
              >
                {replayPlaying ? 'Pause replay' : 'Play replay'}
              </button>
            </div>
          </div>
          <div className="scene-chain">
            {RESPONSE_CHAIN.map((step, index) => (
              <div key={step.phase} className={`scene-chain-node ${stageIndex >= index ? 'is-complete' : ''} ${stageIndex === index ? 'is-active' : ''}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{step.stage}</strong>
              </div>
            ))}
          </div>
          <input
            className="scene-range"
            type="range"
            min={0}
            max={Math.max(replayPoints.length - 1, 0)}
            value={Math.min(replayIndex, Math.max(replayPoints.length - 1, 0))}
            disabled={replayPoints.length === 0}
            onChange={(event) => {
              setReplayPlaying(false);
              setReplayIndex(Number(event.currentTarget.value));
            }}
          />
        </section>
      </main>

      {error ? (
        <div className="absolute bottom-4 left-1/2 z-50 flex max-w-xl -translate-x-1/2 items-center gap-3 border border-command-amber/50 bg-[#15110a]/95 px-4 py-3 text-sm text-command-amber shadow-panel">
          <AlertTriangle size={16} className="shrink-0" />
          {error}
        </div>
      ) : null}
    </div>
  );
}

function MissionHeader({
  scenario,
  confidence,
  outcome,
  connectionState,
  apiState,
  activeMissionCount,
  warningCount,
  replayAvailable,
  demoRunning,
  onDemoMode,
  onReset
}: {
  scenario: OrchestrationScenarioRun | null;
  confidence: number;
  outcome: string;
  connectionState: 'connecting' | 'open' | 'closed';
  apiState: 'connecting' | 'open' | 'closed';
  activeMissionCount: number;
  warningCount: number;
  replayAvailable: boolean;
  demoRunning: boolean;
  onDemoMode: () => void;
  onReset: () => void;
}) {
  const state = scenario?.status ?? 'ready';
  const linkTone = connectionState === 'open' ? 'text-command-cyan' : connectionState === 'connecting' ? 'text-command-amber' : 'text-command-red';
  const telemetryLabel =
    connectionState === 'open' ? 'Telemetry live' : connectionState === 'connecting' ? 'Telemetry waiting' : 'Telemetry offline';
  const incidentResolved = state === 'completed' && outcome === 'confirmed intrusion';
  const displayedWarningCount = incidentResolved ? 0 : warningCount;
  const missionAlertSummary =
    activeMissionCount === 0 && displayedWarningCount === 0
      ? '0 active missions / no open alerts'
      : `${activeMissionCount} active missions / ${displayedWarningCount} open alerts`;

  return (
    <header className="flex min-h-[72px] flex-col items-stretch justify-between gap-3 border-b border-command-line bg-[#070c13]/96 px-4 py-3 md:h-[72px] md:flex-row md:items-center md:px-5 md:py-0">
      <div className="min-w-0">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[18px] font-semibold tracking-[0.18em] text-command-text">STRATOSYN</h1>
          <span className="truncate text-sm text-command-muted">Industrial Facility Command Centre</span>
        </div>
        <div className="mt-2 hidden items-center gap-5 text-sm sm:flex">
          <HeaderFact label="Operation" value={state} tone={state === 'completed' ? 'text-emerald-300' : state === 'running' ? 'text-command-cyan' : 'text-command-muted'} />
          <HeaderFact label="Incident confidence" value={`${Math.round(confidence)}%`} tone={confidence >= 88 ? 'text-emerald-300' : 'text-command-amber'} />
          <HeaderFact label="Outcome" value={outcome} tone={outcome === 'confirmed intrusion' ? 'text-emerald-300' : 'text-command-muted'} />
          <HeaderFact label="Replay" value={replayAvailable ? 'available' : 'not loaded'} tone={replayAvailable ? 'text-command-cyan' : 'text-command-muted'} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 md:justify-end">
        <div className="hidden text-right text-sm text-command-muted xl:block">
          <p>
            <span className={apiState === 'open' ? 'text-command-cyan' : apiState === 'connecting' ? 'text-command-amber' : 'text-command-red'}>
              {apiState === 'open' ? 'Backend online' : apiState === 'connecting' ? 'Backend syncing' : 'Backend offline'}
            </span>
            <span className="mx-2 text-command-muted/50">/</span>
            <span className={linkTone}>{telemetryLabel}</span>
          </p>
          <p>{missionAlertSummary}</p>
        </div>
        <button type="button" onClick={onReset} className="ops-button flex-1 md:flex-none">
          <RotateCcw size={15} />
          Reset
        </button>
        <button type="button" onClick={onDemoMode} disabled={demoRunning} className="ops-button ops-button-primary flex-1 md:flex-none">
          <Play size={15} />
          {demoRunning ? 'Executing' : 'Demo Mode'}
        </button>
      </div>
    </header>
  );
}

function SceneHeader({
  scenario,
  confidence,
  outcome,
  connectionState,
  apiState,
  activeMissionCount,
  warningCount,
  replayAvailable,
  demoRunning,
  onDemoMode,
  onReset
}: {
  scenario: OrchestrationScenarioRun | null;
  confidence: number;
  outcome: string;
  connectionState: 'connecting' | 'open' | 'closed';
  apiState: 'connecting' | 'open' | 'closed';
  activeMissionCount: number;
  warningCount: number;
  replayAvailable: boolean;
  demoRunning: boolean;
  onDemoMode: () => void;
  onReset: () => void;
}) {
  const state = scenario?.status ?? 'ready';
  const incidentResolved = state === 'completed' && outcome === 'confirmed intrusion';
  const displayedWarningCount = incidentResolved ? 0 : warningCount;
  const missionAlertSummary =
    activeMissionCount === 0 && displayedWarningCount === 0
      ? '0 active missions / no open alerts'
      : `${activeMissionCount} active missions / ${displayedWarningCount} open alerts`;
  const connectionLabel =
    apiState === 'open' && connectionState === 'open'
      ? 'connected'
      : apiState === 'closed' || connectionState === 'closed'
        ? 'degraded'
        : 'syncing';

  return (
    <header className="scene-header">
      <div className="scene-brand">
        <strong>STRATOSYN</strong>
        <span>Industrial Facility Command Centre</span>
      </div>
      <div className="scene-status-strip">
        <SceneMetric label="Operation" value={state} />
        <SceneMetric label="Confidence" value={`${Math.round(confidence)}%`} />
        <SceneMetric label="Outcome" value={outcome} />
        <SceneMetric label="Replay" value={replayAvailable ? 'available' : 'not loaded'} />
        <SceneMetric label="Link" value={connectionLabel} />
        <SceneMetric label="Missions" value={missionAlertSummary} />
      </div>
      <div className="scene-actions">
        <button type="button" onClick={onReset}>
          <RotateCcw size={15} />
          Reset
        </button>
        <button type="button" onClick={onDemoMode} disabled={demoRunning}>
          <Play size={15} />
          {demoRunning ? 'Executing' : 'Demo Mode'}
        </button>
      </div>
    </header>
  );
}

function FacilityHero({ currentPhase, confidence }: { currentPhase: string; confidence: number }) {
  const stage = RESPONSE_CHAIN.find((item) => item.phase === currentPhase)?.stage ?? 'Detect';

  return (
    <div className="facility-hero" aria-hidden="true">
      <div className="facility-hero-label">
        <span>Facility operating picture</span>
        <strong>{stage} / {Math.round(confidence)}%</strong>
      </div>
      <div className="facility-plane">
        <span className="facility-perimeter" />
        <span className="facility-road facility-road-a" />
        <span className="facility-road facility-road-b" />
        <span className="facility-road facility-road-c" />

        <span className="facility-zone facility-zone-a">Sector A</span>
        <span className="facility-zone facility-zone-b">Sector B</span>
        <span className="facility-zone facility-zone-c">Sector C</span>
        <span className="facility-zone facility-zone-loading">Loading Bay</span>
        <span className="facility-zone facility-zone-storage">Storage Zone</span>

        <span className="facility-building building-a" />
        <span className="facility-building building-b" />
        <span className="facility-building building-c" />
        <span className="facility-building building-d" />

        <span className="facility-route route-alpha" />
        <span className="facility-route route-bravo" />
        <span className="facility-route route-delta" />
        <span className="facility-risk" />
        <span className="facility-asset asset-alpha">Alpha</span>
        <span className="facility-asset asset-bravo">Bravo</span>
        <span className="facility-asset asset-delta">Delta</span>
      </div>
    </div>
  );
}

function SceneMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="scene-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HeaderFact({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-command-muted">{label}</span>
      <strong className={`font-medium capitalize ${tone}`}>{value}</strong>
    </span>
  );
}
