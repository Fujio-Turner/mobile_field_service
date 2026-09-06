import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { getAsset, linkAssetToWork, listOpenJobs, type AssetItem, type OpenJobRef } from '@/src/ops/assets';
import { OutError } from '@/src/ops/outError';
import { useAuth } from '@/src/session/AuthContext';
import { theme } from '@/src/theme';

export default function AssetDetailScreen() {
  const { id, wooutId } = useLocalSearchParams<{ id: string; wooutId?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [asset, setAsset] = useState<AssetItem | null | undefined>(undefined);
  const [jobs, setJobs] = useState<OpenJobRef[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setAsset(null);
      return;
    }
    setAsset(await getAsset(id));
    if (session) setJobs(await listOpenJobs(session.employeeId));
  }, [id, session]);

  useEffect(() => {
    void load();
  }, [load]);

  const job = (wooutId ? jobs.find((j) => j.id === wooutId) : undefined) ?? jobs[0];

  async function useOnJob() {
    if (!session || !id || !job) {
      Alert.alert('Asset', 'Start a job from Today first.');
      return;
    }
    setBusy(true);
    try {
      await linkAssetToWork(job.id, id, session);
      Alert.alert('Asset', `Linked to ${job.number}.`);
      router.back();
    } catch (e) {
      const code = e instanceof OutError ? e.code : 'missing';
      Alert.alert(
        'Asset',
        code === 'frozen' ? 'This copy is frozen. Add a follow-up instead.' : 'Could not link this asset.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (asset === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: 'Asset' }} />
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.accent} />
        </View>
      </>
    );
  }

  if (!asset) {
    return (
      <>
        <Stack.Screen options={{ title: 'Not found' }} />
        <View style={styles.center}>
          <Text style={styles.value}>Asset not found</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: asset.code ?? asset.name }} />
      <View style={styles.body}>
        <Text style={styles.title}>{asset.name}</Text>
        <Text style={styles.muted}>
          {asset.assetType} · {asset.ownership ?? '—'}
        </Text>
        <Text style={styles.value}>
          {asset.geo.lat}, {asset.geo.lon}
        </Text>
        <Text style={styles.muted}>Pull catalog only — complete WO does not save this asset.</Text>
        {job ? (
          <Pressable
            disabled={busy}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            onPress={() => void useOnJob()}
          >
            <Text style={styles.primaryLabel}>Use on {job.number}</Text>
          </Pressable>
        ) : (
          <Text style={styles.muted}>No open job copy. Start work from Today, then link this asset.</Text>
        )}
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryLabel}>Back</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.bg },
  body: { flex: 1, backgroundColor: theme.color.bg, padding: theme.space.lg },
  title: { fontSize: theme.type.title, fontWeight: '600', color: theme.color.text, marginBottom: theme.space.sm },
  value: { fontSize: theme.type.md, color: theme.color.text, marginBottom: 4 },
  muted: { fontSize: theme.type.md, color: theme.color.muted, marginBottom: 4 },
  primary: {
    marginTop: theme.space.lg,
    backgroundColor: theme.color.accent,
    minHeight: 48,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { color: theme.color.onAccent, fontSize: theme.type.lg, fontWeight: '600' },
  secondary: {
    marginTop: theme.space.md,
    minHeight: 48,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { color: theme.color.accent, fontSize: theme.type.lg, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
