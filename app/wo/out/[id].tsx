import { useCallback, useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { createAmendment } from '@/src/ops/createAmendment';
import { getWorkOrderIn } from '@/src/ops/getWorkOrderIn';
import { getWorkOrderOut, type WorkOrderOut } from '@/src/ops/getWorkOrderOut';
import { OutError } from '@/src/ops/outError';
import { BLOCK_REASONS, isOpDone, toggleOpDone } from '@/src/ops/outStatus';
import { DoneToggle } from '@/src/ui/DoneToggle';
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
import {
  DEFAULT_VAN_ID,
  listStockAtLocation,
  repairUnappliedInventoryTx,
  vanLocationIdForEmployee,
  type DisplayStock,
} from '@/src/ops/inventory';
import { memorySave } from '@/src/db/memoryStore';
import { nativeDbAvailable } from '@/src/db/database';
import { seedProductsRatesTaxes, seedUserDoc } from '@/src/db/seedData';
import { updateWorkOrderOutFields } from '@/src/ops/updateWorkOrderOut';
import { VanStockConsume } from '@/src/features/inventory/VanStockConsume';
import { JobChat } from '@/src/features/chat/JobChat';
import { JobTasksNotes } from '@/src/features/work/JobTasksNotes';
import { useAuth } from '@/src/session/AuthContext';
import { theme } from '@/src/theme';
import { useThumbActionStyle } from '@/src/ui/HandednessContext';
import { FieldInput } from '@/src/ui/FieldInput';
import { ThumbDock } from '@/src/ui/ThumbDock';

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
                  : code === 'insufficient_stock'
                    ? e instanceof Error
                      ? e.message
                      : 'Not enough on the van.'
                    : 'Could not update the job.';
  Alert.alert('Job', msg);
}

