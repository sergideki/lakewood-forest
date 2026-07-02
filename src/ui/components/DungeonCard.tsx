import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { getDungeon, teamPower } from '../../engine';

function fmt(sec: number): string {
  if (sec <= 0) return 'ready';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function DungeonCard({ dungeonId, now }: { dungeonId: string; now: number }) {
  const def = getDungeon(dungeonId)!;
  const dungeon = useGameStore((s) => s.state.dungeons.find((d) => d.id === dungeonId)!);
  const idleCreatures = useGameStore((s) => s.state.creatures.filter((c) => c.assignment.type === 'idle'));
  const state = useGameStore((s) => s.state);
  const startDungeon = useGameStore((s) => s.startDungeon);
  const collectDungeon = useGameStore((s) => s.collectDungeon);

  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  // Only creatures still idle can delve — recomputed each render, so stale ids in `selected`
  // (e.g. a creature just sent foraging) are always filtered out here. No effect needed.
  const validSelected = selected.filter((id) => idleCreatures.some((c) => c.id === id));

  const run = dungeon.activeRun;
  const remaining = run ? Math.ceil((run.startedAt + def.durationSec * 1000 - now) / 1000) : 0;
  const ready = run !== null && remaining <= 0;

  return (
    <View style={cards.card}>
      <View style={styles.header}>
        <Text style={cards.title}>{def.emoji} {def.name}</Text>
        <Text style={styles.rec}>⚔️ ~{def.recommendedPower}</Text>
      </View>

      {run === null && (
        <>
          <Text style={styles.sub}>Pick a team, then delve ({fmt(def.durationSec)})</Text>
          <View style={styles.chips}>
            {idleCreatures.length === 0 && <Text style={styles.sub}>No resting creatures.</Text>}
            {idleCreatures.map((c) => {
              const on = selected.includes(c.id);
              return (
                <Pressable key={c.id} style={[styles.chip, on && styles.chipOn]} onPress={() => toggle(c.id)}>
                  <Text style={styles.chipText}>{c.emoji} {c.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={[styles.btn, validSelected.length === 0 && styles.btnDisabled]}
            disabled={validSelected.length === 0}
            onPress={() => { startDungeon(dungeonId, validSelected); setSelected([]); }}
          >
            <Text style={styles.btnText}>Delve · power {teamPower(state, validSelected)}</Text>
          </Pressable>
        </>
      )}

      {run !== null && !ready && (
        <>
          <Text style={styles.sub}>Delving… {run.creatureIds.length} on the trail</Text>
          <Text style={styles.timer}>⏳ {fmt(remaining)}</Text>
        </>
      )}

      {ready && (
        <Pressable style={styles.btn} onPress={() => collectDungeon(dungeonId)}>
          <Text style={styles.btnText}>✨ Collect loot</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rec: { color: theme.textDim, fontSize: 12 },
  sub: { color: theme.textDim, fontSize: 12, marginTop: 4 },
  timer: { color: theme.accent, fontSize: 18, fontWeight: '700', marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 10 },
  chip: { backgroundColor: '#26332a', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'transparent' },
  chipOn: { borderColor: theme.accent, backgroundColor: '#2e4535' },
  chipText: { color: theme.text, fontSize: 12, fontWeight: '600' },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingVertical: 9, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
