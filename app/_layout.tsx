import { Tabs } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../src/ui/theme';

export default function Layout() {
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
      </Tabs>
    </SafeAreaProvider>
  );
}
