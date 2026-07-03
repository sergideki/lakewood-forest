import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameState, CropId, SpeciesId, PetId } from '../engine/types';
import {
  createInitialState,
  plantCrop,
  assignVillager,
  collectBarn,
  applyElapsed,
  assignCreature,
  startRun,
  collectRun,
  collectSatchel,
  purchaseUpgrade,
  buyTreat,
  collectCreel,
  buildHabitat,
  collectHabitat,
} from '../engine';
import { serialize, deserialize, tryDeserialize } from '../persistence/save';

const STORAGE_KEY = 'lakewood.save.v1'; // key unchanged; the envelope's `version` drives migration

interface GameStore {
  state: GameState;
  loaded: boolean;
  lastDiscovery: SpeciesId | null;
  lastCatch: PetId | null;
  load: () => Promise<void>;
  tick: (now: number) => void;
  plant: (plotId: string, cropId: CropId | null) => void;
  assign: (villagerId: string, to: 'farm' | null) => void;
  collect: () => void;
  assignCreatureTo: (creatureId: string, to: 'idle' | 'forage') => void;
  startDungeon: (dungeonId: string, creatureIds: string[]) => void;
  collectDungeon: (dungeonId: string) => void;
  collectForage: () => void;
  purchase: (upgradeId: string) => void;
  feedTreat: (creatureId: string) => void;
  collectFish: () => void;
  buildHabitat: (habitatId: string) => void;
  collectHabitat: (habitatId: string) => void;
  dismissCatch: () => void;
  dismissDiscovery: () => void;
  save: () => void;
  exportState: () => string;
  importState: (json: string) => boolean;
}

function persist(state: GameState) {
  AsyncStorage.setItem(STORAGE_KEY, serialize(state)).catch(() => {});
}

/** The species newly present in `next.discovered` but not in `prev.discovered`, if any. */
function newlyDiscovered(prev: GameState, next: GameState): SpeciesId | null {
  const added = next.discovered.filter((id) => !prev.discovered.includes(id));
  return added.length > 0 ? added[added.length - 1] : null;
}

/** The pet newly present in next.pets but not prev.pets, if any. */
function newlyCaught(prev: GameState, next: GameState): PetId | null {
  const added = next.pets.filter((id) => !prev.pets.includes(id));
  return added.length > 0 ? added[added.length - 1] : null;
}

export const useGameStore = create<GameStore>((set, get) => {
  // Never persist before load() has hydrated the store: a commit on the fresh
  // initial state would overwrite the real save (deep link to /town, fast tap).
  const commit = (next: GameState) => { if (get().loaded) persist(next); set({ state: next }); };

  /** Run a discovery-capable engine action, surfacing any new species for the toast. */
  const commitWithDiscovery = (prev: GameState, next: GameState) => {
    const found = newlyDiscovered(prev, next);
    if (get().loaded) persist(next);
    set(found ? { state: next, lastDiscovery: found } : { state: next });
  };

  /** Run a catch-capable action (creel collect), surfacing a new pet for the catch toast. */
  const commitWithCatch = (prev: GameState, next: GameState) => {
    const caught = newlyCaught(prev, next);
    if (get().loaded) persist(next);
    set(caught ? { state: next, lastCatch: caught } : { state: next });
  };

  return {
    state: createInitialState(Date.now()),
    loaded: false,
    lastDiscovery: null,
    lastCatch: null,

    load: async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const restored = applyElapsed(deserialize(raw), Date.now());
        persist(restored);
        set({ state: restored, loaded: true });
      } catch {
        // Storage read failed — still flip `loaded` so the game boots on the fresh initial
        // state and can persist from here (otherwise it would hang un-hydrated forever).
        set({ loaded: true });
      }
    },

    tick: (now) => set({ state: applyElapsed(get().state, now) }),

    plant: (plotId, cropId) => commit(plantCrop(applyElapsed(get().state, Date.now()), plotId, cropId)),

    assign: (villagerId, to) => commit(assignVillager(applyElapsed(get().state, Date.now()), villagerId, to)),

    collect: () => commit(collectBarn(applyElapsed(get().state, Date.now()))),

    assignCreatureTo: (creatureId, to) =>
      commit(assignCreature(applyElapsed(get().state, Date.now()), creatureId, to)),

    startDungeon: (dungeonId, creatureIds) => {
      const now = Date.now();
      commit(startRun(applyElapsed(get().state, now), dungeonId, creatureIds, now));
    },

    collectDungeon: (dungeonId) => {
      const now = Date.now();
      const caught = applyElapsed(get().state, now);
      commitWithDiscovery(caught, collectRun(caught, dungeonId, Math.random, now));
    },

    collectForage: () => {
      const caught = applyElapsed(get().state, Date.now());
      commitWithDiscovery(caught, collectSatchel(caught, Math.random));
    },

    purchase: (upgradeId) => commit(purchaseUpgrade(applyElapsed(get().state, Date.now()), upgradeId)),

    feedTreat: (creatureId) => commit(buyTreat(applyElapsed(get().state, Date.now()), creatureId)),

    collectFish: () => {
      const caught = applyElapsed(get().state, Date.now());
      commitWithCatch(caught, collectCreel(caught, Math.random));
    },

    buildHabitat: (habitatId) => {
      const now = Date.now();
      commit(buildHabitat(applyElapsed(get().state, now), habitatId, now));
    },

    collectHabitat: (habitatId) => {
      const now = Date.now();
      const caught = applyElapsed(get().state, now);
      commitWithDiscovery(caught, collectHabitat(caught, habitatId, now));
    },

    dismissCatch: () => set({ lastCatch: null }),

    dismissDiscovery: () => set({ lastDiscovery: null }),

    save: () => { if (get().loaded) persist(get().state); },

    // Backup: the current save envelope as a JSON string (for the Settings export box).
    exportState: () => serialize(get().state),

    // Restore: replace the live state from a pasted export blob. Rejects invalid JSON WITHOUT
    // touching the current save (tryDeserialize returns null rather than a fresh state), so a bad
    // paste can't wipe progress. Runs applyElapsed so offline gains since the blob was made apply.
    importState: (json) => {
      const restored = tryDeserialize(json);
      if (!restored) return false;
      const next = applyElapsed(restored, Date.now());
      persist(next);
      set({ state: next, loaded: true });
      return true;
    },
  };
});
