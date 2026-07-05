import type { GameState, Station, Villager, Resources, Rng } from './types';
import { VILLAGER_PER, VILLAGER_SPEC, VILLAGER_XP_PER_SEC, MAX_VILLAGERS, VILLAGER_NAMES } from './content';

/** Multiplier a station's assigned villagers apply to its output. Farm is GATED (no villagers -> 0);
 *  Forest & Lake are ungated (they run on their own; villagers only add on top). */
export function villagerBoost(state: GameState, station: Station): number {
  const bonus = state.villagers
    .filter((v) => v.assignedTo === station)
    .reduce((s, v) => s + VILLAGER_PER * v.level * (v.specialty === station ? VILLAGER_SPEC : 1), 0);
  if (station === 'farm' && bonus === 0) return 0;
  return 1 + bonus;
}

export function villagerXpForLevel(level: number): number {
  return Math.round(60 * Math.pow(1.35, level - 1));
}
export function grantVillagerXp(v: Villager, amount: number): Villager {
  let level = v.level;
  let xp = v.xp + Math.max(0, amount);
  while (xp >= villagerXpForLevel(level)) { xp -= villagerXpForLevel(level); level += 1; }
  return { ...v, level, xp };
}
/** Drip XP to every ASSIGNED villager over elapsedSec. Resting villagers gain nothing. */
export function dripVillagerXp(state: GameState, elapsedSec: number): GameState {
  if (elapsedSec <= 0) return state;
  const gain = VILLAGER_XP_PER_SEC * elapsedSec;
  return {
    ...state,
    villagers: state.villagers.map((v) => (v.assignedTo !== null ? grantVillagerXp(v, gain) : v)),
  };
}

/** Escalating gold+acorns cost by current villager count. null at cap. */
export function recruitCost(count: number): Resources | null {
  if (count >= MAX_VILLAGERS) return null;
  const mult = Math.pow(1.8, Math.max(0, count - 3));
  return { gold: Math.ceil(120 * mult), wood: 0, acorns: Math.ceil(40 * mult), fish: 0 };
}

const STATIONS: Station[] = ['farm', 'forest', 'lake'];

/** Recruit if under cap and affordable. New villager: L1, unassigned, rng-rolled specialty + name.
 *  Draw order is fixed (specialty, then name) for deterministic tests. No-op otherwise. */
export function recruitVillager(state: GameState, rng: Rng): GameState {
  const count = state.villagers.length;
  const cost = recruitCost(count);
  if (!cost) return state;
  const r = state.resources;
  if (r.gold < cost.gold || r.acorns < cost.acorns) return state;
  const specialty = STATIONS[Math.min(2, Math.floor(rng() * 3))];
  const nameIdx = Math.min(VILLAGER_NAMES.length - 1, Math.floor(rng() * VILLAGER_NAMES.length));
  const name = VILLAGER_NAMES[nameIdx] ?? `Villager ${count + 1}`;
  return {
    ...state,
    resources: { ...r, gold: r.gold - cost.gold, acorns: r.acorns - cost.acorns },
    villagers: [
      ...state.villagers,
      { id: `vil-${count + 1}`, name, emoji: '🧑‍🌾', specialty, level: 1, xp: 0, assignedTo: null },
    ],
  };
}
