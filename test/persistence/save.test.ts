import { describe, it, expect } from 'vitest';
import { createInitialState, plantCrop, SPECIES } from '../../src/engine';
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

describe('v1 -> v2 migration', () => {
  it('adds forest fields to a Plan-1 save without throwing', () => {
    // A Plan-1 (v1) envelope: gold-only resources, barn-only storage, no forest fields.
    const v1Envelope = JSON.stringify({
      version: 1,
      state: {
        resources: { gold: 123 },
        plots: [{ id: 'plot-1', crop: 'wheat' }],
        villagers: [{ id: 'vil-1', name: 'Pip', emoji: '🧑‍🌾', assignedTo: 'farm' }],
        storage: { barn: { amount: 40 } },
        meta: { lastSeen: 5000 },
      },
    });
    const s = deserialize(v1Envelope);
    expect(s.resources.gold).toBe(123);          // preserved
    expect(s.resources.wood).toBe(0);            // added
    expect(s.resources.acorns).toBe(0);
    expect(s.storage.barn.amount).toBe(40);      // preserved
    expect(s.storage.satchel).toEqual({ wood: 0, acorn: 0 });
    expect(s.creatures.map((c) => c.species).sort()).toEqual(['fernling', 'pebblepup']);
    expect(s.dungeons.map((d) => d.id)).toEqual(['hollow', 'grove', 'deep']);
    expect(s.discovered.sort()).toEqual(['fernling', 'pebblepup']);
  });

  it('leaves a current v2 save untouched', () => {
    const v2 = serialize(plantCrop(createInitialState(1), 'plot-1', 'berry'));
    expect(JSON.parse(v2).version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBe(2);
    const restored = deserialize(v2);
    expect(restored.creatures).toHaveLength(2);
    expect(Object.keys(SPECIES).length).toBeGreaterThanOrEqual(10);
  });
});
