import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { createCustomer, getCustomer, type CustomerItem } from '@/src/ops/customers';
import { requestAndGetFix } from '@/src/geo/location';
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
  const [account, setAccount] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
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
      const geoLat = Number(lat);
      const geoLon = Number(lon);
      const geo =
        Number.isFinite(geoLat) && Number.isFinite(geoLon) ? { lat: geoLat, lon: geoLon } : undefined;
      const cusId = await createCustomer(session, {
        name,
        accountNumber: account.trim() || undefined,
        address: line1.trim() || city.trim() ? { line1: line1.trim() || undefined, city: city.trim() || undefined } : undefined,
        geo,
      });
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
              returnKeyType="next"
            />
            <FieldInput
              value={account}
              onChangeText={setAccount}
              placeholder="Account number (optional)"
              style={styles.input}
              editable={!busy}
            />
            <FieldInput
              value={line1}
              onChangeText={setLine1}
              placeholder="Site address"
              style={styles.input}
              editable={!busy}
            />
            <FieldInput
              value={city}
              onChangeText={setCity}
              placeholder="City"
              style={styles.input}
              editable={!busy}
            />
            <View style={styles.geoRow}>
              <FieldInput
                value={lat}
                onChangeText={setLat}
                placeholder="Lat"
                style={[styles.input, styles.geoInput]}
                keyboardType="numeric"
                editable={!busy}
              />
              <FieldInput
                value={lon}
                onChangeText={setLon}
                placeholder="Lon"
                style={[styles.input, styles.geoInput]}
                keyboardType="numeric"
                editable={!busy}
              />
            </View>
            <Pressable
              disabled={busy}
              style={styles.secondary}
              onPress={() =>
                void (async () => {
                  const fix = await requestAndGetFix();
                  if (!fix) {
                    Alert.alert('Location', 'Location permission is off.');
                    return;
                  }
                  setLat(String(fix.lat));
                  setLon(String(fix.lon));
                })()
              }
            >
              <Text style={styles.secondaryLabel}>Use current location</Text>
            </Pressable>
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
            {doc.geo ? (
              <Text style={styles.muted}>
                {doc.geo.lat.toFixed(5)}, {doc.geo.lon.toFixed(5)}
              </Text>
            ) : (
              <Text style={styles.muted}>No site geo on this customer</Text>
            )}
            {doc.sites[0]?.address?.line1 ? (
              <Text style={styles.muted}>
                {doc.sites[0].address?.line1}
                {doc.sites[0].address?.city ? `, ${doc.sites[0].address.city}` : ''}
              </Text>
            ) : null}
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
  geoRow: { flexDirection: 'row', gap: theme.space.sm },
  geoInput: { flex: 1 },
  secondary: {
    marginBottom: theme.space.md,
    minHeight: 48,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
  },
  secondaryLabel: { color: theme.color.accent, fontSize: theme.type.lg, fontWeight: '600' },
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
