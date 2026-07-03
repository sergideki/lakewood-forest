import { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/ui/theme';
import { useGameStore } from '../src/store/gameStore';
import { HABITATS } from '../src/engine';
import { ResourceBar } from '../src/ui/components/ResourceBar';
import { CreelCard } from '../src/ui/components/CreelCard';
import { CreatureRoster } from '../src/ui/components/CreatureRoster';
import { HabitatCard } from '../src/ui/components/HabitatCard';
import { DiscoveryToast } from '../src/ui/components/DiscoveryToast';
import { CatchToast } from '../src/ui/components/CatchToast';

export default function Lake() {
  const tick = useGameStore((s) => s.tick);
  const [now, setNow] = useState(() => Date.now());

  // Live creel fill + habitat countdowns; hard catch-up on foreground.
  useEffect(() => {
    const interval = setInterval(() => { const t = Date.now(); tick(t); setNow(t); }, 1000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') { const t = Date.now(); tick(t); setNow(t); }
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [tick]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ResourceBar />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <CreelCard />
        <CreatureRoster
          filter={(c) => c.affinity === 'fish'}
          title="🐟 Water Friends"
          subtitle="Tap to send fishing — they fill the creel"
          emptyLabel="Build a habitat to attract your first water friend."
        />
        {HABITATS.map((hb) => (
          <HabitatCard key={hb.id} habitatId={hb.id} now={now} />
        ))}
      </ScrollView>
      <DiscoveryToast />
      <CatchToast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
});
