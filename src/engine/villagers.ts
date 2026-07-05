import type { GameState, Station, Villager } from './types';
import { VILLAGER_PER, VILLAGER_SPEC, VILLAGER_XP_PER_SEC } from './content';

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
