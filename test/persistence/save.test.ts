import { describe, it, expect } from 'vitest';
import { createInitialState, plantCrop, SPECIES, HABITATS } from '../../src/engine';
import { serialize, deserialize, tryDeserialize, SAVE_VERSION } from '../../src/persistence/save';

describe('v6 -> v7 villager depth migration', () => {
  it('seeds new-state starters with specialty/level/xp', () => {
    const s = createInitialState(0);
    expect(s.villagers.map((v) => v.specialty)).toEqual(['farm', 'forest', 'lake']);
    expect(s.villagers.every((v) => v.level === 1 && v.xp === 0)).toBe(true);
  });
  it('backfills a v6 villager (no specialty/level/xp) without wiping', () => {
    const v6 = { ...createInitialState(0) };
    (v6 as { villagers: unknown }).villagers = [
      { id: 'vil-1', name: 'Pip', emoji: '🧑‍🌾', assignedTo: 'farm' },
      { id: 'vil-2', name: 'Nan', emoji: '👵', assignedTo: null },
    ];
    const restored = deserialize(JSON.stringify({ version: 6, state: v6 }));
    expect(restored.villagers[0]).toMatchObject({ specialty: 'farm', level: 1, xp: 0, assignedTo: 'farm' });
    expect(restored.villagers[1].specialty).toBe('forest'); // by id
  });
});

describe('tryDeserialize (strict import)', () => {
  it('round-trips a real backup and migrates it', () => {
    const s = { ...createInitialState(0), resources: { gold: 7, wood: 0, acorns: 0, fish: 3 } };
    const restored = tryDeserialize(serialize(s));
    expect(restored?.resources.gold).toBe(7);
    expect(restored?.resources.fish).toBe(3);
  });
  it('returns null (never a fresh state) for junk, so a bad import cannot wipe the save', () => {
    expect(tryDeserialize('not json')).toBeNull();
    expect(tryDeserialize('{}')).toBeNull();
    expect(tryDeserialize(JSON.stringify({ version: 4 }))).toBeNull(); // no state
    expect(tryDeserialize(JSON.stringify({ version: 4, state: { nope: true } }))).toBeNull(); // fails base validation
  });
});

