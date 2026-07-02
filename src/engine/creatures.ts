import type { Creature, SpeciesId } from './types';
import { SPECIES } from './content';

/** Build a fresh level-1 idle creature instance for a species. */
export function makeCreature(species: SpeciesId): Creature {
  const sp = SPECIES[species];
  return {
    id: `cr-${species}`, // one instance per species (discovery pool is de-duped), so this is unique
    species,
    name: sp.name,
    emoji: sp.emoji,
    rarity: sp.rarity,
    affinity: sp.affinity,
    level: 1,
    xp: 0,
    assignment: { type: 'idle', dungeonId: null, startedAt: 0 },
  };
}
