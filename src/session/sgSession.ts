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

export async function mintSgSession(input: {
  identifier: string;
  password: string;
  sgUrl: string;
  nowSec: number;
  bearer?: string;
}): Promise<MintResult> {
  const url = sessionEndpoint(input.sgUrl);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (input.bearer) {
    headers.Authorization = `Bearer ${input.bearer}`;
  } else {
    headers.Authorization = basicAuthHeader(input.identifier, input.password);
  }
  try {
    const res = await fetch(url, { method: 'POST', headers });
    if (res.status === 401) {
      return { ok: false, error: 'Wrong email or password.', status: 401 };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: "Can't reach the server. You can still open last session if it hasn't expired.",
        status: res.status,
      };
    }
    const body = (await res.json()) as {
      session_id?: string;
      cookie_name?: string;
      expires?: unknown;
    };
    const sessionId = String(body.session_id ?? '');
    if (!sessionId) {
      return { ok: false, error: "Can't reach the server. You can still open last session if it hasn't expired." };
    }
    return {
      ok: true,
      minted: {
        sessionId,
        cookieName: String(body.cookie_name ?? 'SyncGatewaySession'),
        sessionExpiresAt: parseSessionExpires(body.expires, input.nowSec),
      },
    };
  } catch {
    return {
      ok: false,
      error: "Can't reach the server. You can still open last session if it hasn't expired.",
    };
  }
}
