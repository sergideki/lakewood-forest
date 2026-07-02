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
