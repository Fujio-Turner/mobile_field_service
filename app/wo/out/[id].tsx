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
import { applyInboundDecision, decideInboundAction, inspectInboundVsCopy } from '@/src/ops/inboundApply';
import type { KitFieldDiff } from '@/src/ops/inboundDiff';
import { useJobRules } from '@/src/dev/JobRulesContext';
import { createAmendment } from '@/src/ops/createAmendment';
import { parseWorkOrderOut, type WorkOrderOut } from '@/src/ops/getWorkOrderOut';
import { loadOutboundRaw } from '@/src/ops/outboundStore';
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
import { ensureMemoryCatalog } from '@/src/db/ensureMemoryDemo';
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
  const { rules } = useJobRules();
  const thumb = useThumbActionStyle();
  const headerHeight = useHeaderHeight();
  const [doc, setDoc] = useState<WorkOrderOut | null | undefined>(undefined);
  const [summary, setSummary] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [dispatchBanner, setDispatchBanner] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<KitFieldDiff[]>([]);
  const [picks, setPicks] = useState<Record<string, 'local' | 'remote'>>({});
  const [locked, setLocked] = useState(false);
  const [dropped, setDropped] = useState(false);
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
    ensureMemoryCatalog();
    let raw = await loadOutboundRaw(id);
    if (session && raw) {
      const repaired = await repairUnappliedInventoryTx(id, session, raw);
      if (repaired > 0) raw = await loadOutboundRaw(id);
    }
    let wo = parseWorkOrderOut(id, raw);
    setDoc(wo);
    if (wo) {
      setSummary(wo.summary);
      const locP = session ? vanLocationIdForEmployee(session.employeeId) : Promise.resolve(DEFAULT_VAN_ID);
      const [nextTasks, nextNotes, loc] = await Promise.all([
        listTasksForWork(wo.id),
        listNotes({ workOrderOutId: wo.id }),
        locP,
      ]);
      setTasks(nextTasks);
      setNotes(nextNotes);
      setVanId(loc);
      if (session) setStock(await listStockAtLocation(loc));
    } else {
      setTasks([]);
      setNotes([]);
      setStock([]);
    }
    if (wo && session) {
      const inspect = await inspectInboundVsCopy(wo.id, raw);
      const assigned = (inspect.inbound?.assignedTo ?? {}) as { employeeId?: string; displayName?: string };
      const reassigned = Boolean(inspect.inbound && assigned.employeeId !== session.employeeId);
      if (reassigned) {
        setBanner(`Reassigned to ${assigned.displayName ?? assigned.employeeId}`);
      } else if (!inspect.inbound) {
        setBanner('Assignment changed');
      } else {
        setBanner(null);
      }
      setLocked(reassigned && rules.reassign === 'forbid_edits');
      const src = inspect.outbound?.source as { dropped?: boolean } | undefined;
      setDropped(src?.dropped === true);
      const action = decideInboundAction({
        rules,
        untouched: inspect.untouched,
        gone: inspect.gone,
        diffs: inspect.diffs,
      });
      if (action === 'apply' || action === 'drop') {
        const result = await applyInboundDecision(wo.id, session, rules, undefined, inspect);
        const again = result.outbound ? parseWorkOrderOut(id, result.outbound) : wo;
        if (again) {
          wo = again;
          setDoc(again);
          setSummary(again.summary);
        }
        setDropped(
          ((result.outbound?.source as { dropped?: boolean } | undefined)?.dropped === true) ||
            action === 'drop',
        );
        setDiffs([]);
        setDispatchBanner(
          action === 'drop'
            ? 'Dispatch cancelled or pulled this ticket. Your copy was never edited, so it is hidden from Today.'
            : result.applied.length
              ? `Applied inbound ${result.applied.join(', ')}.`
              : 'Applied new inbound values onto this copy.',
        );
        setPicks({});
      } else if (action === 'prompt') {
        setDiffs(inspect.diffs);
        setPicks((prev) => {
          const next: Record<string, 'local' | 'remote'> = {};
          for (const d of inspect.diffs) next[d.key] = prev[d.key] ?? (d.dirty ? 'local' : 'remote');
          return next;
        });
        setDispatchBanner('Dispatch changed the ticket. Pick keep mine or take inbound for each field.');
      } else if (inspect.diffs.length) {
        setDiffs(inspect.diffs);
        setDispatchBanner(
          `Dispatch updated ${inspect.diffs.map((d) => d.key).join(', ')}. Local wins — your copy is unchanged.`,
        );
        setPicks({});
      } else {
        setDiffs([]);
        setDispatchBanner(null);
        setPicks({});
      }
    } else {
      setDispatchBanner(null);
      setDiffs([]);
      setLocked(false);
      setDropped(false);
    }
  }, [id, session, rules]);

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
  const canEdit = doc.editable && !locked && !dropped;
  const showStart = canEdit && (doc.status === 'assigned' || doc.status === 'blocked');
  const showComplete = canEdit && doc.status === 'in_progress';
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
        {dispatchBanner ? (
          <View style={styles.warn}>
            <Text style={styles.warnText}>{dispatchBanner}</Text>
          </View>
        ) : null}
        {locked ? (
          <View style={styles.warn}>
            <Text style={styles.warnText}>Dev rule: further edits are forbidden after reassignment.</Text>
          </View>
        ) : null}
        {diffs.length > 0 ? (
          <View style={styles.diffBox}>
            <Text style={styles.section}>Inbound changes</Text>
            {diffs.map((d) => (
              <View key={d.key} style={styles.diffRow}>
                <Text style={styles.diffKey}>{d.key}</Text>
                <Text style={styles.muted}>Yours {d.local}</Text>
                <Text style={styles.muted}>Inbound {d.remote}</Text>
                {picks[d.key] ? (
                  <View style={styles.pickRow}>
                    <Pressable
                      onPress={() => setPicks((p) => ({ ...p, [d.key]: 'local' }))}
                      style={[styles.pick, picks[d.key] === 'local' && styles.pickOn]}
                    >
                      <Text style={picks[d.key] === 'local' ? styles.pickLabelOn : styles.pickLabel}>Keep mine</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setPicks((p) => ({ ...p, [d.key]: 'remote' }))}
                      style={[styles.pick, picks[d.key] === 'remote' && styles.pickOn]}
                    >
                      <Text style={picks[d.key] === 'remote' ? styles.pickLabelOn : styles.pickLabel}>Take inbound</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
            {Object.keys(picks).length > 0 && session ? (
              <Pressable
                disabled={busy}
                style={styles.secondary}
                onPress={() => void run(() => applyInboundDecision(doc.id, s, rules, picks).then(() => undefined))}
              >
                <Text style={styles.secondaryLabel}>Apply selected</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.kicker}>
          {doc.role} · {doc.status} · {doc.syncState}
          {doc.kind ? ` · ${doc.kind}` : ''}
          {doc.owner === 'backend' ? ' · frozen' : ''}
        </Text>
        {canEdit ? (
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
        {doc.move?.from || doc.move?.to ? (
          <Text style={styles.muted}>
            {doc.move.from ? `From ${doc.move.from.name ?? 'origin'}` : ''}
            {doc.move.from && doc.move.to ? ' → ' : ''}
            {doc.move.to ? `To ${doc.move.to.name ?? 'destination'}` : ''}
          </Text>
        ) : null}
        {doc.orderId ? (
          <Pressable onPress={() => router.push(`/order/${doc.orderId}`)} style={styles.rowBtn}>
            <Text style={styles.secondaryLabel}>Open linked order</Text>
          </Pressable>
        ) : null}
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
                disabled={!canEdit || busy}
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
                disabled={!canEdit || busy}
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
          editable={canEdit}
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
            {canEdit ? (
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
        {canEdit ? (
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
        {canEdit ? (
          <>
            <Text style={styles.section}>Van stock</Text>
            <VanStockConsume
              wooutId={doc.id}
              locationId={vanId}
              stock={stock}
              editable={canEdit}
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

        {canEdit ? (
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
  diffBox: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space.md,
    marginBottom: theme.space.md,
  },
  diffRow: { marginBottom: theme.space.md },
  diffKey: { fontSize: theme.type.md, color: theme.color.text, fontWeight: '600' },
  pickRow: { flexDirection: 'row', gap: theme.space.sm, marginTop: theme.space.sm },
  pick: {
    minHeight: 40,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radiusSm,
    borderWidth: 1,
    borderColor: theme.color.border,
    justifyContent: 'center',
    backgroundColor: theme.color.bg,
  },
  pickOn: { borderColor: theme.color.accent, backgroundColor: theme.color.accentSoft },
  pickLabel: { color: theme.color.text, fontSize: theme.type.sm },
  pickLabelOn: { color: theme.color.accent, fontSize: theme.type.sm, fontWeight: '600' },
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
