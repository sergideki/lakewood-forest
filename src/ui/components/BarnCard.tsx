import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';

export function BarnCard() {
  const barn = useGameStore((s) => s.state.storage.barn);
  const collect = useGameStore((s) => s.collect);
  const pct = Math.min(100, Math.round((barn.amount / barn.cap) * 100));
  const amount = Math.floor(barn.amount);

  return (
    <View style={cards.card}>
      <View style={styles.header}>
        <Text style={cards.title}>🛖 Barn</Text>
        <Pressable
          style={[styles.btn, amount === 0 && styles.btnDisabled]}
          disabled={amount === 0}
          onPress={collect}
        >
          <Text style={styles.btnText}>Collect {amount}</Text>
        </Pressable>
      </View>
      <Text style={cards.sub}>{amount} / {barn.cap} gold stored ({pct}%)</Text>
      <View style={styles.meter}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meter: { height: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 5, marginTop: 6 },
  fill: { height: '100%', backgroundColor: theme.accent, borderRadius: 5 },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
