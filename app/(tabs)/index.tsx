import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { TodayRowView } from '@/src/features/today/TodayRowView';
import { deviceLocalDay } from '@/src/ids';
import { getOpenedDatabase, nativeDbAvailable } from '@/src/db/database';
import { ensureMemoryOrders } from '@/src/db/ensureMemoryDemo';
import { createWorkOrderIn, CreateWorkOrderInError } from '@/src/ops/createWorkOrderIn';
import { listTodayWork, sourceIdsFromRows, TODAY_PAGE_SIZE } from '@/src/ops/listTodayWork';
import { listTodayOrders } from '@/src/ops/orders';
import type { TodayRow } from '@/src/ops/todayTypes';
import { watchTodayOrders, type TodayOrderRow } from '@/src/ops/watchTodayOrders';
import { watchTodayWork, type WatchTodayHandle } from '@/src/ops/watchTodayWork';
import type { LiveQueryHandle } from '@/src/db/liveQuery';
import { applyInboundDecision } from '@/src/ops/inboundApply';
import { useAuth } from '@/src/session/AuthContext';
import { useJobRules } from '@/src/dev/JobRulesContext';
import { showsTodayJobs, showsTodayOrders, workModesForEmployee } from '@/src/session/workModes';
import { NativeBanner } from '@/src/ui/NativeBanner';
import { useSyncStatus } from '@/src/ui/SyncStatusBar';
import { FieldInput } from '@/src/ui/FieldInput';
import { TodayClock } from '@/src/ui/TodayClock';
import { theme } from '@/src/theme';

