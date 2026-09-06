import { Stack } from 'expo-router';
import { theme } from '@/src/theme';

export default function NoteLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.surface },
        headerTitleStyle: { color: theme.color.text },
        headerTintColor: theme.color.accent,
        contentStyle: { backgroundColor: theme.color.bg },
      }}
    />
  );
}
