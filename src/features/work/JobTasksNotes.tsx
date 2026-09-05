import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { StartSession } from '@/src/ops/copyInbound';
import { createNote, deleteNote, type NoteItem } from '@/src/ops/notes';
import { cycleTaskStatus, deleteTask, type TaskItem, upsertTask } from '@/src/ops/tasks';
import { theme } from '@/src/theme';

type Props = {
  wooutId: string;
  editable: boolean;
  busy: boolean;
  session: StartSession;
  tasks: TaskItem[];
  notes: NoteItem[];
  onMutate: (fn: () => Promise<void>) => void;
};

export function JobTasksNotes({ wooutId, editable, busy, session, tasks, notes, onMutate }: Props) {
  const [taskTitle, setTaskTitle] = useState('');
  const [taskRequired, setTaskRequired] = useState(false);
  const [noteBody, setNoteBody] = useState('');

  return (
    <>
      <Text style={styles.section}>Tasks</Text>
      {tasks.length === 0 ? <Text style={styles.muted}>No tasks on this copy</Text> : null}
      {tasks.map((t) => (
        <View key={t.id} style={styles.row}>
          <Pressable
            disabled={!editable || busy}
            onPress={() =>
              onMutate(async () => {
                await upsertTask(session, {
                  id: t.id,
                  wooutId,
                  title: t.title,
                  required: t.required,
                  status: cycleTaskStatus(t.status),
                });
              })
            }
            style={styles.rowMain}
          >
            <Text style={styles.value}>
              {t.required ? '* ' : ''}
              {t.title} · {t.status}
            </Text>
          </Pressable>
          {editable ? (
            <Pressable disabled={busy} onPress={() => onMutate(() => deleteTask(t.id, session))} style={styles.rowBtn}>
              <Text style={styles.dangerLabel}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {editable ? (
        <>
          <TextInput
            value={taskTitle}
            onChangeText={setTaskTitle}
            placeholder="New task"
            placeholderTextColor={theme.color.muted}
            style={styles.input}
            editable={!busy}
          />
          <Pressable
            disabled={busy}
            onPress={() => setTaskRequired((v) => !v)}
            style={styles.rowBtn}
          >
            <Text style={styles.muted}>{taskRequired ? '* Required' : 'Optional'}</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            onPress={() =>
              onMutate(async () => {
                await upsertTask(session, { wooutId, title: taskTitle, required: taskRequired });
                setTaskTitle('');
                setTaskRequired(false);
              })
            }
          >
            <Text style={styles.secondaryLabel}>Add task</Text>
          </Pressable>
        </>
      ) : null}

      <Text style={styles.section}>Notes</Text>
      {notes.length === 0 ? <Text style={styles.muted}>No notes on this copy</Text> : null}
      {notes.map((n) => (
        <View key={n.id} style={styles.row}>
          <Text style={[styles.value, styles.rowMain]}>{n.body}</Text>
          {editable ? (
            <Pressable disabled={busy} onPress={() => onMutate(() => deleteNote(n.id, session))} style={styles.rowBtn}>
              <Text style={styles.dangerLabel}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {editable ? (
        <>
          <TextInput
            value={noteBody}
            onChangeText={setNoteBody}
            placeholder="Job note"
            placeholderTextColor={theme.color.muted}
            style={[styles.input, styles.noteInput]}
            editable={!busy}
            multiline
          />
          <Pressable
            disabled={busy}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            onPress={() =>
              onMutate(async () => {
                await createNote(session, { body: noteBody, kind: 'job', workOrderOutId: wooutId });
                setNoteBody('');
              })
            }
          >
            <Text style={styles.secondaryLabel}>Add note</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.muted}>Frozen copies cannot take notes. Add a follow-up or use chat.</Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: theme.space.lg,
    marginBottom: theme.space.xs,
    fontSize: theme.type.sm,
    color: theme.color.muted,
    fontWeight: '600',
  },
  value: { fontSize: theme.type.md, color: theme.color.text, marginBottom: 2 },
  muted: { fontSize: theme.type.md, color: theme.color.muted, marginBottom: 2 },
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
    marginTop: theme.space.sm,
  },
  noteInput: { minHeight: 88, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  rowMain: { flex: 1, paddingRight: theme.space.sm },
  rowBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.space.sm },
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
  dangerLabel: { color: theme.color.danger, fontSize: theme.type.md, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
