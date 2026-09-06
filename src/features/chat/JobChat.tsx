import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { FieldInput } from '@/src/ui/FieldInput';
import type { StartSession } from '@/src/ops/copyInbound';
import { ChatRefChips } from '@/src/features/chat/ChatRefChips';
import {
  ChatError,
  listMessages,
  sendMessage,
  woThreadId,
  type MessageItem,
} from '@/src/ops/messages';
import { theme } from '@/src/theme';

type Props = {
  woinId: string;
  wooutId: string;
  session: StartSession;
};

export function JobChat({ woinId, wooutId, session }: Props) {
  const router = useRouter();
  const threadId = woThreadId(woinId);
  const [rows, setRows] = useState<MessageItem[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setRows(await listMessages(threadId));
  }, [threadId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function send() {
    setBusy(true);
    try {
      await sendMessage(session, {
        body,
        kind: 'job',
        workOrderInId: woinId,
        workOrderOutId: wooutId,
      });
      setBody('');
      await reload();
    } catch (e) {
      const code = e instanceof ChatError ? e.code : 'empty';
      Alert.alert('Chat', code === 'empty' ? 'Type a message first.' : 'Employees only.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Text style={styles.muted}>Job thread stays open after complete. Push on send.</Text>
      {rows.slice(-5).map((m) => (
        <View key={m.id} style={styles.bubble}>
          <Text style={styles.meta}>{m.fromEmployeeId}</Text>
          <Text style={styles.body}>{m.body}</Text>
          <ChatRefChips item={m} />
        </View>
      ))}
      {rows.length === 0 ? <Text style={styles.muted}>No messages yet</Text> : null}
      <FieldInput
        value={body}
        onChangeText={setBody}
        placeholder="Message — @name or WO-10482"
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
      <Pressable
        style={styles.secondary}
        onPress={() => router.push(`/chat/${encodeURIComponent(threadId)}`)}
      >
        <Text style={styles.secondaryLabel}>Open thread</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: theme.type.md, color: theme.color.muted, marginBottom: theme.space.sm },
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
  secondary: {
    marginTop: theme.space.md,
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
