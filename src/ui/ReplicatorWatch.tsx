import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/src/session/AuthContext';
import { sessionIsLive } from '@/src/session/strategy';
import { sessionRefreshSkewSec } from '@/src/session/sgSession';
import { ensureReplicatorRunning, runOneshot } from '@/src/sync/replicator';
import { oneshotIntervalSec, replSchema } from '@/src/sync/schema';

/** Foreground + interval. Schema is build-time (simple continuous vs oneshot). Demo does nothing. */
export function ReplicatorWatch() {
  const { session, refreshAuth, onAuthLost, needsReauth } = useAuth();

  useEffect(() => {
    if (!session || session.strategy === 'demo' || needsReauth) return;

    const hooks = { refreshAuth, onAuthLost };
    const schema = replSchema();
    const intervalMs = schema === 'oneshot' ? oneshotIntervalSec() * 1000 : 60_000;

    const liveSession = async () => {
      const now = Math.floor(Date.now() / 1000);
      if (!sessionIsLive(session.sessionExpiresAt, now, sessionRefreshSkewSec())) {
        const next = await refreshAuth();
        return next;
      }
      return session;
    };

    const onForeground = async () => {
      const s = await liveSession();
      if (!s) return;
      if (schema === 'oneshot') await runOneshot(s, hooks, 'foreground');
      else await ensureReplicatorRunning(s, hooks);
    };

    const onInterval = async () => {
      const s = await liveSession();
      if (!s) return;
      if (schema === 'oneshot') await runOneshot(s, hooks, 'interval');
      else await ensureReplicatorRunning(s, hooks);
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void onForeground();
    });
    if (AppState.currentState === 'active') void onForeground();
    const interval = setInterval(() => void onInterval(), intervalMs);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [session, refreshAuth, onAuthLost, needsReauth]);

  return null;
}
