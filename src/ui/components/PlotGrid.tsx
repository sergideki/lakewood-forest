import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { CROPS, CROP_IDS } from '../../engine';
import type { CropId } from '../../engine';

export function PlotGrid() {
  const plots = useGameStore((s) => s.state.plots);
  const plant = useGameStore((s) => s.plant);

  // Tapping a plot cycles: empty → wheat → carrot → berry → empty
  const nextCrop = (current: CropId | null): CropId | null => {
    if (current === null) return CROP_IDS[0];
    const i = CROP_IDS.indexOf(current);
    return i === CROP_IDS.length - 1 ? null : CROP_IDS[i + 1];
  };

  return (
    <View style={cards.card}>
      <Text style={cards.title}>🌱 Plots</Text>
      <Text style={cards.sub}>Tap to plant / change crop</Text>
      <View style={styles.grid}>
        {plots.map((p) => {
          const crop = p.crop ? CROPS[p.crop] : null;
          return (
            <Pressable key={p.id} style={styles.plot} onPress={() => plant(p.id, nextCrop(p.crop))}>
              <Text style={styles.plotEmoji}>{crop ? crop.emoji : '➕'}</Text>
              <Text style={styles.plotLabel}>{crop ? crop.name : 'empty'}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 10 },
  plot: { flex: 1, backgroundColor: '#3c5a3f', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  plotEmoji: { fontSize: 24 },
  plotLabel: { color: theme.text, fontSize: 11, marginTop: 4 },
});
