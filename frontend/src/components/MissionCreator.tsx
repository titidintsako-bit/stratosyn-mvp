import { AlertTriangle, PauseCircle, Play, Plus, Route, ShieldCheck } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import type { Asset, Mission, MissionFormState, MissionType, Priority, WaypointFormState } from '../types';
import { OperatorButton, OperatorInput, OperatorProgress, OperatorSelect } from './ui/OperatorControls';

interface MissionCreatorProps {
  assets: Asset[];
  missions: Mission[];
  form: MissionFormState;
  selectedMissionId: string;
  waypointForm: WaypointFormState;
  error: string | null;
  onFormChange: (form: MissionFormState) => void;
  onWaypointFormChange: (form: WaypointFormState) => void;
  onMissionSelect: (missionId: string) => void;
  onCreate: () => void;
  onCreateWaypoint: () => void;
  onApprove: () => void;
  onStart: () => void;
  onAbort: () => void;
}

const missionTypes: MissionType[] = ['inspect_zone', 'patrol_route', 'investigate_alert', 'return_home'];
const priorities: Priority[] = ['low', 'medium', 'high', 'critical'];

const missionTone: Record<string, string> = {
  pending: 'border-command-slate/50 bg-command-slate/10 text-slate-200',
  approved: 'border-command-amber/50 bg-command-amber/10 text-command-amber',
  running: 'border-command-cyan/50 bg-command-cyan/10 text-command-cyan',
  completed: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200',
  failed: 'border-command-red/50 bg-command-red/10 text-command-red',
  aborted: 'border-command-amber/50 bg-command-amber/10 text-command-amber'
};

