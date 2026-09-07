import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FieldInput } from '@/src/ui/FieldInput';
import { NativeBanner } from '@/src/ui/NativeBanner';
import { createNote, listNotes, type NoteItem } from '@/src/ops/notes';
import { OutError } from '@/src/ops/outError';
import { useAuth } from '@/src/session/AuthContext';
import { theme } from '@/src/theme';

export default function NotesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [q, setQ] = useState('');
  const [body, setBody] = useState('');
  const [rows, setRows] = useState<NoteItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qRef = useRef(q);
  qRef.current = q;

  const reload = useCallback(async () => {
    try {
      setRows(await listNotes({ q: qRef.current.trim() || undefined }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notes');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function addGeneral() {
    if (!session) return;
    setBusy(true);
    try {
      await createNote(session, { body, kind: 'general' });
      setBody('');
      await reload();
    } catch (e) {
      setError(e instanceof OutError ? e.message : 'Could not save note');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <NativeBanner />
            <Text style={styles.title}>Notes</Text>
            <FieldInput
              value={q}
              onChangeText={setQ}
              onEndEditing={() => void reload()}
              placeholder="Search notes"
              style={styles.input}
              returnKeyType="search"
            />
            <FieldInput
              value={body}
              onChangeText={setBody}
              placeholder="General note"
              style={[styles.input, styles.noteInput]}
              multiline
              editable={!busy}
            />
            <Pressable
              disabled={busy}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              onPress={() => void addGeneral()}
            >
              <Text style={styles.secondaryLabel}>Add general note</Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/note/${item.id}`)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Text style={styles.kicker}>
              {item.kind}
              {item.workOrderOutId ? ' · job' : ''}
            </Text>
            <Text style={styles.body} numberOfLines={3}>
              {item.body}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          busy ? (
            <ActivityIndicator color={theme.color.accent} style={styles.spinner} />
          ) : (
            <Text style={styles.muted}>No notes yet</Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  list: { padding: theme.space.lg, flexGrow: 1, paddingBottom: 48 },
  title: {
    fontSize: theme.type.title,
    fontWeight: '600',
    color: theme.color.text,
    marginBottom: theme.space.md,
  },
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
  noteInput: { minHeight: 88, textAlignVertical: 'top' },
  secondary: {
    minHeight: 48,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
    marginBottom: theme.space.lg,
  },
  secondaryLabel: { color: theme.color.accent, fontSize: theme.type.lg, fontWeight: '600' },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space.md,
    minHeight: 64,
    marginBottom: theme.space.sm,
  },
  kicker: { fontSize: theme.type.sm, color: theme.color.muted, marginBottom: theme.space.xs, textTransform: 'capitalize' },
  body: { fontSize: theme.type.md, color: theme.color.text },
  muted: { fontSize: theme.type.md, color: theme.color.muted, marginTop: theme.space.md },
  error: { color: theme.color.danger, fontSize: theme.type.md, marginBottom: theme.space.md },
  spinner: { marginVertical: theme.space.lg },
  pressed: { opacity: 0.85 },
});
