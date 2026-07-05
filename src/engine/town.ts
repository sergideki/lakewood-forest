import type { GameState, Resources, UpgradeId, CropId } from './types';
import { UPGRADES, TREAT_COST_ACORNS, TREAT_XP, CROPS, CROP_UNLOCK_COST, TRADE_WOOD_COST, TRADE_FISH_YIELD } from './content';
import { grantXp } from './creatures';
import { petLeverMult } from './pets';

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
  return (1 + 0.5 * upgradeLevel(state, 'barn-silo')) * petLeverMult(state, 'barnCap');
}

export function satchelCapMult(state: GameState): number {
  return (1 + 0.5 * upgradeLevel(state, 'satchel-stitch')) * petLeverMult(state, 'satchelCap');
}

export function forageMult(state: GameState): number {
  return (1 + 0.15 * upgradeLevel(state, 'forage-tools')) * petLeverMult(state, 'forageRate');
}

/** True if the crop exists, isn't already unlocked, and every resource component is affordable. */
export function canUnlockCrop(state: GameState, cropId: CropId): boolean {
  if (!CROPS[cropId] || state.unlockedCrops.includes(cropId)) return false;
  const cost = CROP_UNLOCK_COST[cropId];
  if (!cost) return false;
  const r = state.resources;
  return (
    r.gold >= (cost.gold ?? 0) &&
    r.wood >= (cost.wood ?? 0) &&
    r.acorns >= (cost.acorns ?? 0) &&
    r.fish >= (cost.fish ?? 0)
  );
}

/** Pay the unlock cost + append to unlockedCrops. No-op (same ref) if unknown/owned/unaffordable. */
export function unlockCrop(state: GameState, cropId: CropId): GameState {
  if (!canUnlockCrop(state, cropId)) return state;
  const cost = CROP_UNLOCK_COST[cropId];
  return {
    ...state,
    resources: {
      gold: state.resources.gold - (cost.gold ?? 0),
      wood: state.resources.wood - (cost.wood ?? 0),
      acorns: state.resources.acorns - (cost.acorns ?? 0),
      fish: state.resources.fish - (cost.fish ?? 0),
    },
    unlockedCrops: [...state.unlockedCrops, cropId],
  };
}

/** True when the player can afford one wood→fish trade. */
export function canTradeWoodForFish(state: GameState): boolean {
  return state.resources.wood >= TRADE_WOOD_COST;
}

/** Spend TRADE_WOOD_COST wood for TRADE_FISH_YIELD fish. No-op (same ref) if unaffordable.
 *  The recurring wood SINK that revives sapling; touches only resources → save-safe. */
export function tradeWoodForFish(state: GameState): GameState {
  if (!canTradeWoodForFish(state)) return state;
  return {
    ...state,
    resources: {
      ...state.resources,
      wood: state.resources.wood - TRADE_WOOD_COST,
      fish: state.resources.fish + TRADE_FISH_YIELD,
    },
  };
}
