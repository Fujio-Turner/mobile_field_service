import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { memorySave } from '@/src/db/memoryStore';
import { nativeDbAvailable } from '@/src/db/database';
import {
  SEED_INBOUND_ORDER_ID,
  SEED_PRODUCT_ID,
  SEED_RATE_ID,
  SEED_RATE_LABOR_ID,
  SEED_TAX_ID,
  seedCustomerDoc,
  seedInboundOrder,
  seedProductsRatesTaxes,
} from '@/src/db/seedData';
import {
  addOrderLine,
  cancelOrder,
  completeOrder,
  createOrder,
  createOrderAmendment,
  getOrder,
  isOrderFrozen,
  markOrderQuoted,
  startOrder,
  submitOrder,
} from '@/src/ops/orders';
import { formatCents } from '@/src/ops/pricing';
import { OutError } from '@/src/ops/outError';
import { useAuth } from '@/src/session/AuthContext';
import { NativeBanner } from '@/src/ui/NativeBanner';
import { theme } from '@/src/theme';

function ensureCatalog() {
  if (nativeDbAvailable()) return;
  const catalog = seedProductsRatesTaxes('0.1.0+1', 1_700_000_000);
  for (const row of catalog.products) memorySave('products', row.id, row.doc as never);
  for (const row of catalog.rates) memorySave('rates', row.id, row.doc as never);
  for (const row of catalog.taxes) memorySave('taxes', row.id, row.doc as never);
  memorySave('customers', 'cus:01K4Q6CCC00000000000000001', seedCustomerDoc('0.1.0+1', 1_700_000_000) as never);
  const inbound = seedInboundOrder('0.1.0+1', 1_700_000_000);
  memorySave('orders', inbound.id, inbound.doc as never);
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
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    ensureCatalog();
    if (!id || id === 'new') {
      setDoc(null);
      return;
    }
    setDoc(await getOrder(id));
  }, [id]);

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

  const lines = (doc?.lines as Array<{ id?: string; description: string; qty: number; lineTotal: number }> | undefined) ?? [];
  const totals = (doc?.totals as { subtotal?: number; taxTotal?: number; total?: number } | undefined) ?? {};
  const frozen = doc ? isOrderFrozen(doc) : false;
  const inbound = String(doc?.role ?? '') === 'inbound';

  return (
    <>
      <Stack.Screen options={{ title: doc ? String(doc.number ?? 'Order') : 'Orders' }} />
      <ScrollView contentContainerStyle={styles.body}>
        <NativeBanner />
        <Text style={styles.muted}>No cards. Prices snapshot to integer cents. Stock is assumed available.</Text>
        {session && (!id || id === 'new') ? (
          <>
            <Pressable
              disabled={busy}
              style={styles.primary}
              onPress={() =>
                void run(async () => {
                  const ordId = await createOrder(session, { customerName: 'Walk-up' });
                  router.replace(`/order/${ordId}`);
                })
              }
            >
              <Text style={styles.primaryLabel}>Create field order</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              style={styles.secondary}
              onPress={() =>
                void run(async () => {
                  const { ordId } = await startOrder(SEED_INBOUND_ORDER_ID, session);
                  router.replace(`/order/${ordId}`);
                })
              }
            >
              <Text style={styles.secondaryLabel}>Start ORD-3301</Text>
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
            {lines.map((l) => (
              <Text key={l.id ?? l.description} style={styles.value}>
                {l.qty}× {l.description} · {formatCents(l.lineTotal)}
              </Text>
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
            {!inbound && !frozen && session && id ? (
              <>
                <Pressable
                  disabled={busy}
                  style={styles.secondary}
                  onPress={() =>
                    void run(() =>
                      addOrderLine(id, session, {
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
                      addOrderLine(id, session, {
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
                <Pressable disabled={busy} style={styles.secondary} onPress={() => void run(() => markOrderQuoted(id, session))}>
                  <Text style={styles.secondaryLabel}>Mark quoted</Text>
                </Pressable>
                <Pressable disabled={busy} style={styles.primary} onPress={() => void run(() => completeOrder(id, session))}>
                  <Text style={styles.primaryLabel}>Complete (freeze)</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  style={styles.danger}
                  onPress={() => void run(() => cancelOrder(id, session, 'Customer declined'))}
                >
                  <Text style={styles.dangerLabel}>Cancel</Text>
                </Pressable>
              </>
            ) : null}
            {!inbound &&
            session &&
            id &&
            ['quoted', 'accepted', 'complete', 'cancelled'].includes(String(doc.status)) ? (
              <Pressable disabled={busy} style={styles.primary} onPress={() => void run(() => submitOrder(id, session))}>
                <Text style={styles.primaryLabel}>Submit (no payment)</Text>
              </Pressable>
            ) : null}
            {frozen && session && id ? (
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
  value: { fontSize: theme.type.md, color: theme.color.text, marginBottom: 4 },
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
