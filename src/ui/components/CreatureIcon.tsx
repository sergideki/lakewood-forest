import { Image, Text } from 'react-native';
import type { SpeciesId } from '../../engine/types';
import { CREATURE_SPRITES } from '../sprites';

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
  const sprite = CREATURE_SPRITES[speciesId];
  if (sprite) {
    return <Image source={sprite} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  return <Text style={{ fontSize: size }}>{emoji}</Text>;
}
