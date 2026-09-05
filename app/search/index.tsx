import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { memorySave } from '@/src/db/memoryStore';
import { nativeDbAvailable } from '@/src/db/database';
import { SEED_CUSTOMER_ID, seedAssets, seedCustomerDoc, seedProductsRatesTaxes } from '@/src/db/seedData';
import { listCustomerHistory, type CustomerHistoryRow } from '@/src/ops/customerHistory';
import { ftsSearch, type FtsHit } from '@/src/ops/ftsSearch';
import { NativeBanner } from '@/src/ui/NativeBanner';
import { theme } from '@/src/theme';

function ensure() {
  if (nativeDbAvailable()) return;
  for (const row of seedAssets('0.1.0+1', 1_700_000_000)) memorySave('assets', row.id, row.doc as never);
  const c = seedProductsRatesTaxes('0.1.0+1', 1_700_000_000);
  for (const row of c.products) memorySave('products', row.id, row.doc as never);
  memorySave('customers', SEED_CUSTOMER_ID, seedCustomerDoc('0.1.0+1', 1_700_000_000) as never);
}

export default function SearchScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<FtsHit[]>([]);
  const [history, setHistory] = useState<CustomerHistoryRow[]>([]);

  const run = useCallback(async () => {
    ensure();
    setRows(await ftsSearch(q));
    setHistory(await listCustomerHistory(SEED_CUSTOMER_ID));
  }, [q]);

  useFocusEffect(
    useCallback(() => {
      void run();
    }, [run]),
  );

  function openHit(item: FtsHit) {
    if (item.kind === 'asset') router.push(`/asset/${item.id}`);
    else if (item.kind === 'note') router.push(`/note/${item.id}`);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Search' }} />
      <View style={styles.wrap}>
        <NativeBanner />
        <TextInput
          value={q}
          onChangeText={setQ}
          onEndEditing={() => void run()}
          placeholder="Notes / products / assets"
          placeholderTextColor={theme.color.muted}
          style={styles.input}
        />
        <FlatList
          data={rows}
          keyExtractor={(item) => `${item.kind}:${item.id}`}
          ListHeaderComponent={
            history.length > 0 ? (
              <View>
                <Text style={styles.section}>Complete jobs (Hartford)</Text>
                {history.map((h) => (
                  <Pressable key={h.id} onPress={() => router.push(`/wo/out/${h.id}`)} style={styles.row}>
                    <Text style={styles.kicker}>history</Text>
                    <Text style={styles.title}>{h.number}</Text>
                    <Text style={styles.muted} numberOfLines={1}>
                      {h.summary}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => openHit(item)} style={styles.row}>
              <Text style={styles.kicker}>{item.kind}</Text>
              <Text style={styles.title}>{item.title}</Text>
              {item.sub ? <Text style={styles.muted}>{item.sub}</Text> : null}
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.muted}>{q.trim() ? 'No hits' : 'Type to search notes, products, assets'}</Text>}
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
  section: {
    fontSize: theme.type.sm,
    color: theme.color.muted,
    fontWeight: '600',
    marginBottom: theme.space.sm,
  },
  row: { minHeight: 56, borderBottomWidth: 1, borderBottomColor: theme.color.border, justifyContent: 'center' },
  kicker: { fontSize: theme.type.sm, color: theme.color.muted },
  title: { fontSize: theme.type.md, color: theme.color.text, fontWeight: '600' },
  muted: { fontSize: theme.type.md, color: theme.color.muted },
});
