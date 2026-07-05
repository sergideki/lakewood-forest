import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import {
  LANDMARK_IDS, LANDMARKS,
  canBuildLandmark, allLandmarksBuilt,
  canFundFestival, festivalCost, prosperityMult,
} from '../../engine';
import type { Resources } from '../../engine';
import { LandmarkIcon } from './LandmarkIcon';

function costLine(cost: Partial<Resources>): string {
  const parts: string[] = [];
  if (cost.gold) parts.push(`${cost.gold} 🪙`);
  if (cost.wood) parts.push(`${cost.wood} 🪵`);
  if (cost.acorns) parts.push(`${cost.acorns} 🌰`);
  if (cost.fish) parts.push(`${cost.fish} 🐟`);
  return parts.join(' · ');
}

/** +25% etc. from a landmark's amount (catchChance shows as flat points). */
function buffLabel(id: string): string {
  const def = LANDMARKS[id];
  const pct = Math.round(def.amount * 100);
  switch (def.lever) {
    case 'catchChance': return `+${pct}% catch chance`;
    case 'treatXp': return `+${pct}% treat XP`;
    case 'forageRate': return `+${pct}% forage`;
    case 'villagerXp': return `+${pct}% villager XP`;
    case 'barnCap': return `+${pct}% barn cap`;
    case 'tradeYield': return `+${pct}% trade yield`;
    case 'creelCap': return `+${pct}% creel cap`;
    case 'farmRate': return `+${pct}% farm output`;
    default: return `+${pct}%`;
  }
}

function LandmarkRow({ id }: { id: string }) {
  const def = LANDMARKS[id];
  const state = useGameStore((s) => s.state);
  const build = useGameStore((s) => s.buildLandmark);

  const built = state.landmarks.includes(id);
  const affordable = canBuildLandmark(state, id);

  return (
    <View style={styles.row}>
      <LandmarkIcon landmarkId={id} emoji={def.emoji} size={34} />
      <View style={styles.info}>
        <Text style={styles.name}>{def.name}</Text>
        <Text style={styles.blurb}>{def.blurb}</Text>
        <Text style={styles.buff}>{buffLabel(id)}{built ? '' : ` · ${costLine(def.cost)}`}</Text>
      </View>
      {built ? (
        <Text style={styles.builtTag}>✓ built</Text>
      ) : (
        <Pressable
          style={[styles.btn, !affordable && styles.btnDisabled]}
          disabled={!affordable}
          onPress={() => build(id)}
        >
          <Text style={styles.btnText}>Build</Text>
        </Pressable>
      )}
    </View>
  );
}

function FestivalCard() {
  const state = useGameStore((s) => s.state);
  const fund = useGameStore((s) => s.fundFestival);
  const affordable = canFundFestival(state);
  const cost = festivalCost(state.festivalLevel);
  const boostPct = Math.round((prosperityMult(state) - 1) * 100);

  return (
    <View style={styles.festival}>
      <View style={styles.festHeader}>
        <Text style={styles.festTitle}>🏮 Lantern Festival</Text>
        <Text style={styles.prosperity}>Prosperity +{boostPct}%</Text>
      </View>
      <Text style={styles.blurb}>Hold a festival to make the whole valley flourish.</Text>
      <View style={styles.footer}>
        <Text style={styles.cost}>{costLine(cost)}</Text>
        <Pressable
          style={[styles.btn, !affordable && styles.btnDisabled]}
          disabled={!affordable}
          onPress={() => fund()}
        >
          <Text style={styles.btnText}>Hold Festival</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function VillageGreenCard() {
  const built = useGameStore((s) => s.state.landmarks.length);
  const allBuilt = useGameStore((s) => allLandmarksBuilt(s.state));

  return (
    <View style={cards.card}>
      <Text style={cards.title}>🌳 Village Green</Text>
      <Text style={cards.sub}>Beautify the valley — {built}/{LANDMARK_IDS.length} landmarks built</Text>
      {LANDMARK_IDS.map((id) => (
        <LandmarkRow key={id} id={id} />
      ))}
      {allBuilt && <FestivalCard />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.cardBorder },
  info: { flex: 1 },
  name: { color: theme.text, fontSize: 14, fontWeight: '600' },
  blurb: { color: theme.textDim, fontSize: 12, marginTop: 1 },
  buff: { color: theme.accent, fontSize: 12, marginTop: 2, fontWeight: '600' },
  builtTag: { color: theme.textDim, fontSize: 13, fontWeight: '700' },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
  festival: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.cardBorder },
  festHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  festTitle: { color: theme.text, fontSize: 15, fontWeight: '700' },
  prosperity: { color: theme.accent, fontSize: 13, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  cost: { color: theme.text, fontSize: 13 },
});
