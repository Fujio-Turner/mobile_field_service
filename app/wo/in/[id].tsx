import { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { findOutboundForSources } from '@/src/ops/findOutboundForSources';
import { getWorkOrderIn } from '@/src/ops/getWorkOrderIn';
import { StartWorkError, startWork } from '@/src/ops/startWork';
import type { WorkOrderIn } from '@/src/ops/workOrderIn';
import { useAuth } from '@/src/session/AuthContext';
import { theme } from '@/src/theme';

function formatWindow(startDt: number, endDt?: number): string {
  if (!startDt) return '—';
  const start = new Date(startDt * 1000);
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', hour: 'numeric', minute: '2-digit' };
  const a = start.toLocaleString(undefined, opts);
  if (!endDt) return a;
  return `${a} – ${new Date(endDt * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function addressLine(wo: WorkOrderIn): string {
  const a = wo.site.address;
  if (!a) return '';
  return [a.line1, a.city, a.region, a.postal].filter(Boolean).join(', ');
}

export default function WorkOrderInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [doc, setDoc] = useState<WorkOrderIn | null | undefined>(undefined);
  const [outId, setOutId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!id) {
      setDoc(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const wo = await getWorkOrderIn(id);
      if (cancelled) return;
      setDoc(wo);
      if (wo && session?.employeeId) {
        const refs = await findOutboundForSources(session.employeeId, [wo.id]);
        if (!cancelled) setOutId(refs.get(wo.id)?.id ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, session?.employeeId]);

  if (doc === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: 'Job' }} />
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.accent} />
        </View>
      </>
    );
  }

  if (!doc) {
    return (
      <>
        <Stack.Screen options={{ title: 'Not found' }} />
        <View style={styles.center}>
          <Text style={styles.empty}>Work order not found</Text>
        </View>
      </>
    );
  }

  const mine = session?.employeeId === doc.assignedTo.employeeId;
  const canStart = mine && !outId;

  return (
    <>
      <Stack.Screen options={{ title: doc.number }} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.kicker}>
          {doc.priority} · {doc.status}
          {doc.kind ? ` · ${doc.kind}` : ''}
        </Text>
        <Text style={styles.summary}>{doc.summary}</Text>
        {doc.description ? <Text style={styles.muted}>{doc.description}</Text> : null}

        <Text style={styles.section}>Site</Text>
        <Text style={styles.value}>{doc.site.name || '—'}</Text>
        {addressLine(doc) ? <Text style={styles.muted}>{addressLine(doc)}</Text> : null}
        {doc.site.geo ? (
          <Text style={styles.muted}>
            {doc.site.geo.lat.toFixed(4)}, {doc.site.geo.lon.toFixed(4)}
          </Text>
        ) : null}

        <Text style={styles.section}>Window</Text>
        <Text style={styles.value}>{formatWindow(doc.scheduled.startDt, doc.scheduled.endDt)}</Text>
        {doc.scheduled.day ? <Text style={styles.muted}>{doc.scheduled.day}</Text> : null}

        <Text style={styles.section}>Assigned</Text>
        <Text style={styles.value}>{doc.assignedTo.displayName ?? doc.assignedTo.username ?? doc.assignedTo.employeeId}</Text>
        <Text style={styles.muted}>{doc.assignedTo.employeeId}</Text>

        {doc.operations.length > 0 ? (
          <>
            <Text style={styles.section}>Operations</Text>
            {doc.operations.map((op, i) => (
              <Text key={op.id ?? String(i)} style={styles.value}>
                {op.name ?? op.code ?? 'Step'} {op.status ? `· ${op.status}` : ''}
              </Text>
            ))}
          </>
        ) : null}

        {doc.materials.length > 0 ? (
          <>
            <Text style={styles.section}>Materials</Text>
            {doc.materials.map((m, i) => (
              <Text key={m.sku ?? String(i)} style={styles.value}>
                {m.name ?? m.sku ?? 'Item'}
                {m.qtyPlanned != null ? ` × ${m.qtyPlanned}` : ''}
              </Text>
            ))}
          </>
        ) : null}

        {doc.assetIds.length > 0 ? (
          <>
            <Text style={styles.section}>Assets</Text>
            {doc.assetIds.map((a) => (
              <Text key={a} style={styles.value}>
                {a}
              </Text>
            ))}
          </>
        ) : null}

        {doc.checklist.length > 0 ? (
          <>
            <Text style={styles.section}>Checklist</Text>
            {doc.checklist.map((c, i) => (
              <Text key={c.id ?? String(i)} style={styles.value}>
                {c.done ? 'Done' : 'Open'} · {c.label ?? 'Item'}
              </Text>
            ))}
          </>
        ) : null}

        {outId ? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            onPress={() => router.push(`/wo/out/${outId}`)}
          >
            <Text style={styles.primaryLabel}>Open job</Text>
          </Pressable>
        ) : canStart ? (
          <Pressable
            accessibilityRole="button"
            disabled={starting}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed, starting && styles.pressed]}
            onPress={() => {
              if (!session) return;
              setStarting(true);
              void (async () => {
                try {
                  const result = await startWork(doc.id, {
                    employeeId: session.employeeId,
                    email: session.email,
                    username: session.username,
                  });
                  setOutId(result.wooutId);
                  router.push(`/wo/out/${result.wooutId}`);
                } catch (e) {
                  const code = e instanceof StartWorkError ? e.code : 'missing';
                  const msg =
                    code === 'inbound_not_assigned'
                      ? 'This job is not assigned to you.'
                      : code === 'inbound_not_startable'
                        ? 'This job cannot be started.'
                        : 'Could not start work.';
                  Alert.alert('Start work', msg);
                } finally {
                  setStarting(false);
                }
              })();
            }}
          >
            <Text style={styles.primaryLabel}>{starting ? 'Starting…' : 'Start work'}</Text>
          </Pressable>
        ) : (
          <Text style={styles.muted}>This job is not assigned to you.</Text>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.bg },
  empty: { fontSize: theme.type.lg, color: theme.color.text },
  body: { padding: theme.space.lg, paddingBottom: theme.space.xl * 2, backgroundColor: theme.color.bg },
  kicker: { fontSize: theme.type.sm, color: theme.color.muted, marginBottom: theme.space.sm, textTransform: 'capitalize' },
  summary: { fontSize: theme.type.title, fontWeight: '600', color: theme.color.text, marginBottom: theme.space.sm },
  section: {
    marginTop: theme.space.lg,
    marginBottom: theme.space.xs,
    fontSize: theme.type.sm,
    color: theme.color.muted,
    fontWeight: '600',
  },
  value: { fontSize: theme.type.md, color: theme.color.text, marginBottom: 2 },
  muted: { fontSize: theme.type.md, color: theme.color.muted, marginBottom: 2 },
  primary: {
    marginTop: theme.space.xl,
    backgroundColor: theme.color.accent,
    minHeight: 48,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { color: theme.color.onAccent, fontSize: theme.type.lg, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
