import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { deviceLocalDay } from '@/src/ids';
import { syncSnapshot, type SyncSnapshot } from '@/src/ops/syncSnapshot';
import { getTrackingDay, getTrackingLastNDays } from '@/src/ops/tracking';
import { refreshPendingCount } from '@/src/sync/replicator';
import { useAuth } from '@/src/session/AuthContext';
import { NativeBanner } from '@/src/ui/NativeBanner';
import { theme } from '@/src/theme';
import { appVersion } from '@/src/version';

export default function ProfileScreen() {
  const router = useRouter();
  const { session, logout, busy, needsReauth } = useAuth();
  const { dbName, status } = useDatabase();
  const [crumbToday, setCrumbToday] = useState<number | null>(null);
  const [crumbDays, setCrumbDays] = useState<number | null>(null);
  const [sync, setSync] = useState<SyncSnapshot | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      void (async () => {
        const today = await getTrackingDay(session.employeeId, deviceLocalDay());
        const map = today?.tracking as Record<string, unknown> | undefined;
        setCrumbToday(map ? Object.keys(map).length : 0);
        const week = await getTrackingLastNDays(session.employeeId, 7);
        setCrumbDays(week.filter((d) => d.doc != null).length);
        await refreshPendingCount();
        setSync(syncSnapshot());
      })();
    }, [session]),
  );

  return (
    <View style={styles.wrap}>
      <NativeBanner />
      <Text style={styles.label}>Signed in as</Text>
      <Text style={styles.name}>{session?.username ?? '—'}</Text>
      <Text style={styles.muted}>{session?.email ?? '—'}</Text>
      <Text style={styles.muted}>Employee {session?.employeeId ?? '—'}</Text>
      <Text style={styles.muted}>Strategy: {session?.strategy ?? '—'}</Text>
      <Text style={styles.muted}>Database: {dbName ?? status}</Text>
      <Text style={styles.muted}>Version {appVersion()}</Text>
      {crumbToday != null ? (
        <Text style={styles.muted}>
          Crumbs today {crumbToday} · days with crumbs {crumbDays ?? 0}/7 (no map dump)
        </Text>
      ) : null}

      <Text style={styles.label}>Sync</Text>
      <Text style={styles.muted}>
        {sync
          ? sync.skippedReason === 'demo'
            ? 'Demo — replicator off'
            : `${sync.activity}${sync.started ? '' : ' (not started)'}${
                sync.pending ? ` · pending ${sync.pending}` : ''
              }${sync.lastErrorCode != null ? ` · error ${sync.lastErrorCode}` : ''}`
          : '—'}
      </Text>
      {sync?.progressTotal ? (
        <Text style={styles.muted}>
          Progress {sync.progressCompleted ?? 0}/{sync.progressTotal}
        </Text>
      ) : null}

      {needsReauth ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in to sync"
          onPress={() => router.push('/login')}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryLabel}>Sign in to sync</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search"
        onPress={() => router.push('/search')}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryLabel}>Search</Text>
      </Pressable>

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
  secondary: {
    marginTop: theme.space.lg,
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
