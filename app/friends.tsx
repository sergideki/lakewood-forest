import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../src/ui/theme';

export default function Screen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>🐿️ Coming soon: Friends — creature journal (Plan 3)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { color: theme.textDim, fontSize: 15, textAlign: 'center' },
});
