import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { TREAT_COST_ACORNS, TREAT_XP, xpForLevel } from '../../engine';
import { CreatureIcon } from './CreatureIcon';

export function TreatsCard() {
  const creatures = useGameStore((s) => s.state.creatures);
  const acorns = useGameStore((s) => s.state.resources.acorns);
  const feedTreat = useGameStore((s) => s.feedTreat);
  const broke = acorns < TREAT_COST_ACORNS;

  return (
    <View style={cards.card}>
      <Text style={cards.title}>🍪 Treats</Text>
      <Text style={cards.sub}>{TREAT_COST_ACORNS} 🌰 → +{TREAT_XP} XP for a friend</Text>
      {creatures.map((c) => (
        <View key={c.id} style={styles.row}>
          <CreatureIcon speciesId={c.species} emoji={c.emoji} size={24} />
          <View style={styles.info}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.meta}>Lv {c.level} · {Math.floor(c.xp)}/{xpForLevel(c.level, c.rarity)} xp</Text>
          </View>
          <Pressable
            style={[styles.btn, broke && styles.btnDisabled]}
            disabled={broke}
            onPress={() => feedTreat(c.id)}
          >
            <Text style={styles.btnText}>Feed</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  info: { flex: 1 },
  name: { color: theme.text, fontSize: 14, fontWeight: '600' },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 1 },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
