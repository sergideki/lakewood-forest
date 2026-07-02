import { describe, it, expect } from 'vitest';
import { SPECIES, DUNGEONS } from '../../src/engine';
import { createInitialState } from '../../src/engine';
import {
  assignCreature,
  forageRatePerSec,
  satchelCap,
  accrueSatchel,
  collectSatchel,
  startRun,
  isRunReady,
  collectRun,
} from '../../src/engine/forest';
import { getDungeon } from '../../src/engine';

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : values[values.length - 1] ?? 0);
}

describe('content tables', () => {
  it('has ~10 species, each with rarity + wood|acorn affinity', () => {
    const ids = Object.keys(SPECIES);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    for (const id of ids) {
      const s = SPECIES[id];
      expect(s.id).toBe(id);
      expect(['common', 'uncommon', 'rare']).toContain(s.rarity);
      expect(['wood', 'acorn']).toContain(s.affinity);
      expect(s.emoji.length).toBeGreaterThan(0);
    }
  });

  it('includes the two starters fernling + pebblepup', () => {
    expect(SPECIES.fernling).toBeTruthy();
    expect(SPECIES.pebblepup).toBeTruthy();
  });

  it('has 3 dungeons with ascending duration + recommended power', () => {
    expect(DUNGEONS).toHaveLength(3);
    for (let i = 1; i < DUNGEONS.length; i++) {
      expect(DUNGEONS[i].durationSec).toBeGreaterThan(DUNGEONS[i - 1].durationSec);
      expect(DUNGEONS[i].recommendedPower).toBeGreaterThan(DUNGEONS[i - 1].recommendedPower);
    }
    for (const d of DUNGEONS) {
      expect(d.loot.gold).toBeGreaterThan(0);
      expect(d.baseDiscoveryChance).toBeGreaterThan(0);
      expect(d.xpReward).toBeGreaterThan(0);
    }
  });
});

describe('createInitialState (forest fields)', () => {
  it('starts with two idle starter creatures, empty satchel, 3 idle dungeons, both starters discovered', () => {
    const s = createInitialState(1000);
    expect(s.resources.wood).toBe(0);
    expect(s.resources.acorns).toBe(0);
    expect(s.storage.satchel).toEqual({ wood: 0, acorn: 0 });
    expect(s.creatures).toHaveLength(2);
    expect(s.creatures.map((c) => c.species).sort()).toEqual(['fernling', 'pebblepup']);
    expect(s.creatures.every((c) => c.assignment.type === 'idle' && c.level === 1 && c.xp === 0)).toBe(true);
    expect(s.dungeons.map((d) => d.id)).toEqual(['hollow', 'grove', 'deep']);
    expect(s.dungeons.every((d) => d.activeRun === null)).toBe(true);
    expect(s.discovered.sort()).toEqual(['fernling', 'pebblepup']);
  });
});

describe('assignCreature', () => {
  it('sets forage then back to idle, immutably', () => {
    const s0 = createInitialState(0);
    const s1 = assignCreature(s0, 'cr-fernling', 'forage');
    expect(s1.creatures.find((c) => c.id === 'cr-fernling')!.assignment.type).toBe('forage');
    expect(s0.creatures.find((c) => c.id === 'cr-fernling')!.assignment.type).toBe('idle');
    const s2 = assignCreature(s1, 'cr-fernling', 'idle');
    expect(s2.creatures.find((c) => c.id === 'cr-fernling')!.assignment.type).toBe('idle');
  });

  it('refuses to reassign a creature busy in a dungeon (no-op)', () => {
    let s = createInitialState(0);
    s = { ...s, creatures: s.creatures.map((c) =>
      c.id === 'cr-fernling' ? { ...c, assignment: { type: 'dungeon', dungeonId: 'hollow', startedAt: 1 } } : c) };
    const next = assignCreature(s, 'cr-fernling', 'forage');
    expect(next.creatures.find((c) => c.id === 'cr-fernling')!.assignment.type).toBe('dungeon');
  });
});

describe('forageRatePerSec', () => {
  it('sums output of creatures foraging the given material', () => {
    let s = createInitialState(0);
    s = assignCreature(s, 'cr-fernling', 'forage');  // acorn-affinity, 0.05/s
    s = assignCreature(s, 'cr-pebblepup', 'forage'); // wood-affinity, 0.05/s
    expect(forageRatePerSec(s, 'acorn')).toBeCloseTo(0.05, 5);
    expect(forageRatePerSec(s, 'wood')).toBeCloseTo(0.05, 5);
  });
});

