import { memo } from 'react';
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

function railColor(priority: string): string {
  if (priority === 'high') return theme.color.danger;
  if (priority === 'low') return theme.color.muted;
  return theme.color.accent;
}

export const TodayRowView = memo(function TodayRowView({
  row,
  onPress,
}: {
  row: TodayRow;
  onPress?: (row: TodayRow) => void;
}) {
  const label = badgeLabel(row.badge);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.number}, ${row.siteName}`}
      onPress={() => onPress?.(row)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.rail, { backgroundColor: railColor(row.priority) }]} />
      <View style={styles.main}>
        <Text style={styles.number}>
          {row.number}
          {row.kind ? ` · ${row.kind}` : ''}
        </Text>
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
      <Text style={styles.chevron} accessibilityElementsHidden>
        ›
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius,
    paddingVertical: theme.space.md,
    paddingRight: theme.space.md,
    marginBottom: theme.space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.color.border,
    ...theme.shadow.card,
  },
  rail: {
    width: 4,
    alignSelf: 'stretch',
    borderTopLeftRadius: theme.radius,
    borderBottomLeftRadius: theme.radius,
    marginRight: theme.space.md,
  },
  pressed: { opacity: 0.88 },
  main: { flex: 1, paddingRight: theme.space.sm },
  number: { fontSize: theme.type.sm, fontWeight: '600', color: theme.color.accent, letterSpacing: 0.2 },
  site: { fontSize: theme.type.lg, color: theme.color.text, fontWeight: '600', marginTop: 2 },
  summary: { fontSize: theme.type.sm, color: theme.color.muted, marginTop: 2 },
  meta: { alignItems: 'flex-end', minWidth: 84 },
  time: { fontSize: theme.type.md, color: theme.color.text, fontWeight: '600', fontVariant: ['tabular-nums'] },
  priority: { fontSize: theme.type.sm, color: theme.color.muted, marginTop: 2, textTransform: 'capitalize' },
  badge: {
    marginTop: theme.space.xs,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 2,
    borderRadius: theme.radiusSm,
  },
  badgeWarn: { backgroundColor: theme.color.warnSoft },
  badgeAccent: { backgroundColor: theme.color.accentSoft },
  badgeTextWarn: { fontSize: theme.type.sm, color: theme.color.warn, fontWeight: '600' },
  badgeTextAccent: { fontSize: theme.type.sm, color: theme.color.accent, fontWeight: '600' },
  chevron: { fontSize: 22, color: theme.color.muted, marginLeft: theme.space.sm, fontWeight: '300' },
});
