import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThumbLayout } from './HandednessContext';
import { theme } from '../theme';

/** Pins primary actions in the easy thumb zone (bottom-left or bottom-right). */
export function ThumbDock({ children }: { children: ReactNode }) {
  const layout = useThumbLayout();
  const insets = useSafeAreaInsets();
  if (!children) return null;
  return (
    <View
      style={[
        styles.dock,
        {
          paddingBottom: Math.max(insets.bottom, theme.space.md),
          paddingHorizontal: layout.gutter,
          alignItems: layout.alignSelf,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    backgroundColor: theme.color.surface,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingTop: theme.space.md,
    gap: theme.space.sm,
  },
});
