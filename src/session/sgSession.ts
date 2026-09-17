export function sgDbName(): string {
  return process.env.EXPO_PUBLIC_SG_DB?.trim() || 'mfs';
}

export function sgReplicatorUrl(): string {
  return (process.env.EXPO_PUBLIC_SG_URL ?? '').trim();
}

/** Convert replicator ws(s) URL to POST /{db}/_session. */
export function sessionEndpoint(sgUrl: string, db = sgDbName()): string {
  const trimmed = sgUrl.trim().replace(/\/$/, '');
  const http = trimmed.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
  if (http.endsWith('/_session')) return http;
  const last = http.split('/').pop() ?? '';
  if (last === db) return `${http}/_session`;
  return `${http}/${db}/_session`;
}

export function parseSessionExpires(expires: unknown, nowSec: number): number {
  if (typeof expires === 'number' && Number.isFinite(expires)) {
    return expires > 1e12 ? Math.floor(expires / 1000) : Math.floor(expires);
  }
  if (typeof expires === 'string' && expires.trim()) {
    const ms = Date.parse(expires);
    if (Number.isFinite(ms)) return Math.floor(ms / 1000);
  }
  return nowSec + 24 * 3600;
}

export function basicAuthHeader(user: string, password: string): string {
  const raw = `${user}:${password}`;
  if (typeof btoa === 'function') return `Basic ${btoa(raw)}`;
  return `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`;
}

export function acceptSelfSigned(sgUrl: string): boolean {
  if (process.env.EXPO_PUBLIC_SG_SELF_SIGNED === 'true') return true;
  return sgUrl.trim().toLowerCase().startsWith('ws://');
}

export function sessionRefreshSkewSec(): number {
  const n = Number(process.env.EXPO_PUBLIC_SESSION_REFRESH_SKEW_SEC ?? 300);
  return Number.isFinite(n) && n >= 0 ? n : 300;
}

export type MintedSession = {
  sessionId: string;
  cookieName: string;
  sessionExpiresAt: number;
};

export type MintResult =
  | { ok: true; minted: MintedSession }
  | { ok: false; error: string; status?: number };

export const SESSION_POST_TIMEOUT_MS = 30_000;

const UNREACHABLE = "Can't reach the server. You can still open last session if it hasn't expired.";

export function sessionIdFromCookies(headers: Headers | undefined): { sessionId: string; cookieName: string } | null {
  if (!headers) return null;
  const raws: string[] = [];
  const withSet = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withSet.getSetCookie === 'function') raws.push(...withSet.getSetCookie());
  const single = headers.get('set-cookie');
  if (single) raws.push(single);
  for (const raw of raws) {
    const m = raw.match(/SyncGatewaySession=([^;,\s]+)/i);
    if (m) return { cookieName: 'SyncGatewaySession', sessionId: decodeURIComponent(m[1]) };
  }
  return null;
}

/** Public REST (4984) returns { ok, userCtx } + Set-Cookie. Admin REST returns session_id. */
export function mintedFromPublicSession(
  payload: Record<string, unknown>,
  headers: Headers | undefined,
  nowSec: number,
): MintedSession | null {
  const fromCookie = sessionIdFromCookies(headers);
  const sessionId = String(
    payload.session_id ?? payload.one_time_session_id ?? fromCookie?.sessionId ?? '',
  );
  const cookieName = String(payload.cookie_name ?? fromCookie?.cookieName ?? 'SyncGatewaySession');
  if (sessionId) {
    return {
      sessionId,
      cookieName,
      sessionExpiresAt: parseSessionExpires(payload.expires, nowSec),
    };
  }
  if (payload.ok === true) {
    return {
      sessionId: 'public',
      cookieName,
      sessionExpiresAt: parseSessionExpires(payload.expires, nowSec),
    };
  }
  return null;
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = SESSION_POST_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function mintSgSession(input: {
  identifier: string;
  password: string;
  sgUrl: string;
  nowSec: number;
  bearer?: string;
}): Promise<MintResult> {
  const url = sessionEndpoint(input.sgUrl);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  let body: string | undefined;
  if (input.bearer) {
    headers.Authorization = `Bearer ${input.bearer}`;
  } else {
    // Public REST: JSON name/password only (https://docs.couchbase.com/app-services/references/rest_api_public.html)
    body = JSON.stringify({ name: input.identifier, password: input.password });
  }
  try {
    const res = await fetchWithTimeout(url, { method: 'POST', headers, body });
    if (res.status === 401) {
      return { ok: false, error: 'Wrong email or password. Check the App User is not disabled.', status: 401 };
    }
    if (res.status === 400) {
      return {
        ok: false,
        error: 'App Services rejected sign-in (origin/CORS). Check allowed origins on the endpoint.',
        status: 400,
      };
    }
    if (!res.ok) {
      return { ok: false, error: UNREACHABLE, status: res.status };
    }
    const payload = (await res.json()) as Record<string, unknown>;
    const minted = mintedFromPublicSession(payload, res.headers, input.nowSec);
    if (!minted) {
      return { ok: false, error: UNREACHABLE };
    }
    return { ok: true, minted };
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === 'AbortError' || e.message.includes('aborted'));
    return {
      ok: false,
      error: timedOut
        ? 'Sign-in timed out. Enable the App User in Capella and check the App Services URL.'
        : UNREACHABLE,
    };
  }
}
