import type { GameState } from './types';

export function createInitialState(now: number): GameState {
  return {
    resources: { gold: 0 },
    plots: [
      { id: 'plot-1', crop: null },
      { id: 'plot-2', crop: null },
      { id: 'plot-3', crop: null },
    ],
    villagers: [
      { id: 'vil-1', name: 'Pip', emoji: '🧑‍🌾', assignedTo: null },
      { id: 'vil-2', name: 'Nan', emoji: '👵', assignedTo: null },
      { id: 'vil-3', name: 'Rowan', emoji: '🧔', assignedTo: null },
    ],
    storage: { barn: { amount: 0 } },
    meta: { lastSeen: now },
  };
}
