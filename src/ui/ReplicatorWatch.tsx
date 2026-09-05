import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/src/session/AuthContext';
import { sessionIsLive } from '@/src/session/strategy';
import { sessionRefreshSkewSec } from '@/src/session/sgSession';
import { ensureReplicatorRunning } from '@/src/sync/replicator';

/** Foreground restart + T−5 min session refresh. Demo does nothing. */
export function ReplicatorWatch() {
  const { session, refreshAuth, onAuthLost, needsReauth } = useAuth();

  useEffect(() => {
    if (!session || session.strategy === 'demo' || needsReauth) return;

    const hooks = { refreshAuth, onAuthLost };

    const tick = async () => {
      const now = Math.floor(Date.now() / 1000);
      if (!sessionIsLive(session.sessionExpiresAt, now, sessionRefreshSkewSec())) {
        const next = await refreshAuth();
        if (next) {
          await ensureReplicatorRunning(next, hooks);
          return;
        }
      }
      await ensureReplicatorRunning(session, hooks);
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void tick();
    });
    if (AppState.currentState === 'active') void tick();
    const interval = setInterval(() => void tick(), 60_000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [session, refreshAuth, onAuthLost, needsReauth]);

  return null;
}
