import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { barnCap } from '../../engine';
import type { BarnResource } from '../../engine';

const LABEL: Record<BarnResource, { emoji: string; name: string }> = {
  gold: { emoji: '🪙', name: 'gold' },
  wood: { emoji: '🪵', name: 'wood' },
  acorns: { emoji: '🌰', name: 'acorns' },
};
const ORDER: BarnResource[] = ['gold', 'wood', 'acorns'];

export function BarnCard() {
  const state = useGameStore((s) => s.state);       // stable ref — selector-cache safe
  const collect = useGameStore((s) => s.collect);
  const barn = state.storage.barn;
  const cap = barnCap(state);
  const totalWhole = ORDER.reduce((sum, r) => sum + Math.floor(barn[r]), 0);
  const active = ORDER.filter((r) => cap[r] > 0 || barn[r] > 0);

  return (
    <View style={cards.card}>
      <View style={styles.header}>
        <Text style={cards.title}>🛖 Barn</Text>
        <Pressable
          style={[styles.btn, totalWhole === 0 && styles.btnDisabled]}
          disabled={totalWhole === 0}
          onPress={collect}
        >
          <Text style={styles.btnText}>Collect</Text>
        </Pressable>
      </View>
      {active.length === 0 ? (
        <Text style={cards.sub}>Plant a crop and assign a villager to fill the barn.</Text>
      ) : (
        active.map((r) => {
          const amount = Math.floor(barn[r]);
          const pct = cap[r] > 0 ? Math.min(100, Math.round((barn[r] / cap[r]) * 100)) : 0;
          return (
            <View key={r} style={styles.row}>
              <Text style={cards.sub}>{LABEL[r].emoji} {amount} / {cap[r]} {LABEL[r].name}</Text>
              <View style={styles.meter}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { marginTop: 6 },
  meter: { height: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 5, marginTop: 4 },
  fill: { height: '100%', backgroundColor: theme.accent, borderRadius: 5 },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
