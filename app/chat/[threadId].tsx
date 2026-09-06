import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { FieldInput } from '@/src/ui/FieldInput';
import { Stack, useLocalSearchParams } from 'expo-router';
import { memorySave } from '@/src/db/memoryStore';
import { nativeDbAvailable } from '@/src/db/database';
import { SEED_DISPATCH_USER_ID, SEED_USER_ID, seedDispatchUserDoc, seedUserDoc } from '@/src/db/seedData';
import { ChatRefChips } from '@/src/features/chat/ChatRefChips';
import {
  ChatError,
  listMessages,
  sendMessage,
  threadLabel,
  type MessageItem,
} from '@/src/ops/messages';
import { useAuth } from '@/src/session/AuthContext';
import { theme } from '@/src/theme';

function ensureEmployees() {
  if (nativeDbAvailable()) return;
  memorySave('users', SEED_USER_ID, seedUserDoc('0.1.0+1', 1_700_000_000) as never);
  memorySave('users', SEED_DISPATCH_USER_ID, seedDispatchUserDoc('0.1.0+1', 1_700_000_000) as never);
}

export default function ChatThreadScreen() {
  const { threadId: raw } = useLocalSearchParams<{ threadId: string }>();
  const threadId = raw ? decodeURIComponent(raw) : '';
  const { session } = useAuth();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!threadId) return;
    ensureEmployees();
    setMessages(await listMessages(threadId));
  }, [threadId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function send() {
    if (!session || !threadId) return;
    setBusy(true);
    try {
      await sendMessage(session, {
        body,
        kind: threadId.startsWith('thr:dm:') ? 'direct' : 'job',
        threadId,
      });
      setBody('');
      await reload();
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
    <>
      <Stack.Screen options={{ title: threadLabel(threadId) }} />
      <View style={styles.wrap}>
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.bubble}>
              <Text style={styles.meta}>{item.fromEmployeeId}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <ChatRefChips item={item} />
            </View>
          )}
          ListEmptyComponent={<Text style={styles.muted}>No messages yet</Text>}
        />
        <FieldInput
          value={body}
          onChangeText={setBody}
          placeholder="Message"
          style={styles.input}
          editable={!busy}
          returnKeyType="send"
        />
        <Pressable
          disabled={busy}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          onPress={() => void send()}
        >
          <Text style={styles.primaryLabel}>Send</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.color.bg, padding: theme.space.lg },
  list: { paddingBottom: theme.space.md, flexGrow: 1 },
  bubble: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius,
    padding: theme.space.md,
    marginBottom: theme.space.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  meta: { fontSize: theme.type.sm, color: theme.color.muted, marginBottom: 4 },
  body: { fontSize: theme.type.md, color: theme.color.text },
  muted: { fontSize: theme.type.md, color: theme.color.muted, marginTop: theme.space.md },
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
  },
  primaryLabel: { color: theme.color.onAccent, fontSize: theme.type.lg, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
