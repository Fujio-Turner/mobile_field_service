import { Platform, type ViewStyle } from 'react-native';

const shadowCard: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  android: { elevation: 2 },
  default: {},
}) as ViewStyle;

export const theme = {
  color: {
    bg: '#f1f5f9',
    surface: '#ffffff',
    text: '#0f172a',
    muted: '#64748b',
    accent: '#0f766e',
    accentDeep: '#115e59',
    accentSoft: '#ccfbf1',
    danger: '#b91c1c',
    dangerSoft: '#fef2f2',
    warn: '#b45309',
    warnSoft: '#fff7ed',
    ok: '#15803d',
    okSoft: '#f0fdf4',
    border: '#e2e8f0',
    onAccent: '#ffffff',
  },
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  type: {
    sm: 13,
    md: 15,
    lg: 17,
    title: 22,
    clock: 36,
  },
  radius: 14,
  radiusSm: 8,
  font: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
  shadow: { card: shadowCard },
} as const;

export type Theme = typeof theme;
