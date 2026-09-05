import { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getWorkOrderOut, type WorkOrderOut } from '@/src/ops/getWorkOrderOut';
import { theme } from '@/src/theme';

export default function WorkOrderOutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<WorkOrderOut | null | undefined>(undefined);

  useEffect(() => {
    if (!id) {
      setDoc(null);
      return;
    }
    let cancelled = false;
    void getWorkOrderOut(id).then((wo) => {
      if (!cancelled) setDoc(wo);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (doc === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: 'Job copy' }} />
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.accent} />
        </View>
      </>
    );
  }

  if (!doc) {
    return (
      <>
        <Stack.Screen options={{ title: 'Not found' }} />
        <View style={styles.center}>
          <Text style={styles.value}>Outbound copy not found</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: doc.number }} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.kicker}>
          {doc.role} · {doc.status} · {doc.syncState}
        </Text>
        <Text style={styles.summary}>{doc.summary}</Text>
        <Text style={styles.section}>Your copy</Text>
        <Text style={styles.value}>{doc.id}</Text>
        <Text style={styles.muted}>From inbound {doc.sourceId}</Text>
        <Text style={styles.muted}>{doc.siteName}</Text>
        <Text style={styles.muted}>Owner {doc.owner}</Text>
        {doc.historyOps.length > 0 ? (
          <Text style={styles.muted}>History {doc.historyOps.join(', ')}</Text>
        ) : null}
        <Text style={styles.muted}>Field edits land in the next slice.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/wo/in/${doc.sourceId}`)}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryLabel}>View inbound ticket</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.bg },
  body: { padding: theme.space.lg, paddingBottom: theme.space.xl * 2, backgroundColor: theme.color.bg },
  kicker: { fontSize: theme.type.sm, color: theme.color.muted, marginBottom: theme.space.sm, textTransform: 'capitalize' },
  summary: { fontSize: theme.type.title, fontWeight: '600', color: theme.color.text, marginBottom: theme.space.md },
  section: { marginTop: theme.space.lg, marginBottom: theme.space.xs, fontSize: theme.type.sm, color: theme.color.muted, fontWeight: '600' },
  value: { fontSize: theme.type.md, color: theme.color.text, marginBottom: 2 },
  muted: { fontSize: theme.type.md, color: theme.color.muted, marginBottom: 2 },
  secondary: {
    marginTop: theme.space.xl,
    minHeight: 48,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
  },
  secondaryLabel: { color: theme.color.accent, fontSize: theme.type.lg, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
