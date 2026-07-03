import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/engine';
import { assignCreature } from '../../src/engine/forest';
import { BASE_ROD_RATE, CREEL_FLOOR, CREEL_HOURS, PET_IDS } from '../../src/engine/content';
import { fishRatePerSec, creelCap, accrueCreel, collectCreel, rollCatch } from '../../src/engine/lake';
import type { GameState } from '../../src/engine/types';

// A state with one discovered fish-affinity creature set to forage (fills the creel).
function withWaterForager(): GameState {
  const s = createInitialState(0);
  const frog = {
    id: 'cr-ripplefrog', species: 'ripplefrog', name: 'Ripple Frog', emoji: '🐸',
    rarity: 'common' as const, affinity: 'fish' as const, level: 1, xp: 0,
    assignment: { type: 'forage' as const, dungeonId: null, startedAt: 0 },
  };
  return { ...s, creatures: [...s.creatures, frog], discovered: [...s.discovered, 'ripplefrog'] };
}

describe('fishRatePerSec', () => {
  it('is the flat rod base with zero water creatures', () => {
    expect(fishRatePerSec(createInitialState(0))).toBe(BASE_ROD_RATE);
  });
  it('rises when a fish-affinity creature forages', () => {
    expect(fishRatePerSec(withWaterForager())).toBeGreaterThan(BASE_ROD_RATE);
  });
  it('forage-tools lifts only the creature part, not the rod base', () => {
    const s = withWaterForager();
    const creaturePart = fishRatePerSec(s) - BASE_ROD_RATE;
    const boosted = { ...s, upgrades: { 'forage-tools': 2 } };
    expect(fishRatePerSec(boosted)).toBeCloseTo(BASE_ROD_RATE + creaturePart * 1.3);
  });
});

describe('creelCap', () => {
  it('is a day of the current fish rate, at least the floor, integer', () => {
    const cap = creelCap(createInitialState(0));
    expect(cap).toBe(Math.max(CREEL_FLOOR, Math.round(BASE_ROD_RATE * CREEL_HOURS * 3600)));
    expect(Number.isInteger(cap)).toBe(true);
  });
  it('rises with more foragers', () => {
    expect(creelCap(withWaterForager())).toBeGreaterThan(creelCap(createInitialState(0)));
  });
});

describe('accrueCreel', () => {
  it('fills at the fish rate over elapsed seconds', () => {
    const after = accrueCreel(createInitialState(0), 100);
    expect(after.storage.creel.fish).toBeCloseTo(BASE_ROD_RATE * 100);
  });
  it('clamps at the cap', () => {
    const s = createInitialState(0);
    expect(accrueCreel(s, 10 ** 9).storage.creel.fish).toBe(creelCap(s));
  });
  it('is a no-op for zero or negative elapsed', () => {
    const s = createInitialState(0);
    expect(accrueCreel(s, 0)).toBe(s);
    expect(accrueCreel(s, -5)).toBe(s);
  });
});

describe('collectCreel', () => {
  const lowRng = () => 0;      // "hit" the catch, pick the first pet
  const highRng = () => 0.999; // never catch

  it('banks whole fish and carries the remainder', () => {
    const s = { ...createInitialState(0), storage: { ...createInitialState(0).storage, creel: { fish: 12.7 } } };
    const after = collectCreel(s, highRng); // isolate banking from catching
    expect(after.resources.fish).toBe(12);
    expect(after.storage.creel.fish).toBeCloseTo(0.7);
  });
  it('empty creel is a no-op — no bank, no catch roll', () => {
    const s = createInitialState(0); // creel.fish = 0
    expect(collectCreel(s, lowRng)).toBe(s);
    expect(collectCreel(s, lowRng).pets.length).toBe(0);
  });
  it('catches a pet when rng is below CATCH_CHANCE and fish were banked', () => {
    const s = { ...createInitialState(0), storage: { ...createInitialState(0).storage, creel: { fish: 5 } } };
    expect(collectCreel(s, lowRng).pets.length).toBe(1);
  });
  it('catches nothing when rng is above CATCH_CHANCE', () => {
    const s = { ...createInitialState(0), storage: { ...createInitialState(0).storage, creel: { fish: 5 } } };
    expect(collectCreel(s, highRng).pets.length).toBe(0);
  });
});

describe('rollCatch', () => {
  it('no-ops (same ref) when the pool is exhausted', () => {
    const full = { ...createInitialState(0), pets: [...PET_IDS] };
    expect(rollCatch(full, 1, () => 0)).toBe(full);
  });
  it('respects the chance gate', () => {
    const s = createInitialState(0);
    expect(rollCatch(s, 0, () => 0.5)).toBe(s);
  });
});
