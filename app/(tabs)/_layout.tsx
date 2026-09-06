import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@/src/session/AuthContext';
import { theme } from '@/src/theme';
import { useLeftHand } from '@/src/ui/HandednessContext';
import { thumbBarDirection } from '@/src/ui/handedness';

export default function TabsLayout() {
  const { ready, session } = useAuth();
  const leftHand = useLeftHand();
  if (ready && !session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.surface },
        headerShadowVisible: false,
        headerTitleStyle: { color: theme.color.text, fontSize: theme.type.lg, fontWeight: '700' },
        tabBarActiveTintColor: theme.color.accent,
        tabBarInactiveTintColor: theme.color.muted,
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
          flexDirection: thumbBarDirection(leftHand),
        },
        tabBarIcon: ({ focused, color }) => (
          <View style={[styles.dot, focused ? styles.dotOn : styles.dotOff, { backgroundColor: color }]} />
        ),
        tabBarLabelStyle: { fontSize: theme.type.sm, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="notes" options={{ title: 'Notes' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="inventory" options={{ title: 'Stock' }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dot: { borderRadius: 4 },
  dotOn: { width: 7, height: 7 },
  dotOff: { width: 5, height: 5, opacity: 0.4 },
});
