import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

export type StatusTone = 'action' | 'ok' | 'warn' | 'neutral';

export function labelStatus(status: string): string {
  const s = status.trim();
  if (!s) return '';
  return s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function toneForTaskStatus(status: string): StatusTone {
  if (status === 'done') return 'ok';
  if (status === 'skipped') return 'warn';
  if (status === 'open') return 'action';
  return 'neutral';
}

type Props = {
  value: string;
  nextValue?: string;
  disabled?: boolean;
  onPress?: () => void;
  tone?: StatusTone;
};

/** Tappable status chip. Shows current value and the next tap target when cycling. */
export function StatusCycleBadge({ value, nextValue, disabled, onPress, tone = 'action' }: Props) {
  const label = labelStatus(value);
  const next = nextValue ? labelStatus(nextValue) : undefined;
  const canPress = Boolean(onPress) && !disabled;
  const a11y =
    canPress && next ? `${label}. Tap to set ${next}.` : canPress ? `${label}. Tap to change.` : label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !canPress }}
      disabled={!canPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.badge,
        tone === 'ok' ? styles.ok : tone === 'warn' ? styles.warn : tone === 'neutral' ? styles.neutral : styles.action,
        !canPress ? styles.disabled : null,
        pressed && canPress ? styles.pressed : null,
      ]}
    >
      <Text
        style={
          tone === 'ok' ? styles.okText : tone === 'warn' ? styles.warnText : tone === 'neutral' ? styles.neutralText : styles.actionText
        }
      >
        {label}
        {canPress && next ? ` → ${next}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 44,
    minWidth: 88,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: { backgroundColor: theme.color.surface, borderColor: theme.color.accent },
  actionText: { color: theme.color.accent, fontSize: theme.type.md, fontWeight: '700' },
  ok: { backgroundColor: theme.color.okSoft, borderColor: theme.color.ok },
  okText: { color: theme.color.ok, fontSize: theme.type.md, fontWeight: '700' },
  warn: { backgroundColor: theme.color.warnSoft, borderColor: theme.color.warn },
  warnText: { color: theme.color.warn, fontSize: theme.type.md, fontWeight: '700' },
  neutral: { backgroundColor: theme.color.surface, borderColor: theme.color.border },
  neutralText: { color: theme.color.text, fontSize: theme.type.md, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
});
