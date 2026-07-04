import { describe, it, expect } from 'vitest';
import { createInitialState, barnCap } from '../../src/engine';

describe('createInitialState', () => {
  it('starts with three empty plots, three villagers, an empty barn, wheat unlocked, and starter gold', () => {
    const s = createInitialState(1000);
    expect(s.plots).toHaveLength(3);
    expect(s.plots.every((p) => p.crop === null)).toBe(true);
    expect(s.villagers).toHaveLength(3);
    expect(s.villagers.every((v) => v.assignedTo === null)).toBe(true);
    expect(s.storage.barn).toEqual({ gold: 0, wood: 0, acorns: 0 });
    expect(s.unlockedCrops).toEqual(['wheat']);
    expect(s.resources.gold).toBeGreaterThanOrEqual(0);
    expect(s.meta.lastSeen).toBe(1000);
  });
});

import { farmRatesPerSec, plantCrop, assignVillager } from '../../src/engine';

describe('farmRatesPerSec', () => {
  it('is all-zero with no villager assigned even if crops are planted', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    expect(farmRatesPerSec(s)).toEqual({ gold: 0, wood: 0, acorns: 0 });
  });

  it('routes each producer crop to its own resource bucket', () => {
    let s = createInitialState(0);
    s = { ...s, unlockedCrops: ['wheat', 'carrot', 'sapling'] };
    s = plantCrop(s, 'plot-1', 'wheat');   // gold 5/100 = 0.05
    s = plantCrop(s, 'plot-2', 'carrot');  // acorns 6/180 = 0.0333
    s = plantCrop(s, 'plot-3', 'sapling'); // wood 6/180 = 0.0333
    s = assignVillager(s, 'vil-1', 'farm');
    const r = farmRatesPerSec(s);
    expect(r.gold).toBeCloseTo(0.05, 5);
    expect(r.acorns).toBeCloseTo(6 / 180, 5);
    expect(r.wood).toBeCloseTo(6 / 180, 5);
  });

  it('a planted modifier crop (marigold) contributes no rate and no NaN', () => {
    let s = createInitialState(0);
    s = { ...s, unlockedCrops: ['wheat', 'marigold'] };
    s = plantCrop(s, 'plot-1', 'marigold');
    s = assignVillager(s, 'vil-1', 'farm');
    const r = farmRatesPerSec(s);
    expect(r).toEqual({ gold: 0, wood: 0, acorns: 0 });
    expect(Number.isNaN(r.gold + r.wood + r.acorns)).toBe(false);
  });

  it('gives +25% per extra assigned villager', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');   // base 0.05/s gold
    s = assignVillager(s, 'vil-1', 'farm');
    s = assignVillager(s, 'vil-2', 'farm'); // x1.25
    expect(farmRatesPerSec(s).gold).toBeCloseTo(0.0625, 5);
  });
});

describe('plantCrop / assignVillager', () => {
  it('plantCrop is immutable and sets the plot crop', () => {
    const s0 = { ...createInitialState(0), unlockedCrops: ['wheat', 'carrot'] };
    const s1 = plantCrop(s0, 'plot-2', 'carrot');
    expect(s0.plots.find((p) => p.id === 'plot-2')!.crop).toBeNull();
    expect(s1.plots.find((p) => p.id === 'plot-2')!.crop).toBe('carrot');
  });

  it('plantCrop rejects a crop that is not unlocked', () => {
    const s0 = createInitialState(0); // only wheat unlocked
    const s1 = plantCrop(s0, 'plot-1', 'carrot');
    expect(s1).toBe(s0); // unchanged
  });

  it('assignVillager sets and clears assignment', () => {
    let s = assignVillager(createInitialState(0), 'vil-1', 'farm');
    expect(s.villagers.find((v) => v.id === 'vil-1')!.assignedTo).toBe('farm');
    s = assignVillager(s, 'vil-1', null);
    expect(s.villagers.find((v) => v.id === 'vil-1')!.assignedTo).toBeNull();
  });

  it('assignVillager is immutable — leaves the input untouched', () => {
    const s0 = createInitialState(0);
    const s1 = assignVillager(s0, 'vil-1', 'farm');
    expect(s0.villagers.find((v) => v.id === 'vil-1')!.assignedTo).toBeNull();
    expect(s1).not.toBe(s0);
  });
});

import { accrueBarn, collectBarn } from '../../src/engine';

describe('accrueBarn', () => {
  it('adds rate * elapsed to the matching bucket', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat'); // 0.05 gold/s
    s = assignVillager(s, 'vil-1', 'farm');
    s = accrueBarn(s, 200);              // 0.05 * 200 = 10 gold
    expect(s.storage.barn.gold).toBeCloseTo(10, 5);
    expect(s.storage.barn.wood).toBe(0);
  });

  it('never exceeds the per-resource cap', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    s = assignVillager(s, 'vil-1', 'farm');
    s = accrueBarn(s, 10_000_000);
    expect(s.storage.barn.gold).toBe(barnCap(s).gold);
  });

  it('does nothing when elapsed is zero or negative', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    s = assignVillager(s, 'vil-1', 'farm');
    expect(accrueBarn(s, 0).storage.barn.gold).toBe(0);
    expect(accrueBarn(s, -50).storage.barn.gold).toBe(0);
  });

  it('is immutable — leaves the input barn untouched', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    s = assignVillager(s, 'vil-1', 'farm');
    const result = accrueBarn(s, 200);
    expect(s.storage.barn.gold).toBe(0);
    expect(result).not.toBe(s);
    expect(result.storage.barn.gold).toBeCloseTo(10, 5);
  });
});

describe('collectBarn', () => {
  it('moves each whole bucket into its resource and empties the buckets', () => {
    let s = createInitialState(0);
    s = { ...s, storage: { ...s.storage, barn: { gold: 42, wood: 3, acorns: 7 } } };
    s = collectBarn(s);
    expect(s.resources.gold).toBe(42);
    expect(s.resources.wood).toBe(3);
    expect(s.resources.acorns).toBe(7);
    expect(s.storage.barn).toEqual({ gold: 0, wood: 0, acorns: 0 });
  });

  it('banks whole units and carries the fractional remainder per bucket', () => {
    let s = createInitialState(0);
    s = { ...s, storage: { ...s.storage, barn: { gold: 42.7, wood: 0, acorns: 1.2 } } };
    s = collectBarn(s);
    expect(s.resources.gold).toBe(42);
    expect(s.resources.acorns).toBe(1);
    expect(s.storage.barn.gold).toBeCloseTo(0.7, 5);
    expect(s.storage.barn.acorns).toBeCloseTo(0.2, 5);
  });
});
