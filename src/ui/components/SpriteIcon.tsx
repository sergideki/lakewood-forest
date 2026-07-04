import { Image, Text } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

type Props = {
  sprite: ImageSourcePropType | undefined;
  emoji: string;
  size: number;
};

/**
 * Single render path for any entity icon. Renders the sprite PNG when the
 * caller's registry has one; otherwise falls back to the emoji at the same size.
 */
export function SpriteIcon({ sprite, emoji, size }: Props) {
  if (sprite) {
    return <Image source={sprite} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  return <Text style={{ fontSize: size }}>{emoji}</Text>;
}
