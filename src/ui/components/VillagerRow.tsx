import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { VILLAGER_SPRITES } from '../sprites';
import { SpriteIcon } from './SpriteIcon';

export function VillagerRow() {
  const villagers = useGameStore((s) => s.state.villagers);
  const assign = useGameStore((s) => s.assign);

  return (
    <View style={cards.card}>
      <Text style={cards.title}>🧑‍🌾 Family</Text>
      <Text style={cards.sub}>Tap to send them to the farm (boosts the barn)</Text>
      <View style={styles.row}>
        {villagers.map((v) => {
          const on = v.assignedTo === 'farm';
          return (
            <Pressable
              key={v.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => assign(v.id, on ? null : 'farm')}
            >
              <SpriteIcon sprite={VILLAGER_SPRITES[v.id]} emoji={v.emoji} size={22} />
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
  row: { flexDirection: 'row', gap: 10 },
  chip: { flex: 1, backgroundColor: '#26332a', borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: 'transparent' },
  chipOn: { borderColor: theme.accent, backgroundColor: '#2e4535' },
  chipName: { color: theme.textDim, fontSize: 12, marginTop: 3, fontWeight: '600' },
  chipNameOn: { color: theme.text },
  chipState: { color: theme.textDim, fontSize: 10, marginTop: 1 },
});
