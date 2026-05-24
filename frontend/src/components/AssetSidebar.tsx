import { Battery, Camera, CircleDot, Plane, Truck } from 'lucide-react';
import type { Asset, AssetStatus, AssetType } from '../types';

const typeIcon = {
  drone: Plane,
  ground_robot: Truck,
  camera: Camera,
  sensor: CircleDot
};

const statusClass: Record<AssetStatus, string> = {
  idle: 'bg-command-slate',
  active: 'bg-command-cyan',
  mission: 'bg-command-cyan',
  warning: 'bg-command-amber',
  offline: 'bg-command-red'
};

const groupLabels: Record<AssetType, string> = {
  drone: 'Air assets',
  ground_robot: 'Ground units',
  camera: 'Fixed optics',
  sensor: 'Sensors'
};

interface AssetSidebarProps {
  assets: Asset[];
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
}

export function AssetSidebar({ assets, selectedAssetId, onSelectAsset }: AssetSidebarProps) {
  const groups = (Object.keys(groupLabels) as AssetType[]).map((type) => ({
    type,
    label: groupLabels[type],
    assets: assets.filter((asset) => asset.asset_type === type)
  }));

  return (
    <aside className="glass-panel pointer-events-auto flex h-full flex-col overflow-hidden">
      <div className="border-b border-command-line p-3">
        <div className="flex items-center justify-between">
          <p className="panel-heading">Asset groups</p>
          <span className="status-chip border-command-cyan/40 bg-command-cyan/10 text-command-cyan">live</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {groups.map((group) => (
            <div key={group.type} className="border border-command-line bg-black/20 p-2">
              <p className="font-mono text-[10px] tabular-nums text-command-text">{group.assets.length}</p>
              <p className="mt-0.5 truncate font-mono text-[8px] uppercase tracking-[0.12em] text-command-muted">
                {group.type.replace('_', ' ')}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
        {groups.map((group) =>
          group.assets.length > 0 ? (
            <div key={group.type} className="mb-3">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-command-muted">{group.label}</p>
                <span className="font-mono text-[10px] tabular-nums text-command-muted">{group.assets.length}</span>
              </div>
              {group.assets.map((asset) => {
                const Icon = typeIcon[asset.asset_type];
                const isSelected = selectedAssetId === asset.id;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => onSelectAsset(asset.id)}
                    className={`mb-1.5 w-full border px-2.5 py-2 text-left transition duration-200 ${
                      isSelected
                        ? 'border-command-cyan/70 bg-command-cyan/10 shadow-glow'
                        : 'border-command-line bg-black/20 hover:border-command-blue/50 hover:bg-command-blue/5'
                    }`}
                  >
                    <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center border border-command-line bg-black/30 text-command-muted">
                        <Icon size={13} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium leading-4 text-command-text">{asset.name}</p>
                        <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-command-muted">{asset.id}</p>
                      </div>
                      <span className={`h-2 w-2 ${statusClass[asset.status]}`} />
                    </div>
                    <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-command-muted">
                      <span>{asset.status}</span>
                      <span className="flex items-center gap-1 tabular-nums text-command-text">
                        <Battery size={11} />
                        {Math.round(asset.battery)}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null
        )}
      </div>
    </aside>
  );
}
