import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useGameStore } from '../../store/gameStore';
import { SPECIES } from '../../engine';
import { CreatureIcon } from './CreatureIcon';

export function DiscoveryToast() {
  const speciesId = useGameStore((s) => s.lastDiscovery);
  const dismiss = useGameStore((s) => s.dismissDiscovery);
  if (!speciesId) return null;
  const sp = SPECIES[speciesId];

  return (
    <Pressable style={styles.overlay} onPress={dismiss}>
      <View style={styles.card}>
        <Text style={styles.spark}>✨ New friend discovered! ✨</Text>
        <View style={styles.iconWrap}>
          <CreatureIcon speciesId={sp.id} emoji={sp.emoji} size={56} />
        </View>
        <Text style={styles.name}>{sp.name}</Text>
        <Text style={styles.rarity}>{sp.rarity} · forages {sp.affinity === 'wood' ? '🪵' : '🌰'}</Text>
        <Text style={styles.tap}>tap to continue</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: theme.card, borderColor: theme.accent, borderWidth: 2, borderRadius: 18,
    padding: 24, alignItems: 'center', width: '80%' },
  spark: { color: theme.accent, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  iconWrap: { marginVertical: 8 },
  name: { color: theme.text, fontSize: 22, fontWeight: '800' },
  rarity: { color: theme.textDim, fontSize: 13, marginTop: 4 },
  tap: { color: theme.textDim, fontSize: 11, marginTop: 16 },
});
