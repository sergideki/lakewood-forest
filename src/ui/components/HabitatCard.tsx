import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { getHabitat, habitatStatus, canBuildHabitat, SPECIES } from '../../engine';
import type { Resources } from '../../engine';
import { CreatureIcon } from './CreatureIcon';

function fmt(sec: number): string {
  if (sec <= 0) return 'ready';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function costLine(cost: Partial<Resources>): string {
  const parts: string[] = [];
  if (cost.fish) parts.push(`${cost.fish} 🐟`);
  if (cost.gold) parts.push(`${cost.gold} 🪙`);
  if (cost.wood) parts.push(`${cost.wood} 🪵`);
  if (cost.acorns) parts.push(`${cost.acorns} 🌰`);
  return parts.join(' · ');
}

export function HabitatCard({ habitatId, now }: { habitatId: string; now: number }) {
  const def = getHabitat(habitatId)!;
  const state = useGameStore((s) => s.state);
  const build = useGameStore((s) => s.buildHabitat);
  const collect = useGameStore((s) => s.collectHabitat);

  // Derive from the already-subscribed stable `state` — never compute in the selector.
  const status = habitatStatus(state, habitatId, now);
  const h = state.habitats.find((x) => x.id === habitatId)!;
  const remaining = h.builtAt ? Math.ceil((h.builtAt + def.attractSec * 1000 - now) / 1000) : 0;
  const affordable = canBuildHabitat(state, habitatId);
  const sp = SPECIES[def.attracts];

  return (
    <View style={cards.card}>
      <View style={styles.header}>
        <Text style={cards.title}>{def.emoji} {def.name}</Text>
        {status === 'done' && <CreatureIcon speciesId={sp.id} emoji={sp.emoji} size={20} />}
      </View>

      {status === 'unbuilt' && (
        <>
          <Text style={styles.sub}>Build to attract a shy pond-dweller ({fmt(def.attractSec)})</Text>
          <View style={styles.footer}>
            <Text style={styles.cost}>{costLine(def.cost)}</Text>
            <Pressable
              style={[styles.btn, !affordable && styles.btnDisabled]}
              disabled={!affordable}
              onPress={() => build(habitatId)}
            >
              <Text style={styles.btnText}>Build</Text>
            </Pressable>
          </View>
        </>
      )}

      {status === 'attracting' && (
        <>
          <Text style={styles.sub}>Attracting… someone's getting curious</Text>
          <Text style={styles.timer}>⏳ {fmt(remaining)}</Text>
        </>
      )}

      {status === 'ready' && (
        <Pressable style={styles.btn} onPress={() => collect(habitatId)}>
          <Text style={styles.btnText}>✨ A friend arrived!</Text>
        </Pressable>
      )}

      {status === 'done' && <Text style={styles.sub}>{sp.name} lives here 💚</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sub: { color: theme.textDim, fontSize: 12, marginTop: 4 },
  timer: { color: theme.accent, fontSize: 18, fontWeight: '700', marginTop: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  cost: { color: theme.text, fontSize: 13 },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
