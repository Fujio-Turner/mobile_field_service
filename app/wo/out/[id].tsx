import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/src/theme';

/** Stub until S05 copy-on-write / S06 editor. */
export default function WorkOrderOutStub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: 'Job copy' }} />
      <View style={styles.wrap}>
        <Text style={styles.title}>Outbound editor is the next slice</Text>
        <Text style={styles.muted}>{id}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryLabel}>Back</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.bg, padding: theme.space.lg, justifyContent: 'center' },
  title: { fontSize: theme.type.lg, fontWeight: '600', color: theme.color.text, marginBottom: theme.space.sm },
  muted: { fontSize: theme.type.md, color: theme.color.muted, marginBottom: theme.space.xl },
  secondary: {
    minHeight: 48,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
  },
  secondaryLabel: { color: theme.color.accent, fontSize: theme.type.lg, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
