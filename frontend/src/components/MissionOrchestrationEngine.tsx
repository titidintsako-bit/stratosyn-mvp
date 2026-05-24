import { Braces, Command, Route, Send, ShieldCheck, TimerReset } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { Asset, ParsedMission } from '../types';
import { failureProbability, operationalConfidence, signalQuality } from '../lib/operational';
import { OperatorButton, OperatorInput } from './ui/OperatorControls';

interface MissionOrchestrationEngineProps {
  command: string;
  parsed: ParsedMission | null;
  assets: Asset[];
  onCommandChange: (value: string) => void;
  onSubmit: () => void;
  onUseParsed: () => void;
}

export function MissionOrchestrationEngine({
  command,
  parsed,
  assets,
  onCommandChange,
  onSubmit,
  onUseParsed
}: MissionOrchestrationEngineProps) {
  const recommendedAsset = parsed
    ? assets.find((asset) => asset.asset_type === parsed.recommended_asset_type && asset.status === 'idle' && asset.battery >= 30) ??
      assets.find((asset) => asset.asset_type === parsed.recommended_asset_type)
    : null;
  const confidence = recommendedAsset ? operationalConfidence(recommendedAsset, []) : 0;
  const risk = recommendedAsset ? failureProbability(recommendedAsset, []) : 0;
  const signal = recommendedAsset ? signalQuality(recommendedAsset, []) : 0;
  const duration = recommendedAsset ? Math.max(6, Math.round(18 - recommendedAsset.battery / 12 + risk / 10)) : 0;
  const safetyResult = recommendedAsset && recommendedAsset.battery >= 30 && recommendedAsset.status !== 'offline' ? 'clear to stage' : 'validation pending';

  return (
    <section className="border-b border-command-line p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Command size={14} className="text-command-cyan" />
          <p className="panel-heading">Mission Orchestration Engine</p>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-command-muted">reasoning</span>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_34px] gap-2">
        <OperatorInput
          value={command}
          onChange={(event) => onCommandChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSubmit();
          }}
          placeholder="Inspect thermal anomaly in Zone B."
        />
        <OperatorButton
          type="button"
          onClick={onSubmit}
          tone="primary"
          className="!h-[34px] !min-h-[34px]"
          aria-label="Parse mission"
          icon={<Send size={14} />}
        >
        </OperatorButton>
      </div>

      <motion.div
        layout
        transition={{ duration: 0.22 }}
        className="mt-3 border border-command-line bg-black/20 p-2"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="panel-heading">Operational intent</span>
          <Braces size={13} className="text-command-blue" />
        </div>
        {parsed ? (
          <div className="space-y-1.5">
            <IntentRow label="Intent" value={parsed.mission_type} />
            <IntentRow label="Target" value={parsed.target_zone} />
            <IntentRow label="Recommended assets" value={recommendedAsset?.name ?? parsed.recommended_asset_type} />
            <IntentRow label="Required approval" value={parsed.requires_operator_approval ? 'operator gate' : 'autonomous'} />
            <IntentRow label="Predicted risk" value={`${risk}%`} tone={risk > 45 ? 'amber' : 'cyan'} />
            <IntentRow label="Duration estimate" value={`${duration} min`} />
            <IntentRow label="Operational confidence" value={`${confidence}%`} tone={confidence > 70 ? 'cyan' : 'amber'} />
            <IntentRow label="Safety validation" value={safetyResult} tone={safetyResult === 'clear to stage' ? 'cyan' : 'amber'} />
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <MicroMetric icon={<Route size={11} />} label="Route" value="projected" />
              <MicroMetric icon={<TimerReset size={11} />} label="ETA" value={`${duration}m`} />
              <MicroMetric icon={<ShieldCheck size={11} />} label="Signal" value={`${signal}%`} />
            </div>
            <OperatorButton
              type="button"
              onClick={onUseParsed}
              fill
              className="mt-2"
              icon={<ShieldCheck size={13} />}
            >
              Stage orchestration plan
            </OperatorButton>
          </div>
        ) : (
          <div className="py-4 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-command-muted">
            Awaiting mission phrase for deterministic parsing
          </div>
        )}
      </motion.div>
    </section>
  );
}

function IntentRow({ label, value, tone = 'text' }: { label: string; value: string; tone?: 'text' | 'cyan' | 'amber' }) {
  const toneClass = tone === 'cyan' ? 'text-command-cyan' : tone === 'amber' ? 'text-command-amber' : 'text-command-text';
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-command-muted">{label}</span>
      <span className={`max-w-[170px] truncate text-right font-mono text-[10px] uppercase tracking-[0.08em] ${toneClass}`}>{value}</span>
    </div>
  );
}

function MicroMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="border border-command-line bg-black/20 p-1.5">
      <div className="flex items-center gap-1 text-command-blue">{icon}</div>
      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-command-muted">{label}</p>
      <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-command-text">{value}</p>
    </div>
  );
}
