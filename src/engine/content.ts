import type { Crop, CropId, Species, SpeciesId, Dungeon, TownUpgrade, UpgradeId } from './types';

export const CROPS: Record<CropId, Crop> = {
  wheat:  { id: 'wheat',  name: 'Wheat',  emoji: '🌾', growSec: 100, gold: 5 },
  carrot: { id: 'carrot', name: 'Carrot', emoji: '🥕', growSec: 240, gold: 14 },
  berry:  { id: 'berry',  name: 'Berry',  emoji: '🍓', growSec: 480, gold: 32 },
};

export const CROP_IDS: CropId[] = Object.keys(CROPS);

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
  'farm-plot':      { id: 'farm-plot',      name: 'Farm Expansion',    emoji: '🚜', description: 'Clear land for a new crop plot',  maxLevel: 3, baseCost: { gold: 150, wood: 50 },   costGrowth: 2.5 },
};

export const UPGRADE_IDS: UpgradeId[] = Object.keys(UPGRADES);

export const TREAT_COST_ACORNS = 25;
export const TREAT_XP = 100;
