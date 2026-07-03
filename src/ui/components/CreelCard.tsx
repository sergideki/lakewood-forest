import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { creelCap } from '../../engine';

export function CreelCard() {
  const creel = useGameStore((s) => s.state.storage.creel);
  const cap = useGameStore((s) => creelCap(s.state));
  const collect = useGameStore((s) => s.collectFish);

  const fish = Math.floor(creel.fish);
  const pct = Math.min(100, Math.round((creel.fish / cap) * 100));
  const empty = fish === 0;

  return (
    <View style={cards.card}>
      <View style={styles.header}>
        <Text style={cards.title}>🪣 Creel</Text>
        <Pressable style={[styles.btn, empty && styles.btnDisabled]} disabled={empty} onPress={collect}>
          <Text style={styles.btnText}>Collect</Text>
        </Pressable>
      </View>
      <Text style={styles.meterSub}>🐟 {fish}   ({pct}% full)</Text>
      <View style={styles.meter}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meterSub: { color: theme.textDim, fontSize: 12, marginTop: 6 },
  meter: { height: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 5, marginTop: 6 },
  fill: { height: '100%', backgroundColor: theme.accent, borderRadius: 5 },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
