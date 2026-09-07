import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import {
  formatSyncHud,
  formatSyncStatus,
  type SyncStatusTone,
  type SyncStatusView,
} from '../ops/syncStatus';
import { hydrateSyncTimes, refreshPendingCount, replicatorLiveStatus, subscribeReplicatorStatus } from '../sync/replicator';
import { theme } from '../theme';

function useReplicatorLive() {
  const [live, setLive] = useState(() => replicatorLiveStatus());
  useEffect(() => {
    const refresh = () => setLive(replicatorLiveStatus());
    void hydrateSyncTimes().then(refresh);
    void refreshPendingCount().then(refresh);
    return subscribeReplicatorStatus(refresh);
  }, []);
  return live;
}

export function useSyncStatus(): SyncStatusView {
  const live = useReplicatorLive();
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useFocusEffect(
    useCallback(() => {
      setNowSec(Math.floor(Date.now() / 1000));
      void refreshPendingCount();
      const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 30_000);
      return () => clearInterval(id);
    }, []),
  );

  return formatSyncStatus({ ...live, nowSec });
}

const HUD_DOT: Record<SyncStatusTone, string> = {
  ok: theme.color.okBright,
  warn: theme.color.warnBright,
  danger: theme.color.dangerBright,
  accent: theme.color.okBright,
  muted: theme.color.accentSoft,
};

/** Minimal status to the right of the Today clock time. */
export function SyncClockHud({ nowSec }: { nowSec: number }) {
  const live = useReplicatorLive();
  const hud = formatSyncHud({ ...live, nowSec });
  const dot = HUD_DOT[hud.tone];
  return (
    <View
      style={hudStyles.wrap}
      accessibilityRole="text"
      accessibilityLabel={hud.accessibilityLabel}
    >
      <View style={[hudStyles.dot, { backgroundColor: dot }]} />
      {hud.agoCompact ? <Text style={hudStyles.meta}>{hud.agoCompact}</Text> : null}
      {hud.pending > 0 ? <Text style={hudStyles.pending}>{hud.pending}</Text> : null}
    </View>
  );
}

const hudStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    flexShrink: 0,
    paddingLeft: theme.space.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  meta: {
    fontSize: theme.type.md,
    fontWeight: '700',
    color: theme.color.onAccent,
    fontVariant: ['tabular-nums'],
  },
  pending: {
    fontSize: theme.type.md,
    fontWeight: '700',
    color: theme.color.onAccent,
    fontVariant: ['tabular-nums'],
  },
});

const TONE: Record<SyncStatusTone, { bg: string; fg: string; dot: string }> = {
  ok: { bg: theme.color.okSoft, fg: theme.color.ok, dot: theme.color.ok },
  accent: { bg: theme.color.accentSoft, fg: theme.color.accentDeep, dot: theme.color.accent },
  warn: { bg: theme.color.warnSoft, fg: theme.color.warn, dot: theme.color.warn },
  danger: { bg: theme.color.dangerSoft, fg: theme.color.danger, dot: theme.color.danger },
  muted: { bg: theme.color.surface, fg: theme.color.muted, dot: theme.color.muted },
};

export function SyncStatusBar() {
  const view = useSyncStatus();
  const tone = TONE[view.tone];
  return (
    <View
      style={[styles.wrap, { backgroundColor: tone.bg }]}
      accessibilityRole="text"
      accessibilityLabel={view.accessibilityLabel}
      accessibilityLiveRegion={view.kind === 'connected' || view.kind === 'demo' ? 'none' : 'polite'}
    >
      <View style={[styles.dot, { backgroundColor: tone.dot }]} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: tone.fg }]}>{view.title}</Text>
        {view.detail ? <Text style={[styles.detail, { color: tone.fg }]}>{view.detail}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    padding: theme.space.md,
    marginBottom: theme.space.md,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  copy: { flex: 1 },
  title: { fontSize: theme.type.md, fontWeight: '700' },
  detail: { fontSize: theme.type.sm, marginTop: 2 },
});
