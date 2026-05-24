import { AlertTriangle, GitBranch, Play, RotateCcw, ShieldCheck, Undo2 } from 'lucide-react';
import { useMemo } from 'react';
import type { Asset, CoreCognitionState, IndustrialScenarioExport, Mission, OrchestrationScenarioRun } from '../types';
import { phaseNarrative, SCENARIO_PHASE_ORDER } from '../lib/scenarioNarrative';
import { OperatorButton, OperatorProgress } from './ui/OperatorControls';

interface IndustrialScenarioPanelProps {
  scenario: OrchestrationScenarioRun | null;
  exportState: IndustrialScenarioExport | null;
  coreState: CoreCognitionState;
  assets: Asset[];
  missions: Mission[];
  running: boolean;
  demoRunning: boolean;
  replayPointCount: number;
  replayIndex: number;
  onDemoMode: () => void;
  onReset: () => void;
  onStart: () => void;
  onAdvance: () => void;
  onLoadReplay: (missionId: string) => void;
}

const phaseLabel: Record<string, string> = {
  intent_parsed: 'Intent Parsed',
  asset_selected: 'Asset Selected',
  alpha_dispatched: 'Alpha Dispatched',
  support_retasked: 'Support Retasked',
  motion_validation: 'Motion Validation',
  thermal_validation: 'Thermal Validation',
  incident_escalated: 'Incident Escalation',
  bravo_rerouted: 'Bravo Rerouted',
  ground_robot_assigned: 'Ground Verification',
  priority_arbitration: 'Priority Arbitration',
  incident_resolved: 'Incident Resolved'
};

