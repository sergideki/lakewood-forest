import type { GameState, Rng } from './types';
import {
  PETS,
  PET_IDS,
  BASE_ROD_RATE,
  CREEL_HOURS,
  CREEL_FLOOR,
  CATCH_CHANCE,
  getHabitat,
  MARIGOLD_CATCH_BONUS,
  MARIGOLD_CATCH_CAP,
  MARIGOLD_FISH_PER_SEC,
} from './content';
import { DISCOVERY_WEIGHT, makeCreature } from './creatures';
import { forageRatePerSec } from './forest';
import { petLeverMult, petCatchBonus } from './pets';
import { landmarkLeverMult, landmarkCatchBonus, prosperityMult } from './landmarks';
import { bumpLifetime } from './lifetime';
import { villagerBoost } from './villagers';

/** Fish/sec = flat rod base + all fish-affinity foragers (creature part is forageMult-boosted),
 *  then this station's villager boost applied to the whole rate.
 *  Festival prosperity applies to the ROD TERM ONLY — forageRatePerSec already carries prosperity
 *  (forest seam), so multiplying the whole rate would double-count every fish forager (skeptic M2). */
export function fishRatePerSec(state: GameState): number {
  return (BASE_ROD_RATE * prosperityMult(state) + forageRatePerSec(state, 'fish')) * villagerBoost(state, 'lake');
}

/** Creel capacity = a day of the current fish rate, floored, then lifted by pet + Koi Pond bonus. */
export function creelCap(state: GameState): number {
  const base = Math.max(CREEL_FLOOR, Math.round(fishRatePerSec(state) * CREEL_HOURS * 3600));
  return Math.round(base * petLeverMult(state, 'creelCap') * landmarkLeverMult(state, 'creelCap'));
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

/** Number of plots currently planted with marigold. */
function marigoldCount(state: GameState): number {
  return state.plots.filter((p) => p.crop === 'marigold').length;
}

/** Effective pet catch chance: marigold-clamped base, THEN pet catch bonus on top, capped at 1.
 *  Pet bonus is applied AFTER the marigold clamp so a rare-caught Pond Newt is never swallowed by
 *  MARIGOLD_CATCH_CAP (skeptic F1). */
export function creelCatchChance(state: GameState): number {
  const n = marigoldCount(state);
  const marigoldChance = n === 0 || state.resources.fish <= 0
    ? CATCH_CHANCE
    : Math.min(CATCH_CHANCE + MARIGOLD_CATCH_BONUS * n, MARIGOLD_CATCH_CAP);
  return Math.min(1, marigoldChance + petCatchBonus(state) + landmarkCatchBonus(state));
}

/** Drain fish for planted marigolds over elapsedSec, clamped at 0. Immutable. No-op if none/≤0. */
export function accrueMarigold(state: GameState, elapsedSec: number): GameState {
  if (elapsedSec <= 0) return state;
  const n = marigoldCount(state);
  if (n === 0) return state;
  const drain = MARIGOLD_FISH_PER_SEC * n * elapsedSec;
  const fish = Math.max(0, state.resources.fish - drain);
  if (fish === state.resources.fish) return state;
  return { ...state, resources: { ...state.resources, fish } };
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
  // Chance is measured on the PRE-bank state: marigolds are dormant when the pond (resources.fish)
  // is dry, so a collect after the pond drained rolls at base — the just-banked fish don't revive it.
  const withLifetime = bumpLifetime(banked, { fish: bankFish });
  return rollCatch(withLifetime, creelCatchChance(state), rng);
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
