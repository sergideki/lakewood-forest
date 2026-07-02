import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useGameStore } from '../../store/gameStore';
import { satchelCap } from '../../engine';

export function SatchelCard() {
  const satchel = useGameStore((s) => s.state.storage.satchel);
  const cap = useGameStore((s) => satchelCap(s.state));
  const collect = useGameStore((s) => s.collectForage);

  const wood = Math.floor(satchel.wood);
  const acorn = Math.floor(satchel.acorn);
  const total = satchel.wood + satchel.acorn;
  const pct = Math.min(100, Math.round((total / cap) * 100));
  const empty = wood + acorn === 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🎒 Satchel</Text>
        <Pressable
          style={[styles.btn, empty && styles.btnDisabled]}
          disabled={empty}
          onPress={collect}
        >
          <Text style={styles.btnText}>Collect</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>🪵 {wood}   🌰 {acorn}   ({pct}% full)</Text>
      <View style={styles.meter}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1,
    borderRadius: theme.radius, padding: 12, marginHorizontal: 16, marginBottom: theme.gap },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: theme.text, fontSize: 16, fontWeight: '700' },
  sub: { color: theme.textDim, fontSize: 12, marginTop: 6 },
  meter: { height: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 5, marginTop: 6 },
  fill: { height: '100%', backgroundColor: theme.accent, borderRadius: 5 },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
