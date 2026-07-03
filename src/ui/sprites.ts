import type { ImageSourcePropType } from 'react-native';
import type { SpeciesId } from '../engine/types';

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
  // fernling: require('../../assets/creatures/fernling.png'),
  // pebblepup: require('../../assets/creatures/pebblepup.png'),
  // mossmouse: require('../../assets/creatures/mossmouse.png'),
  // barkbug: require('../../assets/creatures/barkbug.png'),
  // hedgehush: require('../../assets/creatures/hedgehush.png'),
  // cedarcat: require('../../assets/creatures/cedarcat.png'),
  // lumifox: require('../../assets/creatures/lumifox.png'),
  // owlin: require('../../assets/creatures/owlin.png'),
  // stagheart: require('../../assets/creatures/stagheart.png'),
  // emberkit: require('../../assets/creatures/emberkit.png'),
};
