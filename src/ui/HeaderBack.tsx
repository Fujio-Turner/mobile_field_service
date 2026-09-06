import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../theme';
import { goStackBack } from './stackNav';

/** Header Back — pops the stack, or Today if there is no history. */
export function HeaderBack() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      onPress={() => {
        goStackBack(router);
      }}
      style={styles.hit}
    >
      <Text style={styles.label}>Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: theme.space.sm },
  label: { color: theme.color.accent, fontSize: theme.type.lg, fontWeight: '600' },
});
