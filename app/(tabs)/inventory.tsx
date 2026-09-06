import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { FieldInput } from '@/src/ui/FieldInput';
import { memorySave } from '@/src/db/memoryStore';
import { SEED_VAN_ID, seedProductsRatesTaxes, seedUserDoc } from '@/src/db/seedData';
import { nativeDbAvailable } from '@/src/db/database';
import { VanStockConsume } from '@/src/features/inventory/VanStockConsume';
import {
  DEFAULT_VAN_ID,
  listStockAtLocation,
  searchProducts,
  vanLocationIdForEmployee,
  type DisplayStock,
  type ProductItem,
} from '@/src/ops/inventory';
import { OutError } from '@/src/ops/outError';
import { useAuth } from '@/src/session/AuthContext';
import { NativeBanner } from '@/src/ui/NativeBanner';
import { theme } from '@/src/theme';

function ensureCatalog() {
  if (nativeDbAvailable()) return;
  const catalog = seedProductsRatesTaxes('0.1.0+1', 1_700_000_000);
  for (const row of catalog.products) memorySave('products', row.id, row.doc as never);
  for (const row of catalog.inventory) memorySave('inventory', row.id, row.doc as never);
  memorySave('users', 'usr:demo', seedUserDoc('0.1.0+1', 1_700_000_000) as never);
}

export default function InventoryScreen() {
  const { wooutId } = useLocalSearchParams<{ wooutId?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [q, setQ] = useState('');
  const [locationId, setLocationId] = useState(SEED_VAN_ID);
  const [stock, setStock] = useState<DisplayStock[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [busy, setBusy] = useState(false);
  const qRef = useRef(q);
  qRef.current = q;

  const reload = useCallback(async () => {
    ensureCatalog();
    const loc = session ? await vanLocationIdForEmployee(session.employeeId) : DEFAULT_VAN_ID;
    setLocationId(loc);
    setStock(await listStockAtLocation(loc));
    setProducts(await searchProducts(qRef.current));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (e) {
      const code = e instanceof OutError ? e.code : 'missing';
      Alert.alert(
        'Stock',
        code === 'insufficient_stock'
          ? e instanceof Error
            ? e.message
            : 'Not enough on the van.'
          : code === 'frozen'
            ? 'This copy is frozen. Add a follow-up instead.'
            : 'Could not consume.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <NativeBanner />
      <Text style={styles.title}>Van stock</Text>
      <Text style={styles.muted}>
        Display qty = snapshot + txs newer than snapshot.audit.up.dt. Device never saves stock rows.
      </Text>
      <FieldInput
        value={q}
        onChangeText={setQ}
        placeholder="Search catalog"
        style={styles.input}
        onEndEditing={() => void reload()}
        returnKeyType="search"
      />
      <Text style={styles.section}>On hand ({locationId})</Text>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            {wooutId && session ? (
              <VanStockConsume
                wooutId={wooutId}
                locationId={locationId}
                stock={stock}
                editable
                busy={busy}
                session={session}
                onMutate={(fn) => void run(fn)}
              />
            ) : (
              stock.map((item) => (
                <View key={item.id || item.productId} style={styles.row}>
                  <Text style={styles.rowTitle}>
                    {item.productName ?? item.sku} · {item.displayQty} {item.uom}
                  </Text>
                  <Text style={styles.muted}>snapshot {item.qtyOnHand}</Text>
                </View>
              ))
            )}
            {stock.length === 0 ? <Text style={styles.muted}>No stock snapshots</Text> : null}
            {!wooutId ? (
              <Text style={styles.muted}>Open a job to consume parts onto that copy.</Text>
            ) : null}
            <Text style={styles.section}>Catalog</Text>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>
              {item.name} · {item.sku}
            </Text>
            {item.description ? <Text style={styles.muted}>{item.description}</Text> : null}
          </View>
        )}
        ListFooterComponent={
          <Pressable onPress={() => void reload()} style={styles.secondary}>
            <Text style={styles.secondaryLabel}>Refresh</Text>
          </Pressable>
        }
        ListEmptyComponent={q ? <Text style={styles.muted}>No catalog hits</Text> : null}
      />
      {wooutId ? (
        <Pressable onPress={() => router.back()} style={styles.secondary}>
          <Text style={styles.secondaryLabel}>Back to job</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.bg, padding: theme.space.lg },
  title: { fontSize: theme.type.lg, color: theme.color.text, fontWeight: '600', marginBottom: theme.space.sm },
  muted: { fontSize: theme.type.md, color: theme.color.muted, marginBottom: theme.space.sm },
  section: {
    marginTop: theme.space.md,
    marginBottom: theme.space.xs,
    fontSize: theme.type.sm,
    color: theme.color.muted,
    fontWeight: '600',
  },
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
  row: { minHeight: 52, borderBottomWidth: 1, borderBottomColor: theme.color.border, justifyContent: 'center' },
  rowTitle: { fontSize: theme.type.md, color: theme.color.text, fontWeight: '600' },
  secondary: {
    marginVertical: theme.space.lg,
    minHeight: 48,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { color: theme.color.accent, fontSize: theme.type.lg, fontWeight: '600' },
});
