import { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/ui/theme';
import { useGameStore } from '../src/store/gameStore';
import { DUNGEONS } from '../src/engine';
import { ResourceBar } from '../src/ui/components/ResourceBar';
import { SatchelCard } from '../src/ui/components/SatchelCard';
import { CreatureRoster } from '../src/ui/components/CreatureRoster';
import { DungeonCard } from '../src/ui/components/DungeonCard';
import { DiscoveryToast } from '../src/ui/components/DiscoveryToast';

export default function Forest() {
  const tick = useGameStore((s) => s.tick);
  const [now, setNow] = useState(() => Date.now());

  // Drive live satchel fill + dungeon countdowns; hard catch-up on foreground.
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
        <SatchelCard />
        <CreatureRoster />
        {DUNGEONS.map((d) => (
          <DungeonCard key={d.id} dungeonId={d.id} now={now} />
        ))}
      </ScrollView>
      <DiscoveryToast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
});
