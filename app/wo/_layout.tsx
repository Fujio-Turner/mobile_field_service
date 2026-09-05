import { Stack } from 'expo-router';
import { theme } from '@/src/theme';

export default function WoLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Today',
        headerTintColor: theme.color.accent,
        headerStyle: { backgroundColor: theme.color.surface },
        headerTitleStyle: { color: theme.color.text },
        contentStyle: { backgroundColor: theme.color.bg },
      }}
    />
  );
}
