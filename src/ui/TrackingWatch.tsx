import { useEffect } from 'react';
import { AppState } from 'react-native';
import { watchForegroundFixes } from '@/src/geo/location';
import { recordTrackPoint, trackMinMoveM } from '@/src/ops/tracking';
import { useAuth } from '@/src/session/AuthContext';

/** Foreground / while-using crumbs. Does not run in background. Never logs the tracking map. */
export function TrackingWatch() {
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;
    let stopWatch: (() => void) | undefined;
    let cancelled = false;

    const start = async () => {
      const handle = await watchForegroundFixes((fix) => {
        void recordTrackPoint(session, fix).catch(() => undefined);
      }, trackMinMoveM());
      if (cancelled) {
        handle?.stop();
        return;
      }
      stopWatch = handle?.stop;
    };

    const onApp = (state: string) => {
      if (state !== 'active') {
        stopWatch?.();
        stopWatch = undefined;
        return;
      }
      if (!stopWatch) void start();
    };

    const sub = AppState.addEventListener('change', onApp);
    if (AppState.currentState === 'active') void start();

    return () => {
      cancelled = true;
      sub.remove();
      stopWatch?.();
    };
  }, [session]);

  return null;
}
