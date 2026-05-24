import { create } from 'zustand';
import type { CoreCognitionState, OperationalState } from '../types';

export const emptyOperationalState: OperationalState = {
  telemetry_trails: [],
  anomaly_clusters: [],
  mission_dependencies: [],
  reroute_suggestions: [],
  replay_paths: []
};

export const emptyCoreCognitionState: CoreCognitionState = {
  reasoning_events: [],
  causality_graph: {
    nodes: [],
    edges: []
  },
  predictions: [],
  coordination_actions: [],
  risk_fields: [],
  ecosystem: null
};

interface CognitionStore {
  operationalState: OperationalState;
  coreState: CoreCognitionState;
  selectedHorizon: 5 | 15 | 30;
  setOperationalState: (state: OperationalState) => void;
  setCoreState: (state: CoreCognitionState) => void;
  setSelectedHorizon: (horizon: 5 | 15 | 30) => void;
}

export const useCognitionStore = create<CognitionStore>((set) => ({
  operationalState: emptyOperationalState,
  coreState: emptyCoreCognitionState,
  selectedHorizon: 15,
  setOperationalState: (operationalState) => set({ operationalState }),
  setCoreState: (coreState) => set({ coreState }),
  setSelectedHorizon: (selectedHorizon) => set({ selectedHorizon })
}));
