import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useGameStore } from '../../store/gameStore';

export function BarnCard() {
  const barn = useGameStore((s) => s.state.storage.barn);
  const collect = useGameStore((s) => s.collect);
  const pct = Math.min(100, Math.round((barn.amount / barn.cap) * 100));
  const amount = Math.floor(barn.amount);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🛖 Barn</Text>
        <Pressable
          style={[styles.btn, amount === 0 && styles.btnDisabled]}
          disabled={amount === 0}
          onPress={collect}
        >
          <Text style={styles.btnText}>Collect {amount}</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>{amount} / {barn.cap} gold stored ({pct}%)</Text>
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
