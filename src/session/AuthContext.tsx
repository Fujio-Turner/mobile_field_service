import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { log } from '../log/logger';
import { stopReplicator } from '../sync/replicator';
import { authStrategy, buildDemoSession, sessionIsLive } from './strategy';
import { clearAuthKeys, clearPassword, readPassword, readSession, writeSession } from './enclave';
import { loginRemoteBasic, refreshBasicSession } from './loginRemote';
import type { Session } from './types';

type AuthState = {
  ready: boolean;
  session: Session | null;
  error: string | null;
  busy: boolean;
  needsReauth: boolean;
  login: (identifier: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<Session | null>;
  onAuthLost: () => void;
};

const Ctx = createContext<AuthState | null>(null);

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await readSession();
        if (cancelled) return;
        if (stored && sessionIsLive(stored.sessionExpiresAt, nowSec())) {
          setSession(stored);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    setBusy(true);
    setError(null);
    try {
      const strategy = authStrategy();
      if (strategy === 'demo') {
        const result = buildDemoSession(identifier, nowSec());
        if (!result.ok) {
          setError(result.error);
          log.warn('mfs.auth.login_fail', { op: 'LoginRemote' });
          return false;
        }
        await writeSession(result.session);
        setSession(result.session);
        setNeedsReauth(false);
        log.info('mfs.auth.login_ok', { op: 'LoginRemote', employeeId: result.session.employeeId });
        return true;
      }
      if (strategy === 'basic') {
        const result = await loginRemoteBasic(identifier, password, nowSec());
        if (!result.ok) {
          setError(result.error);
          log.warn('mfs.auth.login_fail', { op: 'LoginRemote' });
          return false;
        }
        await writeSession(result.session, password);
        setSession(result.session);
        setNeedsReauth(false);
        log.info('mfs.auth.login_ok', { op: 'LoginRemote', employeeId: result.session.employeeId });
        return true;
      }
      setError('This sign-in method is not in this build.');
      log.warn('mfs.auth.login_fail', { op: 'LoginRemote' });
      return false;
    } catch {
      setError("Can't reach the server. You can still open last session if it hasn't expired.");
      log.warn('mfs.auth.login_fail', { op: 'LoginRemote' });
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshAuth = useCallback(async (): Promise<Session | null> => {
    if (!session || session.strategy === 'demo') return session;
    const password = await readPassword();
    if (!password) return null;
    const result = await refreshBasicSession(session, password, nowSec());
    if (!result.ok) {
      log.warn('mfs.auth.refresh', { op: 'RefreshAuth', err: result.error });
      return null;
    }
    await writeSession(result.session, password);
    setSession(result.session);
    setNeedsReauth(false);
    log.info('mfs.auth.refresh', { op: 'RefreshAuth', employeeId: result.session.employeeId });
    return result.session;
  }, [session]);

  const onAuthLost = useCallback(() => {
    void (async () => {
      await clearPassword();
      setNeedsReauth(true);
      log.warn('mfs.auth.login_fail', { op: 'OnReplicatorAuthFailure' });
    })();
  }, []);

  const logout = useCallback(async () => {
    setBusy(true);
    try {
      await stopReplicator();
      await clearAuthKeys();
      setSession(null);
      setNeedsReauth(false);
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo(
    () => ({ ready, session, error, busy, needsReauth, login, logout, refreshAuth, onAuthLost }),
    [ready, session, error, busy, needsReauth, login, logout, refreshAuth, onAuthLost],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
