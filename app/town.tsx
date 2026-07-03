import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/ui/theme';
import { ResourceBar } from '../src/ui/components/ResourceBar';
import { UpgradeShop } from '../src/ui/components/UpgradeShop';
import { TreatsCard } from '../src/ui/components/TreatsCard';

// No tick loop: resources never accrue passively into `resources`, and every
// purchase runs applyElapsed first in the store.
export default function Town() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ResourceBar />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <UpgradeShop />
        <TreatsCard />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
});