describe('accrueSatchel + cap', () => {
  it('fills wood and acorn by their rates', () => {
    let s = createInitialState(0);
    s = assignCreature(s, 'cr-fernling', 'forage');  // acorn
    s = assignCreature(s, 'cr-pebblepup', 'forage'); // wood
    s = accrueSatchel(s, 100); // +5 each
    expect(s.storage.satchel.acorn).toBeCloseTo(5, 5);
    expect(s.storage.satchel.wood).toBeCloseTo(5, 5);
  });

  it('never lets wood + acorn exceed the cap', () => {
    let s = createInitialState(0);
    s = assignCreature(s, 'cr-fernling', 'forage');
    s = assignCreature(s, 'cr-pebblepup', 'forage');
    s = accrueSatchel(s, 10_000_000);
    expect(s.storage.satchel.wood + s.storage.satchel.acorn).toBeLessThanOrEqual(satchelCap(s) + 1e-6);
  });

  it('is a no-op on zero/negative elapsed', () => {
    let s = createInitialState(0);
    s = assignCreature(s, 'cr-fernling', 'forage');
    expect(accrueSatchel(s, 0).storage.satchel.acorn).toBe(0);
    expect(accrueSatchel(s, -5).storage.satchel.acorn).toBe(0);
  });

  it('has a SATCHEL_FLOOR cap of 200 when nobody is foraging', () => {
    const s = createInitialState(0);
    expect(satchelCap(s)).toBe(200);
  });

  it('splits a partial overflow proportionally to the asymmetric rates', () => {
    // Asymmetric rates: fernling (acorn) at L3 = 0.06/s, pebblepup (wood) at L1 = 0.05/s.
    let s = createInitialState(0);
    s = { ...s, creatures: s.creatures.map((c) => {
      if (c.id === 'cr-fernling') return { ...c, level: 3, assignment: { type: 'forage', dungeonId: null, startedAt: 0 } };
      if (c.id === 'cr-pebblepup') return { ...c, assignment: { type: 'forage', dungeonId: null, startedAt: 0 } };
      return c;
    }) };
    const woodRate = forageRatePerSec(s, 'wood');   // 0.05
    const acornRate = forageRatePerSec(s, 'acorn'); // 0.06
    const cap = satchelCap(s);

    // Pre-fill so only a small positive room remains, smaller than the combined gain.
    const room = 4;
    s = { ...s, storage: { ...s.storage, satchel: { wood: cap - room, acorn: 0 } } };
    const before = s.storage.satchel;

    // elapsedSec=100 -> totalGain = 11 > room(4), so the clamp engages.
    const next = accrueSatchel(s, 100);
    const after = next.storage.satchel;

    // Lands exactly at cap, never over.
    expect(after.wood + after.acorn).toBeCloseTo(cap, 6);

    // Added amounts keep the rate ratio — catches "clamp one material first" regressions.
    const gainedWood = after.wood - before.wood;
    const gainedAcorn = after.acorn - before.acorn;
    expect(gainedWood).toBeGreaterThan(0);
    expect(gainedAcorn).toBeGreaterThan(0);
    expect(gainedWood / gainedAcorn).toBeCloseTo(woodRate / acornRate, 6);
  });
});

describe('collectSatchel', () => {
  it('banks whole wood + acorn into resources, carries the remainder, may discover', () => {
    let s = createInitialState(0);
    s = { ...s, storage: { ...s.storage, satchel: { wood: 12.4, acorn: 7.9 } } };
    const next = collectSatchel(s, seqRng([0.99])); // discovery misses
    expect(next.resources.wood).toBe(12);
    expect(next.resources.acorns).toBe(7);
    expect(next.storage.satchel.wood).toBeCloseTo(0.4, 5);
    expect(next.storage.satchel.acorn).toBeCloseTo(0.9, 5);
    expect(next.discovered).toEqual(s.discovered);
  });
});

const HOLLOW = 'hollow';
const HOLLOW_MS = 15 * 60 * 1000;

describe('startRun', () => {
  it('marks creatures busy and opens the run', () => {
    const s = startRun(createInitialState(0), HOLLOW, ['cr-fernling'], 1000);
    expect(s.dungeons.find((d) => d.id === HOLLOW)!.activeRun).toEqual({ creatureIds: ['cr-fernling'], startedAt: 1000 });
    expect(s.creatures.find((c) => c.id === 'cr-fernling')!.assignment).toEqual({ type: 'dungeon', dungeonId: HOLLOW, startedAt: 1000 });
  });

  it('is a no-op with an empty team, a busy creature, or an already-running dungeon', () => {
    const s0 = createInitialState(0);
    expect(startRun(s0, HOLLOW, [], 1000).dungeons.find((d) => d.id === HOLLOW)!.activeRun).toBeNull();
    const running = startRun(s0, HOLLOW, ['cr-fernling'], 1000);
    // pebblepup is free, but hollow already runs => no-op
    expect(startRun(running, HOLLOW, ['cr-pebblepup'], 2000).dungeons.find((d) => d.id === HOLLOW)!.activeRun!.creatureIds).toEqual(['cr-fernling']);
    // fernling is busy => starting grove with it is a no-op
    expect(startRun(running, 'grove', ['cr-fernling'], 2000).dungeons.find((d) => d.id === 'grove')!.activeRun).toBeNull();
  });
});

