import type { GameState, Rng } from './types';
import { PETS, PET_IDS, BASE_ROD_RATE, CREEL_HOURS, CREEL_FLOOR, CATCH_CHANCE, getHabitat } from './content';
import { DISCOVERY_WEIGHT, makeCreature } from './creatures';
import { forageRatePerSec } from './forest';

/** Fish/sec = flat rod base + all fish-affinity foragers (creature part is forageMult-boosted). */
export function fishRatePerSec(state: GameState): number {
  return BASE_ROD_RATE + forageRatePerSec(state, 'fish');
}

/** Creel capacity = a day of the current fish rate, floored. (No creel upgrade in v1.) */
export function creelCap(state: GameState): number {
  return Math.max(CREEL_FLOOR, Math.round(fishRatePerSec(state) * CREEL_HOURS * 3600));
}

/** Fill the creel by the fish rate over elapsedSec, clamped to cap. Immutable. */
export function accrueCreel(state: GameState, elapsedSec: number): GameState {
  if (elapsedSec <= 0) return state;
  const rate = fishRatePerSec(state);
  const cap = creelCap(state);
  const cur = state.storage.creel.fish;
  const next = Math.min(cap, cur + rate * elapsedSec);
  if (next === cur) return state;
  return { ...state, storage: { ...state.storage, creel: { fish: next } } };
}

/**
 * With probability `chance`, catch a new (uncaught) pet — weighted toward common — and record it.
 * Two rng draws: hit, then weighted pick. No-op (same ref) on miss or exhausted pool.
 */
export function rollCatch(state: GameState, chance: number, rng: Rng): GameState {
  if (rng() >= chance) return state;
  const pool = PET_IDS.filter((id) => !state.pets.includes(id)).map((id) => PETS[id]);
  if (pool.length === 0) return state;

  const totalWeight = pool.reduce((sum, p) => sum + DISCOVERY_WEIGHT[p.rarity], 0);
  let roll = rng() * totalWeight;
  let picked = pool[pool.length - 1];
  for (const p of pool) {
    roll -= DISCOVERY_WEIGHT[p.rarity];
    if (roll < 0) { picked = p; break; }
  }
  return { ...state, pets: [...state.pets, picked.id] };
}

/**
 * Bank whole fish into resources, carry the fractional remainder, then roll a pet catch.
 * An EMPTY creel banks nothing and NEVER rolls (no free pets).
 */
export function collectCreel(state: GameState, rng: Rng): GameState {
  const bankFish = Math.floor(state.storage.creel.fish);
  if (bankFish <= 0) return state;
  const banked: GameState = {
    ...state,
    resources: { ...state.resources, fish: state.resources.fish + bankFish },
    storage: { ...state.storage, creel: { fish: state.storage.creel.fish - bankFish } },
  };
  return rollCatch(banked, CATCH_CHANCE, rng);
}

export type HabitatStatus = 'unbuilt' | 'attracting' | 'ready' | 'done';

/** Derived status — no separate "collected" flag (a water species is discovered ONLY via habitat). */
export function habitatStatus(state: GameState, id: string, now: number): HabitatStatus {
  const def = getHabitat(id);
  const h = state.habitats.find((x) => x.id === id);
  if (!def || !h) return 'unbuilt';
  if (state.discovered.includes(def.attracts)) return 'done';
  if (h.builtAt === null) return 'unbuilt';
  return now >= h.builtAt + def.attractSec * 1000 ? 'ready' : 'attracting';
}

export function canBuildHabitat(state: GameState, id: string): boolean {
  const def = getHabitat(id);
  const h = state.habitats.find((x) => x.id === id);
  if (!def || !h || h.builtAt !== null || state.discovered.includes(def.attracts)) return false;
  const r = state.resources;
  return (
    r.gold >= (def.cost.gold ?? 0) &&
    r.wood >= (def.cost.wood ?? 0) &&
    r.acorns >= (def.cost.acorns ?? 0) &&
    r.fish >= (def.cost.fish ?? 0)
  );
}

/** Pay cost + stamp builtAt. No-op (same ref) unless unbuilt & affordable. */
export function buildHabitat(state: GameState, id: string, now: number): GameState {
  if (!canBuildHabitat(state, id)) return state;
  const def = getHabitat(id)!;
  return {
    ...state,
    resources: {
      gold: state.resources.gold - (def.cost.gold ?? 0),
      wood: state.resources.wood - (def.cost.wood ?? 0),
      acorns: state.resources.acorns - (def.cost.acorns ?? 0),
      fish: state.resources.fish - (def.cost.fish ?? 0),
    },
    habitats: state.habitats.map((h) => (h.id === id ? { ...h, builtAt: now } : h)),
  };
}

/** DETERMINISTIC directed discovery: on 'ready', discover the target + spawn it. No rng. No-op otherwise. */
export function collectHabitat(state: GameState, id: string, now: number): GameState {
  if (habitatStatus(state, id, now) !== 'ready') return state;
  const def = getHabitat(id)!;
  return {
    ...state,
    creatures: [...state.creatures, makeCreature(def.attracts)],
    discovered: [...state.discovered, def.attracts],
  };
}
