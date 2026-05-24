import { useEffect, useState } from 'react';
import { Activity, RadioTower, ShieldCheck, Signal, Timer } from 'lucide-react';

interface TopNavProps {
  assetCount: number;
  activeMissionCount: number;
  warningCount: number;
  connectionState: 'connecting' | 'open' | 'closed';
}

export function TopNav({ assetCount, activeMissionCount, warningCount, connectionState }: TopNavProps) {
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const connectionLabel = connectionState === 'open' ? 'link nominal' : connectionState === 'connecting' ? 'link sync' : 'link lost';
  const connectionClass =
    connectionState === 'open'
      ? 'border-command-cyan/40 text-command-cyan'
      : connectionState === 'connecting'
        ? 'border-command-amber/50 text-command-amber'
        : 'border-command-red/50 text-command-red';

  return (
    <header className="glass-panel relative z-[700] flex h-14 items-center justify-between border-x-0 border-t-0 px-4">
      <div className="flex items-center gap-3">
        <div className="telemetry-pulse flex h-9 w-9 items-center justify-center border border-command-cyan/60 bg-command-cyan/10 text-command-cyan">
          <RadioTower size={18} />
        </div>
        <div>
          <h1 className="font-mono text-[15px] font-semibold uppercase tracking-[0.22em] text-command-text">STRATOSYN CORE</h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-command-muted">Autonomous infrastructure cognition</p>
        </div>
      </div>
      <div className="hidden items-center gap-2 lg:flex">
        <TopMetric label="Assets" value={assetCount.toString()} tone="cyan" />
        <TopMetric label="Active" value={activeMissionCount.toString()} tone="blue" />
        <TopMetric label="Alerts" value={warningCount.toString()} tone={warningCount > 0 ? 'amber' : 'slate'} />
      </div>
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-command-muted">
        <span className={`hidden items-center gap-2 border px-3 py-2 md:flex ${connectionClass}`}>
          <Signal size={13} />
          {connectionLabel}
        </span>
        <span className="hidden items-center gap-2 border border-command-line bg-black/20 px-3 py-2 md:flex">
          <Activity size={13} className="text-command-cyan" />
          simulator
        </span>
        <span className="hidden items-center gap-2 border border-command-line bg-black/20 px-3 py-2 sm:flex">
          <ShieldCheck size={13} className="text-emerald-300" />
          jhb zone
        </span>
        <span className="flex items-center gap-2 border border-command-line bg-black/20 px-3 py-2 text-command-text">
          <Timer size={13} className="text-command-blue" />
          {clock.toLocaleTimeString([], { hour12: false })}
        </span>
      </div>
    </header>
  );
}

function TopMetric({ label, value, tone }: { label: string; value: string; tone: 'cyan' | 'blue' | 'amber' | 'slate' }) {
  const toneClass = {
    cyan: 'text-command-cyan',
    blue: 'text-command-blue',
    amber: 'text-command-amber',
    slate: 'text-command-slate'
  }[tone];

  return (
    <div className="grid min-w-24 grid-cols-[1fr_auto] items-center gap-3 border border-command-line bg-black/20 px-3 py-1.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-command-muted">{label}</span>
      <span className={`font-mono text-[12px] font-semibold tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}
