import type { GameState } from './types';
import { DUNGEONS, STARTER_SPECIES, HABITATS, STARTER_CROPS } from './content';
import { makeCreature } from './creatures';

export function createInitialState(now: number): GameState {
  return {
    resources: { gold: 0, wood: 0, acorns: 0, fish: 0 },
    plots: [
      { id: 'plot-1', crop: null },
      { id: 'plot-2', crop: null },
      { id: 'plot-3', crop: null },
    ],
    unlockedCrops: [...STARTER_CROPS],
    villagers: [
      { id: 'vil-1', name: 'Pip', emoji: '🧑‍🌾', specialty: 'farm', level: 1, xp: 0, assignedTo: null },
      { id: 'vil-2', name: 'Nan', emoji: '👵', specialty: 'forest', level: 1, xp: 0, assignedTo: null },
      { id: 'vil-3', name: 'Rowan', emoji: '🧔', specialty: 'lake', level: 1, xp: 0, assignedTo: null },
    ],
    creatures: STARTER_SPECIES.map(makeCreature),
    storage: { barn: { gold: 0, wood: 0, acorns: 0 }, satchel: { wood: 0, acorn: 0 }, creel: { fish: 0 } },
    dungeons: DUNGEONS.map((d) => ({ id: d.id, activeRun: null })),
    discovered: [...STARTER_SPECIES],
    upgrades: {},
    habitats: HABITATS.map((h) => ({ id: h.id, builtAt: null })),
    pets: [],
    lifetime: { gold: 0, wood: 0, acorns: 0, fish: 0 },
    landmarks: [],
    festivalLevel: 0,
    meta: { lastSeen: now },
  };
}
