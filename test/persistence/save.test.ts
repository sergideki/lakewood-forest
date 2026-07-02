import { describe, it, expect } from 'vitest';
import { createInitialState, plantCrop } from '../../src/engine';
import { serialize, deserialize, SAVE_VERSION } from '../../src/persistence/save';

describe('serialize / deserialize', () => {
  it('round-trips a game state', () => {
    const s0 = plantCrop(createInitialState(1234), 'plot-1', 'berry');
    const restored = deserialize(serialize(s0));
    expect(restored).toEqual(s0);
  });

  it('writes the current save version into the envelope', () => {
    const json = serialize(createInitialState(0));
    expect(JSON.parse(json).version).toBe(SAVE_VERSION);
  });

  it('returns a fresh state (not throwing) when the blob is corrupt', () => {
    const restored = deserialize('{ not valid json');
    expect(restored.plots).toHaveLength(3);
    expect(restored.storage.barn.amount).toBe(0);
  });

  it('returns a fresh state when the envelope is valid JSON but the state shape is wrong', () => {
    const restored = deserialize('{"version":1,"state":{}}');
    expect(restored.plots).toHaveLength(3);
    expect(restored.storage.barn.amount).toBe(0);
  });
});
