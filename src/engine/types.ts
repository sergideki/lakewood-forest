export type CropId = string;

export interface Crop {
  id: CropId;
  name: string;
  emoji: string;
  growSec: number; // seconds for one full yield
  gold: number;    // gold produced per yield cycle
}

export interface Plot {
  id: string;
  crop: CropId | null;
}

export interface Villager {
  id: string;
  name: string;
  emoji: string;
  assignedTo: 'farm' | null;
}

export interface Storage {
  barn: { amount: number; cap: number };
}

export interface Resources {
  gold: number;
}

export interface Meta {
  lastSeen: number; // epoch ms
}

export interface GameState {
  resources: Resources;
  plots: Plot[];
  villagers: Villager[];
  storage: Storage;
  meta: Meta;
}
