import { Pressable, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { theme } from '@/src/theme';

export default function OrderLayout() {
  const router = useRouter();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.color.surface },
        headerTintColor: theme.color.accent,
        contentStyle: { backgroundColor: theme.color.bg },
        headerLeft: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Today"
            hitSlop={12}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)');
            }}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}
          >
            <Text style={{ color: theme.color.accent, fontSize: 17, fontWeight: '600' }}>Today</Text>
          </Pressable>
        ),
      }}
    />
  );
}
