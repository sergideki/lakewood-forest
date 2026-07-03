import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameState, CropId, SpeciesId } from '../engine/types';
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
} from '../engine';
import { serialize, deserialize } from '../persistence/save';

const STORAGE_KEY = 'lakewood.save.v1'; // key unchanged; the envelope's `version` drives migration

interface GameStore {
  state: GameState;
  loaded: boolean;
  lastDiscovery: SpeciesId | null;
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
  dismissDiscovery: () => void;
  save: () => void;
}

function persist(state: GameState) {
  AsyncStorage.setItem(STORAGE_KEY, serialize(state)).catch(() => {});
}

/** The species newly present in `next.discovered` but not in `prev.discovered`, if any. */
function newlyDiscovered(prev: GameState, next: GameState): SpeciesId | null {
  const added = next.discovered.filter((id) => !prev.discovered.includes(id));
  return added.length > 0 ? added[added.length - 1] : null;
}

export const useGameStore = create<GameStore>((set, get) => {
  const commit = (next: GameState) => { persist(next); set({ state: next }); };

  /** Run a discovery-capable engine action, surfacing any new species for the toast. */
  const commitWithDiscovery = (prev: GameState, next: GameState) => {
    const found = newlyDiscovered(prev, next);
    persist(next);
    set(found ? { state: next, lastDiscovery: found } : { state: next });
  };

  return {
    state: createInitialState(Date.now()),
    loaded: false,
    lastDiscovery: null,

    load: async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const restored = applyElapsed(deserialize(raw), Date.now());
      persist(restored);
      set({ state: restored, loaded: true });
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

    dismissDiscovery: () => set({ lastDiscovery: null }),

    save: () => persist(get().state),
  };
});
