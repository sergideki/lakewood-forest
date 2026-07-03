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

export type Rarity = 'common' | 'uncommon' | 'rare';
export type SpeciesId = string;
export type Material = 'wood' | 'acorn';

/** Injected randomness so engine rolls stay deterministic under test. */
export type Rng = () => number;

export interface Species {
  id: SpeciesId;
  name: string;
  emoji: string;
  rarity: Rarity;
  affinity: Material; // material it forages
}

export interface Creature {
  id: string;
  species: SpeciesId;
  name: string;
  emoji: string;
  rarity: Rarity;
  affinity: Material;
  level: number;
  xp: number;
  assignment: {
    type: 'idle' | 'forage' | 'dungeon';
    dungeonId: string | null;
    startedAt: number; // epoch ms; 0 when idle/forage
  };
}

export interface DungeonRun {
  creatureIds: string[];
  startedAt: number; // epoch ms
}

export interface DungeonState {
  id: string;
  activeRun: DungeonRun | null;
}

export interface Dungeon {
  id: string;
  name: string;
  emoji: string;
  durationSec: number;
  loot: { gold: number; wood: number; acorn: number };
  baseDiscoveryChance: number; // 0..1
  recommendedPower: number;
  xpReward: number; // XP lump per creature on completion
}

export interface Storage {
  barn: { amount: number };
  satchel: { wood: number; acorn: number };
}

export interface Resources {
  gold: number;
  wood: number;
  acorns: number;
}

export interface Meta {
  lastSeen: number; // epoch ms
}

export type UpgradeId = string;

export interface TownUpgrade {
  id: UpgradeId;
  name: string;
  emoji: string;
  description: string;          // one line, shown in the shop
  maxLevel: number;
  baseCost: Partial<Resources>; // cost of level 0 -> 1; absent component = 0
  costGrowth: number;           // per-level multiplier on every cost component
}

export interface GameState {
  resources: Resources;
  plots: Plot[];
  villagers: Villager[];
  creatures: Creature[];
  storage: Storage;
  dungeons: DungeonState[];
  discovered: SpeciesId[];
  upgrades: Record<UpgradeId, number>; // upgrade id -> owned level; absent key = 0
  meta: Meta;
}
