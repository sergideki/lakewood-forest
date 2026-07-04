import type { Crop, CropId, Species, SpeciesId, Dungeon, TownUpgrade, UpgradeId, Habitat, Pet, PetId, Resources } from './types';

export const CROPS: Record<CropId, Crop> = {
  wheat:    { kind: 'producer', id: 'wheat',    name: 'Wheat',    emoji: '🌾', output: 'gold',   amount: 5, growSec: 100 },
  carrot:   { kind: 'producer', id: 'carrot',   name: 'Carrot',   emoji: '🥕', output: 'acorns', amount: 6, growSec: 180 },
  sapling:  { kind: 'producer', id: 'sapling',  name: 'Sapling',  emoji: '🌲', output: 'wood',   amount: 6, growSec: 180 },
  marigold: { kind: 'modifier', id: 'marigold', name: 'Marigold', emoji: '🌼' },
};

export const CROP_IDS: CropId[] = Object.keys(CROPS);

/** Crops unlocked at game start (all others must be bought via unlockCrop). */
export const STARTER_CROPS: CropId[] = ['wheat'];

/** One-time cost to permanently unlock a crop for planting. Absent component = 0. */
export const CROP_UNLOCK_COST: Record<CropId, Partial<Resources>> = {
  carrot:   { gold: 50 },
  sapling:  { gold: 50 },
  marigold: { gold: 150, fish: 40 },
};

// --- Marigold (modifier crop) tuning ---
export const MARIGOLD_CATCH_BONUS = 0.05;  // +catch chance per planted marigold plot
export const MARIGOLD_CATCH_CAP = 0.50;    // hard ceiling on total catch chance (binds at 5 marigolds)
export const MARIGOLD_FISH_PER_SEC = 0.02; // fish drained per second per planted marigold (~72/hour)

export const SPECIES: Record<SpeciesId, Species> = {
  fernling:  { id: 'fernling',  name: 'Fernling',   emoji: '🌱', rarity: 'common',   affinity: 'acorn' },
  pebblepup: { id: 'pebblepup', name: 'Pebble Pup', emoji: '🐕', rarity: 'common',   affinity: 'wood'  },
  mossmouse: { id: 'mossmouse', name: 'Moss Mouse', emoji: '🐭', rarity: 'common',   affinity: 'acorn' },
  barkbug:   { id: 'barkbug',   name: 'Bark Bug',   emoji: '🐞', rarity: 'common',   affinity: 'wood'  },
  hedgehush: { id: 'hedgehush', name: 'Hedgehush',  emoji: '🦔', rarity: 'uncommon', affinity: 'acorn' },
  cedarcat:  { id: 'cedarcat',  name: 'Cedar Cat',  emoji: '🐈', rarity: 'uncommon', affinity: 'wood'  },
  lumifox:   { id: 'lumifox',   name: 'Lumi Fox',   emoji: '🦊', rarity: 'uncommon', affinity: 'acorn' },
  owlin:     { id: 'owlin',     name: 'Owlin',      emoji: '🦉', rarity: 'rare',     affinity: 'wood'  },
  stagheart: { id: 'stagheart', name: 'Stagheart',  emoji: '🦌', rarity: 'rare',     affinity: 'acorn' },
  emberkit:  { id: 'emberkit',  name: 'Ember Kit',  emoji: '🦝', rarity: 'rare',     affinity: 'wood'  },
  ripplefrog:  { id: 'ripplefrog',  name: 'Ripple Frog',  emoji: '🐸', rarity: 'common',   affinity: 'fish' },
  puddleduck:  { id: 'puddleduck',  name: 'Puddle Duck',  emoji: '🦆', rarity: 'common',   affinity: 'fish' },
  koisprite:   { id: 'koisprite',   name: 'Koi Sprite',   emoji: '🎏', rarity: 'uncommon', affinity: 'fish' },
  mistleotter: { id: 'mistleotter', name: 'Mistle Otter', emoji: '🦦', rarity: 'rare',     affinity: 'fish' },
};

export const STARTER_SPECIES: SpeciesId[] = ['fernling', 'pebblepup'];

