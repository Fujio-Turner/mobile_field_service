import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/src/session/AuthContext';
import { theme } from '@/src/theme';

export default function TabsLayout() {
  const { ready, session } = useAuth();
  if (ready && !session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.surface },
        headerTitleStyle: { color: theme.color.text, fontSize: theme.type.lg },
        tabBarActiveTintColor: theme.color.accent,
        tabBarInactiveTintColor: theme.color.muted,
        tabBarStyle: { backgroundColor: theme.color.surface },
        tabBarLabelStyle: { fontSize: theme.type.sm },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="notes" options={{ title: 'Notes' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="inventory" options={{ title: 'Inventory' }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