describe('isRunReady', () => {
  it('is false before the duration elapses, true after', () => {
    const s = startRun(createInitialState(0), HOLLOW, ['cr-fernling'], 1000);
    expect(isRunReady(s, HOLLOW, 1000 + HOLLOW_MS - 1)).toBe(false);
    expect(isRunReady(s, HOLLOW, 1000 + HOLLOW_MS)).toBe(true);
  });

  it('is false when no run is active', () => {
    expect(isRunReady(createInitialState(0), HOLLOW, 9_999_999)).toBe(false);
  });
});

describe('collectRun', () => {
  it('is a no-op before the run is ready', () => {
    const s = startRun(createInitialState(0), HOLLOW, ['cr-fernling'], 1000);
    const next = collectRun(s, HOLLOW, () => 0.99, 1000 + HOLLOW_MS - 1);
    expect(next).toBe(s); // unchanged reference
  });

  it('pays power-scaled loot, grants xp, frees creatures, clears the run (discovery miss)', () => {
    const d = getDungeon(HOLLOW)!; // recommendedPower 2, loot gold20/wood10/acorn6, xp30
    const s = startRun(createInitialState(0), HOLLOW, ['cr-fernling', 'cr-pebblepup'], 1000); // teamPower 2 => mult 1.0
    const next = collectRun(s, HOLLOW, () => 0.99, 1000 + HOLLOW_MS);
    expect(next.resources.gold).toBe(d.loot.gold);
    expect(next.resources.wood).toBe(d.loot.wood);
    expect(next.resources.acorns).toBe(d.loot.acorn);
    expect(next.dungeons.find((x) => x.id === HOLLOW)!.activeRun).toBeNull();
    const fern = next.creatures.find((c) => c.id === 'cr-fernling')!;
    expect(fern.assignment.type).toBe('idle');
    expect(fern.xp + (fern.level - 1) * 100).toBeGreaterThanOrEqual(30); // got at least the xp lump
  });

  it('clamps loot multiplier to a 0.5 floor for an underpowered team', () => {
    const s = startRun(createInitialState(0), 'deep', ['cr-fernling'], 1000); // power 1 vs recommended 14
    const deep = getDungeon('deep')!;
    const next = collectRun(s, 'deep', () => 0.99, 1000 + deep.durationSec * 1000);
    expect(next.resources.gold).toBe(Math.floor(deep.loot.gold * 0.5));
  });

  it('can discover on completion when the roll hits', () => {
    const s = startRun(createInitialState(0), HOLLOW, ['cr-fernling'], 1000);
    const before = s.discovered.length;
    const next = collectRun(s, HOLLOW, seqRng([0.0, 0.0]), 1000 + HOLLOW_MS);
    expect(next.discovered.length).toBe(before + 1);
  });

  it('clamps loot multiplier to a 1.5 ceiling for an overpowered team', () => {
    const hollow = getDungeon(HOLLOW)!; // recommendedPower 2
    // Bump both starters to L4 => teamPower = 1*4 + 1*4 = 8, /2 = 4.0 => must clamp to 1.5.
    let s = createInitialState(0);
    s = { ...s, creatures: s.creatures.map((c) =>
      ['cr-fernling', 'cr-pebblepup'].includes(c.id) ? { ...c, level: 4 } : c) };
    s = startRun(s, HOLLOW, ['cr-fernling', 'cr-pebblepup'], 1000);
    const next = collectRun(s, HOLLOW, () => 0.99, 1000 + HOLLOW_MS); // discovery miss
    expect(next.resources.gold).toBe(Math.floor(hollow.loot.gold * 1.5));
    expect(next.resources.wood).toBe(Math.floor(hollow.loot.wood * 1.5));
    expect(next.resources.acorns).toBe(Math.floor(hollow.loot.acorn * 1.5));
    // NOT the unclamped 4.0x value — makes the ceiling intent explicit.
    expect(next.resources.gold).not.toBe(Math.floor(hollow.loot.gold * 4));
  });
});
