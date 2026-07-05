import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { VILLAGER_SPRITES } from '../sprites';
import { SpriteIcon } from './SpriteIcon';
import { villagerXpForLevel } from '../../engine';
import type { Station } from '../../engine';

const STATIONS: { key: Station; label: string; emoji: string }[] = [
  { key: 'farm', label: 'Farm', emoji: '🌱' },
  { key: 'forest', label: 'Forest', emoji: '🌲' },
  { key: 'lake', label: 'Lake', emoji: '🎣' },
];
const SPEC_EMOJI: Record<Station, string> = { farm: '🌱', forest: '🌲', lake: '🎣' };

export function VillagerRow() {
  const villagers = useGameStore((s) => s.state.villagers);
  const assign = useGameStore((s) => s.assign);

  return (
    <View style={cards.card}>
      <Text style={cards.title}>🧑‍🌾 Family</Text>
      <Text style={cards.sub}>Send each helper to a station — they level up where they work</Text>
      {villagers.map((v) => {
        const need = villagerXpForLevel(v.level);
        const pct = Math.max(0, Math.min(1, v.xp / need));
        return (
          <View key={v.id} style={styles.villager}>
            <View style={styles.head}>
              <SpriteIcon sprite={VILLAGER_SPRITES[v.id]} emoji={v.emoji} size={26} />
              <View style={styles.meta}>
                <Text style={styles.name}>{v.name} <Text style={styles.lvl}>Lv {v.level}</Text></Text>
                <Text style={styles.spec}>{SPEC_EMOJI[v.specialty]} {v.specialty} specialist</Text>
              </View>
            </View>
            <View style={styles.xpTrack}><View style={[styles.xpFill, { width: `${pct * 100}%` }]} /></View>
            <View style={styles.picker}>
              {STATIONS.map((st) => {
                const on = v.assignedTo === st.key;
                return (
                  <Pressable key={st.key} style={[styles.slot, on && styles.slotOn]}
                    onPress={() => assign(v.id, on ? null : st.key)}>
                    <Text style={[styles.slotText, on && styles.slotTextOn]}>{st.emoji} {st.label}</Text>
                  </Pressable>
                );
              })}
              <Pressable style={[styles.slot, v.assignedTo === null && styles.slotRest]}
                onPress={() => assign(v.id, null)}>
                <Text style={[styles.slotText, v.assignedTo === null && styles.slotTextOn]}>Rest</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  villager: { marginTop: 12, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { flex: 1 },
  name: { color: theme.text, fontSize: 14, fontWeight: '700' },
  lvl: { color: theme.accent, fontSize: 12, fontWeight: '600' },
  spec: { color: theme.textDim, fontSize: 11 },
  xpTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(150,210,160,0.15)', overflow: 'hidden' },
  xpFill: { height: 4, backgroundColor: theme.accent },
  picker: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  slot: { flexGrow: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#26332a', borderWidth: 1, borderColor: 'transparent' },
  slotOn: { borderColor: theme.accent, backgroundColor: '#2e4535' },
  slotRest: { borderColor: theme.cardBorder },
  slotText: { color: theme.textDim, fontSize: 11, fontWeight: '600' },
  slotTextOn: { color: theme.text },
});
