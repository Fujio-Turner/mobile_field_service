import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DatabaseProvider } from '@/src/db/DatabaseProvider';
import { AuthProvider } from '@/src/session/AuthContext';
import { theme } from '@/src/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <DatabaseProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.color.bg },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="wo" />
          <Stack.Screen name="note" />
          <Stack.Screen name="asset" />
        </Stack>
      </DatabaseProvider>
    </AuthProvider>
  );
}
