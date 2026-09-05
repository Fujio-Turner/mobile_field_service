import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/src/theme';

export default function ChatScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Chat</Text>
      <Text style={styles.muted}>Employee threads land in a later slice.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.bg, padding: theme.space.lg, justifyContent: 'center' },
  title: { fontSize: theme.type.lg, color: theme.color.text, fontWeight: '600', marginBottom: theme.space.sm },
  muted: { fontSize: theme.type.md, color: theme.color.muted },
});
