import type { GameState, PetId } from './types';
import { PET_EFFECTS, PetLever } from './content';

/** Sum the `amount` of every caught pet whose effect targets `lever`. Unknown ids ignored. */
function sumFor(state: GameState, lever: PetLever): number {
  let sum = 0;
  for (const id of state.pets) {
    const eff = PET_EFFECTS[id as PetId];
    if (eff && eff.lever === lever) sum += eff.amount;
  }
  return sum;
}

/** Multiplier (≥1) for a rate/cap lever from the caught pet set: 1 + Σamount. */
export function petLeverMult(state: GameState, lever: Exclude<PetLever, 'catchChance'>): number {
  return 1 + sumFor(state, lever);
}

/** Additive catch-chance bonus (≥0) from the caught pet set. */
export function petCatchBonus(state: GameState): number {
  return sumFor(state, 'catchChance');
}
