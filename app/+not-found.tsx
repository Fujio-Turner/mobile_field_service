import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/src/theme';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found', headerShown: true }} />
      <View style={styles.wrap}>
        <Text style={styles.title}>Screen not found</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.bg, padding: theme.space.lg, justifyContent: 'center' },
  title: { fontSize: theme.type.lg, color: theme.color.text, marginBottom: theme.space.md },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { color: theme.color.accent, fontSize: theme.type.md },
});