export default function TodayScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { rules } = useJobRules();
  const { status: dbStatus } = useDatabase();
  const syncView = useSyncStatus();
  const day = deviceLocalDay();
  const [rows, setRows] = useState<TodayRow[]>([]);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [orders, setOrders] = useState<TodayOrderRow[]>([]);
  const [walkUp, setWalkUp] = useState('');
  const [creating, setCreating] = useState(false);
  const skipRef = useRef(new Set<string>());
  const inboundOffset = useRef(0);
  const watchRef = useRef<WatchTodayHandle | null>(null);
  const ordersWatchRef = useRef<LiveQueryHandle | null>(null);

  const employeeId = session?.employeeId;
  const modes = workModesForEmployee(employeeId);
  const showJobs = showsTodayJobs(modes);
  const showOrders = showsTodayOrders(modes);

  const applyPage0 = useCallback((next: TodayRow[], isPreview: boolean, inboundCount: number) => {
    skipRef.current = sourceIdsFromRows(next);
    inboundOffset.current = TODAY_PAGE_SIZE;
    setRows(next);
    setPreview(isPreview);
    setHasMore(!isPreview && inboundCount >= TODAY_PAGE_SIZE);
  }, []);

  const loadOrders = useCallback(async () => {
    if (!employeeId) return;
    try {
      ensureMemoryOrders(day);
      const todayOrders = await listTodayOrders(employeeId, day);
      setOrders(
        todayOrders.map((row) => ({
          id: row.id,
          number: String(row.doc.number ?? ''),
          role: String(row.doc.role ?? ''),
          status: String(row.doc.status ?? ''),
        })),
      );
    } catch {
      // work list is the primary surface
    }
  }, [employeeId, day]);

  const loadPage0 = useCallback(async () => {
    if (!employeeId) return;
    setError(null);
    try {
      let result = await listTodayWork({ employeeId, day, offset: 0 });
      if (session && nativeDbAvailable() && getOpenedDatabase()) {
        let applied = false;
        for (const row of result.rows) {
          if (row.openCollection !== 'workordersout') continue;
          const out = await applyInboundDecision(row.openId, session, rules);
          if (out.action === 'apply' || out.action === 'drop') applied = true;
        }
        if (applied) result = await listTodayWork({ employeeId, day, offset: 0 });
      }
      applyPage0(result.rows, result.preview, result.inboundCount);
      if (!nativeDbAvailable()) await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed');
    }
  }, [employeeId, day, applyPage0, loadOrders, session, rules]);

  useEffect(() => {
    if (!employeeId) return;
    if (dbStatus === 'opening') return;
    let cancelled = false;
    (async () => {
      const handle = await watchTodayWork({ employeeId, day }, (next, meta) => {
        if (cancelled) return;
        if (meta.error) {
          setError(meta.error);
          return;
        }
        applyPage0(next, meta.preview, meta.inboundCount ?? next.length);
        setError(null);
      });
      watchRef.current = handle;
      const ordersHandle = await watchTodayOrders({ employeeId, day }, (next, meta) => {
        if (cancelled) return;
        if (meta.error) return;
        setOrders(next);
      });
      ordersWatchRef.current = ordersHandle;
    })();
    return () => {
      cancelled = true;
      void watchRef.current?.stop();
      watchRef.current = null;
      void ordersWatchRef.current?.stop();
      ordersWatchRef.current = null;
    };
  }, [employeeId, day, dbStatus, applyPage0]);

  useFocusEffect(
    useCallback(() => {
      if (preview) void loadPage0();
    }, [preview, loadPage0]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (nativeDbAvailable() && dbStatus === 'ready' && session && rows.length > 0) {
        for (const row of rows) {
          if (row.openCollection !== 'workordersout') continue;
          await applyInboundDecision(row.openId, session, rules);
        }
      } else {
        await loadPage0();
      }
    } finally {
      setRefreshing(false);
    }
  }, [dbStatus, loadPage0, rows, rules, session]);

  const openRow = useCallback(
    (row: TodayRow) => {
      if (row.openCollection === 'workordersout') router.push(`/wo/out/${row.openId}`);
      else router.push(`/wo/in/${row.openId}`);
    },
    [router],
  );

  const onEndReached = useCallback(async () => {
    if (!employeeId || preview || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await listTodayWork({
        employeeId,
        day,
        offset: inboundOffset.current,
        skipSourceIds: skipRef.current,
      });
      inboundOffset.current += TODAY_PAGE_SIZE;
      setHasMore(result.inboundCount >= TODAY_PAGE_SIZE);
      setRows((prev) => [...prev, ...result.rows]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed');
    } finally {
      setLoadingMore(false);
    }
  }, [employeeId, day, preview, hasMore, loadingMore]);

  return (
    <View style={styles.screen}>
      <FlatList
        data={showJobs ? rows : []}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <TodayRowView row={item} onPress={openRow} />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={theme.color.accent} />
        }
        onEndReached={() => void onEndReached()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View>
            <NativeBanner showSync={false} />
            <TodayClock rows={rows} />
            {preview ? (
              <Text style={styles.preview}>Preview from seed. Live list needs a development build.</Text>
            ) : null}
            {error ? (
              <Pressable onPress={() => void loadPage0()} style={styles.errorBox} accessibilityRole="button">
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.retry}>Retry</Text>
              </Pressable>
            ) : null}
            {showOrders ? (
              <View style={styles.ordersCard}>
                <Text style={styles.section}>Orders</Text>
                {orders.length > 0 ? (
                  orders.map((o) => (
                    <Pressable key={o.id} onPress={() => router.push(`/order/${o.id}`)} style={styles.orderRow}>
                      <Text style={styles.orderTitle}>{o.number}</Text>
                      <Text style={styles.muted}>
                        {o.role} · {o.status}
                      </Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.muted}>No orders on this day</Text>
                )}
                <Pressable onPress={() => router.push('/order/new')} style={styles.orderCta}>
                  <Text style={styles.retry}>New field order</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.ordersCard}>
              <Text style={styles.section}>Walk-up job</Text>
              <FieldInput
                value={walkUp}
                onChangeText={setWalkUp}
                placeholder="Summary"
                style={styles.input}
                editable={!creating}
                returnKeyType="done"
              />
              <Pressable
                disabled={creating || !session}
                onPress={() => {
                  if (!session) return;
                  setCreating(true);
                  void (async () => {
                    try {
                      const { woinId } = await createWorkOrderIn({
                        session: {
                          employeeId: session.employeeId,
                          email: session.email,
                          username: session.username,
                        },
                        summary: walkUp,
                        kind: 'service',
                      });
                      setWalkUp('');
                      router.push(`/wo/in/${woinId}`);
                    } catch (e) {
                      Alert.alert(
                        'Field job',
                        e instanceof CreateWorkOrderInError ? 'Type a summary first.' : 'Could not create the job.',
                      );
                    } finally {
                      setCreating(false);
                    }
                  })();
                }}
                style={styles.orderCta}
              >
                <Text style={styles.retry}>{creating ? 'Creating…' : 'Create field job'}</Text>
              </Pressable>
            </View>
            {showJobs && rows.length > 0 ? <Text style={styles.section}>Jobs</Text> : null}
          </View>
        }
        ListEmptyComponent={
          dbStatus === 'opening' ? (
            <ActivityIndicator color={theme.color.accent} style={styles.spinner} />
          ) : showJobs ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>No work for today</Text>
              <Text style={styles.muted}>{syncView.detail ?? syncView.title}</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={theme.color.accent} style={styles.spinner} /> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  list: { padding: theme.space.lg, flexGrow: 1, paddingBottom: theme.space.xl },
  preview: {
    fontSize: theme.type.sm,
    color: theme.color.muted,
    marginBottom: theme.space.md,
  },
  errorBox: {
    backgroundColor: theme.color.dangerSoft,
    padding: theme.space.md,
    borderRadius: theme.radius,
    marginBottom: theme.space.md,
  },
  errorText: { color: theme.color.danger, fontSize: theme.type.md },
  retry: { color: theme.color.accent, fontSize: theme.type.md, fontWeight: '600' },
  emptyWrap: { paddingTop: theme.space.xl },
  empty: { fontSize: theme.type.lg, color: theme.color.text, fontWeight: '600', marginBottom: theme.space.sm },
  muted: { fontSize: theme.type.md, color: theme.color.muted },
  spinner: { marginVertical: theme.space.lg },
  section: {
    marginBottom: theme.space.sm,
    fontSize: theme.type.sm,
    color: theme.color.muted,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  ordersCard: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space.md,
    marginBottom: theme.space.lg,
    ...theme.shadow.card,
  },
  orderRow: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: theme.color.border },
  orderTitle: { fontSize: theme.type.md, color: theme.color.text, fontWeight: '600' },
  orderCta: { minHeight: 44, justifyContent: 'center', marginTop: theme.space.sm },
  input: {
    backgroundColor: theme.color.bg,
    borderColor: theme.color.border,
    borderWidth: 1,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.md,
    fontSize: theme.type.md,
    color: theme.color.text,
    minHeight: 48,
  },
});
