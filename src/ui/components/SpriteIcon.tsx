import { useRef } from 'react';
import { Animated, Easing, Text } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

type Props = {
  sprite: ImageSourcePropType | undefined;
  emoji: string;
  size: number;
};

// One shared clock for every icon: a single Animated.Value looping 0->1->0.
// Lazy-started on first render (NOT at import) so importing this module stays
// side-effect-free — vitest runs in a node env with no requestAnimationFrame,
// and an import-time loop would crash any test that transitively imports this.
const bob = new Animated.Value(0);
let started = false;
function ensureStarted() {
  if (started) return;
  started = true;
  Animated.loop(
    Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]),
  ).start();
}

// 0->1 maps to a gentle -1.5px lift and back. Tiny on purpose — breathing, not bouncing.
const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] });

/**
 * Single render path for any entity icon. Renders the sprite PNG when the caller's
 * registry has one; otherwise the emoji at the same size. Both gently idle-bob.
 */
export function SpriteIcon({ sprite, emoji, size }: Props) {
  useRef(ensureStarted()).current; // fire once on first mount, no re-render

  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      {sprite ? (
        <Animated.Image source={sprite} style={{ width: size, height: size }} resizeMode="contain" />
      ) : (
        <Text style={{ fontSize: size }}>{emoji}</Text>
      )}
    </Animated.View>
  );
}
