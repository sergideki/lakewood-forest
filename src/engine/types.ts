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
  level: number;
}

export interface Storage {
  barn: { amount: number; cap: number };
}

export interface Resources {
  gold: number;
  wood: number;
  acorns: number;
}

export interface Meta {
  lastSeen: number; // epoch ms
  version: number;
}

export interface GameState {
  resources: Resources;
  plots: Plot[];
  villagers: Villager[];
  storage: Storage;
  meta: Meta;
}
