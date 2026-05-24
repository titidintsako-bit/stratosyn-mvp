import { Activity, History, RotateCcw } from 'lucide-react';
import type { Mission, OrchestrationScenarioRun } from '../types';
import { phaseNarrative, replayPhase } from '../lib/scenarioNarrative';
import { OperatorButton, OperatorSelect, OperatorSlider } from './ui/OperatorControls';

interface MissionTimelineProps {
  missions: Mission[];
  scenario: OrchestrationScenarioRun | null;
  selectedReplayMissionId: string;
  replayPointCount: number;
  replayIndex: number;
  replayPlaying: boolean;
  onReplayMissionChange: (missionId: string) => void;
  onReplay: () => void;
  onReplayToggle: () => void;
  onReplayIndexChange: (index: number) => void;
}

const statusClass: Record<string, string> = {
  pending: 'text-slate-300 border-slate-500/50',
  approved: 'text-command-amber border-command-amber/50',
  running: 'text-command-cyan border-command-cyan/50',
  completed: 'text-emerald-200 border-emerald-400/50',
  failed: 'text-command-red border-command-red/50',
  aborted: 'text-command-amber border-command-amber/50'
};

export function MissionTimeline({
  missions,
  scenario,
  selectedReplayMissionId,
  replayPointCount,
  replayIndex,
  replayPlaying,
  onReplayMissionChange,
  onReplay,
  onReplayToggle,
  onReplayIndexChange
}: MissionTimelineProps) {
  const completedMissions = missions.filter((mission) => mission.status === 'completed');
  const latestMissions = missions.slice(0, 8);
  const activeReplayPhase = replayPhase(scenario?.timeline ?? [], replayIndex, replayPointCount);
  const activeNarrative = phaseNarrative(activeReplayPhase?.phase ?? scenario?.phase);

  return (
    <div className="glass-panel grid h-full min-h-0 grid-cols-[1.1fr_0.95fr] overflow-hidden">
      <div className="min-w-0 border-r border-command-line">
        <div className="flex items-center justify-between border-b border-command-line px-3 py-2.5">
          <div className="flex items-center gap-2">
            <History size={14} className="text-command-cyan" />
            <div>
              <p className="panel-heading">Mission timeline</p>
              <h3 className="text-[12px] font-semibold text-command-text">Lifecycle state</h3>
            </div>
          </div>
          <span className="font-mono text-[10px] tabular-nums text-command-muted">{missions.length} total</span>
        </div>
        <div className="h-[calc(100%-49px)] overflow-y-auto p-2.5">
          {latestMissions.length === 0 ? (
            <EmptyState label="No missions staged" />
          ) : (
            latestMissions.map((mission) => (
              <div key={mission.id} className="mb-1.5 grid grid-cols-[minmax(0,1fr)_84px] items-center gap-2 border border-command-line bg-black/20 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-command-text">{mission.name}</p>
                  <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-command-muted">
                    {mission.target_zone} / {mission.assigned_asset_id ?? 'unassigned'}
                  </p>
                </div>
                <span className={`border px-2 py-1 text-center font-mono text-[9px] uppercase tracking-[0.1em] ${statusClass[mission.status]}`}>
                  {mission.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-between border-b border-command-line px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-command-blue" />
            <div>
              <p className="panel-heading">Replay state</p>
              <h3 className="text-[12px] font-semibold text-command-text">Decision playback</h3>
            </div>
          </div>
          <span className="font-mono text-[10px] text-command-cyan">{replayPlaying ? 'replay active' : 'replay ready'}</span>
        </div>

        <div className="grid h-[calc(100%-49px)] grid-rows-[auto_1fr] gap-2 p-2.5">
          <div className="grid grid-cols-[minmax(0,1fr)_74px] gap-2">
            <OperatorSelect value={selectedReplayMissionId} onChange={(event) => onReplayMissionChange(event.currentTarget.value)}>
              <option value="">Completed mission</option>
              {completedMissions.map((mission) => (
                <option key={mission.id} value={mission.id}>
                  {mission.name}
                </option>
              ))}
            </OperatorSelect>
            <OperatorButton
              type="button"
              onClick={onReplay}
              disabled={!selectedReplayMissionId}
              tone="primary"
              icon={<RotateCcw size={12} />}
            >
              Load
            </OperatorButton>
          </div>

            <div className="grid grid-rows-[auto_1fr] gap-2">
            <div className="grid grid-cols-[56px_minmax(0,1fr)_52px] items-center gap-2">
              <OperatorButton
                type="button"
                onClick={onReplayToggle}
                disabled={replayPointCount === 0}
                tone="ghost"
              >
                {replayPlaying ? 'Pause' : 'Play'}
              </OperatorButton>
              <OperatorSlider
                min={0}
                max={Math.max(replayPointCount - 1, 0)}
                value={Math.min(replayIndex, Math.max(replayPointCount - 1, 0))}
                disabled={replayPointCount === 0}
                onChange={(value) => onReplayIndexChange(value)}
              />
              <span className="text-right font-mono text-[10px] tabular-nums text-command-muted">
                {replayPointCount ? replayIndex + 1 : 0}/{replayPointCount}
              </span>
            </div>

            <div className="grid min-h-0 grid-rows-[auto_1fr] gap-2">
              <div className="border border-command-line bg-black/20 p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-command-cyan">
                    {activeReplayPhase?.phase.replace(/_/g, ' ') ?? 'Replay not loaded'}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-command-amber">
                    {activeReplayPhase ? `${Math.round(activeReplayPhase.confidence)}%` : '--'}
                  </span>
                </div>
                <p className="line-clamp-2 text-[10px] leading-4 text-command-text">
                  {activeReplayPhase?.message ?? 'Load incident replay to scrub asset movement, confidence evolution, risk changes, and coordination progression.'}
                </p>
                <p className="mt-1 line-clamp-1 font-mono text-[9px] uppercase tracking-[0.1em] text-command-muted">
                  {activeNarrative.action}
                </p>
              </div>

              <div className="grid grid-cols-12 items-end gap-1 border border-command-line bg-black/20 p-2">
                {Array.from({ length: 36 }).map((_, index) => (
                  <span
                    key={index}
                    className={index <= replayIndex * 4 ? 'bg-command-cyan/45' : 'bg-command-slate/30'}
                    style={{
                      height: 8 + ((index * 5 + replayIndex * 3) % 24),
                      opacity: replayPointCount ? 0.18 + (index % 6) * 0.06 : 0.12
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center border border-command-line bg-black/20 font-mono text-[10px] uppercase tracking-[0.14em] text-command-muted">
      {label}
    </div>
  );
}