export function MissionCreator({
  assets,
  missions,
  form,
  selectedMissionId,
  waypointForm,
  error,
  onFormChange,
  onWaypointFormChange,
  onMissionSelect,
  onCreate,
  onCreateWaypoint,
  onApprove,
  onStart,
  onAbort
}: MissionCreatorProps) {
  const selectedMission = missions.find((mission) => mission.id === selectedMissionId) ?? null;
  const assignedAsset = selectedMission
    ? assets.find((asset) => asset.id === selectedMission.assigned_asset_id) ?? null
    : assets.find((asset) => asset.id === form.assigned_asset_id) ?? null;
  const safetyGreen = Boolean(assignedAsset && assignedAsset.battery >= 30 && assignedAsset.status !== 'offline');
  const progress = missionProgress(selectedMission);

  return (
    <section className="p-3">
      <div className="flex items-center justify-between">
        <p className="panel-heading">Mission control</p>
        <span className={`status-chip ${safetyGreen ? 'border-command-cyan/40 bg-command-cyan/10 text-command-cyan' : 'border-command-amber/50 bg-command-amber/10 text-command-amber'}`}>
          {safetyGreen ? 'safety green' : 'safety hold'}
        </span>
      </div>

      {error && (
        <div className="mt-3 flex gap-2 border border-command-red/60 bg-command-red/10 p-2 text-[11px] leading-4 text-rose-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-3 border border-command-line bg-black/20 p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="panel-heading">Mission state</span>
          <span className={`status-chip ${selectedMission ? missionTone[selectedMission.status] : 'border-command-line text-command-muted'}`}>
            {selectedMission?.status ?? 'draft'}
          </span>
        </div>
        <StatusRow label="Assigned asset" value={assignedAsset?.name ?? 'unassigned'} />
        <StatusRow label="Target zone" value={selectedMission?.target_zone ?? form.target_zone} />
        <StatusRow label="Approval" value={selectedMission?.status === 'pending' ? 'required' : selectedMission ? 'recorded' : 'not staged'} />
        <StatusRow label="Progress" value={`${progress}%`} />
        <OperatorProgress className="mt-2" value={progress / 100} animate={selectedMission?.status === 'running'} stripes={selectedMission?.status === 'running'} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Field label="Mission name" className="col-span-2">
          <OperatorInput value={form.name} onChange={(e) => onFormChange({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Type">
          <OperatorSelect value={form.mission_type} onChange={(e) => onFormChange({ ...form, mission_type: e.currentTarget.value as MissionType })}>
            {missionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </OperatorSelect>
        </Field>
        <Field label="Priority">
          <OperatorSelect value={form.priority} onChange={(e) => onFormChange({ ...form, priority: e.currentTarget.value as Priority })}>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </OperatorSelect>
        </Field>
        <Field label="Target zone" className="col-span-2">
          <OperatorInput value={form.target_zone} onChange={(e) => onFormChange({ ...form, target_zone: e.target.value })} />
        </Field>
        <Field label="Latitude">
          <OperatorInput
            type="number"
            step="0.0001"
            value={String(form.target_latitude)}
            onChange={(e) => onFormChange({ ...form, target_latitude: Number(e.target.value) })}
          />
        </Field>
        <Field label="Longitude">
          <OperatorInput
            type="number"
            step="0.0001"
            value={String(form.target_longitude)}
            onChange={(e) => onFormChange({ ...form, target_longitude: Number(e.target.value) })}
          />
        </Field>
        <Field label="Asset" className="col-span-2">
          <OperatorSelect value={form.assigned_asset_id} onChange={(e) => onFormChange({ ...form, assigned_asset_id: e.currentTarget.value })}>
            <option value="">Select asset</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} / {asset.status} / {Math.round(asset.battery)}%
              </option>
            ))}
          </OperatorSelect>
        </Field>
      </div>

      <OperatorButton
        type="button"
        onClick={onCreate}
        tone="primary"
        fill
        className="mt-3"
        icon={<Plus size={13} />}
      >
        Create mission
      </OperatorButton>

      <div className="mt-3 border-t border-command-line pt-3">
        <Field label="Action target">
          <OperatorSelect value={selectedMissionId} onChange={(e) => onMissionSelect(e.currentTarget.value)}>
            <option value="">Select mission</option>
            {missions.map((mission) => (
              <option key={mission.id} value={mission.id}>
                {mission.name} / {mission.status}
              </option>
            ))}
          </OperatorSelect>
        </Field>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <ActionButton onClick={onApprove} label="Approve" icon={<ShieldCheck size={13} />} disabled={!selectedMissionId} />
          <ActionButton onClick={onStart} label="Start" icon={<Play size={13} />} disabled={!selectedMissionId} />
          <ActionButton onClick={onAbort} label="Abort" icon={<PauseCircle size={13} />} disabled={!selectedMissionId} danger />
        </div>
      </div>

      <div className="mt-3 border-t border-command-line pt-3">
        <div className="mb-2 flex items-center gap-2">
          <Route size={13} className="text-command-blue" />
          <p className="panel-heading">Waypoint route</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Label" className="col-span-2">
            <OperatorInput value={waypointForm.label} onChange={(e) => onWaypointFormChange({ ...waypointForm, label: e.target.value })} />
          </Field>
          <Field label="Latitude">
            <OperatorInput
              type="number"
              step="0.0001"
              value={String(waypointForm.latitude)}
              onChange={(e) => onWaypointFormChange({ ...waypointForm, latitude: Number(e.target.value) })}
            />
          </Field>
          <Field label="Longitude">
            <OperatorInput
              type="number"
              step="0.0001"
              value={String(waypointForm.longitude)}
              onChange={(e) => onWaypointFormChange({ ...waypointForm, longitude: Number(e.target.value) })}
            />
          </Field>
        </div>
        <OperatorButton
          type="button"
          onClick={onCreateWaypoint}
          disabled={!selectedMissionId}
          fill
          className="mt-2"
        >
          Add waypoint
        </OperatorButton>
      </div>
    </section>
  );
}

function missionProgress(mission: Mission | null) {
  if (!mission) return 0;
  if (mission.status === 'completed') return 100;
  if (mission.status === 'running') return 58;
  if (mission.status === 'approved') return 28;
  if (mission.status === 'pending') return 12;
  return 0;
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-command-muted">{label}</span>
      {children}
    </label>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-command-muted">{label}</span>
      <span className="max-w-[180px] truncate text-right font-mono text-[10px] uppercase tracking-[0.08em] text-command-text">{value}</span>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  danger = false
}: {
  label: string;
  icon: ReactElement;
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <OperatorButton
      type="button"
      onClick={onClick}
      disabled={disabled}
      tone={danger ? 'danger' : 'neutral'}
      icon={icon}
    >
      {label}
    </OperatorButton>
  );
}
