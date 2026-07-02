import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameState, CropId } from '../engine/types';
import {
  createInitialState,
  plantCrop,
  assignVillager,
  collectBarn,
  applyElapsed,
} from '../engine';
import { serialize, deserialize } from '../persistence/save';

const STORAGE_KEY = 'lakewood.save.v1';

interface GameStore {
  state: GameState;
  loaded: boolean;
  load: () => Promise<void>;
  tick: (now: number) => void;
  plant: (plotId: string, cropId: CropId | null) => void;
  assign: (villagerId: string, to: 'farm' | null) => void;
  collect: () => void;
  save: () => void;
}

function persist(state: GameState) {
  AsyncStorage.setItem(STORAGE_KEY, serialize(state)).catch(() => {});
}

export const useGameStore = create<GameStore>((set, get) => {
  const commit = (next: GameState) => { persist(next); set({ state: next }); };

  return {
    state: createInitialState(Date.now()),
    loaded: false,

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

    save: () => persist(get().state),
  };
});
