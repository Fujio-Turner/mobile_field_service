import { Stack } from 'expo-router';
import { theme } from '@/src/theme';
import { BackToToday } from '@/src/ui/BackToToday';
import { useLeftHand } from '@/src/ui/HandednessContext';

export default function WoLayout() {
  const leftHand = useLeftHand();
  const today = () => <BackToToday />;
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackVisible: false,
        headerTintColor: theme.color.accent,
        headerStyle: { backgroundColor: theme.color.surface },
        headerTitleStyle: { color: theme.color.text },
        contentStyle: { backgroundColor: theme.color.bg },
        headerLeft: leftHand ? undefined : today,
        headerRight: leftHand ? today : undefined,
      }}
    />
  );
}
