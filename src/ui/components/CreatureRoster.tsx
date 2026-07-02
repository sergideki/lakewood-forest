import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useGameStore } from '../../store/gameStore';
import { getDungeon } from '../../engine';
import type { Rarity } from '../../engine/types';

const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9fb6a4',
  uncommon: '#7fc8ff',
  rare: '#e6b3ff',
};

export function CreatureRoster() {
  const creatures = useGameStore((s) => s.state.creatures);
  const assignTo = useGameStore((s) => s.assignCreatureTo);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🐿️ Creatures</Text>
      <Text style={styles.sub}>Tap to send foraging (🪵/🌰 by nature); dungeon teams are set below</Text>
      {creatures.map((c) => {
        const inDungeon = c.assignment.type === 'dungeon';
        const foraging = c.assignment.type === 'forage';
        const dungeonName = inDungeon && c.assignment.dungeonId ? getDungeon(c.assignment.dungeonId)?.name : null;
        const status = inDungeon ? `delving ${dungeonName ?? '…'}` : foraging ? `foraging ${c.affinity === 'wood' ? '🪵' : '🌰'}` : 'resting';
        return (
          <Pressable
            key={c.id}
            style={[styles.rowItem, foraging && styles.rowItemOn, inDungeon && styles.rowItemLocked]}
            disabled={inDungeon}
            onPress={() => assignTo(c.id, foraging ? 'idle' : 'forage')}
          >
            <Text style={styles.emoji}>{c.emoji}</Text>
            <View style={styles.meta}>
              <Text style={styles.name}>
                {c.name} <Text style={[styles.rarity, { color: RARITY_COLOR[c.rarity] }]}>• {c.rarity}</Text>
              </Text>
              <Text style={styles.status}>Lv {c.level} · {status}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1,
    borderRadius: theme.radius, padding: 12, marginHorizontal: 16, marginBottom: theme.gap },
  title: { color: theme.text, fontSize: 16, fontWeight: '700' },
  sub: { color: theme.textDim, fontSize: 12, marginTop: 2, marginBottom: 8 },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 10, backgroundColor: '#26332a', marginBottom: 6, borderWidth: 1, borderColor: 'transparent' },
  rowItemOn: { borderColor: theme.accent, backgroundColor: '#2e4535' },
  rowItemLocked: { opacity: 0.55 },
  emoji: { fontSize: 24 },
  meta: { flex: 1 },
  name: { color: theme.text, fontSize: 14, fontWeight: '600' },
  rarity: { fontSize: 11, fontWeight: '600' },
  status: { color: theme.textDim, fontSize: 12, marginTop: 1 },
});
