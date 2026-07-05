import type { GameState } from '../engine/types';
import { isRunReady } from '../engine/forest';
import { habitatStatus } from '../engine/lake';

export const AWAY_MIN_SEC = 60;

export interface AwayReport {
  elapsedSec: number;
  barn: { gold: number; wood: number; acorns: number };
  satchel: { wood: number; acorn: number };
  creel: { fish: number };
  marigoldFishDrained: number;
  readyDungeons: string[];
  readyHabitats: string[];
}

const pos = (x: number): number => (x > 0 ? x : 0);

/** Diff the load-time applyElapsed gap into a cozy summary. Returns null when the gap is under
 *  AWAY_MIN_SEC or nothing meaningful happened. elapsedSec is measured from BEFORE.meta.lastSeen
 *  (applyElapsed advances after.meta.lastSeen to `now`, so it must NOT be the source). */
export function computeAwayReport(before: GameState, after: GameState, now: number): AwayReport | null {
  const elapsedSec = Math.max(0, (now - before.meta.lastSeen) / 1000);
  if (elapsedSec < AWAY_MIN_SEC) return null;

  const barn = {
    gold: pos(after.storage.barn.gold - before.storage.barn.gold),
    wood: pos(after.storage.barn.wood - before.storage.barn.wood),
    acorns: pos(after.storage.barn.acorns - before.storage.barn.acorns),
  };
  const satchel = {
    wood: pos(after.storage.satchel.wood - before.storage.satchel.wood),
    acorn: pos(after.storage.satchel.acorn - before.storage.satchel.acorn),
  };
  const creel = { fish: pos(after.storage.creel.fish - before.storage.creel.fish) };
  const marigoldFishDrained = pos(before.resources.fish - after.resources.fish);

  // A run is "newly ready" iff it was NOT ready at before's own lastSeen and IS ready now.
  const wasLast = before.meta.lastSeen;
  const readyDungeons = after.dungeons
    .filter((d) => !isRunReady(before, d.id, wasLast) && isRunReady(after, d.id, now))
    .map((d) => d.id);
  const readyHabitats = after.habitats
    .filter((h) => habitatStatus(before, h.id, wasLast) !== 'ready' && habitatStatus(after, h.id, now) === 'ready')
    .map((h) => h.id);

  // Gate on the FLOORED totals the UI actually renders (barn+satchel folded per resource, each
  // floored), so a sub-1 float gain never yields a non-null report that displays an empty card.
  const flooredGains =
    Math.floor(barn.gold) +
    Math.floor(barn.wood + satchel.wood) +
    Math.floor(barn.acorns + satchel.acorn) +
    Math.floor(creel.fish) +
    Math.floor(marigoldFishDrained);
  const anything = flooredGains > 0 || readyDungeons.length > 0 || readyHabitats.length > 0;
  if (!anything) return null;

  return { elapsedSec, barn, satchel, creel, marigoldFishDrained, readyDungeons, readyHabitats };
}
