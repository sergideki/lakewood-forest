import { describe, it, expect } from 'vitest';
import { createInitialState, plantCrop, assignVillager, applyElapsed, barnCap, MARIGOLD_FISH_PER_SEC } from '../../src/engine';
import { assignCreature } from '../../src/engine/forest';

function activeFarm(now: number) {
  let s = createInitialState(now);
  s = plantCrop(s, 'plot-1', 'wheat');   // 0.05 gold/s
  s = assignVillager(s, 'vil-1', 'farm');
  return s;
}

describe('applyElapsed', () => {
  it('fills the barn by the wall-clock gap and advances lastSeen', () => {
    const s0 = activeFarm(1_000); // lastSeen = 1000ms
    const s1 = applyElapsed(s0, 1_000 + 200_000); // +200s
    expect(s1.storage.barn.gold).toBeCloseTo(13, 5); // 0.05 * 1.3 * 200
    expect(s1.meta.lastSeen).toBe(1_000 + 200_000);
  });

  it('clamps negative elapsed (clock rollback) to zero — no reward, lastSeen does NOT regress', () => {
    const s0 = activeFarm(1_000_000);
    const s1 = applyElapsed(s0, 500_000); // "now" earlier than lastSeen
    expect(s1.storage.barn.gold).toBe(0);
    expect(s1.meta.lastSeen).toBe(1_000_000); // stays put — never moves backward
  });

  it('closes the rollback dupe exploit: a rollback then a forward jump only rewards the real gap', () => {
    const s0 = activeFarm(1_000_000);
    const rolled = applyElapsed(s0, 500_000); // rollback: barn 0, lastSeen stays 1_000_000
    expect(rolled.storage.barn.gold).toBe(0);
    expect(rolled.meta.lastSeen).toBe(1_000_000);
    const forward = applyElapsed(rolled, 1_000_000 + 200_000); // +200s from the real lastSeen
    expect(forward.storage.barn.gold).toBeCloseTo(13, 5); // ~200s * 0.065, NOT a windfall
    expect(forward.meta.lastSeen).toBe(1_000_000 + 200_000);
  });

  it('a week away is absorbed by the barn cap, not overflowed', () => {
    const s0 = activeFarm(0);
    const week = 7 * 24 * 3600 * 1000;
    const s1 = applyElapsed(s0, week);
    // Cap is sampled at accrual time (window-start, pre-drip): accrueBarn fills to s0's cap
    // before drip-last leveling raises the villager's boost, so the end-state cap is higher.
    expect(s1.storage.barn.gold).toBe(barnCap(s0).gold);
  });

  it('does not mutate its input (immutability)', () => {
    const s0 = activeFarm(1_000);
    const before = s0.meta.lastSeen;
    const result = applyElapsed(s0, 1_000 + 200_000);
    expect(s0.meta.lastSeen).toBe(before); // input untouched
    expect(s0.storage.barn.gold).toBe(0);
    expect(result).not.toBe(s0);
  });

  it('applyElapsed drips XP to assigned villagers', () => {
    const s0 = activeFarm(1_000); // assigns vil-1 to farm
    const s1 = applyElapsed(s0, 1_000 + 100_000); // +100s
    expect(s1.villagers.find((v) => v.id === 'vil-1')!.xp).toBeGreaterThan(0);
  });
});

describe('applyElapsed (forest)', () => {
  it('fills the satchel and drips forager XP over the wall-clock gap', () => {
    let s = createInitialState(1_000);
    s = assignCreature(s, 'cr-fernling', 'forage'); // acorn 0.05/s
    const next = applyElapsed(s, 1_000 + 200_000);  // +200s
    expect(next.storage.satchel.acorn).toBeCloseTo(10, 5); // 0.05 * 200
    const fern = next.creatures.find((c) => c.id === 'cr-fernling')!;
    expect(fern.xp).toBeCloseTo(0.02 * 200, 5); // 4 xp
    expect(next.meta.lastSeen).toBe(1_000 + 200_000);
  });

  it('leaves dungeon runs to be collected later (no auto-collect)', () => {
    let s = createInitialState(0);
    s = { ...s, dungeons: s.dungeons.map((d) => d.id === 'hollow'
      ? { ...d, activeRun: { creatureIds: ['cr-fernling'], startedAt: 0 } } : d) };
    const next = applyElapsed(s, 10 * 3600 * 1000); // long after it would be ready
    expect(next.dungeons.find((d) => d.id === 'hollow')!.activeRun).not.toBeNull();
    expect(next.resources.gold).toBe(0); // nothing paid until collectRun
  });
});

describe('applyElapsed marigold drain', () => {
  it('drains fish for planted marigolds across an offline gap', () => {
    const base = createInitialState(0);
    const s = {
      ...base,
      unlockedCrops: ['wheat', 'marigold'],
      plots: [...base.plots, { id: 'm-0', crop: 'marigold' as const }],
      resources: { ...base.resources, fish: 100 },
      meta: { lastSeen: 0 },
    };
    const after = applyElapsed(s, 100_000); // 100s elapsed → 0.02 * 100 = 2 fish drained
    expect(after.resources.fish).toBeCloseTo(100 - MARIGOLD_FISH_PER_SEC * 100, 3);
  });
});
