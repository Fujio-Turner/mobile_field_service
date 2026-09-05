import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/src/session/AuthContext';
import { theme } from '@/src/theme';
import { appVersion } from '@/src/version';

export default function ProfileScreen() {
  const { session, logout, busy } = useAuth();

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Signed in as</Text>
      <Text style={styles.name}>{session?.username ?? '—'}</Text>
      <Text style={styles.muted}>Strategy: {session?.strategy ?? '—'}</Text>
      <Text style={styles.muted}>Version {appVersion()}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={() => {
          void logout();
        }}
        disabled={busy}
        style={({ pressed }) => [styles.danger, pressed && styles.pressed]}
      >
        <Text style={styles.dangerLabel}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.bg, padding: theme.space.lg },
  label: { fontSize: theme.type.sm, color: theme.color.muted, marginTop: theme.space.lg },
  name: { fontSize: theme.type.title, color: theme.color.text, fontWeight: '600', marginBottom: theme.space.sm },
  muted: { fontSize: theme.type.md, color: theme.color.muted, marginBottom: theme.space.xs },
  danger: {
    marginTop: theme.space.xl,
    minHeight: 48,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.danger,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
  },
  dangerLabel: { color: theme.color.danger, fontSize: theme.type.lg, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
