import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { OPERATOR_COLLECTIONS, isOperatorCollection } from '@/src/db/collections';
import { reopenFieldDatabase } from '@/src/db/database';
import { isDbEncryptionEnabled, setDbEncryptionEnabled } from '@/src/dev/dbEncryption';
import { collectionCounts, type CollectionCountRow } from '@/src/ops/collectionCounts';
import { formatEpoch, runtimeVersions } from '@/src/ops/runtimeVersions';
import { syncSnapshot, type SyncSnapshot } from '@/src/ops/syncSnapshot';
import { useAuth } from '@/src/session/AuthContext';
import {
  applyChannelsToAll,
  emptyChannelMap,
  formatChannels,
  normalizeChannels,
} from '@/src/sync/channels';
import { loadCollectionChannels } from '@/src/sync/persist';
import {
  applyCollectionChannels,
  hydrateSyncTimes,
  refreshPendingCount,
  runOneshot,
  startReplicator,
  stopReplicator,
} from '@/src/sync/replicator';
import { replSchema } from '@/src/sync/schema';
import {
  INBOUND_LABELS,
  INBOUND_POLICIES,
  REASSIGN_LABELS,
  REASSIGN_POLICIES,
  type InboundPolicy,
  type ReassignPolicy,
} from '@/src/dev/jobRules';
import { useJobRules } from '@/src/dev/JobRulesContext';
import { pickOpenJob, simulateDispatchKitChange } from '@/src/dev/simulateInbound';
import { NativeBanner } from '@/src/ui/NativeBanner';
import { FieldInput } from '@/src/ui/FieldInput';
import { useThumbActionStyle } from '@/src/ui/HandednessContext';
import { theme } from '@/src/theme';

