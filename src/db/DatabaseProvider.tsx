import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../session/AuthContext';
import { startReplicator, stopReplicator } from '../sync/replicator';
import { closeFieldDatabase, nativeDbAvailable, openFieldDatabase } from './database';

export type DbStatus = 'idle' | 'opening' | 'ready' | 'unavailable' | 'error';

type DbState = {
  status: DbStatus;
  nativeAvailable: boolean;
  dbName: string | null;
  error: string | null;
};

const Ctx = createContext<DbState | null>(null);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { session, refreshAuth, onAuthLost } = useAuth();
  const [status, setStatus] = useState<DbStatus>('idle');
  const [dbName, setDbName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nativeAvailable = nativeDbAvailable();

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      void stopReplicator().then(() => closeFieldDatabase());
      setStatus('idle');
      setDbName(null);
      setError(null);
      return;
    }
    if (!nativeAvailable) {
      setStatus('unavailable');
      return;
    }
    setStatus('opening');
    (async () => {
      try {
        const opened = await openFieldDatabase(session.employeeId);
        if (cancelled) return;
        setDbName(opened.name);
        setStatus('ready');
        setError(null);
        void startReplicator(session, { refreshAuth, onAuthLost });
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Database failed to open');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, nativeAvailable, refreshAuth, onAuthLost]);

  const value = useMemo(
    () => ({ status, nativeAvailable, dbName, error }),
    [status, nativeAvailable, dbName, error],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDatabase(): DbState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDatabase must be used inside DatabaseProvider');
  return ctx;
}
