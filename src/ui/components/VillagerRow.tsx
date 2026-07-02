import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useGameStore } from '../../store/gameStore';

export function VillagerRow() {
  const villagers = useGameStore((s) => s.state.villagers);
  const assign = useGameStore((s) => s.assign);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🧑‍🌾 Family</Text>
      <Text style={styles.sub}>Tap to send them to the farm (boosts the barn)</Text>
      <View style={styles.row}>
        {villagers.map((v) => {
          const on = v.assignedTo === 'farm';
          return (
            <Pressable
              key={v.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => assign(v.id, on ? null : 'farm')}
            >
              <Text style={styles.chipEmoji}>{v.emoji}</Text>
              <Text style={[styles.chipName, on && styles.chipNameOn]}>{v.name}</Text>
              <Text style={styles.chipState}>{on ? 'farming' : 'resting'}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1,
    borderRadius: theme.radius, padding: 12, marginHorizontal: 16, marginBottom: theme.gap },
  title: { color: theme.text, fontSize: 16, fontWeight: '700' },
  sub: { color: theme.textDim, fontSize: 12, marginTop: 2, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  chip: { flex: 1, backgroundColor: '#26332a', borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: 'transparent' },
  chipOn: { borderColor: theme.accent, backgroundColor: '#2e4535' },
  chipEmoji: { fontSize: 22 },
  chipName: { color: theme.textDim, fontSize: 12, marginTop: 3, fontWeight: '600' },
  chipNameOn: { color: theme.text },
  chipState: { color: theme.textDim, fontSize: 10, marginTop: 1 },
});
