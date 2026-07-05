import type { GameState, LandmarkLever, Resources } from './types';
import {
  LANDMARKS,
  LANDMARK_IDS,
  getLandmark,
  FESTIVAL_PROSPERITY_PER_LEVEL,
  FESTIVAL_BASE_COST,
  FESTIVAL_COST_GROWTH,
} from './content';

/** Sum the `amount` of every BUILT landmark whose buff targets `lever`. Unknown ids ignored.
 *  Direct analogue of pets.ts `sumFor`. */
function sumFor(state: GameState, lever: LandmarkLever): number {
  let sum = 0;
  for (const id of state.landmarks) {
    const def = LANDMARKS[id];
    if (def && def.lever === lever) sum += def.amount;
  }
  return sum;
}

/** Multiplier (≥1) for a rate/cap lever from the built landmark set: 1 + Σamount. */
export function landmarkLeverMult(state: GameState, lever: Exclude<LandmarkLever, 'catchChance'>): number {
  return 1 + sumFor(state, lever);
}

/** Additive catch-chance bonus (≥0) from the built landmark set (Fountain). */
export function landmarkCatchBonus(state: GameState): number {
  return sumFor(state, 'catchChance');
}

/** Global production multiplier (≥1) from the Lantern Festival level. Linear, gentle. */
export function prosperityMult(state: GameState): number {
  return 1 + FESTIVAL_PROSPERITY_PER_LEVEL * state.festivalLevel;
}

/** True once every landmark in the roster is built — the gate for the Festival tail. */
export function allLandmarksBuilt(state: GameState): boolean {
  return state.landmarks.length === LANDMARK_IDS.length;
}

function affordable(r: Resources, cost: Partial<Resources>): boolean {
  return (
    r.gold >= (cost.gold ?? 0) &&
    r.wood >= (cost.wood ?? 0) &&
    r.acorns >= (cost.acorns ?? 0) &&
    r.fish >= (cost.fish ?? 0)
  );
}

function pay(r: Resources, cost: Partial<Resources>): Resources {
  return {
    gold: r.gold - (cost.gold ?? 0),
    wood: r.wood - (cost.wood ?? 0),
    acorns: r.acorns - (cost.acorns ?? 0),
    fish: r.fish - (cost.fish ?? 0),
  };
}

/** True when the landmark exists, isn't already built, and is affordable. */
export function canBuildLandmark(state: GameState, id: string): boolean {
  const def = getLandmark(id);
  if (!def || state.landmarks.includes(id)) return false;
  return affordable(state.resources, def.cost);
}

/** Pay the one-time cost + append the id. No-op (same ref) when unknown/built/unaffordable. */
export function buildLandmark(state: GameState, id: string): GameState {
  if (!canBuildLandmark(state, id)) return state;
  const def = getLandmark(id)!;
  return { ...state, resources: pay(state.resources, def.cost), landmarks: [...state.landmarks, id] };
}

/** Cost of the NEXT festival level given the current `level` (0-indexed): base * growth^level, ceil'd. */
export function festivalCost(level: number): Resources {
  const m = Math.pow(FESTIVAL_COST_GROWTH, level);
  return {
    gold: Math.ceil(FESTIVAL_BASE_COST.gold * m),
    wood: Math.ceil(FESTIVAL_BASE_COST.wood * m),
    acorns: Math.ceil(FESTIVAL_BASE_COST.acorns * m),
    fish: Math.ceil(FESTIVAL_BASE_COST.fish * m),
  };
}

/** Festival is gated on all 8 landmarks AND affording the next level's cost. */
export function canFundFestival(state: GameState): boolean {
  if (!allLandmarksBuilt(state)) return false;
  return affordable(state.resources, festivalCost(state.festivalLevel));
}

/** Pay the next-level cost + increment festivalLevel. No-op (same ref) when gated/unaffordable. */
export function fundFestival(state: GameState): GameState {
  if (!canFundFestival(state)) return state;
  const cost = festivalCost(state.festivalLevel);
  return { ...state, resources: pay(state.resources, cost), festivalLevel: state.festivalLevel + 1 };
}
