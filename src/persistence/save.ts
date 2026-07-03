import type { GameState } from '../engine/types';
import { createInitialState, makeCreature } from '../engine';
import { DUNGEONS, STARTER_SPECIES, HABITATS } from '../engine/content';

export const SAVE_VERSION = 4;

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

/** Validates the fields common to every version. Forest fields are backfilled by migrate(). */
function isValidBaseState(state: unknown): state is GameState {
  if (!state || typeof state !== 'object') return false;
  const s = state as Record<string, unknown>;
  if (!Array.isArray(s.plots) || !Array.isArray(s.villagers)) return false;
  if (!s.resources || typeof s.resources !== 'object') return false;
  if (!s.meta || typeof s.meta !== 'object') return false;
  const storage = s.storage as { barn?: { amount?: unknown } } | undefined;
  if (!storage || typeof storage !== 'object') return false;
  if (!storage.barn || typeof storage.barn !== 'object') return false;
  if (typeof storage.barn.amount !== 'number') return false;
  return true;
}

/** Additive migrations. v1 (farm) -> v2 (forest) -> v3 (town) -> v4 (lake). Idempotent. */
function migrate(fromVersion: number, state: GameState): GameState {
  let s = state;
  if (fromVersion < 2) s = addForestFields(s);
  if (fromVersion < 3) s = { ...s, upgrades: s.upgrades ?? {} };
  if (fromVersion < 4) s = addLakeFields(s);
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
