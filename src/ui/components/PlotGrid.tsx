import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { CROPS, CROP_IDS } from '../../engine';
import type { CropId } from '../../engine';

function fmt(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

export function PlotGrid() {
  const plots = useGameStore((s) => s.state.plots);
  const plant = useGameStore((s) => s.plant);
  // Which plot's crop picker is open (plot id), or null when closed.
  const [picking, setPicking] = useState<string | null>(null);

  const choose = (cropId: CropId | null) => {
    if (picking) plant(picking, cropId);
    setPicking(null);
  };

  return (
    <View style={cards.card}>
      <Text style={cards.title}>🌱 Plots</Text>
      <Text style={cards.sub}>Tap a plot to pick a crop</Text>
      <View style={styles.grid}>
        {plots.map((p) => {
          const crop = p.crop ? CROPS[p.crop] : null;
          return (
            <Pressable key={p.id} style={styles.plot} onPress={() => setPicking(p.id)}>
              <Text style={styles.plotEmoji}>{crop ? crop.emoji : '➕'}</Text>
              <Text style={styles.plotLabel}>{crop ? crop.name : 'empty'}</Text>
            </Pressable>
          );
        })}
      </View>

      <Modal
        visible={picking !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicking(null)}
      >
        {/* Separate absolute backdrop + centered sheet: taps on the sheet never
            reach the backdrop, so inner taps don't close it (react-native-web
            would otherwise bubble a click from a nested Pressable to the parent). */}
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setPicking(null)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Plant a crop</Text>
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {CROP_IDS.map((id) => {
                const c = CROPS[id];
                return (
                  <Pressable key={id} style={styles.cropRow} onPress={() => choose(id)}>
                    <Text style={styles.cropEmoji}>{c.emoji}</Text>
                    <Text style={styles.cropName}>{c.name}</Text>
                    <Text style={styles.cropMeta}>{fmt(c.growSec)} · {c.gold}g</Text>
                  </Pressable>
                );
              })}
              <Pressable style={[styles.cropRow, styles.clearRow]} onPress={() => choose(null)}>
                <Text style={styles.cropEmoji}>✕</Text>
                <Text style={[styles.cropName, styles.clearName]}>Clear plot</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  plot: { flexBasis: '30%', flexGrow: 1, backgroundColor: '#3c5a3f', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  plotEmoji: { fontSize: 24 },
  plotLabel: { color: theme.text, fontSize: 11, marginTop: 4 },

  modalRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { width: '100%', maxWidth: 360, maxHeight: '70%', backgroundColor: theme.card,
    borderColor: theme.accent, borderWidth: 2, borderRadius: 18, padding: 18 },
  sheetTitle: { color: theme.accent, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  list: { flexGrow: 0 },
  listContent: { gap: 6 },
  cropRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 10, backgroundColor: '#26332a' },
  cropEmoji: { fontSize: 22 },
  cropName: { flex: 1, color: theme.text, fontSize: 14, fontWeight: '600' },
  cropMeta: { color: theme.textDim, fontSize: 12 },
  clearRow: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.cardBorder },
  clearName: { color: theme.textDim },
});
