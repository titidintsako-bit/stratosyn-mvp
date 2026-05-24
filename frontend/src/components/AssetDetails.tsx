import { Battery, BrainCircuit, Compass, Crosshair, Gauge, GitBranch, MapPin, Radio, ShieldAlert, Waves } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Asset, EventLog, Mission, OperationalState } from '../types';
import {
  aiInterpretation,
  causalityChain,
  failureProbability,
  nearestRelatedAssets,
  operationalConfidence,
  signalQuality
} from '../lib/operational';

interface AssetDetailsProps {
  asset: Asset | null;
  mission: Mission | null;
  assets: Asset[];
  events: EventLog[];
  operationalState: OperationalState;
}

const statusTone: Record<string, string> = {
  idle: 'border-command-slate/50 bg-command-slate/10 text-slate-200',
  active: 'border-command-cyan/50 bg-command-cyan/10 text-command-cyan',
  mission: 'border-command-cyan/50 bg-command-cyan/10 text-command-cyan',
  warning: 'border-command-amber/50 bg-command-amber/10 text-command-amber',
  offline: 'border-command-red/50 bg-command-red/10 text-command-red'
};

export function AssetDetails({ asset, mission, assets, events, operationalState }: AssetDetailsProps) {
  if (!asset) {
    return (
      <section className="border-b border-command-line p-3">
        <p className="panel-heading">Intelligence core</p>
        <p className="mt-3 text-xs text-command-muted">Select an asset to activate operational reasoning.</p>
      </section>
    );
  }

  const signal = signalQuality(asset, events);
  const confidence = operationalConfidence(asset, events);
  const failure = failureProbability(asset, events);
  const activeDependencies = operationalState.mission_dependencies.filter(
    (dependency) => dependency.active && (dependency.source_asset_id === asset.id || dependency.target_asset_id === asset.id)
  );
  const dependencyAssetIds = activeDependencies.map((dependency) =>
    dependency.source_asset_id === asset.id ? dependency.target_asset_id : dependency.source_asset_id
  );
  const relatedFromDependencies = dependencyAssetIds
    .map((assetId) => assets.find((item) => item.id === assetId))
    .filter(Boolean) as Asset[];
  const related = relatedFromDependencies.length > 0 ? relatedFromDependencies : nearestRelatedAssets(asset, assets);
  const reasoning = aiInterpretation(asset, mission, events);
  const persistedChain = activeDependencies.slice(0, 3).map((dependency) => dependency.reason);
  const chain = persistedChain.length > 0 ? persistedChain : causalityChain(asset, mission, related, events);
  const latestEvent = events.find((event) => event.asset_id === asset.id) ?? null;
  const latestCluster = operationalState.anomaly_clusters.find((cluster) => cluster.asset_id === asset.id) ?? null;
  const rerouteSuggestion = operationalState.reroute_suggestions.find(
    (suggestion) => suggestion.asset_id === asset.id && suggestion.status === 'pending'
  );
  const trail = operationalState.telemetry_trails.find((item) => item.asset_id === asset.id);

  return (
    <section className="border-b border-command-line p-3">
      <div className="flex items-center justify-between">
        <p className="panel-heading">Intelligence core</p>
        <span className={`status-chip ${statusTone[asset.status]}`}>{asset.status}</span>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold leading-5 text-command-text">{asset.name}</h2>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-command-muted">
            {asset.id} / {asset.asset_type.replace('_', ' ')}
          </p>
        </div>
        <Radio size={16} className="mt-1 text-command-cyan" />
      </div>

      <div className="mt-3 border border-command-line bg-black/20 p-2">
        <div className="mb-2 flex items-center gap-2">
          <BrainCircuit size={13} className="text-command-cyan" />
          <span className="panel-heading">Reasoning state</span>
        </div>
        <p className="text-[11px] leading-4 text-command-text">{reasoning}</p>
        {rerouteSuggestion ? (
          <p className="mt-2 border-t border-command-line pt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-command-amber">
            Reroute pending / risk {Math.round(rerouteSuggestion.risk_score)} / confidence {Math.round(rerouteSuggestion.confidence * 100)}%
          </p>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <Score label="Signal" value={signal} tone={signal > 70 ? 'cyan' : signal > 45 ? 'amber' : 'red'} />
        <Score label="Confidence" value={confidence} tone={confidence > 70 ? 'cyan' : confidence > 45 ? 'amber' : 'red'} />
        <Score label="Failure risk" value={failure} tone={failure < 25 ? 'cyan' : failure < 50 ? 'amber' : 'red'} />
      </div>

      <div className="mt-3 border-y border-command-line/70 py-1">
        <DataRow icon={<Battery size={13} />} label="Battery" value={`${Math.round(asset.battery)}%`} />
        <DataRow icon={<Gauge size={13} />} label="Speed" value={`${asset.speed.toFixed(1)} m/s`} />
        <DataRow icon={<Compass size={13} />} label="Heading" value={`${Math.round(asset.heading)} deg`} />
        <DataRow icon={<Crosshair size={13} />} label="Mission" value={mission?.id ?? 'none'} />
        <DataRow icon={<MapPin size={13} />} label="Coordinates" value={`${asset.latitude.toFixed(5)}, ${asset.longitude.toFixed(5)}`} />
      </div>

      <div className="mt-3">
        <p className="panel-heading">Related assets</p>
        <div className="mt-2 space-y-1.5">
          {related.map((item) => (
            <div key={item.id} className="flex items-center justify-between border border-command-line bg-black/20 px-2 py-1.5">
              <span className="truncate text-[11px] text-command-text">{item.name}</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-command-muted">{item.asset_type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 border border-command-line bg-black/20 p-2">
        <div className="mb-2 flex items-center gap-2">
          <GitBranch size={13} className="text-command-blue" />
          <span className="panel-heading">Causality chain</span>
        </div>
        <div className="space-y-2">
          {chain.map((item, index) => (
            <div key={item} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2">
              <span className="mt-0.5 flex h-4 w-4 items-center justify-center border border-command-line font-mono text-[8px] text-command-muted">
                {index + 1}
              </span>
              <p className="text-[10px] leading-4 text-command-text">{item}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 border border-command-line bg-black/20 p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="panel-heading">Latest interpretation</span>
          <ShieldAlert size={13} className="text-command-amber" />
        </div>
        <p className="line-clamp-2 text-[11px] leading-4 text-command-text">
          {latestCluster?.message ?? latestEvent?.message ?? 'No recent anomaly is affecting this asset.'}
        </p>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-command-muted">
          {latestCluster
            ? `${latestCluster.event_type.replace(/_/g, ' ')} / ${Math.round(latestCluster.confidence * 100)}%`
            : latestEvent
              ? new Date(latestEvent.timestamp).toLocaleTimeString()
              : 'standby'}
        </p>
      </div>

      <div className="mt-3 border border-command-line bg-black/20 p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="panel-heading">Telemetry harmonics</span>
          <Waves size={13} className="text-command-blue" />
        </div>
        <div className="flex h-12 items-end gap-1">
          {Array.from({ length: 24 }).map((_, index) => {
            const point = trail?.points[index % Math.max(trail.points.length, 1)];
            const signalHeight = point ? (point.speed ?? 0) * 2.2 + (point.battery ?? 0) * 0.22 : 9 + ((index * 13 + signal + confidence) % 38);
            const height = Math.max(8, Math.min(46, signalHeight));
            return (
              <span
                key={index}
                className="w-full bg-command-cyan/50"
                style={{ height, opacity: index > 17 ? 0.95 : 0.22 + index * 0.03 }}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Score({ label, value, tone }: { label: string; value: number; tone: 'cyan' | 'amber' | 'red' }) {
  const toneClass = {
    cyan: 'text-command-cyan border-command-cyan/40 bg-command-cyan/10',
    amber: 'text-command-amber border-command-amber/50 bg-command-amber/10',
    red: 'text-command-red border-command-red/50 bg-command-red/10'
  }[tone];
  return (
    <div className={`border p-2 ${toneClass}`}>
      <p className="font-mono text-[8px] uppercase tracking-[0.12em] opacity-80">{label}</p>
      <p className="mt-1 font-mono text-[16px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function DataRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="data-row">
      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-command-muted">
        <span className="text-command-blue">{icon}</span>
        {label}
      </span>
      <span className="mono-value max-w-[165px] truncate text-right">{value}</span>
    </div>
  );
}
