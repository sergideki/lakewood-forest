import type { Crop, CropId, Species, SpeciesId, Dungeon } from './types';

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
