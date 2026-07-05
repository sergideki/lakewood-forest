export type CropId = string;

/** Resources a producer crop can bank (a subset of Resources keys — plural `acorns`). */
export type BarnResource = 'gold' | 'wood' | 'acorns';

interface CropBase {
  id: CropId;
  name: string;
  emoji: string;
}
/** A crop that banks a resource into the barn over time. */
export interface ProducerCrop extends CropBase {
  kind: 'producer';
  output: BarnResource;
  amount: number;  // resource produced per yield cycle
  growSec: number; // seconds for one full yield
}
/** A crop with no bankable output; its effect is applied where it is consumed (e.g. lake catch). */
export interface ModifierCrop extends CropBase {
  kind: 'modifier';
}
export type Crop = ProducerCrop | ModifierCrop;

export interface Plot {
  id: string;
  crop: CropId | null;
}

export type Station = 'farm' | 'forest' | 'lake';

export interface Villager {
  id: string;
  name: string;
  emoji: string;
  specialty: Station;
  level: number;
  xp: number;
  assignedTo: Station | null;
}

export type Rarity = 'common' | 'uncommon' | 'rare';
export type SpeciesId = string;
export type Material = 'wood' | 'acorn' | 'fish';

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

export interface HabitatState {
  id: string;
  builtAt: number | null; // epoch ms; null = unbuilt
}

export interface Habitat {
  id: string;
  name: string;
  emoji: string;
  attracts: SpeciesId;      // the ONE water creature this habitat attracts
  cost: Partial<Resources>; // absent component = 0
  attractSec: number;       // build → ready
}

export type PetId = string;

export interface Pet {
  id: PetId;
  name: string;
  emoji: string;
  rarity: Rarity;
}

export interface Storage {
  barn: { gold: number; wood: number; acorns: number };
  satchel: { wood: number; acorn: number };
  creel: { fish: number };
}

export interface Resources {
  gold: number;
  wood: number;
  acorns: number;
  fish: number;
}

/** Cumulative counters that only ever go up — never spent. Backs achievements. */
export interface Lifetime {
  gold: number;
  wood: number;
  acorns: number;
  fish: number;
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
  unlockedCrops: CropId[]; // crop ids the player may plant; wheat is always seeded here
  villagers: Villager[];
  creatures: Creature[];
  storage: Storage;
  dungeons: DungeonState[];
  discovered: SpeciesId[];
  upgrades: Record<UpgradeId, number>; // upgrade id -> owned level; absent key = 0
  habitats: HabitatState[];
  pets: PetId[]; // discovered pet ids; absent/[] = none caught
  lifetime: Lifetime; // cumulative banked totals; additive save v6
  meta: Meta;
}
