import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useGameStore } from '../../store/gameStore';
import { PETS } from '../../engine';

export function CatchToast() {
  const petId = useGameStore((s) => s.lastCatch);
  const dismiss = useGameStore((s) => s.dismissCatch);
  if (!petId) return null;
  const pet = PETS[petId];

  return (
    <Pressable style={styles.overlay} onPress={dismiss}>
      <View style={styles.card}>
        <Text style={styles.spark}>🎣 You caught a critter! 🎣</Text>
        <Text style={styles.icon}>{pet.emoji}</Text>
        <Text style={styles.name}>{pet.name}</Text>
        <Text style={styles.rarity}>{pet.rarity} · a cozy pet</Text>
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
  icon: { fontSize: 56, lineHeight: 64, marginVertical: 8 },
  name: { color: theme.text, fontSize: 22, fontWeight: '800' },
  rarity: { color: theme.textDim, fontSize: 13, marginTop: 4 },
  tap: { color: theme.textDim, fontSize: 11, marginTop: 16 },
});
