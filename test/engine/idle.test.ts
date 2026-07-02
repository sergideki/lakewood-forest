import { describe, it, expect } from 'vitest';
import { createInitialState, plantCrop, assignVillager, applyElapsed } from '../../src/engine';

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
    expect(s1.storage.barn.amount).toBeCloseTo(10, 5); // 0.05 * 200
    expect(s1.meta.lastSeen).toBe(1_000 + 200_000);
  });

  it('clamps negative elapsed (clock rollback) to zero — no reward, lastSeen still updates', () => {
    const s0 = activeFarm(1_000_000);
    const s1 = applyElapsed(s0, 500_000); // "now" earlier than lastSeen
    expect(s1.storage.barn.amount).toBe(0);
    expect(s1.meta.lastSeen).toBe(500_000);
  });

  it('a week away is absorbed by the barn cap, not overflowed', () => {
    const s0 = activeFarm(0);
    const week = 7 * 24 * 3600 * 1000;
    const s1 = applyElapsed(s0, week);
    expect(s1.storage.barn.amount).toBe(s1.storage.barn.cap);
  });
});
