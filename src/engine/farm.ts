import type { GameState, CropId, BarnResource, Lifetime } from './types';
import { CROPS } from './content';
import { barnCapMult } from './town';
import { petLeverMult } from './pets';
import { bumpLifetime } from './lifetime';
import { villagerBoost } from './villagers';

/** The barn holds this many hours of the current production rate before it's "full". */
export const BARN_HOURS = 24;
/** Minimum cap for any resource the farm is actively producing. */
export const BARN_FLOOR = 500;

const BARN_RESOURCES: BarnResource[] = ['gold', 'wood', 'acorns'];

function zeroRates(): Record<BarnResource, number> {
  return { gold: 0, wood: 0, acorns: 0 };
}

/** Per-resource gold/wood/acorns produced per second across all planted PRODUCER crops. */
export function farmRatesPerSec(state: GameState): Record<BarnResource, number> {
  const rates = zeroRates();
  const boost = villagerBoost(state, 'farm');
  if (boost === 0) return rates;                       // gate: no farm villagers
  const multiplier = boost * petLeverMult(state, 'farmRate');   // KEEP petLeverMult (crawdad buff)
  for (const p of state.plots) {
    if (!p.crop) continue;
    const crop = CROPS[p.crop];
    if (!crop || crop.kind !== 'producer') continue; // modifier crops bank nothing
    rates[crop.output] += (crop.amount / crop.growSec) * multiplier;
  }
  return rates;
}

/** Per-resource cap: a day of that resource's rate, floored (nonzero rates only), then upgraded. */
export function barnCap(state: GameState): Record<BarnResource, number> {
  const rates = farmRatesPerSec(state);
  const mult = barnCapMult(state);
  const caps = zeroRates();
  for (const res of BARN_RESOURCES) {
    if (rates[res] <= 0) { caps[res] = 0; continue; } // not farmed → no phantom cap
    const perDay = rates[res] * BARN_HOURS * 3600;
    caps[res] = Math.round(Math.max(BARN_FLOOR, Math.round(perDay)) * mult);
  }
  return caps;
}

/** Fill every barn bucket toward its own cap over `elapsedSec`. Immutable. */
export function accrueBarn(state: GameState, elapsedSec: number): GameState {
  if (elapsedSec <= 0) return state;
  const rates = farmRatesPerSec(state);
  const caps = barnCap(state);
  const barn = { ...state.storage.barn };
  let changed = false;
  for (const res of BARN_RESOURCES) {
    const gained = rates[res] * elapsedSec;
    if (gained <= 0) continue;
    const room = Math.max(0, caps[res] - barn[res]);
    const add = Math.min(gained, room);
    if (add > 0) { barn[res] += add; changed = true; }
  }
  if (!changed) return state;
  return { ...state, storage: { ...state.storage, barn } };
}

/** Bank the whole-unit part of every bucket into its resource; carry fractional remainders. */
export function collectBarn(state: GameState): GameState {
  const barn = { ...state.storage.barn };
  const resources = { ...state.resources };
  const gained: Partial<Lifetime> = {};
  for (const res of BARN_RESOURCES) {
    const banked = Math.floor(barn[res]);
    if (banked <= 0) continue;
    resources[res] += banked;
    barn[res] -= banked;
    gained[res] = banked;
  }
  const next = { ...state, resources, storage: { ...state.storage, barn } };
  return bumpLifetime(next, gained);
}

/** Set a plot's crop. Rejects (returns state unchanged) a crop not in unlockedCrops. */
export function plantCrop(state: GameState, plotId: string, cropId: CropId | null): GameState {
  if (cropId !== null && !state.unlockedCrops.includes(cropId)) return state;
  return {
    ...state,
    plots: state.plots.map((p) => (p.id === plotId ? { ...p, crop: cropId } : p)),
  };
}

export function assignVillager(
  state: GameState,
  villagerId: string,
  to: 'farm' | null,
): GameState {
  return {
    ...state,
    villagers: state.villagers.map((v) =>
      v.id === villagerId ? { ...v, assignedTo: to } : v,
    ),
  };
}
