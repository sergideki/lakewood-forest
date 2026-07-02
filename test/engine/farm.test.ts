import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/engine';

describe('createInitialState', () => {
  it('starts with three empty plots, three villagers, an empty capped barn, and starter gold', () => {
    const s = createInitialState(1000);
    expect(s.plots).toHaveLength(3);
    expect(s.plots.every((p) => p.crop === null)).toBe(true);
    expect(s.villagers).toHaveLength(3);
    expect(s.villagers.every((v) => v.assignedTo === null)).toBe(true);
    expect(s.storage.barn.amount).toBe(0);
    expect(s.storage.barn.cap).toBeGreaterThan(0);
    expect(s.resources.gold).toBeGreaterThanOrEqual(0);
    expect(s.meta.lastSeen).toBe(1000);
  });
});

import { farmRatePerSec, plantCrop, assignVillager } from '../../src/engine';

describe('farmRatePerSec', () => {
  it('is zero with no villager assigned to the farm even if crops are planted', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    expect(farmRatePerSec(s)).toBe(0);
  });

  it('equals summed planted-crop yield-per-second when one villager tends the farm', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');   // 5 gold / 100s = 0.05/s
    s = assignVillager(s, 'vil-1', 'farm');
    expect(farmRatePerSec(s)).toBeCloseTo(0.05, 5);
  });

  it('gives +25% per extra assigned villager', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');   // base 0.05/s
    s = assignVillager(s, 'vil-1', 'farm');
    s = assignVillager(s, 'vil-2', 'farm'); // x1.25
    expect(farmRatePerSec(s)).toBeCloseTo(0.0625, 5);
  });
});

describe('plantCrop / assignVillager', () => {
  it('plantCrop is immutable and sets the plot crop', () => {
    const s0 = createInitialState(0);
    const s1 = plantCrop(s0, 'plot-2', 'carrot');
    expect(s0.plots.find((p) => p.id === 'plot-2')!.crop).toBeNull();
    expect(s1.plots.find((p) => p.id === 'plot-2')!.crop).toBe('carrot');
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
  it('adds rate * elapsed to the barn', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');   // 0.05/s
    s = assignVillager(s, 'vil-1', 'farm');
    s = accrueBarn(s, 200);                 // 0.05 * 200 = 10
    expect(s.storage.barn.amount).toBeCloseTo(10, 5);
  });

  it('never exceeds the cap', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    s = assignVillager(s, 'vil-1', 'farm');
    s = accrueBarn(s, 10_000_000);          // would be huge
    expect(s.storage.barn.amount).toBe(s.storage.barn.cap);
  });

  it('does nothing when elapsed is zero or negative', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    s = assignVillager(s, 'vil-1', 'farm');
    expect(accrueBarn(s, 0).storage.barn.amount).toBe(0);
    expect(accrueBarn(s, -50).storage.barn.amount).toBe(0);
  });

  it('is immutable — leaves the input barn untouched', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    s = assignVillager(s, 'vil-1', 'farm');
    const result = accrueBarn(s, 200);
    expect(s.storage.barn.amount).toBe(0); // input untouched
    expect(result).not.toBe(s);
    expect(result.storage.barn.amount).toBeCloseTo(10, 5);
  });
});

describe('collectBarn', () => {
  it('moves the whole barn into gold and empties the barn', () => {
    let s = createInitialState(0);
    s.storage.barn.amount = 42;
    s = collectBarn(s);
    expect(s.resources.gold).toBe(42);
    expect(s.storage.barn.amount).toBe(0);
  });

  it('banks the whole-gold part and carries the fractional remainder in the barn', () => {
    let s = createInitialState(0);
    s.storage.barn.amount = 42.7;
    s = collectBarn(s);
    expect(s.resources.gold).toBe(42);
    expect(s.storage.barn.amount).toBeCloseTo(0.7, 5); // remainder kept, not discarded
  });
});
