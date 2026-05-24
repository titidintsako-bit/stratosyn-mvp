import type { EvidenceState } from '../lib/evidence';

interface EvidenceFeedProps {
  phase: string;
  evidence: EvidenceState;
  selectedAssetName?: string;
  videoSrc?: string;
}

export function EvidenceFeed({ phase, evidence, selectedAssetName, videoSrc }: EvidenceFeedProps) {
  const resolved = phase === 'incident_resolved';

  return (
    <section className="evidence-shell">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="ops-label">Evidence feed</p>
          <h3 className="mt-1 text-base font-semibold text-command-text">{selectedAssetName ?? 'Facility evidence channel'}</h3>
        </div>
        <span className={`border px-2.5 py-1 text-xs font-semibold ${resolved ? 'border-emerald-400/35 text-emerald-300' : 'border-command-cyan/35 text-command-cyan'}`}>
          {videoSrc ? 'source live' : 'source pending'}
        </span>
      </div>

      <div className="evidence-frame">
        {videoSrc ? (
          <video className="h-full w-full object-cover" src={videoSrc} autoPlay muted loop playsInline />
        ) : (
          <>
            <div className="evidence-grid" />
            <div className="evidence-yard">
              <span className="evidence-building evidence-building-a" />
              <span className="evidence-building evidence-building-b" />
              <span className="evidence-building evidence-building-c" />
              <span className="evidence-route" />
              <span className="evidence-target" />
            </div>
            <div className="absolute left-3 top-3 text-xs text-command-muted">EO/IR source not connected</div>
            <div className="absolute bottom-3 left-3 text-xs text-command-text">{evidence.lock}</div>
            <div className="absolute bottom-3 right-3 font-mono text-xs tabular-nums text-command-cyan">{evidence.confidence}%</div>
          </>
        )}
      </div>

      <p className="mt-3 text-sm leading-5 text-command-muted">
        {videoSrc ? 'Operator video evidence is bound to the current scenario phase.' : 'Upload or configure the site video source and it will appear here as the primary evidence stream.'}
      </p>
    </section>
  );
}
