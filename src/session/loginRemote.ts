import { resolveLoginIdentity } from './identity';
import { mintSgSession, sgReplicatorUrl } from './sgSession';
import type { Session } from './types';

export async function loginRemoteBasic(
  identifier: string,
  password: string,
  nowSec: number,
  sgUrl = sgReplicatorUrl(),
): Promise<{ ok: true; session: Session } | { ok: false; error: string }> {
  const identity = resolveLoginIdentity(identifier);
  if (!identity) {
    return { ok: false, error: 'Unknown employee for this build.' };
  }
  if (!identifier.trim() || !password) {
    return { ok: false, error: 'Enter an email or username and a password.' };
  }
  if (!sgUrl) {
    return { ok: false, error: "Can't reach the server. You can still open last session if it hasn't expired." };
  }
  const minted = await mintSgSession({
    identifier: identity.email,
    password,
    sgUrl,
    nowSec,
  });
  if (!minted.ok) return minted;
  return {
    ok: true,
    session: {
      strategy: 'basic',
      username: identity.username,
      email: identity.email,
      employeeId: identity.employeeId,
      sessionId: minted.minted.sessionId,
      cookieName: minted.minted.cookieName,
      sessionExpiresAt: minted.minted.sessionExpiresAt,
    },
  };
}

export async function refreshBasicSession(
  session: Session,
  password: string,
  nowSec: number,
  sgUrl = sgReplicatorUrl(),
): Promise<{ ok: true; session: Session } | { ok: false; error: string }> {
  if (!sgUrl || !password) {
    return { ok: false, error: "Can't reach the server. You can still open last session if it hasn't expired." };
  }
  const minted = await mintSgSession({
    identifier: session.email || session.username,
    password,
    sgUrl,
    nowSec,
  });
  if (!minted.ok) return minted;
  return {
    ok: true,
    session: {
      ...session,
      sessionId: minted.minted.sessionId,
      cookieName: minted.minted.cookieName,
      sessionExpiresAt: minted.minted.sessionExpiresAt,
    },
  };
}
