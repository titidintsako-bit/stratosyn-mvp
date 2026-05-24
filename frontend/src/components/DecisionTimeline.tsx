import { Pause, Play, RotateCcw } from 'lucide-react';
import type { OrchestrationScenarioRun } from '../types';
import { type EvidenceState, RESPONSE_CHAIN } from '../lib/evidence';

interface DecisionTimelineProps {
  scenario: OrchestrationScenarioRun | null;
  stageIndex: number;
  evidence: EvidenceState;
  replayPointCount: number;
  replayIndex: number;
  replayPlaying: boolean;
  selectedReplayMissionId: string;
  onLoadReplay: () => void;
  onReplayToggle: () => void;
  onReplayIndexChange: (index: number) => void;
  className?: string;
}

export function DecisionTimeline({
  scenario,
  stageIndex,
  evidence,
  replayPointCount,
  replayIndex,
  replayPlaying,
  selectedReplayMissionId,
  onLoadReplay,
  onReplayToggle,
  onReplayIndexChange,
  className = ''
}: DecisionTimelineProps) {
  const activeStep = RESPONSE_CHAIN[Math.max(0, Math.min(stageIndex, RESPONSE_CHAIN.length - 1))];

  return (
    <section className={`ops-panel grid min-h-0 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_300px] ${className}`}>
      <div className="min-w-0 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="ops-label">Decision timeline</p>
            <h2 className="mt-1 text-lg font-semibold text-command-text">One operational decision at a time</h2>
          </div>
          <span className="font-mono text-sm tabular-nums text-command-muted">{scenario?.timeline?.length ?? 0}/11 phases</span>
        </div>

        <div className="timeline-strip">
          {RESPONSE_CHAIN.map((step, index) => {
            const completed = stageIndex >= index;
            const active = stageIndex === index;
            return (
              <div
                key={step.phase}
                className={`timeline-node ${active ? 'timeline-node-active' : ''} ${completed ? 'timeline-node-complete' : ''}`}
                aria-label={step.label}
              >
                <span>{index + 1}</span>
                <strong>{step.stage}</strong>
              </div>
            );
          })}
        </div>

        <div className="mt-3 border border-command-line/80 bg-black/15 p-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-command-text">{activeStep?.label ?? 'Incident detected'}</p>
              <p className="mt-1 text-sm leading-5 text-command-muted">{evidence.chainDetail}</p>
            </div>
            <span className="shrink-0 font-mono text-sm tabular-nums text-command-cyan">{evidence.confidence}%</span>
          </div>
        </div>
      </div>

      <aside className="hidden border-l border-command-line p-4 xl:block">
        <p className="ops-label">Replay explanation</p>
        <p className="mt-2 text-sm leading-6 text-command-text">
          {replayPointCount
            ? `${replayPlaying ? 'Playing' : 'Loaded'} phase ${Math.min(replayIndex + 1, replayPointCount)} of ${replayPointCount}.`
            : selectedReplayMissionId
              ? 'Evidence replay available. Load the incident to inspect the decision chain.'
              : 'Replay becomes available after Demo Mode completes.'}
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onLoadReplay} disabled={!selectedReplayMissionId} className="ops-button flex-1">
            <RotateCcw size={15} />
            Load
          </button>
          <button type="button" onClick={onReplayToggle} disabled={!selectedReplayMissionId} className="ops-button ops-button-primary flex-1">
            {replayPlaying ? <Pause size={15} /> : <Play size={15} />}
            {replayPlaying ? 'Pause' : 'Review'}
          </button>
        </div>
        <input
          className="mt-5 h-2 w-full accent-command-cyan"
          type="range"
          min={0}
          max={Math.max(replayPointCount - 1, 0)}
          value={Math.min(replayIndex, Math.max(replayPointCount - 1, 0))}
          disabled={replayPointCount === 0}
          onChange={(event) => onReplayIndexChange(Number(event.currentTarget.value))}
        />
      </aside>
    </section>
  );
}
