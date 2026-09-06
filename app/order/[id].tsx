import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { memorySave } from '@/src/db/memoryStore';
import { nativeDbAvailable } from '@/src/db/database';
import {
  SEED_PRODUCT_ID,
  SEED_RATE_ID,
  SEED_RATE_LABOR_ID,
  SEED_TAX_ID,
  SEED_VAN_ID,
  seedCustomerDoc,
  seedInboundOrders,
  seedProductsRatesTaxes,
} from '@/src/db/seedData';
import { captureAndCommitOrderPhoto } from '@/src/ops/capturePhoto';
import { createCustomer, getCustomer, listCustomers, type CustomerItem } from '@/src/ops/customers';
import { VanStockConsume } from '@/src/features/inventory/VanStockConsume';
import {
  DEFAULT_VAN_ID,
  listStockAtLocation,
  searchProducts,
  vanLocationIdForEmployee,
  type DisplayStock,
  type ProductItem,
} from '@/src/ops/inventory';
import {
  addOrderLine,
  cancelOrder,
  completeOrder,
  createOrder,
  createOrderAmendment,
  getOrder,
  isOrderFrozen,
  markOrderQuoted,
  setOrderCustomer,
  setOrderLineQty,
  startOrder,
  submitOrder,
} from '@/src/ops/orders';
import { photoList, type PhotoMeta } from '@/src/ops/photoKeys';
import { formatCents } from '@/src/ops/pricing';
import { OutError } from '@/src/ops/outError';
import { useAuth } from '@/src/session/AuthContext';
import { NativeBanner } from '@/src/ui/NativeBanner';
import { FieldInput } from '@/src/ui/FieldInput';
import { theme } from '@/src/theme';

function ensureCatalog() {
  if (nativeDbAvailable()) return;
  const catalog = seedProductsRatesTaxes('0.1.0+1', 1_700_000_000);
  for (const row of catalog.products) memorySave('products', row.id, row.doc as never);
  for (const row of catalog.rates) memorySave('rates', row.id, row.doc as never);
  for (const row of catalog.taxes) memorySave('taxes', row.id, row.doc as never);
  for (const row of catalog.inventory) memorySave('inventory', row.id, row.doc as never);
  memorySave('customers', 'cus:01K4Q6CCC00000000000000001', seedCustomerDoc('0.1.0+1', 1_700_000_000) as never);
  for (const inbound of seedInboundOrders('0.1.0+1', 1_700_000_000)) {
    memorySave('orders', inbound.id, inbound.doc as never);
  }
}

