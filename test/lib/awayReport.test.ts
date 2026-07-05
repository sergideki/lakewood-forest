import { describe, it, expect } from 'vitest';
import { createInitialState, applyElapsed, creelCap } from '../../src/engine';
import { computeAwayReport, AWAY_MIN_SEC } from '../../src/lib/awayReport';
import type { GameState } from '../../src/engine/types';

/** A state with one farm villager + a wheat plot so applyElapsed accrues gold in the barn. */
function producing(lastSeen: number): GameState {
  const base = createInitialState(lastSeen);
  return {
    ...base,
    unlockedCrops: ['wheat'],
    villagers: base.villagers.map((v) => (v.id === 'vil-1' ? { ...v, assignedTo: 'farm' } : v)),
    plots: base.plots.map((p) => (p.id === 'plot-1' ? { ...p, crop: 'wheat' } : p)),
  };
}

describe('computeAwayReport', () => {
  it('returns null below the minimum away threshold', () => {
    const before = producing(0);
    const after = applyElapsed(before, (AWAY_MIN_SEC - 1) * 1000);
    expect(computeAwayReport(before, after, (AWAY_MIN_SEC - 1) * 1000)).toBeNull();
  });

  it('reports barn gains after a real gap', () => {
    const before = producing(0);
    const now = 3600 * 1000; // 1 hour
    const after = applyElapsed(before, now);
    const r = computeAwayReport(before, after, now);
    expect(r).not.toBeNull();
    expect(r!.elapsedSec).toBeCloseTo(3600, 5);
    expect(r!.barn.gold).toBeGreaterThan(0);
  });

  it('elapsedSec uses BEFORE.meta.lastSeen, not after (which applyElapsed advances to now)', () => {
    const before = producing(1000);
    const now = 1000 + 3600 * 1000;
    const after = applyElapsed(before, now);
    // after.meta.lastSeen === now; if the impl used it, elapsed would be 0.
    expect(computeAwayReport(before, after, now)!.elapsedSec).toBeCloseTo(3600, 5);
  });

  it('reports marigold fish drain as a positive number', () => {
    const base = createInitialState(0);
    const before: GameState = {
      ...base,
      plots: [{ id: 'plot-1', crop: 'marigold' }],
      resources: { ...base.resources, fish: 100 },
    };
    const now = 3600 * 1000;
    const after = applyElapsed(before, now);
    const r = computeAwayReport(before, after, now)!;
    expect(r.marigoldFishDrained).toBeGreaterThan(0);
    expect(r.marigoldFishDrained).toBeCloseTo(before.resources.fish - after.resources.fish, 5);
  });

  it('returns null when nothing changed and no run is newly ready', () => {
    const base = createInitialState(0); // no villager assigned → no farm/forage production
    // BASE_ROD_RATE is a flat passive fish rate that never zeroes out, so a truly no-op gap
    // requires the creel already at cap (clamped fill = 0 gain) rather than a bare initial state.
    const before: GameState = { ...base, storage: { ...base.storage, creel: { fish: creelCap(base) } } };
    const now = 3600 * 1000;
    const after = applyElapsed(before, now);
    expect(computeAwayReport(before, after, now)).toBeNull();
  });
});
