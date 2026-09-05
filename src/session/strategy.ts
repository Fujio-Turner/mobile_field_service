import type { AuthStrategy } from './types';

export function authStrategy(): AuthStrategy {
  const raw = process.env.EXPO_PUBLIC_AUTH_STRATEGY ?? 'basic';
  if (raw === 'demo' || raw === 'oidc_implicit' || raw === 'oidc_code' || raw === 'basic') {
    return raw;
  }
  return 'basic';
}

/** Demo session: no network. Identifier required. */
export function buildDemoSession(identifier: string, nowSec: number): {
  ok: true;
  session: {
    strategy: 'demo';
    username: string;
    sessionId: string;
    cookieName: string;
    sessionExpiresAt: number;
  };
} | { ok: false; error: string } {
  const username = identifier.trim();
  if (!username) {
    return { ok: false, error: 'Enter an email or username.' };
  }
  return {
    ok: true,
    session: {
      strategy: 'demo',
      username,
      sessionId: 'demo-session',
      cookieName: 'SyncGatewaySession',
      sessionExpiresAt: nowSec + 7 * 24 * 3600,
    },
  };
}

export function sessionIsLive(expiresAt: number, nowSec: number, skewSec = 30): boolean {
  return expiresAt > nowSec + skewSec;
}
