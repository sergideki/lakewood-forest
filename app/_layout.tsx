import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../src/ui/theme';
import { useGameStore } from '../src/store/gameStore';

export default function Layout() {
  // Hydrate at the root: a deep link straight to /town or /forest must load the
  // save before any commit can persist over it (Home is not always mounted first).
  const load = useGameStore((s) => s.load);
  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: '#141d18', borderTopColor: theme.cardBorder },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textDim,
        }}
      >
        <Tabs.Screen name="index"   options={{ title: '🏡 Home' }} />
        <Tabs.Screen name="forest"  options={{ title: '🌲 Forest' }} />
        <Tabs.Screen name="friends" options={{ title: '🐿️ Friends' }} />
        <Tabs.Screen name="town"    options={{ title: '🏪 Town' }} />
        <Tabs.Screen name="lake"    options={{ title: '🎣 Lake' }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
