import { Play, StepForward } from 'lucide-react';
import { EvidenceFeed } from './EvidenceFeed';
import type { Asset, CoreCognitionState, OperationalState } from '../types';
import type { EvidenceState } from '../lib/evidence';
import type { PhaseNarrative } from '../lib/scenarioNarrative';

interface DecisionExplanationPanelProps {
  scenarioStatus: string;
  currentPhase: string;
  narrative: PhaseNarrative;
  evidence: EvidenceState;
  selectedAsset: Asset | null;
  coreState: CoreCognitionState;
  operationalState: OperationalState;
  running: boolean;
  demoRunning: boolean;
  evidenceVideoSrc?: string;
  onStart: () => void;
  onAdvance: () => void;
  className?: string;
}

export function DecisionExplanationPanel({
  scenarioStatus,
  currentPhase,
  narrative,
  evidence,
  selectedAsset,
  coreState,
  operationalState,
  running,
  demoRunning,
  evidenceVideoSrc,
  onStart,
  onAdvance,
  className = ''
}: DecisionExplanationPanelProps) {
  return (
    <aside className={`ops-panel flex min-h-0 flex-col overflow-y-auto p-4 ${className}`}>
      <div>
        <p className="ops-label">Why the system acted</p>
        <h2 className="mt-2 text-xl font-semibold leading-7 text-command-text">{narrative.decision}</h2>
      </div>

      <div className="mt-4 grid gap-3">
        <DecisionRow label="Trigger" value={narrative.trigger} />
        <DecisionRow label="Reasoning" value={evidence.reason} />
        <DecisionRow label="Confidence change" value={narrative.confidence} emphasized />
        <DecisionRow label="Resulting action" value={narrative.action} />
      </div>

      <EvidenceFeed phase={currentPhase} evidence={evidence} selectedAssetName={selectedAsset?.name} videoSrc={evidenceVideoSrc} />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MetricBlock label="Sources" value={`${evidence.assetCount}`} />
        <MetricBlock label="Actions" value={`${coreState.coordination_actions.length}`} />
        <MetricBlock label="Evidence" value={`${operationalState.replay_paths.length}`} />
      </div>

      <div className="mt-4 border border-command-line bg-black/15 p-3">
        <p className="ops-label">Affected assets</p>
        <p className="mt-2 text-sm leading-5 text-command-text">{narrative.affectedAssets.join(', ')}</p>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
        <button type="button" onClick={onStart} disabled={running || demoRunning} className="ops-button">
          <Play size={15} />
          Start
        </button>
        <button type="button" onClick={onAdvance} disabled={demoRunning || scenarioStatus !== 'running'} className="ops-button">
          <StepForward size={15} />
          Step
        </button>
      </div>
    </aside>
  );
}

function DecisionRow({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className="border-b border-command-line/70 pb-3 last:border-b-0">
      <p className="text-xs text-command-muted">{label}</p>
      <p className={`mt-1 text-sm leading-5 ${emphasized ? 'font-mono font-semibold text-command-amber' : 'text-command-text'}`}>{value}</p>
    </div>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-command-line bg-black/15 p-3">
      <p className="text-xs text-command-muted">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-semibold tabular-nums text-command-text">{value}</p>
    </div>
  );
}
