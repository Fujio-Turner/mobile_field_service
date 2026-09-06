import { demoIdentity } from './identity';
import type { AuthStrategy } from './types';

export function authStrategy(): AuthStrategy {
  const raw = process.env.EXPO_PUBLIC_AUTH_STRATEGY ?? 'basic';
  if (raw === 'demo' || raw === 'oidc_implicit' || raw === 'oidc_code' || raw === 'basic') {
    return raw;
  }
  return 'basic';
}

/** Demo session: no network. Known personas map; anything else is Jon. */
export function buildDemoSession(identifier: string, nowSec: number): {
  ok: true;
  session: {
    strategy: 'demo';
    username: string;
    email: string;
    employeeId: string;
    sessionId: string;
    cookieName: string;
    sessionExpiresAt: number;
  };
} | { ok: false; error: string } {
  const identity = demoIdentity(identifier);
  if (!identity) {
    return { ok: false, error: 'Enter an email or username.' };
  }
  return {
    ok: true,
    session: {
      strategy: 'demo',
      username: identity.username,
      email: identity.email,
      employeeId: identity.employeeId,
      sessionId: 'demo-session',
      cookieName: 'SyncGatewaySession',
      sessionExpiresAt: nowSec + 7 * 24 * 3600,
    },
  };
}

export function sessionIsLive(expiresAt: number, nowSec: number, skewSec = 30): boolean {
  return expiresAt > nowSec + skewSec;
}
