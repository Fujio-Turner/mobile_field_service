import { useState } from 'react';
import { Redirect } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/session/AuthContext';
import { authStrategy } from '@/src/session/strategy';
import { theme } from '@/src/theme';
import { appVersion } from '@/src/version';

export default function LoginScreen() {
  const { session, login, error, busy } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const strategy = authStrategy();
  const demo = strategy === 'demo';

  if (session) return <Redirect href="/(tabs)" />;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.hint}>
            {demo
              ? 'Demo mode — any email or username, no server.'
              : 'Work email and password. Session is stored in the device keychain.'}
          </Text>

          <Text style={styles.label}>Email or username</Text>
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            placeholder="jon.hale@example.com"
            placeholderTextColor={theme.color.muted}
            style={styles.input}
            editable={!busy}
          />

          {!demo ? (
            <>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                placeholder="Password"
                placeholderTextColor={theme.color.muted}
                style={styles.input}
                editable={!busy}
              />
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void login(identifier, password);
            }}
            disabled={busy}
            style={({ pressed }) => [
              styles.primary,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            <Text style={styles.primaryLabel}>{busy ? 'Signing in…' : 'Sign in'}</Text>
          </Pressable>
        </View>
        <Text style={styles.version}>{appVersion()}</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.bg },
  flex: { flex: 1, paddingHorizontal: theme.space.lg },
  body: { flex: 1, justifyContent: 'center' },
  title: {
    fontSize: theme.type.title,
    color: theme.color.text,
    fontWeight: '600',
    marginBottom: theme.space.sm,
  },
  hint: {
    fontSize: theme.type.md,
    color: theme.color.muted,
    marginBottom: theme.space.xl,
  },
  label: {
    fontSize: theme.type.sm,
    color: theme.color.text,
    marginBottom: theme.space.xs,
  },
  input: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.border,
    borderWidth: 1,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.md,
    fontSize: theme.type.lg,
    color: theme.color.text,
    minHeight: 48,
    marginBottom: theme.space.lg,
  },
  error: {
    color: theme.color.danger,
    fontSize: theme.type.md,
    marginBottom: theme.space.md,
  },
  primary: {
    backgroundColor: theme.color.accent,
    minHeight: 48,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: theme.color.onAccent,
    fontSize: theme.type.lg,
    fontWeight: '600',
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  version: {
    textAlign: 'center',
    color: theme.color.muted,
    fontSize: theme.type.sm,
    marginBottom: theme.space.lg,
  },
});