export const DUNGEONS: Dungeon[] = [
  { id: 'hollow', name: 'Mossy Hollow',  emoji: '🍄', durationSec: 15 * 60,  loot: { gold: 20,  wood: 10,  acorn: 6  }, baseDiscoveryChance: 0.35, recommendedPower: 2,  xpReward: 30  },
  { id: 'grove',  name: 'Whisper Grove', emoji: '🌿', durationSec: 60 * 60,  loot: { gold: 80,  wood: 40,  acorn: 24 }, baseDiscoveryChance: 0.45, recommendedPower: 6,  xpReward: 80  },
  { id: 'deep',   name: 'Deepwood',      emoji: '🌲', durationSec: 4 * 3600, loot: { gold: 300, wood: 150, acorn: 90 }, baseDiscoveryChance: 0.60, recommendedPower: 14, xpReward: 200 },
];

export function getDungeon(id: string): Dungeon | undefined {
  return DUNGEONS.find((d) => d.id === id);
}

export const UPGRADES: Record<UpgradeId, TownUpgrade> = {
  'barn-silo':      { id: 'barn-silo',      name: 'Barn Silo',         emoji: '🏚️', description: '+50% barn capacity per level',    maxLevel: 5, baseCost: { gold: 40,  wood: 25 },   costGrowth: 1.8 },
  'satchel-stitch': { id: 'satchel-stitch', name: 'Satchel Stitching', emoji: '🧵', description: '+50% satchel capacity per level', maxLevel: 5, baseCost: { gold: 40,  acorns: 20 }, costGrowth: 1.8 },
  'forage-tools':   { id: 'forage-tools',   name: 'Forage Tools',      emoji: '🪓', description: '+15% forage rate per level',      maxLevel: 5, baseCost: { gold: 60,  wood: 30 },   costGrowth: 1.9 },
  'farm-plot':      { id: 'farm-plot',      name: 'Farm Expansion',    emoji: '🚜', description: 'Clear land for a new crop plot',  maxLevel: 5, baseCost: { gold: 150, wood: 50 },   costGrowth: 2.5 },
};

export const UPGRADE_IDS: UpgradeId[] = Object.keys(UPGRADES);

export const TREAT_COST_ACORNS = 25;
export const TREAT_XP = 100;

export const HABITATS: Habitat[] = [
  { id: 'lilypads',  name: 'Lily Pads',  emoji: '🪷', attracts: 'ripplefrog',  cost: { fish: 20 },            attractSec: 15 * 60  },
  { id: 'reedbed',   name: 'Reed Bed',   emoji: '🎋', attracts: 'puddleduck',  cost: { fish: 40, wood: 20 },  attractSec: 60 * 60  },
  { id: 'koistones', name: 'Koi Stones', emoji: '🪨', attracts: 'koisprite',   cost: { fish: 80, gold: 50 },  attractSec: 2 * 3600 },
  { id: 'otterholt', name: 'Otter Holt', emoji: '🕳️', attracts: 'mistleotter', cost: { fish: 150, wood: 60 }, attractSec: 4 * 3600 },
];

export function getHabitat(id: string): Habitat | undefined {
  return HABITATS.find((h) => h.id === id);
}

export const HABITAT_IDS: string[] = HABITATS.map((h) => h.id);

export const PETS: Record<PetId, Pet> = {
  pondsnail:    { id: 'pondsnail',    name: 'Pond Snail',    emoji: '🐌', rarity: 'common'   },
  waterbeetle:  { id: 'waterbeetle',  name: 'Water Beetle',  emoji: '🪲', rarity: 'common'   },
  dragonfly:    { id: 'dragonfly',    name: 'Dragonfly',     emoji: '🦋', rarity: 'uncommon' },
  pebbleturtle: { id: 'pebbleturtle', name: 'Pebble Turtle', emoji: '🐢', rarity: 'uncommon' },
  crawdad:      { id: 'crawdad',      name: 'Crawdad',       emoji: '🦞', rarity: 'rare'     },
  pondnewt:     { id: 'pondnewt',     name: 'Pond Newt',     emoji: '🦎', rarity: 'rare'     },
};

export const PET_IDS: PetId[] = Object.keys(PETS);

export const BASE_ROD_RATE = 0.05; // fish/sec with zero water creatures (bootstraps the loop)
export const CREEL_HOURS = 24;     // creel holds ~a day of the current fish rate
export const CREEL_FLOOR = 200;    // minimum creel capacity
export const CATCH_CHANCE = 0.25;  // chance to catch a pet per NON-EMPTY creel collect
