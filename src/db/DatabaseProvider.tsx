import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getUserProfile } from '../ops/users';
import { useAuth } from '../session/AuthContext';
import { startReplicator, stopReplicator } from '../sync/replicator';
import { closeFieldDatabase, nativeDbAvailable, openFieldDatabase } from './database';

export type DbStatus = 'idle' | 'opening' | 'ready' | 'unavailable' | 'error';

type DbState = {
  status: DbStatus;
  nativeAvailable: boolean;
  dbName: string | null;
  dbPath: string | null;
  dbDirectory: string | null;
  error: string | null;
  retry: () => void;
};

const Ctx = createContext<DbState | null>(null);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { session, refreshAuth, onAuthLost, applyWorkModes } = useAuth();
  const [status, setStatus] = useState<DbStatus>('idle');
  const [dbName, setDbName] = useState<string | null>(null);
  const [dbPath, setDbPath] = useState<string | null>(null);
  const [dbDirectory, setDbDirectory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const nativeAvailable = nativeDbAvailable();
  const retry = useCallback(() => setRetryTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      void stopReplicator().then(() => closeFieldDatabase());
      setStatus('idle');
      setDbName(null);
      setDbPath(null);
      setDbDirectory(null);
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
        setDbPath(opened.path);
        setDbDirectory(opened.directory);
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
  }, [session, nativeAvailable, refreshAuth, onAuthLost, retryTick]);

  const employeeId = session?.employeeId;
  useEffect(() => {
    if (!employeeId) return;
    if (status !== 'ready' && status !== 'unavailable') return;
    let cancelled = false;
    void getUserProfile(employeeId).then((profile) => {
      if (!cancelled && profile) applyWorkModes(profile.workModes);
    });
    return () => {
      cancelled = true;
    };
  }, [employeeId, status, applyWorkModes]);

  const value = useMemo(
    () => ({ status, nativeAvailable, dbName, dbPath, dbDirectory, error, retry }),
    [status, nativeAvailable, dbName, dbPath, dbDirectory, error, retry],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDatabase(): DbState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDatabase must be used inside DatabaseProvider');
  return ctx;
}