function showErr(e: unknown) {
  const code = e instanceof OutError ? e.code : 'missing';
  Alert.alert(
    'Order',
    code === 'frozen'
      ? 'Inbound copies are never edited. Frozen orders need an amendment.'
      : code === 'not_terminal'
        ? 'Quote, accept, complete, or cancel before submit. No card capture.'
        : code === 'not_frozen'
          ? 'Amendment is only after complete or cancel.'
          : code === 'reason_required'
            ? 'A reason is required.'
            : e instanceof Error
              ? e.message
              : 'Could not update the order.',
  );
}

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [stock, setStock] = useState<DisplayStock[]>([]);
  const [vanId, setVanId] = useState(DEFAULT_VAN_ID);
  const [walkUp, setWalkUp] = useState('');
  const [busy, setBusy] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);

  const reload = useCallback(async () => {
    ensureCatalog();
    setCustomers(await listCustomers());
    setProducts(await searchProducts());
    if (session) {
      const loc = await vanLocationIdForEmployee(session.employeeId);
      setVanId(loc);
      setStock(await listStockAtLocation(loc));
    } else {
      setVanId(SEED_VAN_ID);
    }
    if (!id || id === 'new') {
      setDoc(null);
      setCustomerName(null);
      return;
    }
    const next = await getOrder(id);
    setDoc(next);
    const cusId = next?.customerId != null ? String(next.customerId) : '';
    if (cusId) {
      const cus = await getCustomer(cusId);
      setCustomerName(cus?.name ?? cusId);
    } else {
      setCustomerName(null);
    }
  }, [id, session]);

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
      showErr(e);
    } finally {
      setBusy(false);
    }
  }

  const lines =
    (doc?.lines as Array<{
      id?: string;
      description: string;
      qty: number;
      lineTotal: number;
    }> | undefined) ?? [];
  const totals = (doc?.totals as { subtotal?: number; taxTotal?: number; total?: number } | undefined) ?? {};
  const frozen = doc ? isOrderFrozen(doc) : false;
  const inbound = String(doc?.role ?? '') === 'inbound';
  const photos = doc ? photoList(doc) : [];
  const writable = Boolean(doc && session && id && !inbound && !frozen);

  return (
    <>
      <Stack.Screen options={{ title: doc ? String(doc.number ?? 'Order') : 'Orders' }} />
      <ScrollView contentContainerStyle={styles.body}>
        <NativeBanner />
        <Text style={styles.muted}>No cards. Prices snapshot to integer cents. Stock is assumed available.</Text>
        {session && (!id || id === 'new') ? (
          <>
            <Text style={styles.section}>Customer</Text>
            {customers.map((c) => (
              <Pressable
                key={c.id}
                disabled={busy}
                style={styles.secondary}
                onPress={() =>
                  void run(async () => {
                    const ordId = await createOrder(session, { customerId: c.id });
                    router.replace(`/order/${ordId}`);
                  })
                }
              >
                <Text style={styles.secondaryLabel}>Order for {c.name}</Text>
              </Pressable>
            ))}
            <FieldInput
              value={walkUp}
              onChangeText={setWalkUp}
              placeholder="Walk-up name"
              style={styles.input}
              editable={!busy}
              returnKeyType="done"
            />
            <Pressable
              disabled={busy}
              style={styles.primary}
              onPress={() =>
                void run(async () => {
                  const ordId = await createOrder(session, { customerName: walkUp.trim() || 'Walk-up' });
                  router.replace(`/order/${ordId}`);
                })
              }
            >
              <Text style={styles.primaryLabel}>Create field order</Text>
            </Pressable>
            <Pressable disabled={busy} style={styles.secondary} onPress={() => router.push('/customer/new')}>
              <Text style={styles.secondaryLabel}>New customer</Text>
            </Pressable>
          </>
        ) : null}
        {doc ? (
          <>
            <Text style={styles.kicker}>
              {String(doc.role)} · {String(doc.status)} · {String(doc.syncState)}
              {frozen ? ' · frozen' : ''}
            </Text>
            {inbound ? <Text style={styles.muted}>Inbound is pull-only. Start a working copy to edit.</Text> : null}
            {customerName ? (
              <Pressable
                onPress={() => {
                  const cusId = String(doc.customerId ?? '');
                  if (cusId) router.push(`/customer/${cusId}`);
                }}
                style={styles.rowBtn}
              >
                <Text style={styles.secondaryLabel}>{customerName}</Text>
              </Pressable>
            ) : null}
            {lines.map((l) => (
              <View key={l.id ?? l.description} style={styles.lineRow}>
                <Text style={styles.value}>
                  {l.qty}× {l.description} · {formatCents(l.lineTotal)}
                </Text>
                {writable && l.id ? (
                  <View style={styles.qtyRow}>
                    <Pressable
                      disabled={busy || l.qty <= 1}
                      onPress={() => void run(() => setOrderLineQty(String(id), session!, l.id!, l.qty - 1))}
                      style={styles.qtyBtn}
                    >
                      <Text style={styles.secondaryLabel}>−</Text>
                    </Pressable>
                    <Pressable
                      disabled={busy}
                      onPress={() => void run(() => setOrderLineQty(String(id), session!, l.id!, l.qty + 1))}
                      style={styles.qtyBtn}
                    >
                      <Text style={styles.secondaryLabel}>+</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
            <Text style={styles.title}>Total {formatCents(totals.total ?? 0)}</Text>
            <Text style={styles.muted}>
              Subtotal {formatCents(totals.subtotal ?? 0)} · tax {formatCents(totals.taxTotal ?? 0)}
            </Text>
            {inbound && session ? (
              <Pressable
                disabled={busy}
                style={styles.primary}
                onPress={() =>
                  void run(async () => {
                    const { ordId } = await startOrder(String(id), session);
                    router.replace(`/order/${ordId}`);
                  })
                }
              >
                <Text style={styles.primaryLabel}>Start working copy</Text>
              </Pressable>
            ) : null}
            {writable ? (
              <>
                <Text style={styles.section}>Catalog</Text>
                {products.map((p) => (
                  <Pressable
                    key={p.id}
                    disabled={busy}
                    style={styles.secondary}
                    onPress={() =>
                      void run(() =>
                        addOrderLine(String(id), session!, {
                          productId: p.id,
                          rateId: p.defaultRateId ?? SEED_RATE_ID,
                          qty: 1,
                          taxIds: [SEED_TAX_ID],
                        }),
                      )
                    }
                  >
                    <Text style={styles.secondaryLabel}>Add {p.name}</Text>
                  </Pressable>
                ))}
                <Pressable
                  disabled={busy}
                  style={styles.secondary}
                  onPress={() =>
                    void run(() =>
                      addOrderLine(String(id), session!, {
                        productId: SEED_PRODUCT_ID,
                        rateId: SEED_RATE_ID,
                        qty: 2,
                        taxIds: [SEED_TAX_ID],
                      }),
                    )
                  }
                >
                  <Text style={styles.secondaryLabel}>Add 2× valve (snapshot)</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  style={styles.secondary}
                  onPress={() =>
                    void run(() =>
                      addOrderLine(String(id), session!, {
                        rateId: SEED_RATE_LABOR_ID,
                        qty: 1,
                        uom: 'hour',
                        taxIds: [SEED_TAX_ID],
                      }),
                    )
                  }
                >
                  <Text style={styles.secondaryLabel}>Add 1h labor</Text>
                </Pressable>
                <Text style={styles.section}>Proof of delivery</Text>
                {photos.map((p: PhotoMeta) => (
                  <Text key={p.id} style={styles.value}>
                    {p.kind} · {p.id}
                  </Text>
                ))}
                <Pressable
                  disabled={busy}
                  style={styles.secondary}
                  onPress={() => void run(() => captureAndCommitOrderPhoto(String(id), session!))}
                >
                  <Text style={styles.secondaryLabel}>Add POD photo</Text>
                </Pressable>
                <Text style={styles.section}>Van stock</Text>
                <VanStockConsume
                  orderId={String(id)}
                  locationId={vanId}
                  stock={stock}
                  editable
                  busy={busy}
                  session={session!}
                  onMutate={(fn) => void run(fn)}
                />
                {customers.length > 0 && !doc.customerId ? (
                  <>
                    <Text style={styles.section}>Attach customer</Text>
                    {customers.map((c) => (
                      <Pressable
                        key={c.id}
                        disabled={busy}
                        style={styles.secondary}
                        onPress={() => void run(() => setOrderCustomer(String(id), session!, c.id))}
                      >
                        <Text style={styles.secondaryLabel}>{c.name}</Text>
                      </Pressable>
                    ))}
                    <Pressable
                      disabled={busy}
                      style={styles.secondary}
                      onPress={() =>
                        void run(async () => {
                          const cusId = await createCustomer(session!, { name: walkUp.trim() || 'Walk-up' });
                          await setOrderCustomer(String(id), session!, cusId);
                        })
                      }
                    >
                      <Text style={styles.secondaryLabel}>Create walk-up customer</Text>
                    </Pressable>
                  </>
                ) : null}
                <Pressable disabled={busy} style={styles.secondary} onPress={() => void run(() => markOrderQuoted(String(id), session!))}>
                  <Text style={styles.secondaryLabel}>Mark quoted</Text>
                </Pressable>
                <Pressable disabled={busy} style={styles.primary} onPress={() => void run(() => completeOrder(String(id), session!))}>
                  <Text style={styles.primaryLabel}>Complete (freeze)</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  style={styles.danger}
                  onPress={() => void run(() => cancelOrder(String(id), session!, 'Customer declined'))}
                >
                  <Text style={styles.dangerLabel}>Cancel</Text>
                </Pressable>
              </>
            ) : null}
            {!inbound &&
            session &&
            id &&
            ['quoted', 'accepted', 'complete', 'cancelled'].includes(String(doc.status)) ? (
              <Pressable disabled={busy} style={styles.primary} onPress={() => void run(() => submitOrder(String(id), session))}>
                <Text style={styles.primaryLabel}>Submit (no payment)</Text>
              </Pressable>
            ) : null}
            {frozen && !inbound && session && id ? (
              <Pressable
                disabled={busy}
                style={styles.secondary}
                onPress={() =>
                  void run(async () => {
                    const next = await createOrderAmendment(id, session);
                    router.push(`/order/${next}`);
                  })
                }
              >
                <Text style={styles.secondaryLabel}>Amendment</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: theme.space.lg, paddingBottom: 48, backgroundColor: theme.color.bg },
  muted: { fontSize: theme.type.md, color: theme.color.muted, marginBottom: theme.space.md },
  kicker: { fontSize: theme.type.sm, color: theme.color.muted, marginBottom: theme.space.sm, textTransform: 'capitalize' },
  title: { fontSize: theme.type.title, fontWeight: '600', color: theme.color.text, marginVertical: theme.space.md },
  section: {
    marginTop: theme.space.lg,
    marginBottom: theme.space.sm,
    fontSize: theme.type.sm,
    color: theme.color.muted,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  value: { fontSize: theme.type.md, color: theme.color.text, marginBottom: 4, flex: 1 },
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
    marginBottom: theme.space.sm,
  },
  lineRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  qtyRow: { flexDirection: 'row', gap: theme.space.sm },
  qtyBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.accent,
    borderRadius: theme.radius,
    backgroundColor: theme.color.surface,
  },
  rowBtn: { minHeight: 44, justifyContent: 'center', marginBottom: theme.space.sm },
  primary: {
    marginTop: theme.space.md,
    backgroundColor: theme.color.accent,
    minHeight: 48,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { color: theme.color.onAccent, fontSize: theme.type.lg, fontWeight: '600' },
  secondary: {
    marginTop: theme.space.md,
    minHeight: 48,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
  },
  secondaryLabel: { color: theme.color.accent, fontSize: theme.type.lg, fontWeight: '600' },
  danger: {
    marginTop: theme.space.md,
    minHeight: 48,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.danger,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
  },
  dangerLabel: { color: theme.color.danger, fontSize: theme.type.md, fontWeight: '600' },
});
