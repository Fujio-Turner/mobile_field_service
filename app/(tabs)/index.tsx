import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
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
import { memorySave } from '@/src/db/memoryStore';
import { nativeDbAvailable } from '@/src/db/database';
import { seedInboundOrder, seedProductsRatesTaxes } from '@/src/db/seedData';
import { listTodayWork, sourceIdsFromRows, TODAY_PAGE_SIZE } from '@/src/ops/listTodayWork';
import { listTodayOrders } from '@/src/ops/orders';
import type { TodayRow } from '@/src/ops/todayTypes';
import { watchTodayWork, type WatchTodayHandle } from '@/src/ops/watchTodayWork';
import { useAuth } from '@/src/session/AuthContext';
import { NativeBanner } from '@/src/ui/NativeBanner';
import { theme } from '@/src/theme';

export default function TodayScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { status: dbStatus } = useDatabase();
  const day = deviceLocalDay();
  const [rows, setRows] = useState<TodayRow[]>([]);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [orders, setOrders] = useState<Array<{ id: string; number: string; role: string; status: string }>>([]);
  const skipRef = useRef(new Set<string>());
  const inboundOffset = useRef(0);
  const watchRef = useRef<WatchTodayHandle | null>(null);

  const employeeId = session?.employeeId;

  const applyPage0 = useCallback((next: TodayRow[], isPreview: boolean, inboundCount: number) => {
    skipRef.current = sourceIdsFromRows(next);
    inboundOffset.current = TODAY_PAGE_SIZE;
    setRows(next);
    setPreview(isPreview);
    setHasMore(!isPreview && inboundCount >= TODAY_PAGE_SIZE);
  }, []);

  const loadPage0 = useCallback(async () => {
    if (!employeeId) return;
    setError(null);
    try {
      if (!nativeDbAvailable()) {
        const catalog = seedProductsRatesTaxes('0.1.0+1', 1_700_000_000);
        for (const row of catalog.rates) memorySave('rates', row.id, row.doc as never);
        for (const row of catalog.taxes) memorySave('taxes', row.id, row.doc as never);
        const inbound = seedInboundOrder('0.1.0+1', 1_700_000_000, day);
        memorySave('orders', inbound.id, inbound.doc as never);
      }
      const result = await listTodayWork({ employeeId, day, offset: 0 });
      applyPage0(result.rows, result.preview, result.inboundCount);
      const todayOrders = await listTodayOrders(employeeId, day);
      setOrders(
        todayOrders.map((row) => ({
          id: row.id,
          number: String(row.doc.number ?? ''),
          role: String(row.doc.role ?? ''),
          status: String(row.doc.status ?? ''),
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed');
    }
  }, [employeeId, day, applyPage0]);

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
    })();
    return () => {
      cancelled = true;
      void watchRef.current?.stop();
      watchRef.current = null;
    };
  }, [employeeId, day, dbStatus, applyPage0]);

  useFocusEffect(
    useCallback(() => {
      if (preview) void loadPage0();
    }, [preview, loadPage0]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPage0();
    setRefreshing(false);
  }, [loadPage0]);

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
        data={rows}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <TodayRowView
            row={item}
            onPress={(row) => {
              const path =
                row.openCollection === 'workordersout' ? `/wo/out/${row.openId}` : `/wo/in/${row.openId}`;
              router.push(path);
            }}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={theme.color.accent} />
        }
        onEndReached={() => void onEndReached()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View>
            <NativeBanner />
            <Text style={styles.day}>{day}</Text>
            {preview ? (
              <Text style={styles.preview}>Preview from seed. Live list needs a development build.</Text>
            ) : null}
            {error ? (
              <Pressable onPress={() => void loadPage0()} style={styles.errorBox} accessibilityRole="button">
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.retry}>Retry</Text>
              </Pressable>
            ) : null}
            {orders.length > 0 ? (
              <View>
                <Text style={styles.section}>Orders</Text>
                {orders.map((o) => (
                  <Pressable key={o.id} onPress={() => router.push(`/order/${o.id}`)} style={styles.orderRow}>
                    <Text style={styles.orderTitle}>{o.number}</Text>
                    <Text style={styles.muted}>
                      {o.role} · {o.status}
                    </Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => router.push('/order/new')} style={styles.orderRow}>
                  <Text style={styles.retry}>New field order</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => router.push('/order/new')} style={styles.orderRow}>
                <Text style={styles.retry}>Orders</Text>
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={
          dbStatus === 'opening' ? (
            <ActivityIndicator color={theme.color.accent} style={styles.spinner} />
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>No work for today</Text>
              <Text style={styles.muted}>Not synced yet</Text>
            </View>
          )
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
  list: { padding: theme.space.lg, flexGrow: 1 },
  day: {
    fontSize: theme.type.title,
    fontWeight: '600',
    color: theme.color.text,
    marginBottom: theme.space.md,
  },
  preview: {
    fontSize: theme.type.sm,
    color: theme.color.muted,
    marginBottom: theme.space.md,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    padding: theme.space.md,
    borderRadius: theme.radius,
    marginBottom: theme.space.md,
  },
  errorText: { color: theme.color.danger, fontSize: theme.type.md },
  retry: { color: theme.color.accent, fontSize: theme.type.md, marginTop: theme.space.sm, fontWeight: '600' },
  emptyWrap: { paddingTop: theme.space.xl },
  empty: { fontSize: theme.type.lg, color: theme.color.text, fontWeight: '600', marginBottom: theme.space.sm },
  muted: { fontSize: theme.type.md, color: theme.color.muted },
  spinner: { marginVertical: theme.space.lg },
  section: {
    marginTop: theme.space.lg,
    marginBottom: theme.space.xs,
    fontSize: theme.type.sm,
    color: theme.color.muted,
    fontWeight: '600',
  },
  orderRow: { minHeight: 48, justifyContent: 'center', marginBottom: theme.space.sm },
  orderTitle: { fontSize: theme.type.md, color: theme.color.text, fontWeight: '600' },
});
