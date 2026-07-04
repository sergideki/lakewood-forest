import type { ImageSourcePropType } from 'react-native';
import type { SpeciesId, PetId, CropId } from '../engine/types';

/**
 * Creature sprite registry. One line per landed PNG; a species absent here
 * renders its emoji fallback (see CreatureIcon).
 *
 * IMPORTANT: every entry must point at a file that EXISTS. Metro resolves
 * require() at bundle time, so a require() of a missing asset breaks the build.
 * Keep pending species commented out until their PNG is in assets/creatures/.
 *
 * Filename convention: assets/creatures/<speciesId>.png (e.g. fernling.png).
 */
export const CREATURE_SPRITES: Partial<Record<SpeciesId, ImageSourcePropType>> = {
  fernling: require('../../assets/creatures/fernling.png'),
  pebblepup: require('../../assets/creatures/pebblepup.png'),
  mossmouse: require('../../assets/creatures/mossmouse.png'),
  barkbug: require('../../assets/creatures/barkbug.png'),
  hedgehush: require('../../assets/creatures/hedgehush.png'),
  cedarcat: require('../../assets/creatures/cedarcat.png'),
  lumifox: require('../../assets/creatures/lumifox.png'),
  owlin: require('../../assets/creatures/owlin.png'),
  stagheart: require('../../assets/creatures/stagheart.png'),
  emberkit: require('../../assets/creatures/emberkit.png'),
  ripplefrog: require('../../assets/creatures/ripplefrog.png'),
  puddleduck: require('../../assets/creatures/puddleduck.png'),
  koisprite: require('../../assets/creatures/koisprite.png'),
  mistleotter: require('../../assets/creatures/mistleotter.png'),
};

export const PET_SPRITES: Partial<Record<PetId, ImageSourcePropType>> = {
  pondsnail: require('../../assets/pets/pondsnail.png'),
  waterbeetle: require('../../assets/pets/waterbeetle.png'),
  dragonfly: require('../../assets/pets/dragonfly.png'),
  pebbleturtle: require('../../assets/pets/pebbleturtle.png'),
  crawdad: require('../../assets/pets/crawdad.png'),
  pondnewt: require('../../assets/pets/pondnewt.png'),
};

export const CROP_SPRITES: Partial<Record<CropId, ImageSourcePropType>> = {
  wheat: require('../../assets/crops/wheat.png'),
  carrot: require('../../assets/crops/carrot.png'),
  sapling: require('../../assets/crops/sapling.png'),
  marigold: require('../../assets/crops/marigold.png'),
};

/** Keyed by villager id (vil-1=Pip, vil-2=Nan, vil-3=Rowan) — key = filename. */
export const VILLAGER_SPRITES: Partial<Record<string, ImageSourcePropType>> = {
  'vil-1': require('../../assets/villagers/vil-1.png'),
  'vil-2': require('../../assets/villagers/vil-2.png'),
  'vil-3': require('../../assets/villagers/vil-3.png'),
};
