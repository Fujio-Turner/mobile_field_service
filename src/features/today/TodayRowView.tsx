import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TodayBadge, TodayRow } from '../../ops/todayTypes';
import { theme } from '../../theme';

function badgeLabel(badge: TodayBadge): string | null {
  if (badge === 'started') return 'Started';
  if (badge === 'reassigned') return 'Reassigned';
  if (badge === 'amendment') return 'Amendment';
  return null;
}

function formatTime(startDt: number): string {
  if (!startDt) return '';
  return new Date(startDt * 1000).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TodayRowView({ row, onPress }: { row: TodayRow; onPress?: (row: TodayRow) => void }) {
  const label = badgeLabel(row.badge);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.number}, ${row.siteName}`}
      onPress={() => onPress?.(row)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.main}>
        <Text style={styles.number}>{row.number}</Text>
        <Text style={styles.site} numberOfLines={1}>
          {row.siteName}
        </Text>
        <Text style={styles.summary} numberOfLines={1}>
          {row.summary}
        </Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.time}>{formatTime(row.startDt)}</Text>
        <Text style={styles.priority}>{row.priority}</Text>
        {label ? (
          <View style={[styles.badge, row.badge === 'reassigned' ? styles.badgeWarn : styles.badgeAccent]}>
            <Text style={row.badge === 'reassigned' ? styles.badgeTextWarn : styles.badgeTextAccent}>{label}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius,
    padding: theme.space.md,
    marginBottom: theme.space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  pressed: { opacity: 0.85 },
  main: { flex: 1, paddingRight: theme.space.sm },
  number: { fontSize: theme.type.md, fontWeight: '600', color: theme.color.text },
  site: { fontSize: theme.type.md, color: theme.color.text, marginTop: 2 },
  summary: { fontSize: theme.type.sm, color: theme.color.muted, marginTop: 2 },
  meta: { alignItems: 'flex-end', minWidth: 88 },
  time: { fontSize: theme.type.sm, color: theme.color.text },
  priority: { fontSize: theme.type.sm, color: theme.color.muted, marginTop: 2 },
  badge: {
    marginTop: theme.space.xs,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeWarn: { backgroundColor: '#fff7ed' },
  badgeAccent: { backgroundColor: '#f0fdfa' },
  badgeTextWarn: { fontSize: theme.type.sm, color: theme.color.warn, fontWeight: '600' },
  badgeTextAccent: { fontSize: theme.type.sm, color: theme.color.accent, fontWeight: '600' },
});
