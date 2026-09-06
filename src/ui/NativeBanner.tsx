import { StyleSheet, Text, View } from 'react-native';
import { useDatabase } from '../db/DatabaseProvider';
import { useAuth } from '../session/AuthContext';
import { theme } from '../theme';

export function NativeBanner() {
  const { status, error } = useDatabase();
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
          Development build required for Couchbase Lite. Expo Go cannot open the encrypted database.
        </Text>
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={styles.err}>
        <Text style={styles.errText}>{error ?? 'Database failed to open'}</Text>
      </View>
    );
  }
  if (status === 'opening') {
    return (
      <View style={styles.warn}>
        <Text style={styles.warnText}>Opening database…</Text>
      </View>
    );
  }
  return null;
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
});
