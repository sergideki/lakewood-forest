import type { GameState } from '../engine/types';
import { createInitialState, makeCreature } from '../engine';
import { DUNGEONS, STARTER_SPECIES, HABITATS, CROP_IDS, STARTER_CROPS, SPECIALTY_BY_ID } from '../engine/content';

export const SAVE_VERSION = 7;

interface SaveEnvelope {
  version: number;
  state: GameState;
}

export function serialize(state: GameState): string {
  const envelope: SaveEnvelope = { version: SAVE_VERSION, state };
  return JSON.stringify(envelope);
}

/** Never throws — a corrupt/absent/malformed blob yields a fresh state so the app always boots. */
export function deserialize(json: string | null): GameState {
  if (!json) return createInitialState(Date.now());
  try {
    const parsed = JSON.parse(json) as Partial<SaveEnvelope>;
    if (!parsed || typeof parsed.version !== 'number' || !parsed.state) {
      return createInitialState(Date.now());
    }
    if (!isValidBaseState(parsed.state)) {
      return createInitialState(Date.now());
    }
    return migrate(parsed.version, parsed.state);
  } catch {
    return createInitialState(Date.now());
  }
}

/**
 * Strict parse for user-supplied import blobs: returns a migrated GameState, or null when the
 * input is not a real save (bad JSON, missing envelope, failed base validation). Unlike
 * deserialize, it never falls back to a fresh state — so a failed Import leaves the save untouched.
 */
export function tryDeserialize(json: string): GameState | null {
  try {
    const parsed = JSON.parse(json) as Partial<SaveEnvelope>;
    if (!parsed || typeof parsed.version !== 'number' || !parsed.state) return null;
    if (!isValidBaseState(parsed.state)) return null;
    return migrate(parsed.version, parsed.state);
  } catch {
    return null;
  }
}

/** Validates fields common to every version. Runs PRE-migration, so it must accept old shapes:
 *  a v4 save has storage.barn = {amount}; do NOT assert the new bucket shape or unlockedCrops
 *  (migrate() backfills those). Asserting the new shape here would fail every real v4 save and
 *  silently wipe it. */
function isValidBaseState(state: unknown): state is GameState {
  if (!state || typeof state !== 'object') return false;
  const s = state as Record<string, unknown>;
  if (!Array.isArray(s.plots) || !Array.isArray(s.villagers)) return false;
  if (!s.resources || typeof s.resources !== 'object') return false;
  if (!s.meta || typeof s.meta !== 'object') return false;
  const storage = s.storage as { barn?: unknown } | undefined;
  if (!storage || typeof storage !== 'object') return false;
  if (!storage.barn || typeof storage.barn !== 'object') return false; // shape checked by migrate
  return true;
}

/** Additive migrations. v1(farm)->v2(forest)->v3(town)->v4(lake)->v5(crops)->v6(lifetime). Idempotent. */
function migrate(fromVersion: number, state: GameState): GameState {
  let s = state;
  if (fromVersion < 2) s = addForestFields(s);
  if (fromVersion < 3) s = { ...s, upgrades: s.upgrades ?? {} };
  if (fromVersion < 4) s = addLakeFields(s);
  if (fromVersion < 5) s = addCropRework(s);
  // Always run (not version-gated): per-field ?? makes it idempotent, and a same-version (v6)
  // blob with a partial lifetime object (e.g. a hand-edited import) still needs backfilling.
  s = addLifetimeCounters(s);
  s = addVillagerDepth(s);   // unconditional, per-field ?? — same discipline as addLifetimeCounters
  return s;
}

function addForestFields(old: GameState): GameState {
  const r = old.resources as Partial<GameState['resources']>;
  return {
    ...old,
    resources: { gold: r.gold ?? 0, wood: r.wood ?? 0, acorns: r.acorns ?? 0, fish: r.fish ?? 0 },
    storage: {
      barn: old.storage.barn,
      satchel: old.storage.satchel ?? { wood: 0, acorn: 0 },
      creel: old.storage.creel ?? { fish: 0 },
    },
    creatures: old.creatures ?? STARTER_SPECIES.map(makeCreature),
    dungeons: old.dungeons ?? DUNGEONS.map((d) => ({ id: d.id, activeRun: null })),
    discovered: old.discovered ?? [...STARTER_SPECIES],
  };
}

function addLakeFields(old: GameState): GameState {
  return {
    ...old,
    resources: { ...old.resources, fish: old.resources.fish ?? 0 },
    storage: { ...old.storage, creel: old.storage.creel ?? { fish: 0 } },
    habitats: old.habitats ?? HABITATS.map((h) => ({ id: h.id, builtAt: null })),
    pets: old.pets ?? [],
  };
}

/** v4->v5: barn {amount} -> {gold,wood,acorns}; seed unlockedCrops; clear removed crop ids. */
function addCropRework(old: GameState): GameState {
  const oldBarn = old.storage.barn as unknown as { amount?: number; gold?: number; wood?: number; acorns?: number };
  const barn = typeof oldBarn.amount === 'number'
    ? { gold: oldBarn.amount, wood: 0, acorns: 0 }                 // old shape → gold bucket
    : { gold: oldBarn.gold ?? 0, wood: oldBarn.wood ?? 0, acorns: oldBarn.acorns ?? 0 }; // already migrated

  const validId = (id: string | null): id is string => id !== null && CROP_IDS.includes(id);
  // Clear any plot holding a crop id that no longer exists in the roster.
  const plots = old.plots.map((p) => (validId(p.crop) ? p : { ...p, crop: null }));
  // Seed unlockedCrops with wheat + any still-valid planted crop (so planted crops stay usable).
  const seeded = old.unlockedCrops ?? [...STARTER_CROPS];
  const fromPlots = plots.map((p) => p.crop).filter(validId);
  const unlockedCrops = Array.from(new Set([...seeded, ...STARTER_CROPS, ...fromPlots]));

  return { ...old, storage: { ...old.storage, barn }, plots, unlockedCrops };
}

/** v5->v6: backfill cumulative lifetime counters. Per-field ?? so a partial import blob
 *  ({lifetime:{gold:5}}) can't leave an undefined key that a later bump turns into NaN. */
function addLifetimeCounters(old: GameState): GameState {
  const l = old.lifetime as Partial<GameState['lifetime']> | undefined;
  return {
    ...old,
    lifetime: {
      gold: l?.gold ?? 0,
      wood: l?.wood ?? 0,
      acorns: l?.acorns ?? 0,
      fish: l?.fish ?? 0,
    },
  };
}

/** v6->v7: villagers gain specialty/level/xp. Per-field ?? (never whole-object) so a partial blob
 *  can't leave undefined fields that villagerBoost turns into NaN. Runs unconditionally (idempotent). */
function addVillagerDepth(old: GameState): GameState {
  return {
    ...old,
    villagers: old.villagers.map((v) => {
      const w = v as Partial<GameState['villagers'][number]>;
      return {
        ...v,
        specialty: w.specialty ?? SPECIALTY_BY_ID[v.id] ?? 'farm',
        level: w.level ?? 1,
        xp: w.xp ?? 0,
      };
    }),
  };
}
