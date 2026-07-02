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

/** Never throws — a corrupt/absent/old blob yields a fresh state so the app always boots. */
export function deserialize(json: string | null): GameState {
  if (!json) return createInitialState(Date.now());
  try {
    const parsed = JSON.parse(json) as Partial<SaveEnvelope>;
    if (!parsed || typeof parsed.version !== 'number' || !parsed.state) {
      return createInitialState(Date.now());
    }
    return migrate(parsed.version, parsed.state);
  } catch {
    return createInitialState(Date.now());
  }
}

/** Version migrations go here as the schema evolves. v1 is the baseline. */
function migrate(fromVersion: number, state: GameState): GameState {
  // No migrations yet; v1 state is returned as-is.
  return state;
}
