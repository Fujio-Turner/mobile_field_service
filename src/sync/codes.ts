/** Session / missing-db at the *replicator* status listener. Document-level 404 is classified separately. */
export const AUTH_FAIL_CODES = new Set([401, 404, 10401]);
export const NOT_FOUND_CODES = new Set([404]);
export const CONFLICT_CODES = new Set([409]);
export const PAYLOAD_CODES = new Set([413]);
export const TRANSIENT_CODES = new Set([408, 429, 500, 502, 503, 504, 1001]);
export const TLS_CODES = new Set([1006, 11006, 5011]);
export const CLIENT_CODES = new Set([400, 405, 406, 410, 412, 415, 422]);

export type ReplErrorClass =
  | 'auth'
  | 'not_found'
  | 'conflict'
  | 'forbidden'
  | 'payload'
  | 'timeout'
  | 'rate_limit'
  | 'transient'
  | 'tls'
  | 'client'
  | 'other';

export type ActivityName = 'stopped' | 'offline' | 'connecting' | 'idle' | 'busy';

export const ACTIVITY_NAMES: ActivityName[] = ['stopped', 'offline', 'connecting', 'idle', 'busy'];

export function activityName(level: number | undefined): ActivityName {
  if (level == null || level < 0 || level > 4) return 'stopped';
  return ACTIVITY_NAMES[level] ?? 'stopped';
}

export function isAuthFailureCode(code: number | undefined): boolean {
  return code != null && AUTH_FAIL_CODES.has(code);
}

/** Doc-level 401/10401 only — a single 404/409 must not kick the tech to login. */
export function isDocumentAuthFailure(code: number | undefined): boolean {
  return code === 401 || code === 10401;
}

export function extractErrorCode(err: unknown): number | undefined {
  if (err == null) return undefined;
  if (typeof err === 'number' && Number.isFinite(err)) return err;
  if (typeof err === 'string') {
    const m = err.match(/\b(4\d\d|5\d\d|10401|1001|1006|11006|5011)\b/);
    return m ? Number(m[1]) : undefined;
  }
  if (typeof err === 'object') {
    const o = err as {
      code?: unknown;
      status?: unknown;
      getCode?: () => unknown;
      message?: unknown;
    };
    if (typeof o.getCode === 'function') {
      const n = Number(o.getCode());
      if (Number.isFinite(n)) return n;
    }
    const n = Number(o.code ?? o.status);
    if (Number.isFinite(n)) return n;
    if (o.message != null) return extractErrorCode(String(o.message));
  }
  return undefined;
}

export function classifyReplError(code: number | undefined): ReplErrorClass {
  if (code == null) return 'other';
  switch (code) {
    case 401:
    case 10401:
      return 'auth';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 413:
      return 'payload';
    case 408:
      return 'timeout';
    case 429:
      return 'rate_limit';
    case 1006:
    case 11006:
    case 5011:
      return 'tls';
    case 400:
    case 405:
    case 406:
    case 410:
    case 412:
    case 415:
    case 422:
      return 'client';
    case 1001:
    case 500:
    case 502:
    case 503:
    case 504:
      return 'transient';
    default:
      if (code >= 500 && code <= 599) return 'transient';
      if (code >= 400 && code <= 499) return 'client';
      return 'other';
  }
}

export function isTransientCode(code: number | undefined): boolean {
  return code != null && (TRANSIENT_CODES.has(code) || (code >= 500 && code <= 504));
}

export function isTlsCode(code: number | undefined): boolean {
  return code != null && TLS_CODES.has(code);
}

export function metricErrorCode(code: number | undefined): string {
  if (code == null) return 'other';
  const cls = classifyReplError(code);
  if (cls === 'other') return 'other';
  return String(code);
}
