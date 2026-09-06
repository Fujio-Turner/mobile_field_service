import { Pressable, StyleSheet, Text } from 'react-native';
import { useThumbActionStyle } from './HandednessContext';
import { theme } from '../theme';

type Props = {
  label: string;
  done: boolean;
  disabled?: boolean;
  required?: boolean;
  onPress?: () => void;
};

/** Outline when open, filled when done — tap the button, not a whole row. */
export function DoneToggle({ label, done, disabled, required, onPress }: Props) {
  const thumb = useThumbActionStyle();
  const title = `${required ? '* ' : ''}${label}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ checked: done, disabled: Boolean(disabled) }}
      accessibilityLabel={done ? `${label}, done` : `${label}, not done`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        thumb,
        done ? styles.btnOn : styles.btnOff,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={done ? styles.labelOn : styles.labelOff}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: theme.radius,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.space.sm,
    paddingHorizontal: theme.space.md,
  },
  btnOff: {
    backgroundColor: 'transparent',
    borderColor: theme.color.accent,
  },
  btnOn: {
    backgroundColor: theme.color.accent,
    borderColor: theme.color.accent,
  },
  labelOff: {
    color: theme.color.accent,
    fontSize: theme.type.lg,
    fontWeight: '600',
  },
  labelOn: {
    color: theme.color.onAccent,
    fontSize: theme.type.lg,
    fontWeight: '600',
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
});
