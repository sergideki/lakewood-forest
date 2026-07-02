import type { GameState } from './types';

const BARN_CAP = 500;

export function createInitialState(now: number): GameState {
  return {
    resources: { gold: 0, wood: 0, acorns: 0 },
    plots: [
      { id: 'plot-1', crop: null },
      { id: 'plot-2', crop: null },
      { id: 'plot-3', crop: null },
    ],
    villagers: [
      { id: 'vil-1', name: 'Pip', emoji: '🧑‍🌾', assignedTo: null, level: 1 },
      { id: 'vil-2', name: 'Nan', emoji: '👵', assignedTo: null, level: 1 },
      { id: 'vil-3', name: 'Rowan', emoji: '🧔', assignedTo: null, level: 1 },
    ],
    storage: { barn: { amount: 0, cap: BARN_CAP } },
    meta: { lastSeen: now, version: 1 },
  };
}
