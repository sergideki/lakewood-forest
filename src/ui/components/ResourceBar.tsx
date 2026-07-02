import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useGameStore } from '../../store/gameStore';

export function ResourceBar() {
  const r = useGameStore((s) => s.state.resources);
  return (
    <View style={styles.row}>
      <Text style={styles.item}>🪙 {r.gold}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingVertical: 12 },
  item: { color: theme.text, fontSize: 15, fontWeight: '600' },
});
