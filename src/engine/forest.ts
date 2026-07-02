import type { GameState, Material, Rng } from './types';
import { creatureForageOutput, rollDiscovery } from './creatures';

export const SATCHEL_HOURS = 24;
export const SATCHEL_FLOOR = 200;
export const FORAGE_DISCOVERY_CHANCE = 0.15;

/** Items/sec produced for one material by all creatures foraging it. */
export function forageRatePerSec(state: GameState, material: Material): number {
  return state.creatures
    .filter((c) => c.assignment.type === 'forage' && c.affinity === material)
    .reduce((sum, c) => sum + creatureForageOutput(c), 0);
}

/** Combined satchel capacity = a day's worth of the current total forage rate, floored. */
export function satchelCap(state: GameState): number {
  const perSec = forageRatePerSec(state, 'wood') + forageRatePerSec(state, 'acorn');
  return Math.max(SATCHEL_FLOOR, Math.round(perSec * SATCHEL_HOURS * 3600));
}

/** Fill wood + acorn by their rates over `elapsedSec`, clamped so their sum <= cap. */
export function accrueSatchel(state: GameState, elapsedSec: number): GameState {
  if (elapsedSec <= 0) return state;
  const woodRate = forageRatePerSec(state, 'wood');
  const acornRate = forageRatePerSec(state, 'acorn');
  const cap = satchelCap(state);
  const { wood, acorn } = state.storage.satchel;
  const room = Math.max(0, cap - (wood + acorn));

  let gainWood = woodRate * elapsedSec;
  let gainAcorn = acornRate * elapsedSec;
  const totalGain = gainWood + gainAcorn;
  if (totalGain > room && totalGain > 0) {
    const scale = room / totalGain;
    gainWood *= scale;
    gainAcorn *= scale;
  }

  return {
    ...state,
    storage: { ...state.storage, satchel: { wood: wood + gainWood, acorn: acorn + gainAcorn } },
  };
}

/** Bank whole wood + acorn into resources, carry the fractional remainder, roll a discovery. */
export function collectSatchel(state: GameState, rng: Rng): GameState {
  const { wood, acorn } = state.storage.satchel;
  const bankWood = Math.floor(wood);
  const bankAcorn = Math.floor(acorn);
  const banked: GameState = {
    ...state,
    resources: {
      ...state.resources,
      wood: state.resources.wood + bankWood,
      acorns: state.resources.acorns + bankAcorn,
    },
    storage: { ...state.storage, satchel: { wood: wood - bankWood, acorn: acorn - bankAcorn } },
  };
  return rollDiscovery(banked, FORAGE_DISCOVERY_CHANCE, rng);
}

/** Move a creature between idle and forage. No-op if it is currently in a dungeon. */
export function assignCreature(state: GameState, creatureId: string, to: 'idle' | 'forage'): GameState {
  return {
    ...state,
    creatures: state.creatures.map((c) => {
      if (c.id !== creatureId) return c;
      if (c.assignment.type === 'dungeon') return c; // locked until the run is collected
      return { ...c, assignment: { type: to, dungeonId: null, startedAt: 0 } };
    }),
  };
}
