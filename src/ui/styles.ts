import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const cards = StyleSheet.create({
  card: {
    backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1,
    borderRadius: theme.radius, padding: 12, marginHorizontal: 16, marginBottom: theme.gap,
  },
  title: { color: theme.text, fontSize: 16, fontWeight: '700' },
  sub: { color: theme.textDim, fontSize: 12, marginTop: 2, marginBottom: 8 },
});
