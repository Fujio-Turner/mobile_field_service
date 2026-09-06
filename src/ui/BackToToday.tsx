import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../theme';

export function BackToToday() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to Today"
      hitSlop={12}
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)');
      }}
      style={styles.hit}
    >
      <Text style={styles.label}>Today</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  label: { color: theme.color.accent, fontSize: 17, fontWeight: '600' },
});
