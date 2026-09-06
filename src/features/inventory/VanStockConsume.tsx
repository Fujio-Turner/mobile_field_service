import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StartSession } from '@/src/ops/copyInbound';
import { consumeInventoryOnWork, type DisplayStock } from '@/src/ops/inventory';
import { theme } from '@/src/theme';

type Props = {
  wooutId?: string;
  orderId?: string;
  locationId: string;
  stock: DisplayStock[];
  editable: boolean;
  busy: boolean;
  session: StartSession;
  onMutate: (fn: () => Promise<void>) => void;
};

export function VanStockConsume({
  wooutId,
  orderId,
  locationId,
  stock,
  editable,
  busy,
  session,
  onMutate,
}: Props) {
  if (stock.length === 0) {
    return <Text style={styles.muted}>No van snapshots for {locationId}</Text>;
  }
  return (
    <>
      {stock.map((row) => (
        <View key={row.id || row.productId} style={styles.row}>
          <View style={styles.rowMain}>
            <Text style={styles.rowTitle}>
              {row.productName ?? row.sku} · {row.displayQty} {row.uom}
            </Text>
            <Text style={styles.muted}>snapshot {row.qtyOnHand}</Text>
          </View>
          {editable ? (
            <Pressable
              disabled={busy || row.displayQty < 1}
              onPress={() =>
                onMutate(async () => {
                  await consumeInventoryOnWork(session, {
                    wooutId,
                    orderId,
                    productId: row.productId,
                    locationId,
                    qty: 1,
                  });
                })
              }
              style={styles.rowBtn}
            >
              <Text style={[styles.consume, (busy || row.displayQty < 1) && styles.disabled]}>Consume 1</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: theme.type.md, color: theme.color.muted, marginBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  rowMain: { flex: 1, paddingRight: theme.space.sm },
  rowTitle: { fontSize: theme.type.md, color: theme.color.text, fontWeight: '600' },
  rowBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.space.sm },
  consume: { color: theme.color.accent, fontSize: theme.type.md, fontWeight: '600' },
  disabled: { color: theme.color.muted },
});
