import type { GameState } from '../engine/types';
import { createInitialState } from '../engine';

export const SAVE_VERSION = 1;

interface SaveEnvelope {
  version: number;
  state: GameState;
}

export function serialize(state: GameState): string {
  const envelope: SaveEnvelope = { version: SAVE_VERSION, state };
  return JSON.stringify(envelope);
}

/** Never throws — a corrupt/absent/old/malformed blob yields a fresh state so the app always boots. */
export function deserialize(json: string | null): GameState {
  if (!json) return createInitialState(Date.now());
  try {
    const parsed = JSON.parse(json) as Partial<SaveEnvelope>;
    if (!parsed || typeof parsed.version !== 'number' || !parsed.state) {
      return createInitialState(Date.now());
    }
    if (!isValidState(parsed.state)) {
      return createInitialState(Date.now());
    }
    return parsed.state;
  } catch {
    return createInitialState(Date.now());
  }
}

/** Structural guard: valid JSON with the wrong shape must not reach the engine and crash it. */
function isValidState(state: unknown): state is GameState {
  if (!state || typeof state !== 'object') return false;
  const s = state as Record<string, unknown>;
  if (!Array.isArray(s.plots) || !Array.isArray(s.villagers)) return false;
  if (!s.resources || typeof s.resources !== 'object') return false;
  if (!s.meta || typeof s.meta !== 'object') return false;
  const storage = s.storage as { barn?: unknown } | undefined;
  if (!storage || typeof storage !== 'object') return false;
  const barn = storage.barn as { amount?: unknown; cap?: unknown } | undefined;
  if (!barn || typeof barn !== 'object') return false;
  if (typeof barn.amount !== 'number' || typeof barn.cap !== 'number') return false;
  return true;
}
