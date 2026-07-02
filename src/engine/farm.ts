import type { GameState, CropId } from './types';
import { CROPS } from './content';

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

export function plantCrop(state: GameState, plotId: string, cropId: CropId): GameState {
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
  const rate = farmRatePerSec(state);
  const gained = rate * elapsedSec;
  const cap = state.storage.barn.cap;
  const amount = Math.min(cap, state.storage.barn.amount + gained);
  return { ...state, storage: { ...state.storage, barn: { ...state.storage.barn, amount } } };
}

/** Bank the barn's contents into gold and empty it. */
export function collectBarn(state: GameState): GameState {
  const banked = Math.floor(state.storage.barn.amount);
  return {
    ...state,
    resources: { ...state.resources, gold: state.resources.gold + banked },
    storage: { ...state.storage, barn: { ...state.storage.barn, amount: 0 } },
  };
}
