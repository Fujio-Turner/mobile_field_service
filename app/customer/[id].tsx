import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { createCustomer, getCustomer, type CustomerItem } from '@/src/ops/customers';
import { createOrder } from '@/src/ops/orders';
import { OutError } from '@/src/ops/outError';
import { useAuth } from '@/src/session/AuthContext';
import { FieldInput } from '@/src/ui/FieldInput';
import { NativeBanner } from '@/src/ui/NativeBanner';
import { theme } from '@/src/theme';

export default function CustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [doc, setDoc] = useState<CustomerItem | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const isNew = !id || id === 'new';

  const reload = useCallback(async () => {
    if (isNew) {
      setDoc(null);
      return;
    }
    setDoc(await getCustomer(id));
  }, [id, isNew]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function create() {
    if (!session) return;
    setBusy(true);
    try {
      const cusId = await createCustomer(session, { name });
      router.replace(`/customer/${cusId}`);
    } catch (e) {
      Alert.alert('Customer', e instanceof OutError ? e.message : 'Name is required.');
    } finally {
      setBusy(false);
    }
  }

  async function orderForCustomer() {
    if (!session || !doc) return;
    setBusy(true);
    try {
      const ordId = await createOrder(session, { customerId: doc.id });
      router.push(`/order/${ordId}`);
    } catch (e) {
      Alert.alert('Order', e instanceof Error ? e.message : 'Could not create order.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: doc?.name ?? (isNew ? 'New customer' : 'Customer') }} />
      <ScrollView contentContainerStyle={styles.body}>
        <NativeBanner />
        <Text style={styles.muted}>Field customers are new documents. Pulled masters are never patched.</Text>
        {isNew ? (
          <>
            <FieldInput
              value={name}
              onChangeText={setName}
              placeholder="Walk-up name"
              style={styles.input}
              editable={!busy}
              returnKeyType="done"
            />
            <Pressable disabled={busy} style={styles.primary} onPress={() => void create()}>
              <Text style={styles.primaryLabel}>Create customer</Text>
            </Pressable>
          </>
        ) : doc ? (
          <>
            <Text style={styles.title}>{doc.name}</Text>
            <Text style={styles.muted}>
              {doc.origin} {doc.accountNumber ? `· ${doc.accountNumber}` : ''}
            </Text>
            {session ? (
              <Pressable disabled={busy} style={styles.primary} onPress={() => void orderForCustomer()}>
                <Text style={styles.primaryLabel}>Create order</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <Text style={styles.muted}>Customer not found</Text>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: theme.space.lg, paddingBottom: 48, backgroundColor: theme.color.bg },
  muted: { fontSize: theme.type.md, color: theme.color.muted, marginBottom: theme.space.md },
  title: { fontSize: theme.type.title, fontWeight: '600', color: theme.color.text, marginBottom: theme.space.sm },
  input: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.border,
    borderWidth: 1,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.md,
    fontSize: theme.type.md,
    color: theme.color.text,
    minHeight: 48,
    marginBottom: theme.space.md,
  },
  primary: {
    backgroundColor: theme.color.accent,
    minHeight: 48,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { color: theme.color.onAccent, fontSize: theme.type.lg, fontWeight: '600' },
});
