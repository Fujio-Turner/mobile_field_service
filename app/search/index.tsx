import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { FieldInput } from '@/src/ui/FieldInput';
import { Stack } from 'expo-router';
import { memorySave } from '@/src/db/memoryStore';
import { nativeDbAvailable } from '@/src/db/database';
import { SEED_CUSTOMER_ID, seedAssets, seedCustomerDoc, seedProductsRatesTaxes } from '@/src/db/seedData';
import { listOpenJobs } from '@/src/ops/assets';
import { ftsSearch, type FtsHit } from '@/src/ops/ftsSearch';
import { useAuth } from '@/src/session/AuthContext';
import { searchKinds, workModesFromSession } from '@/src/session/workModes';
import { NativeBanner } from '@/src/ui/NativeBanner';
import { theme } from '@/src/theme';

function ensure() {
  if (nativeDbAvailable()) return;
  for (const row of seedAssets('0.1.0+1', 1_700_000_000)) memorySave('assets', row.id, row.doc as never);
  const c = seedProductsRatesTaxes('0.1.0+1', 1_700_000_000);
  for (const row of c.products) memorySave('products', row.id, row.doc as never);
  memorySave('customers', SEED_CUSTOMER_ID, seedCustomerDoc('0.1.0+1', 1_700_000_000) as never);
}

function placeholderFor(kinds: string[]): string {
  const labels = kinds.filter((k) => k !== 'note');
  if (labels.length === 0) return 'Search notes';
  return `Notes / ${labels.join(' / ')}`;
}

export default function SearchScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const modes = workModesFromSession(session);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<FtsHit[]>([]);
  const [kitJob, setKitJob] = useState(false);
  const qRef = useRef(q);
  qRef.current = q;
  const kinds = useMemo(() => searchKinds(modes, { kitJob }), [modes, kitJob]);

  const search = useCallback(async () => {
    ensure();
    const needle = qRef.current.trim();
    setRows(needle ? await ftsSearch(needle, kinds) : []);
  }, [kinds]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        ensure();
        if (session) {
          const jobs = await listOpenJobs(session.employeeId);
          if (!cancelled) setKitJob(jobs.some((j) => j.kit));
        }
        const needle = qRef.current.trim();
        const hits = needle ? await ftsSearch(needle, kinds) : [];
        if (!cancelled) setRows(hits);
      })();
      return () => {
        cancelled = true;
      };
    }, [kinds, session]),
  );

  function openHit(item: FtsHit) {
    if (item.kind === 'asset') router.push(`/asset/${item.id}`);
    else if (item.kind === 'note') router.push(`/note/${item.id}`);
    else if (item.kind === 'customer') router.push(`/customer/${item.id}`);
    else if (item.kind === 'product') {
      router.push(`/order/new?productId=${encodeURIComponent(item.id)}`);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Search' }} />
      <View style={styles.wrap}>
        <NativeBanner />
        <FieldInput
          value={q}
          onChangeText={setQ}
          onEndEditing={() => void search()}
          placeholder={placeholderFor(kinds)}
          returnKeyType="search"
          placeholderTextColor={theme.color.muted}
          style={styles.input}
        />
        <FlatList
          data={rows}
          keyExtractor={(item) => `${item.kind}:${item.id}`}
          renderItem={({ item }) => (
            <Pressable onPress={() => openHit(item)} style={styles.row}>
              <Text style={styles.kicker}>{item.kind}</Text>
              <Text style={styles.title}>{item.title}</Text>
              {item.sub ? <Text style={styles.muted}>{item.sub}</Text> : null}
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.muted}>{q.trim() ? 'No hits' : `Type to search ${placeholderFor(kinds).toLowerCase()}`}</Text>
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.bg, padding: theme.space.lg },
  input: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.border,
    borderWidth: 1,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.md,
    fontSize: theme.type.md,
    color: theme.color.text,
    minHeight: 48,
    marginBottom: theme.space.md,
  },
  row: { minHeight: 56, borderBottomWidth: 1, borderBottomColor: theme.color.border, justifyContent: 'center' },
  kicker: { fontSize: theme.type.sm, color: theme.color.muted },
  title: { fontSize: theme.type.md, color: theme.color.text, fontWeight: '600' },
  muted: { fontSize: theme.type.md, color: theme.color.muted },
});