describe('serialize / deserialize', () => {
  it('round-trips a game state', () => {
    const base = createInitialState(1234);
    const s0 = plantCrop({ ...base, unlockedCrops: ['wheat', 'carrot'] }, 'plot-1', 'carrot');
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
    expect(restored.storage.barn).toEqual({ gold: 0, wood: 0, acorns: 0 });
  });

  it('returns a fresh state when the envelope is valid JSON but the state shape is wrong', () => {
    const restored = deserialize('{"version":1,"state":{}}');
    expect(restored.plots).toHaveLength(3);
    expect(restored.storage.barn).toEqual({ gold: 0, wood: 0, acorns: 0 });
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
    expect(s.storage.barn).toEqual({ gold: 40, wood: 0, acorns: 0 }); // amount preserved as gold bucket
    expect(s.storage.satchel).toEqual({ wood: 0, acorn: 0 });
    expect(s.creatures.map((c) => c.species).sort()).toEqual(['fernling', 'pebblepup']);
    expect(s.dungeons.map((d) => d.id)).toEqual(['hollow', 'grove', 'deep']);
    expect(s.discovered.sort()).toEqual(['fernling', 'pebblepup']);
  });

  it('leaves a current save untouched', () => {
    const v2 = serialize(createInitialState(1));
    expect(JSON.parse(v2).version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBe(8);
    const restored = deserialize(v2);
    expect(restored.creatures).toHaveLength(2);
    expect(Object.keys(SPECIES).length).toBeGreaterThanOrEqual(10);
  });
});

describe('v2 -> v3 migration', () => {
  it('backfills upgrades on a v2 (forest, pre-town) save', () => {
    const v2State = createInitialState(0) as unknown as Record<string, unknown>;
    delete v2State.upgrades; // simulate a save written before Plan 4
    const restored = deserialize(JSON.stringify({ version: 2, state: v2State }));
    expect(restored.upgrades).toEqual({});
  });

  it('chains v1 -> v3: forest fields AND upgrades are backfilled', () => {
    const v1Envelope = JSON.stringify({
      version: 1,
      state: {
        resources: { gold: 5 },
        plots: [{ id: 'plot-1', crop: null }],
        villagers: [],
        storage: { barn: { amount: 0 } },
        meta: { lastSeen: 0 },
      },
    });
    const s = deserialize(v1Envelope);
    expect(s.storage.satchel).toEqual({ wood: 0, acorn: 0 }); // v2 step still ran
    expect(s.upgrades).toEqual({});                            // v3 step ran
  });

  it('preserves owned upgrade levels on a current save', () => {
    const s0 = { ...createInitialState(0), upgrades: { 'barn-silo': 2 } };
    expect(deserialize(serialize(s0)).upgrades).toEqual({ 'barn-silo': 2 });
  });
});

describe('v3 -> v4 migration', () => {
  it('backfills fish, creel, habitats, pets on a v3 (pre-lake) save', () => {
    const base = createInitialState(0) as unknown as Record<string, unknown>;
    const v3State = {
      ...base,
      resources: { gold: 1, wood: 2, acorns: 3 },                          // no fish
      storage: { barn: { amount: 0 }, satchel: { wood: 0, acorn: 0 } },    // no creel
    } as Record<string, unknown>;
    delete v3State.habitats;
    delete v3State.pets;
    const restored = deserialize(JSON.stringify({ version: 3, state: v3State }));
    expect(restored.resources.fish).toBe(0);
    expect(restored.storage.creel).toEqual({ fish: 0 });
    expect(restored.habitats.length).toBe(HABITATS.length);
    expect(restored.habitats.every((h) => h.builtAt === null)).toBe(true);
    expect(restored.pets).toEqual([]);
  });

  it('chains v1 -> v4: forest, upgrades, AND lake fields all present', () => {
    const v1Envelope = JSON.stringify({
      version: 1,
      state: {
        resources: { gold: 5 },
        plots: [{ id: 'plot-1', crop: null }],
        villagers: [],
        storage: { barn: { amount: 0 } },
        meta: { lastSeen: 0 },
      },
    });
    const s = deserialize(v1Envelope);
    expect(s.storage.satchel).toEqual({ wood: 0, acorn: 0 }); // v2
    expect(s.upgrades).toEqual({});                            // v3
    expect(s.resources.fish).toBe(0);                          // v4
    expect(s.storage.creel).toEqual({ fish: 0 });             // v4
    expect(s.habitats.length).toBe(HABITATS.length);           // v4
    expect(s.pets).toEqual([]);                                // v4
  });

  it('preserves lake state on a current save (round-trip)', () => {
    const s0 = {
      ...createInitialState(0),
      resources: { gold: 0, wood: 0, acorns: 0, fish: 42 },
      pets: ['pondsnail'],
    };
    const round = deserialize(serialize(s0));
    expect(round.resources.fish).toBe(42);
    expect(round.pets).toEqual(['pondsnail']);
  });
});

describe('v4 -> v5 migration (crop rework)', () => {
  it('maps barn.amount to the gold bucket, seeds unlockedCrops, clears removed crop ids', () => {
    const v4Envelope = JSON.stringify({
      version: 4,
      state: {
        resources: { gold: 5, wood: 0, acorns: 0, fish: 2 },
        plots: [
          { id: 'plot-1', crop: 'berry' },  // removed id → cleared
          { id: 'plot-2', crop: 'wheat' },  // valid → kept + unlocked
          { id: 'plot-3', crop: null },
        ],
        villagers: [{ id: 'vil-1', name: 'Pip', emoji: '🧑‍🌾', assignedTo: 'farm' }],
        storage: { barn: { amount: 40 }, satchel: { wood: 0, acorn: 0 }, creel: { fish: 0 } },
        creatures: [], dungeons: [], discovered: [], upgrades: {}, habitats: [], pets: [],
        meta: { lastSeen: 9 },
      },
    });
    const s = deserialize(v4Envelope);
    expect(s.storage.barn).toEqual({ gold: 40, wood: 0, acorns: 0 });
    expect(s.plots.find((p) => p.id === 'plot-1')!.crop).toBeNull(); // berry cleared
    expect(s.plots.find((p) => p.id === 'plot-2')!.crop).toBe('wheat');
    expect(s.unlockedCrops).toContain('wheat');
    expect(s.unlockedCrops).not.toContain('berry');
  });

  it('a real v4 save survives BOTH deserialize and tryDeserialize (no silent wipe / no reject)', () => {
    const v4 = JSON.stringify({
      version: 4,
      state: {
        resources: { gold: 77, wood: 1, acorns: 2, fish: 3 },
        plots: [{ id: 'plot-1', crop: null }, { id: 'plot-2', crop: null }, { id: 'plot-3', crop: null }],
        villagers: [{ id: 'vil-1', name: 'Pip', emoji: '🧑‍🌾', assignedTo: null }],
        storage: { barn: { amount: 12 }, satchel: { wood: 0, acorn: 0 }, creel: { fish: 0 } },
        creatures: [], dungeons: [], discovered: [], upgrades: {}, habitats: [], pets: [],
        meta: { lastSeen: 0 },
      },
    });
    const viaLoad = deserialize(v4);
    expect(viaLoad.resources.gold).toBe(77);          // NOT wiped to a fresh state
    expect(viaLoad.storage.barn.gold).toBe(12);
    const viaImport = tryDeserialize(v4);
    expect(viaImport).not.toBeNull();                  // NOT rejected
    expect(viaImport!.resources.gold).toBe(77);
  });
});

describe('v5 -> v6 lifetime migration', () => {
  it('backfills lifetime zeros on a v5 save and does not wipe it', () => {
    const s5 = { ...createInitialState(0), resources: { gold: 42, wood: 0, acorns: 0, fish: 9 } };
    delete (s5 as { lifetime?: unknown }).lifetime;         // simulate a real v5 blob (no lifetime)
    const blob = JSON.stringify({ version: 5, state: s5 });
    const restored = deserialize(blob);
    expect(restored.resources.gold).toBe(42);               // not wiped
    expect(restored.lifetime).toEqual({ gold: 0, wood: 0, acorns: 0, fish: 0 });
  });

  it('backfills a PARTIAL lifetime object per field (no NaN)', () => {
    const s = { ...createInitialState(0) };
    (s as { lifetime: unknown }).lifetime = { gold: 5 };    // partial (bad import)
    const restored = tryDeserialize(JSON.stringify({ version: 6, state: s }));
    expect(restored?.lifetime).toEqual({ gold: 5, wood: 0, acorns: 0, fish: 0 });
  });
});
