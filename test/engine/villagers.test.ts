import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/engine';
import { villagerBoost } from '../../src/engine/villagers';
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
