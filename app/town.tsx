import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/ui/theme';
import { cards } from '../src/ui/styles';
import { useGameStore } from '../src/store/gameStore';
import { ResourceBar } from '../src/ui/components/ResourceBar';
import { UpgradeShop } from '../src/ui/components/UpgradeShop';
import { TreatsCard } from '../src/ui/components/TreatsCard';
import { canTradeWoodForFish, TRADE_WOOD_COST, TRADE_FISH_YIELD } from '../src/engine';

function TradeCard() {
  const state = useGameStore((s) => s.state);
  const tradeWood = useGameStore((s) => s.tradeWood);
  const disabled = !canTradeWoodForFish(state);

  return (
    <View style={cards.card}>
      <Text style={cards.title}>🎣 Trading Post</Text>
      <Text style={cards.sub}>Swap surplus lumber for fresh fish</Text>
      <View style={tradeStyles.row}>
        <Text style={tradeStyles.rate}>{TRADE_WOOD_COST}🪵 → {TRADE_FISH_YIELD}🐟</Text>
        <Pressable
          style={[tradeStyles.btn, disabled && tradeStyles.btnDisabled]}
          disabled={disabled}
          onPress={tradeWood}
        >
          <Text style={tradeStyles.btnText}>Trade</Text>
        </Pressable>
      </View>
    </View>
  );
}

const tradeStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  rate: { color: theme.text, fontSize: 14, fontWeight: '600' },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});

// No tick loop: resources never accrue passively into `resources`, and every
// purchase runs applyElapsed first in the store.
export default function Town() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ResourceBar />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <UpgradeShop />
        <TreatsCard />
        <TradeCard />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
});
