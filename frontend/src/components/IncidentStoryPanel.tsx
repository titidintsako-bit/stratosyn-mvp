import type { Asset, EventLog as EventLogType } from '../types';
import { type EvidenceState, RESPONSE_CHAIN, severityTone } from '../lib/evidence';
import { phaseNarrative } from '../lib/scenarioNarrative';

interface IncidentStoryPanelProps {
  currentPhase: string;
  stageIndex: number;
  evidence: EvidenceState;
  confidence: number;
  assets: Asset[];
  latestEvent: EventLogType | null;
  className?: string;
}

export function IncidentStoryPanel({ currentPhase, stageIndex, evidence, confidence, assets, latestEvent, className = '' }: IncidentStoryPanelProps) {
  const narrative = phaseNarrative(currentPhase);
  const coordinatedAssetNames = ['drone_001', 'camera_002', 'drone_002', 'robot_001']
    .map((assetId) => assets.find((asset) => asset.id === assetId)?.name)
    .filter(Boolean);

  return (
    <aside className={`ops-panel flex min-h-0 flex-col overflow-y-auto p-5 ${className}`}>
      <div>
        <p className="ops-label">Incident story</p>
        <h2 className="mt-2 text-2xl font-semibold leading-8 text-command-text">Possible intrusion in Sector B</h2>
        <p className="mt-3 text-sm leading-6 text-command-muted">
          One request becomes asset selection, evidence validation, risk handling, and final confirmation.
        </p>
      </div>

      <section className="mt-5 border-t border-command-line pt-5">
        <p className="ops-label">What is happening now</p>
        <h3 className="mt-2 text-lg font-semibold text-command-text">{narrative.title}</h3>
        <p className="mt-2 text-sm leading-6 text-command-text">{narrative.happened}</p>
      </section>

      <section className="mt-5">
        <div className="flex items-center justify-between">
          <p className="ops-label">Incident confidence</p>
          <p className="font-mono text-sm font-semibold tabular-nums text-command-text">{Math.round(confidence)}%</p>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[38, 61, 79, 88].map((value) => {
            const active = confidence >= value;
            return (
              <div key={value} className={`border px-2 py-2 text-center font-mono text-sm tabular-nums ${active ? 'border-command-cyan/45 bg-command-cyan/10 text-command-text' : 'border-command-line bg-black/10 text-command-muted'}`}>
                {value}%
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-5">
        <p className="ops-label">System actions</p>
        <div className="mt-3 space-y-2">
          {RESPONSE_CHAIN.filter((_, index) => index <= Math.max(stageIndex, 0)).slice(-5).map((step) => (
            <div key={step.phase} className="flex gap-3 text-sm">
              <span className="mt-1 h-2 w-2 shrink-0 border border-command-cyan bg-command-cyan/30" />
              <span className="leading-5 text-command-muted">{step.detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 border border-command-line bg-black/15 p-3">
        <p className="ops-label">Current status</p>
        <p className={`mt-2 text-lg font-semibold ${currentPhase === 'incident_resolved' ? 'text-emerald-300' : 'text-command-amber'}`}>{evidence.verdict}</p>
        <p className="mt-2 text-sm leading-5 text-command-muted">{evidence.summary}</p>
      </section>

      <section className="mt-5">
        <p className="ops-label">Coordinated assets</p>
        <p className="mt-2 text-sm leading-6 text-command-text">{coordinatedAssetNames.join(', ') || 'Waiting for first asset assignment'}</p>
      </section>

      <section className="mt-auto border-t border-command-line pt-4">
        <p className="ops-label">Latest operational event</p>
        {latestEvent ? (
          <div className="mt-2">
            <p className={`text-sm font-semibold ${severityTone(latestEvent.severity)}`}>{latestEvent.event_type.replace(/_/g, ' ')}</p>
            <p className="mt-1 text-sm leading-5 text-command-muted">{latestEvent.message}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-command-muted">No event yet.</p>
        )}
      </section>
    </aside>
  );
}
