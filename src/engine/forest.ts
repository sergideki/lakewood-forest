import type { GameState, Material, Rng } from './types';
import { creatureForageOutput, rollDiscovery, teamPower, grantXp } from './creatures';
import { getDungeon } from './content';
import { satchelCapMult, forageMult } from './town';

export const SATCHEL_HOURS = 24;
export const SATCHEL_FLOOR = 200;
export const FORAGE_DISCOVERY_CHANCE = 0.15;

/** Items/sec produced for one material by all creatures foraging it (upgrade-boosted). */
export function forageRatePerSec(state: GameState, material: Material): number {
  const base = state.creatures
    .filter((c) => c.assignment.type === 'forage' && c.affinity === material)
    .reduce((sum, c) => sum + creatureForageOutput(c), 0);
  return base * forageMult(state);
}

/** Combined satchel capacity = a day's worth of the current total forage rate, floored, then upgraded. */
export function satchelCap(state: GameState): number {
  const perSec = forageRatePerSec(state, 'wood') + forageRatePerSec(state, 'acorn');
  const derived = Math.max(SATCHEL_FLOOR, Math.round(perSec * SATCHEL_HOURS * 3600));
  return Math.round(derived * satchelCapMult(state));
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

/** Begin a run: no-op unless the dungeon is idle, the team is non-empty, and all are free. */
export function startRun(state: GameState, dungeonId: string, creatureIds: string[], now: number): GameState {
  const dungeon = state.dungeons.find((d) => d.id === dungeonId);
  if (!dungeon || dungeon.activeRun) return state;
  if (creatureIds.length === 0) return state;
  const team = state.creatures.filter((c) => creatureIds.includes(c.id));
  if (team.length !== creatureIds.length) return state;               // unknown id
  if (team.some((c) => c.assignment.type !== 'idle')) return state; // must be resting to delve

  return {
    ...state,
    creatures: state.creatures.map((c) =>
      creatureIds.includes(c.id)
        ? { ...c, assignment: { type: 'dungeon', dungeonId, startedAt: now } }
        : c,
    ),
    dungeons: state.dungeons.map((d) =>
      d.id === dungeonId ? { ...d, activeRun: { creatureIds, startedAt: now } } : d,
    ),
  };
}

export function isRunReady(state: GameState, dungeonId: string, now: number): boolean {
  const dungeon = state.dungeons.find((d) => d.id === dungeonId);
  const def = getDungeon(dungeonId);
  if (!dungeon || !dungeon.activeRun || !def) return false;
  return now >= dungeon.activeRun.startedAt + def.durationSec * 1000;
}

/**
 * Collect a ready run: pay loot * clamp(teamPower/recommendedPower, 0.5, 1.5), roll discovery at
 * baseChance * mult, grant each creature the xp lump, free them, clear the run. No-op if not ready.
 */
export function collectRun(state: GameState, dungeonId: string, rng: Rng, now: number): GameState {
  if (!isRunReady(state, dungeonId, now)) return state;
  const def = getDungeon(dungeonId)!;
  const run = state.dungeons.find((d) => d.id === dungeonId)!.activeRun!;
  const power = teamPower(state, run.creatureIds);
  const mult = Math.max(0.5, Math.min(1.5, power / def.recommendedPower));

  const paid: GameState = {
    ...state,
    resources: {
      ...state.resources,
      gold: state.resources.gold + Math.floor(def.loot.gold * mult),
      wood: state.resources.wood + Math.floor(def.loot.wood * mult),
      acorns: state.resources.acorns + Math.floor(def.loot.acorn * mult),
    },
    creatures: state.creatures.map((c) =>
      run.creatureIds.includes(c.id)
        ? grantXp({ ...c, assignment: { type: 'idle', dungeonId: null, startedAt: 0 } }, def.xpReward)
        : c,
    ),
    dungeons: state.dungeons.map((d) => (d.id === dungeonId ? { ...d, activeRun: null } : d)),
  };

  return rollDiscovery(paid, Math.min(0.95, def.baseDiscoveryChance * mult), rng);
}