export function IndustrialScenarioPanel({
  scenario,
  exportState,
  coreState,
  assets,
  missions,
  running,
  demoRunning,
  replayPointCount,
  replayIndex,
  onDemoMode,
  onReset,
  onStart,
  onAdvance,
  onLoadReplay
}: IndustrialScenarioPanelProps) {
  const selectedAsset = scenario?.selected_asset_id ? assets.find((asset) => asset.id === scenario.selected_asset_id) : null;
  const activeMissions = missions.filter((mission) => ['approved', 'running'].includes(mission.status));
  const timeline = scenario?.timeline ?? [];
  const currentPhase = scenario?.phase ?? timeline[timeline.length - 1]?.phase ?? 'intent_parsed';
  const narrative = phaseNarrative(currentPhase);
  const progress = timeline.length > 0 ? Math.min(1, timeline.length / SCENARIO_PHASE_ORDER.length) : 0;
  const isResolved = scenario?.status === 'completed' && scenario.outcome === 'confirmed_intrusion';
  const missionStateLabel = isResolved ? 'resolved / replay available' : `${activeMissions.length} active missions`;
  const replayPhaseIndex =
    replayPointCount > 1 ? Math.min(timeline.length - 1, Math.round((replayIndex / Math.max(replayPointCount - 1, 1)) * Math.max(timeline.length - 1, 0))) : timeline.length - 1;
  const replayTimelineItem = timeline[Math.max(0, replayPhaseIndex)] ?? null;

  const metrics = useMemo(() => {
    const coordinatedAssets = new Set<string>();
    timeline.forEach((item) => {
      if (item.asset_id) coordinatedAssets.add(item.asset_id);
    });
    coreState.coordination_actions.forEach((action) => {
      if (action.initiator_asset_id) coordinatedAssets.add(action.initiator_asset_id);
      if (action.target_asset_id) coordinatedAssets.add(action.target_asset_id);
    });
    return [
      { label: 'Assets', value: Math.max(coordinatedAssets.size, exportState?.assets_involved.length ?? 0).toString() },
      { label: 'Decisions', value: coreState.reasoning_events.length.toString() },
      { label: 'Edges', value: coreState.causality_graph.edges.length.toString() },
      { label: 'Predictions', value: coreState.predictions.length.toString() },
      { label: 'Actions', value: coreState.coordination_actions.length.toString() },
      { label: 'Replay', value: `${timeline.length}/11` },
      { label: 'Confidence', value: `${Math.round(scenario?.confidence ?? 0)}%` },
      { label: 'Outcome', value: scenario?.outcome?.replace(/_/g, ' ') ?? 'pending' }
    ];
  }, [coreState, exportState, scenario?.confidence, scenario?.outcome, timeline]);

  return (
    <section className="border-b border-command-line p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-command-amber" />
          <p className="panel-heading">Industrial incident orchestration</p>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-command-cyan">
          {demoRunning ? 'demo mode' : scenario?.status ?? 'ready'}
        </span>
      </div>

      <div className="mt-3 border border-command-line bg-black/20 p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-command-text">
              {scenario ? phaseLabel[currentPhase] ?? currentPhase.replace(/_/g, ' ') : 'Investigate possible intrusion near Sector B'}
            </p>
            <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.1em] text-command-muted">
              {selectedAsset?.name ?? 'deterministic asset arbitration'} / {missionStateLabel}
            </p>
          </div>
          <span className={`font-mono text-[18px] font-semibold tabular-nums ${isResolved ? 'text-emerald-300' : 'text-command-amber'}`}>
            {Math.round(scenario?.confidence ?? 0)}%
          </span>
        </div>
        <div className="mt-2">
          <OperatorProgress value={progress} />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <Fact label="Phase" value={scenario ? `${timeline.length}/11` : '0/11'} />
          <Fact label="Asset" value={selectedAsset?.id ?? 'pending'} />
          <Fact label="Outcome" value={scenario?.outcome?.replace(/_/g, ' ') ?? 'unresolved'} />
        </div>
      </div>

      <div className="mt-3 border border-command-line bg-black/20 p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="panel-heading">Mission narrative</span>
          <span className={`font-mono text-[9px] tabular-nums ${isResolved ? 'text-emerald-300' : 'text-command-amber'}`}>
            {narrative.confidence}
          </span>
        </div>
        <p className="text-[11px] leading-4 text-command-text">{narrative.happened}</p>
        <p className="mt-2 text-[10px] leading-4 text-command-muted">{narrative.why}</p>
        <div className="mt-2 border-t border-command-line pt-2">
          <CausalityRow label="Next expected" value={narrative.next} />
          <CausalityRow label="Assets affected" value={narrative.affectedAssets.join(', ')} />
        </div>
      </div>

      <div className="mt-3 border border-command-line bg-black/20 p-2">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck size={12} className={isResolved ? 'text-emerald-300' : 'text-command-cyan'} />
          <span className="panel-heading">Causality explanation</span>
        </div>
        <CausalityRow label="Trigger" value={narrative.trigger} />
        <CausalityRow label="Decision" value={narrative.decision} />
        <CausalityRow label="Reason" value={narrative.reasoning} />
        <CausalityRow label="Confidence" value={narrative.confidence} tone={isResolved ? 'green' : 'amber'} />
        <CausalityRow label="Action" value={narrative.action} />
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_78px] gap-2">
        <OperatorButton type="button" onClick={onDemoMode} disabled={demoRunning} tone="primary" icon={<Play size={13} />}>
          Demo Mode
        </OperatorButton>
        <OperatorButton type="button" onClick={onReset} disabled={demoRunning} tone="ghost" icon={<Undo2 size={13} />}>
          Reset
        </OperatorButton>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <OperatorButton type="button" onClick={onStart} disabled={running || demoRunning} tone="ghost" icon={<Play size={13} />}>
          Start only
        </OperatorButton>
        <OperatorButton type="button" onClick={onAdvance} disabled={!scenario || scenario.status !== 'running' || demoRunning} tone="ghost" icon={<GitBranch size={13} />}>
          Advance phase
        </OperatorButton>
      </div>

      {scenario?.primary_mission_id ? (
        <OperatorButton
          type="button"
          onClick={() => onLoadReplay(scenario.primary_mission_id as string)}
          fill
          className="mt-2"
          icon={<RotateCcw size={13} />}
        >
          Load incident replay
        </OperatorButton>
      ) : null}

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {metrics.map((metric) => (
          <Metric key={metric.label} label={metric.label} value={metric.value} subdued={isResolved && metric.label !== 'Confidence' && metric.label !== 'Outcome'} />
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        {timeline.length === 0 ? (
          <div className="border border-command-line bg-black/20 px-2 py-4 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-command-muted">
            Demo Mode will persist the scenario timeline here
          </div>
        ) : (
          timeline
            .slice(-6)
            .reverse()
            .map((item) => (
              <div key={`${item.phase}-${item.timestamp}`} className="grid grid-cols-[18px_minmax(0,1fr)_36px] gap-2 border border-command-line bg-black/20 p-2">
                <ShieldCheck size={12} className="mt-0.5 text-command-cyan" />
                <div className="min-w-0">
                  <p className="truncate font-mono text-[9px] uppercase tracking-[0.1em] text-command-cyan">{item.phase.replace(/_/g, ' ')}</p>
                  <p className="mt-1 text-[10px] leading-4 text-command-text">{item.message}</p>
                </div>
                <span className="text-right font-mono text-[9px] tabular-nums text-command-amber">{Math.round(item.confidence)}%</span>
              </div>
            ))
        )}
      </div>

      {replayTimelineItem ? (
        <div className="mt-3 border border-command-line bg-command-cyan/5 p-2">
          <p className="panel-heading">Replay focus</p>
          <p className="mt-1 text-[10px] leading-4 text-command-text">
            {phaseLabel[replayTimelineItem.phase] ?? replayTimelineItem.phase.replace(/_/g, ' ')} / {Math.round(replayTimelineItem.confidence)}% confidence
          </p>
        </div>
      ) : null}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-command-line bg-black/20 p-1.5">
      <p className="font-mono text-[8px] uppercase tracking-[0.1em] text-command-muted">{label}</p>
      <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-command-text">{value}</p>
    </div>
  );
}

function Metric({ label, value, subdued = false }: { label: string; value: string; subdued?: boolean }) {
  return (
    <div className={`border p-1.5 ${subdued ? 'border-command-line bg-black/20' : 'border-command-cyan/30 bg-command-cyan/5'}`}>
      <p className="font-mono text-[7px] uppercase tracking-[0.1em] text-command-muted">{label}</p>
      <p className={`mt-1 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.06em] ${subdued ? 'text-command-muted' : 'text-command-cyan'}`}>{value}</p>
    </div>
  );
}

function CausalityRow({ label, value, tone = 'text' }: { label: string; value: string; tone?: 'text' | 'amber' | 'green' }) {
  const toneClass = tone === 'amber' ? 'text-command-amber' : tone === 'green' ? 'text-emerald-300' : 'text-command-text';
  return (
    <div className="mb-1.5 grid grid-cols-[74px_minmax(0,1fr)] gap-2">
      <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-command-muted">{label}</span>
      <span className={`text-[10px] leading-4 ${toneClass}`}>{value}</span>
    </div>
  );
}
