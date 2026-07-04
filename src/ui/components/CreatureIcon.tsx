import type { SpeciesId } from '../../engine/types';
import { CREATURE_SPRITES } from '../sprites';
import { SpriteIcon } from './SpriteIcon';

type Props = {
  speciesId: SpeciesId;
  emoji: string;
  size: number;
};

/**
 * Single render path for a creature's face. Renders the sprite PNG when one is
 * registered for this species; otherwise falls back to the emoji at the same size.
 */
export function CreatureIcon({ speciesId, emoji, size }: Props) {
  return <SpriteIcon sprite={CREATURE_SPRITES[speciesId]} emoji={emoji} size={size} />;
}