export default function DebugScreen() {
  const { session, refreshAuth, onAuthLost } = useAuth();
  const { rules, setReassign, setInbound } = useJobRules();
  const router = useRouter();
  const params = useLocalSearchParams<{ demo?: string }>();
  const demoRan = useRef<string | null>(null);
  const thumb = useThumbActionStyle();
  const versions = runtimeVersions();
  const [sync, setSync] = useState<SyncSnapshot | null>(null);
  const [counts, setCounts] = useState<CollectionCountRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [shared, setShared] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [encrypt, setEncrypt] = useState(false);

  const refresh = useCallback(async () => {
    await hydrateSyncTimes();
    await refreshPendingCount();
    setSync(syncSnapshot());
    setCounts(await collectionCounts());
    setEncrypt(await isDbEncryptionEnabled());
    const stored = await loadCollectionChannels();
    const next: Record<string, string> = {};
    for (const name of OPERATOR_COLLECTIONS) {
      next[name] = formatChannels(stored?.[name] ?? []);
    }
    setDraft(next);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      if (session && params.demo && demoRan.current !== params.demo) {
        demoRan.current = params.demo;
        void (async () => {
          await runDemo(params.demo!);
        })();
      }
      const id = setInterval(() => {
        void (async () => {
          await hydrateSyncTimes();
          await refreshPendingCount();
          setSync(syncSnapshot());
        })();
      }, 5000);
      return () => clearInterval(id);
    }, [refresh, session, params.demo]),
  );

  async function runDemo(demo: string) {
    if (!session) return;
    setBusy(true);
    try {
      if (demo === 'remote') setInbound('remote_wins');
      else if (demo === 'prompt') setInbound('prompt');
      else if (demo === 'local' || demo === 'untouched') setInbound('local_wins');
      if (demo === 'reassign') {
        setReassign('forbid_edits');
        const job = await pickOpenJob(session.employeeId, 'WO-10460');
        if (!job) {
          setResult('No reassigned leftover. Need WO-10460.');
          return;
        }
        router.push(`/wo/out/${job.wooutId}`);
        return;
      }
      const job = await pickOpenJob(session.employeeId, 'WO-10470');
      if (!job) {
        setResult('Start work on a Today job first.');
        return;
      }
      await simulateDispatchKitChange(session, job.wooutId, { dirtyLocal: demo !== 'untouched' });
      setResult(`Simulated dispatch kit on ${job.number}`);
      router.push(`/wo/out/${job.wooutId}`);
    } finally {
      setBusy(false);
    }
  }

  const hooks = { refreshAuth, onAuthLost };

  async function run(label: string, fn: () => Promise<{ ok: boolean; reason?: string } | void>) {
    if (!session) return;
    setBusy(true);
    try {
      const out = await fn();
      if (out && typeof out === 'object' && 'ok' in out) {
        setResult(out.ok ? `${label}: started` : `${label}: ${out.reason ?? 'failed'}`);
      } else {
        setResult(`${label}: done`);
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Settings / debug' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <NativeBanner />

          <Text style={styles.h}>Software</Text>
          <Text style={styles.row}>App {versions.app}</Text>
          <Text style={styles.row}>Expo SDK {versions.expoSdk}</Text>
          <Text style={styles.row}>React Native {versions.reactNative}</Text>
          <Text style={styles.row}>Hermes {versions.hermes ? 'yes' : 'no'}</Text>
          <Text style={styles.row}>cbl-reactnative {versions.cblJs}</Text>
          <Text style={styles.row}>Couchbase Lite native {versions.cblNative}</Text>
          <Text style={styles.row}>
            {versions.os} {versions.osVersion}
          </Text>

          <Text style={styles.h}>Job rules (dev)</Text>
          <Text style={styles.muted}>
            Reassignment: keep working your copy (default) or lock it. Inbound kit: if you have not edited the copy,
            new inbound values are always applied (or the row is hidden if dispatch cancelled). If you already edited,
            pick local wins, remote wins, or a per-field diff.
          </Text>
          <Text style={styles.label}>Reassigned inbound</Text>
          {REASSIGN_POLICIES.map((p) => (
            <Pressable
              key={p}
              accessibilityRole="button"
              onPress={() => setReassign(p as ReassignPolicy)}
              style={[styles.choice, rules.reassign === p && styles.choiceOn]}
            >
              <Text style={rules.reassign === p ? styles.choiceLabelOn : styles.choiceLabel}>{REASSIGN_LABELS[p]}</Text>
            </Pressable>
          ))}
          <Text style={styles.label}>Inbound vs your copy (after you have edited)</Text>
          {INBOUND_POLICIES.map((p) => (
            <Pressable
              key={p}
              accessibilityRole="button"
              onPress={() => setInbound(p as InboundPolicy)}
              style={[styles.choice, rules.inbound === p && styles.choiceOn]}
            >
              <Text style={rules.inbound === p ? styles.choiceLabelOn : styles.choiceLabel}>{INBOUND_LABELS[p]}</Text>
            </Pressable>
          ))}
          <Text style={styles.muted}>
            Try on WO-10470 (started inspect): dirties your copy, then patches inbound summary + checklist.
          </Text>
          <Pressable
            disabled={busy || !session}
            onPress={() => void runDemo('local')}
            style={({ pressed }) => [styles.secondary, thumb, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.secondaryLabel}>Try local wins on a job</Text>
          </Pressable>
          <Pressable
            disabled={busy || !session}
            onPress={() => void runDemo('prompt')}
            style={({ pressed }) => [styles.secondary, thumb, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.secondaryLabel}>Try pick-from-diff on a job</Text>
          </Pressable>
          <Pressable
            disabled={busy || !session}
            onPress={() => void runDemo('remote')}
            style={({ pressed }) => [styles.secondary, thumb, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.secondaryLabel}>Try remote wins on a job</Text>
          </Pressable>
          <Pressable
            disabled={busy || !session}
            onPress={() => void runDemo('reassign')}
            style={({ pressed }) => [styles.secondary, thumb, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.secondaryLabel}>Try forbid-edits on reassigned job</Text>
          </Pressable>

          <Text style={styles.h}>Database</Text>
          <Text style={styles.row} selectable>
            Name {sync?.dbName ?? '—'}
          </Text>
          <Text style={styles.path} selectable>
            Directory {sync?.dbDirectory ?? '—'}
          </Text>
          <Text style={styles.path} selectable>
            Path {sync?.dbPath ?? '—'}
          </Text>
          <Text style={styles.label}>Encryption (dev)</Text>
          <Text style={styles.muted}>
            Default off (unencrypted file). On uses CBL AES-256 with a Keychain key — the key is never shown.
            Switching deletes the local database and reseeds.
          </Text>
          {(
            [
              { on: false, label: 'Off (default)' },
              { on: true, label: 'On (Keychain key)' },
            ] as const
          ).map((opt) => (
            <Pressable
              key={opt.label}
              accessibilityRole="button"
              disabled={busy || !session || encrypt === opt.on}
              onPress={() =>
                void run(opt.on ? 'Encryption on' : 'Encryption off', async () => {
                  await stopReplicator();
                  await setDbEncryptionEnabled(opt.on);
                  if (session) await reopenFieldDatabase(session.employeeId, { wipe: true });
                  setEncrypt(opt.on);
                })
              }
              style={[styles.choice, encrypt === opt.on && styles.choiceOn]}
            >
              <Text style={encrypt === opt.on ? styles.choiceLabelOn : styles.choiceLabel}>{opt.label}</Text>
            </Pressable>
          ))}

          <Text style={styles.h}>Replication</Text>
          <Text style={styles.row} selectable>
            URL {sync?.replicatorUrl ?? '—'}
          </Text>
          <Text style={styles.row}>
            Schema {sync?.schema ?? '—'}
            {sync?.schema === 'oneshot'
              ? ` · oneshot every ${sync.oneshotIntervalSec}s + foreground`
              : ' · continuous'}
          </Text>
          {sync?.schema === 'oneshot' ? (
            <>
              <Text style={styles.row}>
                Oneshot {sync.oneshotPhase}
                {sync.oneshotBootstrapDone ? ' · bootstrap done' : ' · bootstrap pending (workordersin, orders)'}
              </Text>
              <Text style={styles.row}>Last oneshot {formatEpoch(sync.lastOneshotAt)}</Text>
              <Text style={styles.muted}>
                Active this run:{' '}
                {(sync.activeCollections ?? []).filter(isOperatorCollection).join(', ') || '—'}
              </Text>
            </>
          ) : null}
          <Text style={styles.muted}>
            Schema is set at build time (EXPO_PUBLIC_REPL_SCHEMA), not on Profile.
          </Text>
          <Text style={styles.row}>
            Status {sync ? `${sync.activity}${sync.started ? '' : ' (not started)'}` : '—'}
            {sync?.skippedReason ? ` · ${sync.skippedReason}` : ''}
            {sync?.lastErrorCode != null ? ` · error ${sync.lastErrorCode}` : ''}
          </Text>
          <Text style={styles.row}>
            Documents completed {sync?.docsCompleted ?? 0} (push {sync?.docsPushOk ?? 0} · pull{' '}
            {sync?.docsPullOk ?? 0})
          </Text>
          <Text style={styles.row}>
            Documents failed {sync?.docsFailed ?? 0}
            {sync?.docsConflict ? ` · conflicts ${sync.docsConflict}` : ''}
          </Text>
          <Text style={styles.row}>Pending {sync?.pending ?? 0}</Text>
          {sync?.lastDocId && isOperatorCollection(sync.lastDocCollection ?? '') ? (
            <Text style={styles.row}>
              Last doc {sync.lastDocCollection ?? '—'}/{sync.lastDocId}
              {sync.lastErrorClass ? ` · ${sync.lastErrorClass}` : ''}
            </Text>
          ) : null}
          <Text style={styles.row}>Last pull {formatEpoch(sync?.lastPullSuccessAt)}</Text>
          <Text style={styles.row}>Last push {formatEpoch(sync?.lastPushSuccessAt)}</Text>
          {sync?.progressTotal ? (
            <Text style={styles.row}>
              Progress {sync.progressCompleted ?? 0}/{sync.progressTotal}
            </Text>
          ) : null}
          {sync?.lastErrorClass ? (
            <Text style={styles.row}>
              Last HTTP {sync.lastErrorCode} ({sync.lastErrorClass})
            </Text>
          ) : null}
          <Text style={styles.muted}>
            Conflict resolvers are per collection (switch/case). All collections currently use the
            Couchbase Lite default; a custom resolver can replace any case later.
          </Text>
          <Text style={styles.muted}>
            Demo never starts the replicator. Use basic auth and EXPO_PUBLIC_SG_URL to test a live
            gateway. Empty channel lists pull every channel the session can access. Start/Restart
            follows the compiled schema (continuous vs oneshot).
          </Text>
          {result ? <Text style={styles.result}>{result}</Text> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start replicator"
            disabled={busy || !session}
            onPress={() =>
              void run('Start', () =>
                replSchema() === 'oneshot'
                  ? runOneshot(session!, hooks, 'manual')
                  : startReplicator(session!, hooks),
              )
            }
            style={({ pressed }) => [styles.secondary, thumb, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.secondaryLabel}>Start replicator</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop replicator"
            disabled={busy}
            onPress={() => void run('Stop', () => stopReplicator())}
            style={({ pressed }) => [styles.secondary, thumb, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.secondaryLabel}>Stop replicator</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restart replicator"
            disabled={busy || !session}
            onPress={() =>
              void run('Restart', () =>
                replSchema() === 'oneshot'
                  ? runOneshot(session!, hooks, 'manual')
                  : startReplicator(session!, hooks),
              )
            }
            style={({ pressed }) => [styles.secondary, thumb, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.secondaryLabel}>Restart replicator</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh debug"
            disabled={busy}
            onPress={() => void refresh()}
            style={({ pressed }) => [styles.secondary, thumb, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.secondaryLabel}>Refresh</Text>
          </Pressable>

          <Text style={styles.h}>Documents per collection</Text>
          {counts
            .filter((row) => isOperatorCollection(row.name) || (row.scope === 'local' && row.name === 'tmp'))
            .map((row) => (
            <Text key={`${row.scope}.${row.name}`} style={styles.row}>
              {row.scope}.{row.name} {row.count ?? '—'}
              {row.replicated ? '' : ' · not replicated'}
            </Text>
          ))}

          <Text style={styles.h}>Channel filters</Text>
          <Text style={styles.muted}>
            Per-collection pull channels (comma-separated). Leave blank for no client filter.
            Currently filtering{' '}
            {OPERATOR_COLLECTIONS.filter((n) => (sync?.channels?.[n] ?? []).length > 0).length} of{' '}
            {OPERATOR_COLLECTIONS.length} collections.
          </Text>
          <Text style={styles.label}>Apply to every collection</Text>
          <FieldInput
            value={shared}
            onChangeText={setShared}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="emp:E-4412, email:jon.hale@example.com"
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Apply shared channels to all collections"
            onPress={() => {
              const map = applyChannelsToAll(normalizeChannels(shared), OPERATOR_COLLECTIONS);
              const next: Record<string, string> = {};
              for (const name of OPERATOR_COLLECTIONS) next[name] = formatChannels(map[name] ?? []);
              setDraft(next);
            }}
            style={({ pressed }) => [styles.ghost, thumb, pressed && styles.pressed]}
          >
            <Text style={styles.ghostLabel}>Fill all collections</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fill employee channel on all collections"
            onPress={() => {
              if (!session) return;
              const map = applyChannelsToAll([`emp:${session.employeeId}`], OPERATOR_COLLECTIONS);
              const next: Record<string, string> = {};
              for (const name of OPERATOR_COLLECTIONS) next[name] = formatChannels(map[name] ?? []);
              setDraft(next);
              setShared(`emp:${session.employeeId}`);
            }}
            style={({ pressed }) => [styles.ghost, thumb, pressed && styles.pressed]}
          >
            <Text style={styles.ghostLabel}>Fill emp:{session?.employeeId ?? 'id'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear all channel filters"
            onPress={() => {
              const map = emptyChannelMap(OPERATOR_COLLECTIONS);
              const next: Record<string, string> = {};
              for (const name of OPERATOR_COLLECTIONS) next[name] = formatChannels(map[name] ?? []);
              setDraft(next);
              setShared('');
            }}
            style={({ pressed }) => [styles.ghost, thumb, pressed && styles.pressed]}
          >
            <Text style={styles.ghostLabel}>Clear all filters</Text>
          </Pressable>

          {OPERATOR_COLLECTIONS.map((name) => (
            <View key={name} style={styles.colBlock}>
              <Text style={styles.label}>
                field.{name}
                {counts.find((c) => c.name === name && c.scope === 'field')
                  ? ` · ${counts.find((c) => c.name === name)?.count ?? '—'}`
                  : ''}
              </Text>
              <FieldInput
                value={draft[name] ?? ''}
                onChangeText={(text) => setDraft((prev) => ({ ...prev, [name]: text }))}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="(all granted channels)"
                style={styles.input}
              />
            </View>
          ))}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save channel filters and restart replicator"
            disabled={busy || !session}
            onPress={() =>
              void run('Save channels', async () => {
                const stored = await loadCollectionChannels();
                const map = { ...(stored ?? emptyChannelMap()) };
                for (const name of OPERATOR_COLLECTIONS) {
                  map[name] = normalizeChannels(draft[name]);
                }
                return applyCollectionChannels(session!, map, hooks);
              })
            }
            style={({ pressed }) => [styles.primary, thumb, pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.primaryLabel}>Save channels and restart</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space.lg, paddingBottom: theme.space.xl * 2 },
  h: {
    fontSize: theme.type.lg,
    color: theme.color.text,
    fontWeight: '700',
    marginTop: theme.space.xl,
    marginBottom: theme.space.sm,
  },
  row: { fontSize: theme.type.md, color: theme.color.text, marginBottom: theme.space.xs },
  path: { fontSize: theme.type.sm, color: theme.color.text, marginBottom: theme.space.xs },
  muted: { fontSize: theme.type.sm, color: theme.color.muted, marginBottom: theme.space.md },
  result: { fontSize: theme.type.md, color: theme.color.accentDeep, marginBottom: theme.space.sm },
  label: { fontSize: theme.type.sm, color: theme.color.muted, marginBottom: theme.space.xs, marginTop: theme.space.sm },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radiusSm,
    paddingHorizontal: theme.space.md,
    backgroundColor: theme.color.surface,
    color: theme.color.text,
    fontSize: theme.type.md,
  },
  colBlock: { marginBottom: theme.space.sm },
  primary: {
    marginTop: theme.space.lg,
    borderRadius: theme.radius,
    backgroundColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryLabel: { color: theme.color.onAccent, fontSize: theme.type.lg, fontWeight: '600' },
  secondary: {
    marginTop: theme.space.sm,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
    minHeight: 48,
  },
  secondaryLabel: { color: theme.color.accent, fontSize: theme.type.lg, fontWeight: '600' },
  ghost: {
    marginTop: theme.space.sm,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  ghostLabel: { color: theme.color.accent, fontSize: theme.type.md, fontWeight: '600' },
  choice: {
    minHeight: 44,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
    justifyContent: 'center',
    paddingHorizontal: theme.space.md,
    marginBottom: theme.space.sm,
  },
  choiceOn: { borderColor: theme.color.accent, backgroundColor: theme.color.accentSoft },
  choiceLabel: { color: theme.color.text, fontSize: theme.type.md },
  choiceLabelOn: { color: theme.color.accent, fontSize: theme.type.md, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
