import { describe, it, expect } from 'vitest';
import { createInitialState, plantCrop } from '../../src/engine';
import { villagerBoost } from '../../src/engine/villagers';
import { farmRatesPerSec } from '../../src/engine/farm';
import { fishRatePerSec } from '../../src/engine/lake';
import type { GameState, Station } from '../../src/engine/types';

const assign = (s: GameState, id: string, to: Station | null): GameState => ({
  ...s,
  villagers: s.villagers.map((v) => (v.id === id ? { ...v, assignedTo: to } : v)),
});

describe('villagerBoost', () => {
  it('farm is gated: 0 farm villagers -> 0', () => {
    expect(villagerBoost(createInitialState(0), 'farm')).toBe(0);
  });
  it('forest/lake are ungated: 0 villagers -> 1', () => {
    const s = createInitialState(0);
    expect(villagerBoost(s, 'forest')).toBe(1);
    expect(villagerBoost(s, 'lake')).toBe(1);
  });
  it('a specialist on their station contributes double a generalist', () => {
    let s = createInitialState(0);
    s = assign(s, 'vil-1', 'farm'); // Pip: farm specialist, L1 -> 0.15*1*2 = 0.30
    expect(villagerBoost(s, 'farm')).toBeCloseTo(1.30, 5);
    s = assign(s, 'vil-2', 'farm'); // Nan: forest specialist on farm -> generalist 0.15
    expect(villagerBoost(s, 'farm')).toBeCloseTo(1.45, 5);
  });
  it('scales with level', () => {
    let s = createInitialState(0);
    s = { ...s, villagers: s.villagers.map((v) => (v.id === 'vil-2' ? { ...v, level: 3, assignedTo: 'forest' } : v)) };
    expect(villagerBoost(s, 'forest')).toBeCloseTo(1 + 0.15 * 3 * 2, 5); // Nan forest-specialist L3
  });
});

describe('station wiring', () => {
  it('a forest villager does NOT change fishRatePerSec (no contamination)', () => {
    let s = createInitialState(0);
    const before = fishRatePerSec(s);
    s = { ...s, villagers: s.villagers.map((v) => (v.id === 'vil-2' ? { ...v, assignedTo: 'forest' } : v)) };
    expect(fishRatePerSec(s)).toBeCloseTo(before, 6); // forest boost must not leak into fishing
  });
  it('a lake villager boosts fishRatePerSec by its multiplier', () => {
    let s = createInitialState(0);
    const before = fishRatePerSec(s);
    s = { ...s, villagers: s.villagers.map((v) => (v.id === 'vil-3' ? { ...v, assignedTo: 'lake' } : v)) };
    expect(fishRatePerSec(s)).toBeCloseTo(before * 1.3, 6); // Rowan lake-specialist L1 -> x1.30
  });
  it('farm gate holds: 0 farm villagers -> 0 rate even with a crop planted', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    expect(farmRatesPerSec(s).gold).toBe(0);
  });
});
