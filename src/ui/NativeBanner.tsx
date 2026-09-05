import { StyleSheet, Text, View } from 'react-native';
import { useDatabase } from '../db/DatabaseProvider';
import { theme } from '../theme';

export function NativeBanner() {
  const { status, error, dbName } = useDatabase();
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
  if (status === 'ready' && dbName) {
    return (
      <View style={styles.ok}>
        <Text style={styles.okText}>Local database {dbName}</Text>
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
    backgroundColor: '#fff7ed',
    padding: theme.space.md,
    marginBottom: theme.space.md,
    borderRadius: theme.radius,
  },
  warnText: { color: theme.color.warn, fontSize: theme.type.md },
  err: {
    backgroundColor: '#fef2f2',
    padding: theme.space.md,
    marginBottom: theme.space.md,
    borderRadius: theme.radius,
  },
  errText: { color: theme.color.danger, fontSize: theme.type.md },
  ok: {
    backgroundColor: '#f0fdf4',
    padding: theme.space.md,
    marginBottom: theme.space.md,
    borderRadius: theme.radius,
  },
  okText: { color: theme.color.ok, fontSize: theme.type.sm },
});
