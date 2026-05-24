import * as d3 from 'd3';
import { Activity, BrainCircuit, GitBranch, Orbit, RadioTower, ShieldAlert } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import type { Asset, CausalityNode, Mission } from '../types';
import { useCognitionStore } from '../store/cognitionStore';
import { OperatorButton, OperatorProgress } from './ui/OperatorControls';

interface CognitionCorePanelProps {
  assets: Asset[];
  missions: Mission[];
}

const nodeTone: Record<string, string> = {
  asset: '#2dd4ff',
  mission: '#f6c75f',
  anomaly: '#ff4d6d',
  zone: '#60a5fa'
};

export function CognitionCorePanel({ assets, missions }: CognitionCorePanelProps) {
  const { coreState, selectedHorizon, setSelectedHorizon } = useCognitionStore();
  const ecosystem = coreState.ecosystem;
  const projected = coreState.predictions
    .filter((prediction) => prediction.horizon_minutes === selectedHorizon)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 4);
  const reasoning = coreState.reasoning_events.slice(0, 5);
  const actions = coreState.coordination_actions.slice(0, 3);
  const graph = useMemo(() => buildGraph(coreState.causality_graph.nodes, coreState.causality_graph.edges), [coreState.causality_graph]);

  return (
    <section className="border-b border-command-line p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit size={14} className="text-command-cyan" />
          <p className="panel-heading">Stratosyn Core</p>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-command-cyan">
          {ecosystem?.system_state ?? 'initializing'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <Metric label="Load" value={ecosystem?.operational_load ?? 0} />
        <Metric label="Risk" value={ecosystem?.risk_index ?? 0} tone={(ecosystem?.risk_index ?? 0) > 45 ? 'amber' : 'cyan'} />
        <Metric label="Continuity" value={ecosystem?.coverage_continuity ?? 0} />
      </div>

      <div className="mt-3 border border-command-line bg-black/20 p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="panel-heading">Live causality graph</span>
          <GitBranch size={13} className="text-command-blue" />
        </div>
        <svg viewBox="0 0 296 148" className="h-[148px] w-full overflow-visible">
          {graph.edges.map((edge) => (
            <line
              key={edge.id}
              x1={edge.source.x}
              y1={edge.source.y}
              x2={edge.target.x}
              y2={edge.target.y}
              stroke={edge.edge_type.includes('risk') || edge.edge_type.includes('anomaly') ? '#f6c75f' : '#2dd4ff'}
              strokeOpacity={0.18 + edge.confidence / 160}
              strokeWidth={1 + edge.weight * 2}
            />
          ))}
          {graph.nodes.map((node) => (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={node.node_type === 'zone' ? 7 : node.node_type === 'anomaly' ? 5.5 : 4.5}
                fill={nodeTone[node.node_type] ?? '#9fb1c8'}
                fillOpacity={node.node_type === 'zone' ? 0.2 : 0.72}
                stroke={nodeTone[node.node_type] ?? '#9fb1c8'}
                strokeWidth={1}
              />
              <circle cx={node.x} cy={node.y} r={8 + node.risk_score / 8} fill="none" stroke={nodeTone[node.node_type] ?? '#9fb1c8'} strokeOpacity={0.08 + node.uncertainty / 220} />
            </g>
          ))}
        </svg>
        <div className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.1em] text-command-muted">
          <span>{graph.nodes.length} nodes</span>
          <span>{graph.edges.length} causal edges</span>
          <span>{assets.length} autonomous assets</span>
        </div>
      </div>

      <div className="mt-3 border border-command-line bg-black/20 p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="panel-heading">Predictive state</span>
          <div className="flex gap-1">
            {[5, 15, 30].map((horizon) => (
              <OperatorButton
                key={horizon}
                type="button"
                tone={selectedHorizon === horizon ? 'primary' : 'ghost'}
                className="!min-h-[24px] !px-2 !text-[8px]"
                onClick={() => setSelectedHorizon(horizon as 5 | 15 | 30)}
              >
                {horizon}m
              </OperatorButton>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {projected.map((prediction) => (
            <div key={prediction.id}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="truncate text-[10px] leading-4 text-command-text">{prediction.message}</p>
                <span className="font-mono text-[10px] tabular-nums text-command-amber">{Math.round(prediction.probability)}%</span>
              </div>
              <OperatorProgress value={prediction.probability / 100} />
            </div>
          ))}
          {projected.length === 0 ? <EmptyLine label="Future state not yet resolved" /> : null}
        </div>
      </div>

      <div className="mt-3 border border-command-line bg-black/20 p-2">
        <div className="mb-2 flex items-center gap-2">
          <RadioTower size={13} className="text-command-cyan" />
          <span className="panel-heading">AI reasoning stream</span>
        </div>
        <div className="space-y-2">
          {reasoning.map((event) => (
            <div key={event.id} className="grid grid-cols-[16px_minmax(0,1fr)_38px] gap-2">
              <Activity size={12} className={event.severity === 'warning' ? 'mt-0.5 text-command-amber' : 'mt-0.5 text-command-cyan'} />
              <p className="text-[10px] leading-4 text-command-text">{event.message}</p>
              <span className="text-right font-mono text-[9px] tabular-nums text-command-muted">{Math.round(event.confidence)}%</span>
            </div>
          ))}
          {reasoning.length === 0 ? <EmptyLine label="Reasoning stream warming" /> : null}
        </div>
      </div>

      <div className="mt-3 border border-command-line bg-black/20 p-2">
        <div className="mb-2 flex items-center gap-2">
          <Orbit size={13} className="text-command-blue" />
          <span className="panel-heading">Autonomous coordination</span>
        </div>
        <div className="space-y-2">
          {actions.map((action) => (
            <div key={action.id} className="border-l border-command-cyan/50 pl-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-command-cyan">{action.action_type.replace(/_/g, ' ')}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-command-muted">{action.priority}</span>
              </div>
              <p className="mt-1 text-[10px] leading-4 text-command-text">{action.rationale}</p>
            </div>
          ))}
          {actions.length === 0 ? <EmptyLine label="No coordination pressure" /> : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border border-command-line bg-black/20 p-2">
        <SmallFact icon={<ShieldAlert size={12} />} label="Missions" value={missions.length.toString()} />
        <SmallFact icon={<BrainCircuit size={12} />} label="Reasoning" value={(ecosystem?.active_reasoning_count ?? reasoning.length).toString()} />
      </div>
    </section>
  );
}

function buildGraph(nodes: CausalityNode[], edges: { id: string; source_id: string; target_id: string; edge_type: string; weight: number; confidence: number }[]) {
  const xScale = d3.scaleLinear().domain([27.85, 28.25]).range([24, 272]);
  const yScale = d3.scaleLinear().domain([-26.35, -26.05]).range([126, 18]);
  const fallback = d3.scalePoint<string>().domain(nodes.map((node) => node.id)).range([26, 270]).padding(0.45);
  const positioned = nodes.slice(0, 28).map((node, index) => ({
    ...node,
    x: node.longitude == null ? fallback(node.id) ?? 48 + index * 8 : xScale(node.longitude),
    y: node.latitude == null ? 24 + (index % 8) * 14 : yScale(node.latitude)
  }));
  const byId = new Map(positioned.map((node) => [node.id, node]));
  const graphEdges = edges
    .map((edge) => {
      const source = byId.get(edge.source_id);
      const target = byId.get(edge.target_id);
      return source && target ? { ...edge, source, target } : null;
    })
    .filter(Boolean) as Array<(typeof edges)[number] & { source: (typeof positioned)[number]; target: (typeof positioned)[number] }>;
  return { nodes: positioned, edges: graphEdges };
}

function Metric({ label, value, tone = 'cyan' }: { label: string; value: number; tone?: 'cyan' | 'amber' }) {
  return (
    <div className={`border p-2 ${tone === 'amber' ? 'border-command-amber/50 bg-command-amber/10 text-command-amber' : 'border-command-cyan/40 bg-command-cyan/10 text-command-cyan'}`}>
      <p className="font-mono text-[8px] uppercase tracking-[0.12em] opacity-80">{label}</p>
      <p className="mt-1 font-mono text-[16px] font-semibold tabular-nums">{Math.round(value)}</p>
    </div>
  );
}

function EmptyLine({ label }: { label: string }) {
  return <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-command-muted">{label}</p>;
}

function SmallFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-command-blue">{icon}</div>
      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-command-muted">{label}</p>
      <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-command-text">{value}</p>
    </div>
  );
}
