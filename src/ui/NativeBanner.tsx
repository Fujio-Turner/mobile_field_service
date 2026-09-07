import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDatabase } from '../db/DatabaseProvider';
import { useAuth } from '../session/AuthContext';
import { theme } from '../theme';
import { SyncStatusBar } from './SyncStatusBar';

export function NativeBanner({ showSync = true }: { showSync?: boolean }) {
  const { status, error, retry } = useDatabase();
  const { needsReauth } = useAuth();
  if (needsReauth) {
    return (
      <View style={styles.warn}>
        <Text style={styles.warnText}>Sign in to sync. Local work stays on this device.</Text>
      </View>
    );
  }
  if (status === 'unavailable') {
    return (
      <View style={styles.warn}>
        <Text style={styles.warnText}>
          Development build required for Couchbase Lite. Expo Go cannot open the local database.
        </Text>
      </View>
    );
  }
  if (status === 'error') {
    return (
      <Pressable onPress={() => retry()} style={styles.err} accessibilityRole="button">
        <Text style={styles.errText}>{error ?? 'Database failed to open'}</Text>
        <Text style={styles.retry}>Retry</Text>
      </Pressable>
    );
  }
  if (status === 'opening') {
    return (
      <View style={styles.warn}>
        <Text style={styles.warnText}>Opening database…</Text>
      </View>
    );
  }
  return showSync ? <SyncStatusBar /> : null;
}

const styles = StyleSheet.create({
  warn: {
    backgroundColor: theme.color.warnSoft,
    padding: theme.space.md,
    marginBottom: theme.space.md,
    borderRadius: theme.radius,
  },
  warnText: { color: theme.color.warn, fontSize: theme.type.md },
  err: {
    backgroundColor: theme.color.dangerSoft,
    padding: theme.space.md,
    marginBottom: theme.space.md,
    borderRadius: theme.radius,
  },
  errText: { color: theme.color.danger, fontSize: theme.type.md },
  retry: { color: theme.color.accent, fontSize: theme.type.md, fontWeight: '600', marginTop: 4 },
});
