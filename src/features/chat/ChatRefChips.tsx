import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { MessageItem } from '@/src/ops/messages';
import { theme } from '@/src/theme';

export function ChatRefChips({ item }: { item: MessageItem }) {
  const router = useRouter();
  const woLabel = item.workOrderNumber ?? (item.workOrderInId ? 'Job' : null);
  const ordLabel = item.orderNumber ?? (item.orderId ? 'Order' : null);
  if (!woLabel && !ordLabel) return null;
  return (
    <View style={styles.row}>
      {woLabel ? (
        <Pressable
          onPress={() => {
            if (item.workOrderOutId) router.push(`/wo/out/${item.workOrderOutId}`);
            else if (item.workOrderInId) router.push(`/wo/in/${item.workOrderInId}`);
          }}
          style={styles.chip}
        >
          <Text style={styles.chipText}>{woLabel}</Text>
        </Pressable>
      ) : null}
      {ordLabel && item.orderId ? (
        <Pressable onPress={() => router.push(`/order/${item.orderId}`)} style={styles.chip}>
          <Text style={styles.chipText}>{ordLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm, marginTop: theme.space.sm },
  chip: {
    minHeight: 32,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radiusSm,
    backgroundColor: theme.color.accentSoft,
    justifyContent: 'center',
  },
  chipText: { color: theme.color.accent, fontSize: theme.type.sm, fontWeight: '600' },
});
