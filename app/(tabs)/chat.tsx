import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { memorySave } from '@/src/db/memoryStore';
import { nativeDbAvailable } from '@/src/db/database';
import {
  SEED_DISPATCH_EMPLOYEE_ID,
  SEED_DISPATCH_USER_ID,
  SEED_USER_ID,
  seedDispatchUserDoc,
  seedUserDoc,
} from '@/src/db/seedData';
import {
  ChatError,
  dmThreadId,
  listThreadSummaries,
  sendMessage,
  threadLabel,
} from '@/src/ops/messages';
import { useAuth } from '@/src/session/AuthContext';
import { NativeBanner } from '@/src/ui/NativeBanner';
import { theme } from '@/src/theme';

function ensureEmployees() {
  if (nativeDbAvailable()) return;
  memorySave('users', SEED_USER_ID, seedUserDoc('0.1.0+1', 1_700_000_000) as never);
  memorySave('users', SEED_DISPATCH_USER_ID, seedDispatchUserDoc('0.1.0+1', 1_700_000_000) as never);
}

export default function ChatScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [threads, setThreads] = useState<Array<{ threadId: string; preview: string; lastAt: number; kind: string }>>(
    [],
  );
  const [body, setBody] = useState('');
  const [toEmp, setToEmp] = useState(SEED_DISPATCH_EMPLOYEE_ID);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    ensureEmployees();
    setThreads(await listThreadSummaries());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function sendDm() {
    if (!session) return;
    setBusy(true);
    try {
      await sendMessage(session, {
        body,
        kind: 'direct',
        toEmployeeId: toEmp.trim(),
      });
      setBody('');
      await reload();
      router.push(`/chat/${encodeURIComponent(dmThreadId(session.employeeId, toEmp.trim()))}`);
    } catch (e) {
      const code = e instanceof ChatError ? e.code : 'empty';
      Alert.alert(
        'Chat',
        code === 'unknown_employee' ? 'Employees only — that id is not on this device.' : 'Type a message first.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <NativeBanner />
      <Text style={styles.title}>Employee chat</Text>
      <Text style={styles.muted}>Employees only. Completing a job does not freeze threads. Messages push on send.</Text>
      <TextInput
        value={toEmp}
        onChangeText={setToEmp}
        placeholder="DM employeeId"
        placeholderTextColor={theme.color.muted}
        style={styles.input}
        editable={!busy}
      />
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Message"
        placeholderTextColor={theme.color.muted}
        style={styles.input}
        editable={!busy}
      />
      <Pressable
        disabled={busy}
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        onPress={() => void sendDm()}
      >
        <Text style={styles.primaryLabel}>Send DM</Text>
      </Pressable>
      <FlatList
        data={threads}
        keyExtractor={(t) => t.threadId}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/chat/${encodeURIComponent(item.threadId)}`)}>
            <Text style={styles.rowTitle}>{threadLabel(item.threadId)}</Text>
            <Text style={styles.muted}>{item.preview}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.muted}>No threads yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.bg, padding: theme.space.lg },
  title: { fontSize: theme.type.lg, color: theme.color.text, fontWeight: '600', marginBottom: theme.space.sm },
  muted: { fontSize: theme.type.md, color: theme.color.muted, marginBottom: theme.space.sm },
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
    marginBottom: theme.space.sm,
  },
  primary: {
    backgroundColor: theme.color.accent,
    minHeight: 48,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.space.lg,
  },
  primaryLabel: { color: theme.color.onAccent, fontSize: theme.type.lg, fontWeight: '600' },
  row: { minHeight: 56, borderBottomWidth: 1, borderBottomColor: theme.color.border, justifyContent: 'center' },
  rowTitle: { fontSize: theme.type.md, color: theme.color.text, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
