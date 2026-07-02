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
  plant: (plotId: string, cropId: CropId) => void;
  assign: (villagerId: string, to: 'farm' | null) => void;
  collect: () => void;
}

function persist(state: GameState) {
  AsyncStorage.setItem(STORAGE_KEY, serialize(state)).catch(() => {});
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialState(Date.now()),
  loaded: false,

  load: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const restored = applyElapsed(deserialize(raw), Date.now());
    persist(restored);
    set({ state: restored, loaded: true });
  },

  tick: (now) => {
    const next = applyElapsed(get().state, now);
    persist(next);
    set({ state: next });
  },

  plant: (plotId, cropId) => {
    const next = plantCrop(applyElapsed(get().state, Date.now()), plotId, cropId);
    persist(next);
    set({ state: next });
  },

  assign: (villagerId, to) => {
    const next = assignVillager(applyElapsed(get().state, Date.now()), villagerId, to);
    persist(next);
    set({ state: next });
  },

  collect: () => {
    const next = collectBarn(applyElapsed(get().state, Date.now()));
    persist(next);
    set({ state: next });
  },
}));
