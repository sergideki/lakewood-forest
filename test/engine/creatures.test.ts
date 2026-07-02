import { describe, it, expect } from 'vitest';
import { makeCreature, SPECIES } from '../../src/engine';
import {
  creatureForageOutput,
  levelMult,
  xpForLevel,
  grantXp,
  teamPower,
  rollDiscovery,
  dripForagerXp,
} from '../../src/engine/creatures';
import { createInitialState } from '../../src/engine';

describe('levelMult', () => {
  it('is 1.0 at level 1 and +10% per level', () => {
    expect(levelMult(1)).toBeCloseTo(1.0, 5);
    expect(levelMult(3)).toBeCloseTo(1.2, 5);
  });
});

describe('creatureForageOutput', () => {
  it('scales with rarity and level', () => {
    const common = makeCreature('fernling');   // common, BASE 0.05 * 1 * 1
    expect(creatureForageOutput(common)).toBeCloseTo(0.05, 5);
    const rare = makeCreature('stagheart');     // rare mult 2.25
    expect(creatureForageOutput(rare)).toBeCloseTo(0.05 * 2.25, 5);
  });
});

describe('xpForLevel', () => {
  it('grows with level and rarity', () => {
    expect(xpForLevel(1, 'common')).toBe(100);
    expect(xpForLevel(2, 'common')).toBe(200);
    expect(xpForLevel(1, 'rare')).toBe(200); // rare curve x2
  });
});

describe('grantXp', () => {
  it('accumulates xp without leveling below the threshold', () => {
    const c = grantXp(makeCreature('fernling'), 50);
    expect(c.level).toBe(1);
    expect(c.xp).toBe(50);
  });

  it('levels up and carries the remainder', () => {
    const c = grantXp(makeCreature('fernling'), 130); // needs 100 for L1->L2, 30 remains
    expect(c.level).toBe(2);
    expect(c.xp).toBe(30);
  });

  it('can cross multiple levels at once', () => {
    // L1->L2 costs 100, L2->L3 costs 200 => 300 total lands exactly at L3 with 0
    const c = grantXp(makeCreature('fernling'), 300);
    expect(c.level).toBe(3);
    expect(c.xp).toBe(0);
  });

  it('is immutable', () => {
    const c0 = makeCreature('fernling');
    grantXp(c0, 500);
    expect(c0.xp).toBe(0);
    expect(c0.level).toBe(1);
  });
});

describe('teamPower', () => {
  it('sums rarityWeight * level over the given creatures', () => {
    let s = createInitialState(0); // fernling(common,L1)=1, pebblepup(common,L1)=1
    expect(teamPower(s, ['cr-fernling', 'cr-pebblepup'])).toBe(2);
    // level pebblepup to L2 => weight 1 * 2 = 2, total 3
    s = { ...s, creatures: s.creatures.map((c) => (c.id === 'cr-pebblepup' ? { ...c, level: 2 } : c)) };
    expect(teamPower(s, ['cr-fernling', 'cr-pebblepup'])).toBe(3);
  });
});

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : values[values.length - 1] ?? 0);
}

describe('rollDiscovery', () => {
  it('does nothing when the hit roll misses (rng >= chance)', () => {
    const s = createInitialState(0);
    const next = rollDiscovery(s, 0.5, seqRng([0.9]));
    expect(next.discovered).toEqual(s.discovered);
    expect(next.creatures).toHaveLength(2);
  });

  it('adds a new undiscovered species when the hit roll succeeds', () => {
    const s = createInitialState(0);
    // first rng < chance = hit; second rng selects within the weighted pool
    const next = rollDiscovery(s, 0.5, seqRng([0.0, 0.0]));
    expect(next.discovered.length).toBe(3);
    expect(next.creatures.length).toBe(3);
    const added = next.creatures.find((c) => !s.creatures.some((o) => o.id === c.id))!;
    expect(added.assignment.type).toBe('idle');
  });

  it('is a no-op when every species is already discovered', () => {
    let s = createInitialState(0);
    const all = Object.keys(SPECIES);
    s = { ...s, discovered: all };
    const next = rollDiscovery(s, 1.0, seqRng([0.0, 0.0]));
    expect(next.discovered.length).toBe(all.length);
    expect(next.creatures.length).toBe(s.creatures.length);
  });
});

describe('dripForagerXp', () => {
  it('grants xp only to foraging creatures over elapsed seconds', () => {
    let s = createInitialState(0);
    s = { ...s, creatures: s.creatures.map((c) =>
      c.id === 'cr-fernling'
        ? { ...c, assignment: { type: 'forage' as const, dungeonId: null, startedAt: 0 } }
        : c) };
    s = dripForagerXp(s, 100); // 0.02 * 100 = 2 xp
    const fern = s.creatures.find((c) => c.id === 'cr-fernling')!;
    const pebble = s.creatures.find((c) => c.id === 'cr-pebblepup')!;
    expect(fern.xp).toBeCloseTo(2, 5);
    expect(pebble.xp).toBe(0); // idle, no xp
  });
});
