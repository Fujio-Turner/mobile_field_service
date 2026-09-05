import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DatabaseProvider } from '@/src/db/DatabaseProvider';
import { AuthProvider } from '@/src/session/AuthContext';
import { theme } from '@/src/theme';
import { TrackingWatch } from '@/src/ui/TrackingWatch';

export default function RootLayout() {
  return (
    <AuthProvider>
      <DatabaseProvider>
        <TrackingWatch />
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
          <Stack.Screen name="chat" />
          <Stack.Screen name="order" />
        </Stack>
      </DatabaseProvider>
    </AuthProvider>
  );
}
