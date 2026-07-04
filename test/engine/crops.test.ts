import { describe, it, expect } from 'vitest';
import { createInitialState, unlockCrop, plantCrop } from '../../src/engine';

const rich = (over: Partial<ReturnType<typeof createInitialState>['resources']> = {}) => ({
  ...createInitialState(0),
  resources: { gold: 1000, wood: 1000, acorns: 1000, fish: 1000, ...over },
});

describe('unlockCrop', () => {
  it('unlocks an affordable crop and spends its cost', () => {
    const s = unlockCrop(rich(), 'carrot'); // costs 50 gold
    expect(s.unlockedCrops).toContain('carrot');
    expect(s.resources.gold).toBe(950);
  });

  it('checks ALL resources including fish (marigold costs 150 gold + 40 fish)', () => {
    const broke = rich({ fish: 10 }); // enough gold, not enough fish
    const s = unlockCrop(broke, 'marigold');
    expect(s).toBe(broke); // no-op: cannot afford fish
    expect(s.unlockedCrops).not.toContain('marigold');
  });

  it('spends fish when affordable', () => {
    const s = unlockCrop(rich(), 'marigold');
    expect(s.unlockedCrops).toContain('marigold');
    expect(s.resources.gold).toBe(850);
    expect(s.resources.fish).toBe(960);
  });

  it('is idempotent — already unlocked returns state unchanged', () => {
    const once = unlockCrop(rich(), 'carrot');
    const twice = unlockCrop(once, 'carrot');
    expect(twice).toBe(once);
  });

  it('an unknown crop id is a no-op', () => {
    const s = rich();
    expect(unlockCrop(s, 'nope')).toBe(s);
  });

  it('a crop unlocked via unlockCrop becomes plantable', () => {
    const s = unlockCrop(rich(), 'sapling');
    const planted = plantCrop(s, 'plot-1', 'sapling');
    expect(planted.plots.find((p) => p.id === 'plot-1')!.crop).toBe('sapling');
  });
});
