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
    expect(s.meta.version).toBe(1);
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
});