export default function WorkOrderOutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const thumb = useThumbActionStyle();
  const headerHeight = useHeaderHeight();
  const [doc, setDoc] = useState<WorkOrderOut | null | undefined>(undefined);
  const [summary, setSummary] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [stock, setStock] = useState<DisplayStock[]>([]);
  const [vanId, setVanId] = useState(DEFAULT_VAN_ID);

  const reload = useCallback(async () => {
    if (!id) {
      setDoc(null);
      setTasks([]);
      setNotes([]);
      setStock([]);
      return;
    }
    if (!nativeDbAvailable()) {
      const catalog = seedProductsRatesTaxes('0.1.0+1', 1_700_000_000);
      for (const row of catalog.products) memorySave('products', row.id, row.doc as never);
      for (const row of catalog.inventory) memorySave('inventory', row.id, row.doc as never);
      memorySave('users', 'usr:demo', seedUserDoc('0.1.0+1', 1_700_000_000) as never);
    }
    if (session) await repairUnappliedInventoryTx(id, session);
    const wo = await getWorkOrderOut(id);
    setDoc(wo);
    if (wo) {
      setSummary(wo.summary);
      setTasks(await listTasksForWork(wo.id));
      setNotes(await listNotes({ workOrderOutId: wo.id }));
      if (session) {
        const loc = await vanLocationIdForEmployee(session.employeeId);
        setVanId(loc);
        setStock(await listStockAtLocation(loc));
      }
    } else {
      setTasks([]);
      setNotes([]);
      setStock([]);
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
  const showStart = doc.editable && (doc.status === 'assigned' || doc.status === 'blocked');
  const showComplete = doc.editable && doc.status === 'in_progress';
  const showSubmit =
    !doc.editable && (doc.status === 'complete' || doc.status === 'cancelled') && doc.syncState === 'local_draft';

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <Stack.Screen options={{ title: doc.number }} />
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
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
            <FieldInput
              value={summary}
              onChangeText={setSummary}
              onEndEditing={() => {
                if (summary !== doc.summary) {
                  void run(() => updateWorkOrderOutFields(doc.id, { summary }, s));
                }
              }}
              style={styles.input}
              editable={!busy}
              returnKeyType="done"
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
              <DoneToggle
                key={op.id ?? String(i)}
                label={op.name ?? 'Step'}
                required={Boolean(op.required)}
                done={isOpDone(op.status)}
                disabled={!doc.editable || busy}
                onPress={() => {
                  const operations = doc.operations.map((o, j) =>
                    j === i ? { ...o, status: toggleOpDone(o.status) } : o,
                  );
                  void run(() => updateWorkOrderOutFields(doc.id, { operations }, s));
                }}
              />
            ))}
          </>
        ) : null}

        {doc.checklist.length > 0 ? (
          <>
            <Text style={styles.section}>Checklist</Text>
            {doc.checklist.map((c, i) => (
              <DoneToggle
                key={c.id ?? String(i)}
                label={c.label ?? 'Item'}
                required={Boolean(c.required)}
                done={Boolean(c.done)}
                disabled={!doc.editable || busy}
                onPress={() => {
                  const checklist = doc.checklist.map((item, j) => (j === i ? { ...item, done: !item.done } : item));
                  void run(() => updateWorkOrderOutFields(doc.id, { checklist }, s));
                }}
              />
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

        <Text style={styles.section}>Job chat</Text>
        <JobChat woinId={doc.sourceId} wooutId={doc.id} session={s} />

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
            style={({ pressed }) => [styles.secondary, thumb, pressed && styles.pressed]}
            onPress={() =>
              void run(async () => {
                await captureAndCommitPhoto(doc.id, s);
              })
            }
          >
            <Text style={styles.secondaryLabel}>Add photo</Text>
          </Pressable>
        ) : null}

        <Pressable
          disabled={busy}
          style={({ pressed }) => [styles.secondary, thumb, pressed && styles.pressed]}
          onPress={() => router.push(`/(tabs)/map?wooutId=${encodeURIComponent(doc.id)}`)}
        >
          <Text style={styles.secondaryLabel}>Nearby assets</Text>
        </Pressable>

        <Text style={styles.section}>Materials</Text>
        {doc.materials.length === 0 ? <Text style={styles.muted}>None used yet</Text> : null}
        {doc.materials.map((m) => (
          <Text key={m.productId} style={styles.value}>
            {m.description ?? m.sku ?? m.productId} · {m.qtyUsed} {m.uom ?? ''}
          </Text>
        ))}
        {doc.editable ? (
          <>
            <Text style={styles.section}>Van stock</Text>
            <VanStockConsume
              wooutId={doc.id}
              locationId={vanId}
              stock={stock}
              editable={doc.editable}
              busy={busy}
              session={s}
              onMutate={(fn) => void run(fn)}
            />
            <Pressable
              disabled={busy}
              style={({ pressed }) => [styles.secondary, thumb, pressed && styles.pressed]}
              onPress={() => router.push(`/(tabs)/inventory?wooutId=${encodeURIComponent(doc.id)}`)}
            >
              <Text style={styles.secondaryLabel}>Full van catalog</Text>
            </Pressable>
          </>
        ) : null}

        {showComplete ? (
          <Pressable
            disabled={busy}
            style={({ pressed }) => [styles.secondary, thumb, pressed && styles.pressed]}
            onPress={() =>
              void run(() => blockWork(doc.id, s, BLOCK_REASONS[0], 'Waiting on access'))
            }
          >
            <Text style={styles.secondaryLabel}>Block (access)</Text>
          </Pressable>
        ) : null}

        {doc.editable ? (
          <>
            <Text style={styles.section}>Cancel reason</Text>
            <FieldInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Required to cancel"
              style={styles.input}
              returnKeyType="done"
            />
            <Pressable
              disabled={busy}
              style={({ pressed }) => [styles.danger, thumb, pressed && styles.pressed]}
              onPress={() => void run(() => cancelWork(doc.id, s, cancelReason))}
            >
              <Text style={styles.dangerLabel}>Cancel job</Text>
            </Pressable>
          </>
        ) : null}

        {!doc.editable ? (
          <Pressable
            disabled={busy}
            style={({ pressed }) => [styles.secondary, thumb, pressed && styles.pressed]}
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
          style={({ pressed }) => [styles.secondary, thumb, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryLabel}>View inbound ticket</Text>
        </Pressable>
      </ScrollView>
      {showStart || showComplete || showSubmit ? (
        <ThumbDock>
          {showStart ? (
            <Pressable
              disabled={busy}
              style={({ pressed }) => [styles.primary, thumb, pressed && styles.pressed]}
              onPress={() => void run(() => startOrResumeWork(doc.id, s))}
            >
              <Text style={styles.primaryLabel}>{doc.status === 'blocked' ? 'Resume work' : 'Start work'}</Text>
            </Pressable>
          ) : null}
          {showComplete ? (
            <Pressable
              disabled={busy}
              style={({ pressed }) => [styles.primary, thumb, pressed && styles.pressed]}
              onPress={() => void run(() => completeWork(doc.id, s))}
            >
              <Text style={styles.primaryLabel}>Complete</Text>
            </Pressable>
          ) : null}
          {showSubmit ? (
            <Pressable
              disabled={busy}
              style={({ pressed }) => [styles.primary, thumb, pressed && styles.pressed]}
              onPress={() => void run(() => submitWork(doc.id, s))}
            >
              <Text style={styles.primaryLabel}>Submit</Text>
            </Pressable>
          ) : null}
        </ThumbDock>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.bg },
  body: { padding: theme.space.lg, paddingBottom: theme.space.xl, backgroundColor: theme.color.bg },
  warn: { backgroundColor: theme.color.warnSoft, padding: theme.space.md, borderRadius: theme.radius, marginBottom: theme.space.md },
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
    backgroundColor: theme.color.accent,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { color: theme.color.onAccent, fontSize: theme.type.lg, fontWeight: '600' },
  secondary: {
    marginTop: theme.space.md,
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
