import type { GameState, Resources, UpgradeId } from './types';
import { UPGRADES, TREAT_COST_ACORNS, TREAT_XP } from './content';
import { grantXp } from './creatures';

/** Owned level of an upgrade; tolerates pre-v3 states with no `upgrades` field. */
export function upgradeLevel(state: GameState, id: UpgradeId): number {
  return state.upgrades?.[id] ?? 0;
}

/** Cost of buying the NEXT level given `ownedLevel`; null when unknown id or already at max. */
export function upgradeCost(id: UpgradeId, ownedLevel: number): Resources | null {
  const def = UPGRADES[id];
  if (!def || ownedLevel >= def.maxLevel) return null;
  const mult = Math.pow(def.costGrowth, ownedLevel);
  return {
    gold: Math.ceil((def.baseCost.gold ?? 0) * mult),
    wood: Math.ceil((def.baseCost.wood ?? 0) * mult),
    acorns: Math.ceil((def.baseCost.acorns ?? 0) * mult),
    fish: Math.ceil((def.baseCost.fish ?? 0) * mult),
  };
}

export function canAfford(state: GameState, id: UpgradeId): boolean {
  const cost = upgradeCost(id, upgradeLevel(state, id));
  if (!cost) return false;
  const r = state.resources;
  return r.gold >= cost.gold && r.wood >= cost.wood && r.acorns >= cost.acorns;
}

/** Buy the next level. No-op (same reference) when unknown, maxed, or unaffordable. */
export function purchaseUpgrade(state: GameState, id: UpgradeId): GameState {
  const level = upgradeLevel(state, id);
  const cost = upgradeCost(id, level);
  if (!cost || !canAfford(state, id)) return state;

  let next: GameState = {
    ...state,
    resources: {
      gold: state.resources.gold - cost.gold,
      wood: state.resources.wood - cost.wood,
      acorns: state.resources.acorns - cost.acorns,
      fish: state.resources.fish - cost.fish,
    },
    upgrades: { ...state.upgrades, [id]: level + 1 },
  };
  if (id === 'farm-plot') {
    // Plots are only ever appended, so length+1 always yields a fresh id.
    next = { ...next, plots: [...next.plots, { id: `plot-${next.plots.length + 1}`, crop: null }] };
  }
  return next;
}

/** Spend acorns to grant a flat XP lump. Instant — works regardless of assignment. */
export function buyTreat(state: GameState, creatureId: string): GameState {
  if (state.resources.acorns < TREAT_COST_ACORNS) return state;
  if (!state.creatures.some((c) => c.id === creatureId)) return state;
  return {
    ...state,
    resources: { ...state.resources, acorns: state.resources.acorns - TREAT_COST_ACORNS },
    creatures: state.creatures.map((c) => (c.id === creatureId ? grantXp(c, TREAT_XP) : c)),
  };
}

export function barnCapMult(state: GameState): number {
  return 1 + 0.5 * upgradeLevel(state, 'barn-silo');
}

export function satchelCapMult(state: GameState): number {
  return 1 + 0.5 * upgradeLevel(state, 'satchel-stitch');
}

export function forageMult(state: GameState): number {
  return 1 + 0.15 * upgradeLevel(state, 'forage-tools');
}
