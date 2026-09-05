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
import { authStrategy, buildDemoSession, sessionIsLive } from './strategy';
import { clearAuthKeys, readSession, writeSession } from './enclave';
import type { Session } from './types';

type AuthState = {
  ready: boolean;
  session: Session | null;
  error: string | null;
  busy: boolean;
  login: (identifier: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
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
        log.info('mfs.auth.login_ok', { op: 'LoginRemote', employeeId: result.session.employeeId });
        return true;
      }
      if (strategy === 'basic') {
        const sgUrl = process.env.EXPO_PUBLIC_SG_URL ?? '';
        if (!identifier.trim() || !password) {
          setError('Enter an email or username and a password.');
          log.warn('mfs.auth.login_fail', { op: 'LoginRemote' });
          return false;
        }
        if (!sgUrl) {
          setError("Can't reach the server. You can still open last session if it hasn't expired.");
          log.warn('mfs.auth.login_fail', { op: 'LoginRemote' });
          return false;
        }
        // HTTP mint of POST /_session lands in a later slice (replicator).
        setError("Can't reach the server. You can still open last session if it hasn't expired.");
        log.warn('mfs.auth.login_fail', { op: 'LoginRemote' });
        return false;
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

  const logout = useCallback(async () => {
    setBusy(true);
    try {
      await clearAuthKeys();
      setSession(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo(
    () => ({ ready, session, error, busy, login, logout }),
    [ready, session, error, busy, login, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
