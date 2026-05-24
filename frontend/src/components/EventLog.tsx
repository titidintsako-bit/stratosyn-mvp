import { AlertTriangle, CheckCircle2, RadioTower } from 'lucide-react';
import type { Asset, EventLog as EventLogType, Mission } from '../types';
import { OperatorButton } from './ui/OperatorControls';

const severityClass = {
  info: 'border-command-blue/40 text-sky-200 bg-command-blue/10',
  warning: 'border-command-amber/50 text-command-amber bg-command-amber/10',
  critical: 'border-command-red/50 text-command-red bg-command-red/10'
};

interface EventLogProps {
  events: EventLogType[];
  assets: Asset[];
  missions: Mission[];
  onAcknowledge: (eventId: string) => void;
}

export function EventLog({ events, assets, missions, onAcknowledge }: EventLogProps) {
  return (
    <div className="glass-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-command-line px-3 py-2.5">
        <div className="flex items-center gap-2">
          <RadioTower size={14} className="text-command-cyan" />
          <div>
            <p className="panel-heading">Operational feed</p>
            <h3 className="text-[12px] font-semibold text-command-text">Live event log</h3>
          </div>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-command-muted">{events.length} events</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.14em] text-command-muted">
            Awaiting operational events
          </div>
        ) : (
          events.slice(0, 36).map((event) => (
            <div
              key={event.id}
              className="grid grid-cols-[70px_72px_118px_minmax(0,1fr)_70px] items-center gap-2 border-b border-command-line/60 px-3 py-2 text-[11px] transition hover:bg-command-blue/5"
            >
              <span className="font-mono tabular-nums text-command-muted">{new Date(event.timestamp).toLocaleTimeString()}</span>
              <span className={`w-fit border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] ${severityClass[event.severity]}`}>
                {event.severity}
              </span>
              <span className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-command-muted">
                {assetName(event.asset_id, assets)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-command-text">{event.message}</p>
                <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-command-muted">
                  {missionName(event.mission_id, missions)}
                </p>
              </div>
              {event.severity === 'info' ? (
                <span className="flex items-center justify-end gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-command-muted">
                  <CheckCircle2 size={11} />
                  audit
                </span>
              ) : event.acknowledged ? (
                <span className="border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-center font-mono text-[9px] uppercase tracking-[0.1em] text-emerald-200">
                  acked
                </span>
              ) : (
                <OperatorButton
                  type="button"
                  onClick={() => onAcknowledge(event.id)}
                  tone="amber"
                  icon={<AlertTriangle size={10} />}
                >
                  Ack
                </OperatorButton>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function assetName(assetId: string | null, assets: Asset[]) {
  if (!assetId) return 'system';
  return assets.find((asset) => asset.id === assetId)?.name ?? assetId;
}

function missionName(missionId: string | null, missions: Mission[]) {
  if (!missionId) return 'no mission';
  return missions.find((mission) => mission.id === missionId)?.name ?? missionId;
}
