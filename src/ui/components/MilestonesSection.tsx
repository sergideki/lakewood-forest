import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { ACHIEVEMENTS, completedCount } from '../../engine';

export function MilestonesSection() {
  // Subscribe the STABLE whole-state ref (zustand v5: never build a fresh array in the selector).
  const state = useGameStore((s) => s.state);
  const done = completedCount(state);

  return (
    <View>
      <View style={cards.card}>
        <Text style={cards.title}>🏆 Milestones</Text>
        <Text style={cards.sub}>{done} / {ACHIEVEMENTS.length} complete</Text>
      </View>
      <View style={styles.list}>
        {ACHIEVEMENTS.map((a) => {
          const { current, target } = a.progress(state);
          const pct = target > 0 ? Math.min(1, current / target) : 0;
          const complete = current >= target;
          return (
            <View key={a.id} style={styles.row}>
              <Text style={styles.emoji}>{a.emoji}</Text>
              <View style={styles.body}>
                <Text style={styles.name}>
                  {a.name} {complete ? '✓' : ''}
                </Text>
                <Text style={styles.desc}>{a.description}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${pct * 100}%` }]} />
                </View>
              </View>
              <Text style={[styles.count, complete && styles.countDone]}>
                {Math.min(current, target)}/{target}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderColor: theme.cardBorder,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: 12,
    marginBottom: theme.gap,
    gap: 12,
  },
  emoji: { fontSize: 28 },
  body: { flex: 1, gap: 4 },
  name: { color: theme.text, fontSize: 14, fontWeight: '600' },
  desc: { color: theme.textDim, fontSize: 12 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(150,210,160,0.15)',
    overflow: 'hidden',
    marginTop: 2,
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: theme.accent },
  count: { color: theme.textDim, fontSize: 12, fontWeight: '600', minWidth: 52, textAlign: 'right' },
  countDone: { color: theme.accent },
});
