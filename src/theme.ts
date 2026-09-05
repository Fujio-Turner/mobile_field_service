import { Platform } from 'react-native';

export const theme = {
  color: {
    bg: '#f8fafc',
    surface: '#ffffff',
    text: '#0f172a',
    muted: '#64748b',
    accent: '#0f766e',
    danger: '#b91c1c',
    warn: '#b45309',
    ok: '#15803d',
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
  },
  radius: 10,
  font: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
} as const;

export type Theme = typeof theme;
