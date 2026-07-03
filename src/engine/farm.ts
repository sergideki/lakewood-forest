import type { GameState, CropId } from './types';
import { CROPS } from './content';
import { barnCapMult } from './town';

/** The barn holds this many hours of the current production rate before it's "full". */
export const BARN_HOURS = 24;

/** Derived barn capacity = a day's worth of the current farm rate, floored, then upgraded. */
export function barnCap(state: GameState): number {
  const perDay = farmRatePerSec(state) * BARN_HOURS * 3600;
  // Multiplier applies AFTER the floor (upgrade visible at zero production); final round
  // keeps the cap an integer (odd cap x 1.5 would otherwise leak fractions to the UI).
  return Math.round(Math.max(500, Math.round(perDay)) * barnCapMult(state));
}

/** Gold produced per second across all planted plots, gated + boosted by farm villagers. */
export function farmRatePerSec(state: GameState): number {
  const assigned = state.villagers.filter((v) => v.assignedTo === 'farm').length;
  if (assigned === 0) return 0;
  const base = state.plots.reduce((sum, p) => {
    if (!p.crop) return sum;
    const crop = CROPS[p.crop];
    return crop ? sum + crop.gold / crop.growSec : sum;
  }, 0);
  const multiplier = 1 + 0.25 * (assigned - 1);
  return base * multiplier;
}

export function plantCrop(state: GameState, plotId: string, cropId: CropId | null): GameState {
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

/** Fill the barn by the farm rate over `elapsedSec`, clamped to [0, cap]. */
export function accrueBarn(state: GameState, elapsedSec: number): GameState {
  if (elapsedSec <= 0) return state;
  const cap = barnCap(state);
  const gained = farmRatePerSec(state) * elapsedSec;
  const current = state.storage.barn.amount;
  const room = Math.max(0, cap - current);
  const amount = current + Math.min(gained, room); // grows toward cap, never reduces current
  return { ...state, storage: { ...state.storage, barn: { amount } } };
}

/** Bank the whole-gold part of the barn into gold; carry the fractional remainder. */
export function collectBarn(state: GameState): GameState {
  const banked = Math.floor(state.storage.barn.amount);
  const remainder = state.storage.barn.amount - banked;
  return {
    ...state,
    resources: { ...state.resources, gold: state.resources.gold + banked },
    storage: { ...state.storage, barn: { ...state.storage.barn, amount: remainder } },
  };
}
