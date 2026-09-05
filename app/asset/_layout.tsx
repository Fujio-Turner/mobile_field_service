import { Stack } from 'expo-router';
import { theme } from '@/src/theme';

export default function AssetLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.surface },
        headerTintColor: theme.color.accent,
        contentStyle: { backgroundColor: theme.color.bg },
      }}
    />
  );
}
