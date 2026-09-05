import { useCallback, useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { createAmendment } from '@/src/ops/createAmendment';
import { getWorkOrderIn } from '@/src/ops/getWorkOrderIn';
import { getWorkOrderOut, type WorkOrderOut } from '@/src/ops/getWorkOrderOut';
import { OutError } from '@/src/ops/outError';
import { BLOCK_REASONS, cycleOpStatus } from '@/src/ops/outStatus';
import { submitWork } from '@/src/ops/submitWork';
import {
  blockWork,
  cancelWork,
  completeWork,
  startOrResumeWork,
} from '@/src/ops/transitionStatus';
import { captureAndCommitPhoto } from '@/src/ops/capturePhoto';
import { listNotes, type NoteItem } from '@/src/ops/notes';
import { deletePhoto } from '@/src/ops/photos';
import { listTasksForWork, type TaskItem } from '@/src/ops/tasks';
import { updateWorkOrderOutFields } from '@/src/ops/updateWorkOrderOut';
import { JobTasksNotes } from '@/src/features/work/JobTasksNotes';
import { useAuth } from '@/src/session/AuthContext';
import { theme } from '@/src/theme';

function showErr(e: unknown) {
  const code = e instanceof OutError ? e.code : 'missing';
  const msg =
    code === 'frozen'
      ? 'This copy is frozen. Add a follow-up instead.'
      : code === 'incomplete'
        ? e instanceof Error
          ? e.message
          : 'Finish required steps first.'
        : code === 'illegal_transition'
          ? 'That status change is not allowed.'
          : code === 'reason_required'
            ? 'A reason is required.'
            : code === 'not_terminal'
              ? 'Complete or cancel before submit.'
              : code === 'not_frozen'
                ? 'Follow-up is only after complete or cancel.'
                : code === 'photo_cap'
                  ? 'Photo cap is 20 on this copy.'
                  : 'Could not update the job.';
  Alert.alert('Job', msg);
}

export default function WorkOrderOutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [doc, setDoc] = useState<WorkOrderOut | null | undefined>(undefined);
  const [summary, setSummary] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);

  const reload = useCallback(async () => {
    if (!id) {
      setDoc(null);
      setTasks([]);
      setNotes([]);
      return;
    }
    const wo = await getWorkOrderOut(id);
    setDoc(wo);
    if (wo) {
      setSummary(wo.summary);
      setTasks(await listTasksForWork(wo.id));
      setNotes(await listNotes({ workOrderOutId: wo.id }));
    } else {
      setTasks([]);
      setNotes([]);
    }
    if (wo && session) {
      const inbound = await getWorkOrderIn(wo.sourceId);
      if (inbound && inbound.assignedTo.employeeId !== session.employeeId) {
        setBanner(`Reassigned to ${inbound.assignedTo.displayName ?? inbound.assignedTo.employeeId}`);
      } else if (!inbound) {
        setBanner('Assignment changed');
      } else {
        setBanner(null);
      }
    }
  }, [id, session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function run(fn: () => Promise<void>) {
    if (!session || !id) return;
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (e) {
      showErr(e);
    } finally {
      setBusy(false);
    }
  }

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

  const s = session!;

  return (
    <>
      <Stack.Screen options={{ title: doc.number }} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {banner ? (
          <View style={styles.warn}>
            <Text style={styles.warnText}>{banner}</Text>
          </View>
        ) : null}
        <Text style={styles.kicker}>
          {doc.role} · {doc.status} · {doc.syncState}
          {doc.owner === 'backend' ? ' · frozen' : ''}
        </Text>
        {doc.editable ? (
          <>
            <Text style={styles.section}>Summary</Text>
            <TextInput
              value={summary}
              onChangeText={setSummary}
              onEndEditing={() => {
                if (summary !== doc.summary) {
                  void run(() => updateWorkOrderOutFields(doc.id, { summary }, s));
                }
              }}
              style={styles.input}
              editable={!busy}
            />
          </>
        ) : (
          <Text style={styles.summary}>{doc.summary}</Text>
        )}
        <Text style={styles.muted}>{doc.siteName}</Text>
        {doc.blockedReason ? <Text style={styles.muted}>Blocked: {doc.blockedReason} — {doc.blockedNote}</Text> : null}
        {doc.cancelledReason ? <Text style={styles.muted}>Cancelled: {doc.cancelledReason}</Text> : null}

        {doc.operations.length > 0 ? (
          <>
            <Text style={styles.section}>Operations</Text>
            {doc.operations.map((op, i) => (
              <Pressable
                key={op.id ?? String(i)}
                disabled={!doc.editable || busy}
                onPress={() => {
                  const operations = doc.operations.map((o, j) =>
                    j === i ? { ...o, status: cycleOpStatus(o.status ?? 'pending') } : o,
                  );
                  void run(() => updateWorkOrderOutFields(doc.id, { operations }, s));
                }}
                style={styles.rowBtn}
              >
                <Text style={styles.value}>
                  {op.required ? '* ' : ''}
                  {op.name ?? 'Step'} · {op.status ?? 'pending'}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}

        {doc.checklist.length > 0 ? (
          <>
            <Text style={styles.section}>Checklist</Text>
            {doc.checklist.map((c, i) => (
              <Pressable
                key={c.id ?? String(i)}
                disabled={!doc.editable || busy}
                onPress={() => {
                  const checklist = doc.checklist.map((item, j) => (j === i ? { ...item, done: !item.done } : item));
                  void run(() => updateWorkOrderOutFields(doc.id, { checklist }, s));
                }}
                style={styles.rowBtn}
              >
                <Text style={styles.value}>
                  {c.done ? 'Done' : 'Open'}
                  {c.required ? ' *' : ''} · {c.label ?? 'Item'}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}

        <JobTasksNotes
          wooutId={doc.id}
          editable={doc.editable}
          busy={busy}
          session={s}
          tasks={tasks}
          notes={notes}
          onMutate={(fn) => void run(fn)}
        />

        <Text style={styles.section}>Photos {doc.photos.length}/20</Text>
        {doc.photos.map((p) => (
          <View key={p.id} style={styles.photoRow}>
            <Text style={styles.value}>
              {p.kind} · {p.id}
            </Text>
            {doc.editable ? (
              <Pressable
                disabled={busy}
                onPress={() => void run(() => deletePhoto(doc.id, p.id, s))}
                style={styles.rowBtn}
              >
                <Text style={styles.dangerLabel}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {doc.editable ? (
          <Pressable
            disabled={busy}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            onPress={() =>
              void run(async () => {
                await captureAndCommitPhoto(doc.id, s);
              })
            }
          >
            <Text style={styles.secondaryLabel}>Add photo</Text>
          </Pressable>
        ) : null}

        {doc.editable && (doc.status === 'assigned' || doc.status === 'blocked') ? (
          <Pressable
            disabled={busy}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            onPress={() => void run(() => startOrResumeWork(doc.id, s))}
          >
            <Text style={styles.primaryLabel}>{doc.status === 'blocked' ? 'Resume work' : 'Start work'}</Text>
          </Pressable>
        ) : null}

        {doc.editable && doc.status === 'in_progress' ? (
          <>
            <Pressable
              disabled={busy}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              onPress={() =>
                void run(() => blockWork(doc.id, s, BLOCK_REASONS[0], 'Waiting on access'))
              }
            >
              <Text style={styles.secondaryLabel}>Block (access)</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
              onPress={() => void run(() => completeWork(doc.id, s))}
            >
              <Text style={styles.primaryLabel}>Complete</Text>
            </Pressable>
          </>
        ) : null}

        {doc.editable ? (
          <>
            <Text style={styles.section}>Cancel reason</Text>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Required to cancel"
              placeholderTextColor={theme.color.muted}
              style={styles.input}
            />
            <Pressable
              disabled={busy}
              style={({ pressed }) => [styles.danger, pressed && styles.pressed]}
              onPress={() => void run(() => cancelWork(doc.id, s, cancelReason))}
            >
              <Text style={styles.dangerLabel}>Cancel job</Text>
            </Pressable>
          </>
        ) : null}

        {!doc.editable && (doc.status === 'complete' || doc.status === 'cancelled') && doc.syncState === 'local_draft' ? (
          <Pressable
            disabled={busy}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            onPress={() => void run(() => submitWork(doc.id, s))}
          >
            <Text style={styles.primaryLabel}>Submit</Text>
          </Pressable>
        ) : null}

        {!doc.editable ? (
          <Pressable
            disabled={busy}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            onPress={() => {
              void (async () => {
                try {
                  const next = await createAmendment(doc.id, s);
                  router.push(`/wo/out/${next.wooutId}`);
                } catch (e) {
                  showErr(e);
                }
              })();
            }}
          >
            <Text style={styles.secondaryLabel}>Add follow-up</Text>
          </Pressable>
        ) : null}

        <Pressable
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
  body: { padding: theme.space.lg, paddingBottom: 48, backgroundColor: theme.color.bg },
  warn: { backgroundColor: '#fff7ed', padding: theme.space.md, borderRadius: theme.radius, marginBottom: theme.space.md },
  warnText: { color: theme.color.warn, fontSize: theme.type.md },
  kicker: { fontSize: theme.type.sm, color: theme.color.muted, marginBottom: theme.space.sm, textTransform: 'capitalize' },
  summary: { fontSize: theme.type.title, fontWeight: '600', color: theme.color.text, marginBottom: theme.space.sm },
  section: { marginTop: theme.space.lg, marginBottom: theme.space.xs, fontSize: theme.type.sm, color: theme.color.muted, fontWeight: '600' },
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
  },
  rowBtn: { minHeight: 44, justifyContent: 'center' },
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
    backgroundColor: theme.color.surface,
  },
  secondaryLabel: { color: theme.color.accent, fontSize: theme.type.lg, fontWeight: '600' },
  danger: {
    marginTop: theme.space.md,
    minHeight: 48,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.danger,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
  },
  dangerLabel: { color: theme.color.danger, fontSize: theme.type.md, fontWeight: '600' },
  photoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  pressed: { opacity: 0.85 },
});
