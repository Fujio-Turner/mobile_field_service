import { useCallback, useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { loadChild } from '@/src/ops/childStore';
import { deleteNote, parseNote, updateNote, type NoteItem } from '@/src/ops/notes';
import { OutError } from '@/src/ops/outError';
import { useAuth } from '@/src/session/AuthContext';
import { theme } from '@/src/theme';

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [note, setNote] = useState<NoteItem | null | undefined>(undefined);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [frozen, setFrozen] = useState(false);

  const reload = useCallback(async () => {
    if (!id) {
      setNote(null);
      return;
    }
    const raw = await loadChild('notes', id);
    if (!raw) {
      setNote(null);
      return;
    }
    const parsed = parseNote(id, raw);
    setNote(parsed);
    setBody(parsed.body);
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save() {
    if (!session || !id) return;
    setBusy(true);
    try {
      await updateNote(id, session, body);
      setFrozen(false);
      await reload();
    } catch (e) {
      if (e instanceof OutError && e.code === 'frozen') {
        setFrozen(true);
        Alert.alert('Note', 'This copy is frozen. Add a follow-up instead.');
      } else {
        Alert.alert('Note', e instanceof Error ? e.message : 'Could not save');
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!session || !id) return;
    setBusy(true);
    try {
      await deleteNote(id, session);
      router.back();
    } catch (e) {
      if (e instanceof OutError && e.code === 'frozen') {
        setFrozen(true);
        Alert.alert('Note', 'This copy is frozen. Add a follow-up instead.');
      } else {
        Alert.alert('Note', e instanceof Error ? e.message : 'Could not delete');
      }
    } finally {
      setBusy(false);
    }
  }

  if (note === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: 'Note' }} />
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.accent} />
        </View>
      </>
    );
  }

  if (!note) {
    return (
      <>
        <Stack.Screen options={{ title: 'Not found' }} />
        <View style={styles.center}>
          <Text style={styles.muted}>Note not found</Text>
        </View>
      </>
    );
  }

  const editable = !frozen && !busy;

  return (
    <>
      <Stack.Screen options={{ title: note.kind === 'general' ? 'General note' : 'Job note' }} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>
          {note.kind}
          {note.workOrderOutId ? ` · ${note.workOrderOutId}` : ''}
        </Text>
        {note.title ? <Text style={styles.title}>{note.title}</Text> : null}
        <TextInput
          value={body}
          onChangeText={setBody}
          onEndEditing={() => {
            if (body !== note.body) void save();
          }}
          style={[styles.input, styles.noteInput]}
          editable={editable}
          multiline
        />
        <Pressable
          disabled={busy}
          style={({ pressed }) => [styles.danger, pressed && styles.pressed]}
          onPress={() => void remove()}
        >
          <Text style={styles.dangerLabel}>Delete note</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.bg },
  body: { padding: theme.space.lg, paddingBottom: 48, backgroundColor: theme.color.bg },
  kicker: { fontSize: theme.type.sm, color: theme.color.muted, marginBottom: theme.space.sm, textTransform: 'capitalize' },
  title: { fontSize: theme.type.title, fontWeight: '600', color: theme.color.text, marginBottom: theme.space.md },
  muted: { fontSize: theme.type.md, color: theme.color.muted },
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
  },
  noteInput: { minHeight: 160, textAlignVertical: 'top' },
  danger: {
    marginTop: theme.space.lg,
    minHeight: 48,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.danger,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
  },
  dangerLabel: { color: theme.color.danger, fontSize: theme.type.md, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
