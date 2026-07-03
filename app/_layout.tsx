import { useEffect } from 'react';
import { Text, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../src/ui/theme';
import { useGameStore } from '../src/store/gameStore';

// Render the tab emoji as the icon so it sits ABOVE a clean text label. Passing the emoji in
// `title` (the old approach) left the icon slot empty, which shows a missing-glyph box.
function tabIcon(emoji: string) {
  return ({ color }: { color: ColorValue; focused: boolean; size: number }) => (
    <Text style={{ fontSize: 20, color }}>{emoji}</Text>
  );
}

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
        <Tabs.Screen name="index"    options={{ title: 'Home',     tabBarIcon: tabIcon('🏡') }} />
        <Tabs.Screen name="forest"   options={{ title: 'Forest',   tabBarIcon: tabIcon('🌲') }} />
        <Tabs.Screen name="friends"  options={{ title: 'Friends',  tabBarIcon: tabIcon('🐿️') }} />
        <Tabs.Screen name="town"     options={{ title: 'Town',     tabBarIcon: tabIcon('🏪') }} />
        <Tabs.Screen name="lake"     options={{ title: 'Lake',     tabBarIcon: tabIcon('🎣') }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('⚙️') }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
