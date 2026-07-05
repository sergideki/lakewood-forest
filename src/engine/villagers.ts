import type { GameState, Station } from './types';
import { VILLAGER_PER, VILLAGER_SPEC } from './content';

/** Multiplier a station's assigned villagers apply to its output. Farm is GATED (no villagers -> 0);
 *  Forest & Lake are ungated (they run on their own; villagers only add on top). */
export function villagerBoost(state: GameState, station: Station): number {
  const bonus = state.villagers
    .filter((v) => v.assignedTo === station)
    .reduce((s, v) => s + VILLAGER_PER * v.level * (v.specialty === station ? VILLAGER_SPEC : 1), 0);
  if (station === 'farm' && bonus === 0) return 0;
  return 1 + bonus;
}
