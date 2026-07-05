import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { recruitCost, MAX_VILLAGERS } from '../../engine';

export function RecruitCard() {
  const villagers = useGameStore((s) => s.state.villagers);
  const resources = useGameStore((s) => s.state.resources);
  const recruit = useGameStore((s) => s.recruit);

  const cost = recruitCost(villagers.length);           // computed in body — stable-ref safe
  const full = cost === null;
  const canAfford = !!cost && resources.gold >= cost.gold && resources.acorns >= cost.acorns;

  return (
    <View style={cards.card}>
      <Text style={cards.title}>🧑‍🌾 Welcome a Villager</Text>
      <Text style={cards.sub}>{full ? `Full house — ${MAX_VILLAGERS} / ${MAX_VILLAGERS}` : `Grow your village (${villagers.length} / ${MAX_VILLAGERS})`}</Text>
      <View style={styles.row}>
        <Text style={styles.cost}>{full ? '—' : `${cost!.gold}🪙 ${cost!.acorns}🌰`}</Text>
        <Pressable style={[styles.btn, (!canAfford || full) && styles.btnDisabled]}
          disabled={!canAfford || full} onPress={recruit}>
          <Text style={styles.btnText}>Recruit</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cost: { color: theme.text, fontSize: 14, fontWeight: '600' },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
