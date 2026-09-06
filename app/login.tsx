import { useState } from 'react';
import { Redirect } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/session/AuthContext';
import { DEMO_LOGIN_HINT } from '@/src/session/identity';
import { authStrategy } from '@/src/session/strategy';
import { theme } from '@/src/theme';
import { FieldInput } from '@/src/ui/FieldInput';
import { useThumbActionStyle } from '@/src/ui/HandednessContext';
import { appVersion } from '@/src/version';

export default function LoginScreen() {
  const { session, login, error, busy, needsReauth } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const strategy = authStrategy();
  const demo = strategy === 'demo';
  const thumb = useThumbActionStyle();

  if (session && !needsReauth) return <Redirect href="/(tabs)" />;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <Text style={styles.brand}>Field Service</Text>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.hint}>
            {needsReauth
              ? 'Sign in to sync. Local work stays on this device.'
              : demo
                ? DEMO_LOGIN_HINT
                : 'Work email and password. Session is stored in the device keychain.'}
          </Text>

          <Text style={styles.label}>Email or username</Text>
          <FieldInput
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            placeholder="jon.hale@example.com"
            style={styles.input}
            editable={!busy}
            returnKeyType="done"
          />

          {!demo ? (
            <>
              <Text style={styles.label}>Password</Text>
              <FieldInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                placeholder="Password"
                style={styles.input}
                editable={!busy}
                returnKeyType="go"
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
              thumb,
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
  brand: {
    fontSize: theme.type.sm,
    color: theme.color.accent,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: theme.space.sm,
  },
  title: {
    fontSize: theme.type.clock,
    color: theme.color.text,
    fontWeight: '700',
    marginBottom: theme.space.sm,
    letterSpacing: -0.6,
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
    minHeight: 52,
    marginBottom: theme.space.lg,
  },
  error: {
    color: theme.color.danger,
    fontSize: theme.type.md,
    marginBottom: theme.space.md,
  },
  primary: {
    backgroundColor: theme.color.accent,
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
