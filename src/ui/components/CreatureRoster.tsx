import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { getDungeon } from '../../engine';
import { CreatureIcon } from './CreatureIcon';
import { RARITY_COLOR } from '../rarity';
import type { Creature } from '../../engine/types';

const FORAGE_GLYPH = { wood: '🪵', acorn: '🌰', fish: '🐟' } as const;

export function CreatureRoster({
  filter = (c: Creature) => c.affinity !== 'fish',
  title = '🐿️ Creatures',
  subtitle = 'Tap to send foraging (🪵/🌰 by nature); dungeon teams are set below',
  emptyLabel,
}: {
  filter?: (c: Creature) => boolean;
  title?: string;
  subtitle?: string;
  emptyLabel?: string;
} = {}) {
  const creatures = useGameStore((s) => s.state.creatures);
  const assignTo = useGameStore((s) => s.assignCreatureTo);
  const shown = creatures.filter(filter);

  return (
    <View style={cards.card}>
      <Text style={cards.title}>{title}</Text>
      <Text style={cards.sub}>{subtitle}</Text>
      {shown.length === 0 && emptyLabel && <Text style={cards.sub}>{emptyLabel}</Text>}
      {shown.map((c) => {
        const inDungeon = c.assignment.type === 'dungeon';
        const foraging = c.assignment.type === 'forage';
        const dungeonName = inDungeon && c.assignment.dungeonId ? getDungeon(c.assignment.dungeonId)?.name : null;
        const status = inDungeon ? `delving ${dungeonName ?? '…'}` : foraging ? `foraging ${FORAGE_GLYPH[c.affinity]}` : 'resting';
        return (
          <Pressable
            key={c.id}
            style={[styles.rowItem, foraging && styles.rowItemOn, inDungeon && styles.rowItemLocked]}
            disabled={inDungeon}
            onPress={() => assignTo(c.id, foraging ? 'idle' : 'forage')}
          >
            <CreatureIcon speciesId={c.species} emoji={c.emoji} size={24} />
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
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 10, backgroundColor: '#26332a', marginBottom: 6, borderWidth: 1, borderColor: 'transparent' },
  rowItemOn: { borderColor: theme.accent, backgroundColor: '#2e4535' },
  rowItemLocked: { opacity: 0.55 },
  meta: { flex: 1 },
  name: { color: theme.text, fontSize: 14, fontWeight: '600' },
  rarity: { fontSize: 11, fontWeight: '600' },
  status: { color: theme.textDim, fontSize: 12, marginTop: 1 },
});
