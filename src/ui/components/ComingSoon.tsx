import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

export function ComingSoon({ text }: { text: string }) {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { color: theme.textDim, fontSize: 15, textAlign: 'center' },
});
