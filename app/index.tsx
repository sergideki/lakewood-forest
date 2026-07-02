import { useEffect } from 'react';
import { View, Text, StyleSheet, AppState, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/ui/theme';
import { useGameStore } from '../src/store/gameStore';
import { ResourceBar } from '../src/ui/components/ResourceBar';
import { BarnCard } from '../src/ui/components/BarnCard';
import { PlotGrid } from '../src/ui/components/PlotGrid';
import { VillagerRow } from '../src/ui/components/VillagerRow';

export default function Home() {
  const loaded = useGameStore((s) => s.loaded);
  const load = useGameStore((s) => s.load);
  const tick = useGameStore((s) => s.tick);
  const save = useGameStore((s) => s.save);

  useEffect(() => { load(); }, [load]);

  // Live barn fill while the app is open (visual), plus a hard catch-up on foreground.
  // Persistence happens on backgrounding, not every tick.
  useEffect(() => {
    const interval = setInterval(() => tick(Date.now()), 1000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') tick(Date.now());
      else save();
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [tick, save]);

  if (!loaded) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.loading}>🌿 Waking up Lakewood…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ResourceBar />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <BarnCard />
        <PlotGrid />
        <VillagerRow />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  loading: { color: theme.text, textAlign: 'center', marginTop: 80, fontSize: 16 },
});
