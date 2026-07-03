import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { UPGRADES, UPGRADE_IDS, upgradeCost, upgradeLevel, canAfford } from '../../engine';
import type { Resources } from '../../engine';

function costLine(cost: Resources): string {
  const parts: string[] = [];
  if (cost.gold) parts.push(`${cost.gold} 🪙`);
  if (cost.wood) parts.push(`${cost.wood} 🪵`);
  if (cost.acorns) parts.push(`${cost.acorns} 🌰`);
  return parts.join(' · ');
}

export function UpgradeShop() {
  // `s.state` is the stable committed snapshot — safe; derive everything in render.
  const state = useGameStore((s) => s.state);
  const purchase = useGameStore((s) => s.purchase);

  return (
    <>
      {UPGRADE_IDS.map((id) => {
        const def = UPGRADES[id];
        const level = upgradeLevel(state, id);
        const cost = upgradeCost(id, level);
        const affordable = canAfford(state, id);
        return (
          <View key={id} style={cards.card}>
            <View style={styles.header}>
              <Text style={cards.title}>{def.emoji} {def.name}</Text>
              <Text style={styles.level}>Lv {level}/{def.maxLevel}</Text>
            </View>
            <Text style={cards.sub}>{def.description}</Text>
            <View style={styles.footer}>
              <Text style={cost ? styles.cost : styles.max}>{cost ? costLine(cost) : 'MAX'}</Text>
              {cost !== null && (
                <Pressable
                  style={[styles.btn, !affordable && styles.btnDisabled]}
                  disabled={!affordable}
                  onPress={() => purchase(id)}
                >
                  <Text style={styles.btnText}>Buy</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  level: { color: theme.accent, fontSize: 13, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cost: { color: theme.text, fontSize: 13 },
  max: { color: theme.textDim, fontSize: 13, fontWeight: '700' },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
