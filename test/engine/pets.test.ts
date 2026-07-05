import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/engine';
import { petLeverMult, petCatchBonus } from '../../src/engine/pets';
import type { GameState } from '../../src/engine/types';

function withPets(...ids: string[]): GameState {
  return { ...createInitialState(0), pets: ids };
}

describe('pet bonuses', () => {
  it('no pets → every lever mult is exactly 1 and catch bonus is 0', () => {
    const s = withPets();
    for (const lever of ['barnCap', 'satchelCap', 'creelCap', 'forageRate', 'farmRate'] as const) {
      expect(petLeverMult(s, lever)).toBe(1);
    }
    expect(petCatchBonus(s)).toBe(0);
  });

  it('a single pet affects only its own lever', () => {
    const s = withPets('pondsnail'); // barnCap +0.05
    expect(petLeverMult(s, 'barnCap')).toBeCloseTo(1.05, 10);
    expect(petLeverMult(s, 'satchelCap')).toBe(1);
    expect(petCatchBonus(s)).toBe(0);
  });

  it('catchChance pet returns an additive bonus, not a lever mult', () => {
    const s = withPets('pondnewt'); // catchChance +0.03
    expect(petCatchBonus(s)).toBeCloseTo(0.03, 10);
  });

  it('full set → each lever reflects exactly its one pet, catch bonus is 0.03', () => {
    const s = withPets('pondsnail', 'waterbeetle', 'dragonfly', 'pebbleturtle', 'crawdad', 'pondnewt');
    expect(petLeverMult(s, 'barnCap')).toBeCloseTo(1.05, 10);
    expect(petLeverMult(s, 'satchelCap')).toBeCloseTo(1.05, 10);
    expect(petLeverMult(s, 'forageRate')).toBeCloseTo(1.08, 10);
    expect(petLeverMult(s, 'creelCap')).toBeCloseTo(1.08, 10);
    expect(petLeverMult(s, 'farmRate')).toBeCloseTo(1.10, 10);
    expect(petCatchBonus(s)).toBeCloseTo(0.03, 10);
  });

  it('unknown pet ids are ignored', () => {
    const s = withPets('not-a-pet', 'pondsnail');
    expect(petLeverMult(s, 'barnCap')).toBeCloseTo(1.05, 10);
  });
});
