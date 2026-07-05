import type { GameState } from './types';
import { accrueBarn } from './farm';
import { accrueSatchel } from './forest';
import { dripForagerXp } from './creatures';
import { accrueCreel, accrueMarigold } from './lake';
import { dripVillagerXp } from './villagers';

/**
 * Apply all offline progress between state.meta.lastSeen and `now` (epoch ms).
 * Pure + clock-safe: negative gaps clamp to zero. Dungeon runs are NOT auto-collected here —
 * they simply become ready and are collected by an explicit user action. Extend here as new
 * job types land.
 */
export function applyElapsed(state: GameState, now: number): GameState {
  const elapsedSec = Math.max(0, (now - state.meta.lastSeen) / 1000);
  let next = accrueBarn(state, elapsedSec);
  next = accrueSatchel(next, elapsedSec);
  next = accrueCreel(next, elapsedSec);
  next = accrueMarigold(next, elapsedSec);
  next = dripForagerXp(next, elapsedSec);
  next = dripVillagerXp(next, elapsedSec);
  // Never let lastSeen move backward: a clock rollback (DST/NTP shift, manual clock
  // change) must not create a huge forward gap on the next call — a repeatable dupe.
  const lastSeen = Math.max(now, state.meta.lastSeen);
  next = { ...next, meta: { ...next.meta, lastSeen } };
  return next;
}
