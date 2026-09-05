import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/src/theme';

export default function TodayScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.empty}>No work for today</Text>
      <Text style={styles.muted}>Jobs appear here after the database slice.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: theme.color.bg,
    padding: theme.space.lg,
    justifyContent: 'center',
  },
  empty: {
    fontSize: theme.type.lg,
    color: theme.color.text,
    fontWeight: '600',
    marginBottom: theme.space.sm,
  },
  muted: { fontSize: theme.type.md, color: theme.color.muted },
});
