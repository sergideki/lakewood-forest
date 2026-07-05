import type { GameState, Lifetime } from './types';

/** Add a partial delta onto the cumulative lifetime counters. Pure. Absent keys add 0. */
export function bumpLifetime(state: GameState, delta: Partial<Lifetime>): GameState {
  return {
    ...state,
    lifetime: {
      gold: state.lifetime.gold + (delta.gold ?? 0),
      wood: state.lifetime.wood + (delta.wood ?? 0),
      acorns: state.lifetime.acorns + (delta.acorns ?? 0),
      fish: state.lifetime.fish + (delta.fish ?? 0),
    },
  };
}
