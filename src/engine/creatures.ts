import type { Creature, GameState, Rarity, Rng, SpeciesId } from './types';
import { SPECIES } from './content';

/** Build a fresh level-1 idle creature instance for a species. */
export function makeCreature(species: SpeciesId): Creature {
  const sp = SPECIES[species];
  return {
    id: `cr-${species}`, // one instance per species (discovery pool is de-duped), so this is unique
    species,
    name: sp.name,
    emoji: sp.emoji,
    rarity: sp.rarity,
    affinity: sp.affinity,
    level: 1,
    xp: 0,
    assignment: { type: 'idle', dungeonId: null, startedAt: 0 },
  };
}

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 4 };
export const FORAGE_RARITY_MULT: Record<Rarity, number> = { common: 1, uncommon: 1.5, rare: 2.25 };
export const RARITY_XP_MULT: Record<Rarity, number> = { common: 1, uncommon: 1.5, rare: 2 };

export const BASE_FORAGE = 0.05; // items/sec at level 1, common

export function levelMult(level: number): number {
  return 1 + 0.1 * (level - 1);
}

/** Items/sec a single creature yields while foraging. */
export function creatureForageOutput(c: Creature): number {
  return BASE_FORAGE * FORAGE_RARITY_MULT[c.rarity] * levelMult(c.level);
}

/** XP needed to advance FROM `level` to `level+1`, scaled by rarity. */
export function xpForLevel(level: number, rarity: Rarity): number {
  return Math.round(100 * level * RARITY_XP_MULT[rarity]);
}

/** Add XP and auto-level across as many thresholds as the total allows. Immutable. */
export function grantXp(c: Creature, amount: number): Creature {
  let level = c.level;
  let xp = c.xp + Math.max(0, amount);
  while (xp >= xpForLevel(level, c.rarity)) {
    xp -= xpForLevel(level, c.rarity);
    level += 1;
  }
  return { ...c, level, xp };
}

/** Combined dungeon power of the named creatures. */
export function teamPower(state: GameState, ids: string[]): number {
  return state.creatures
    .filter((c) => ids.includes(c.id))
    .reduce((sum, c) => sum + RARITY_WEIGHT[c.rarity] * c.level, 0);
}

export const DISCOVERY_WEIGHT: Record<Rarity, number> = { common: 6, uncommon: 3, rare: 1 };
export const FORAGE_XP_PER_SEC = 0.02;

/**
 * With probability `chance`, discover a new (undiscovered) species — weighted toward common —
 * spawning a fresh idle creature and recording the species. Uses two rng draws: hit, then pick.
 */
export function rollDiscovery(state: GameState, chance: number, rng: Rng): GameState {
  if (rng() >= chance) return state;
  const pool = Object.values(SPECIES).filter((sp) => !state.discovered.includes(sp.id));
  if (pool.length === 0) return state;

  const totalWeight = pool.reduce((sum, sp) => sum + DISCOVERY_WEIGHT[sp.rarity], 0);
  let roll = rng() * totalWeight;
  let picked = pool[pool.length - 1];
  for (const sp of pool) {
    roll -= DISCOVERY_WEIGHT[sp.rarity];
    if (roll < 0) { picked = sp; break; }
  }

  return {
    ...state,
    creatures: [...state.creatures, makeCreature(picked.id)],
    discovered: [...state.discovered, picked.id],
  };
}

/** Give every foraging creature XP for `elapsedSec` seconds (auto-levels). Immutable. */
export function dripForagerXp(state: GameState, elapsedSec: number): GameState {
  if (elapsedSec <= 0) return state;
  const gain = FORAGE_XP_PER_SEC * elapsedSec;
  return {
    ...state,
    creatures: state.creatures.map((c) =>
      c.assignment.type === 'forage' ? grantXp(c, gain) : c,
    ),
  };
}
