export const AUTH_FAIL_CODES = new Set([401, 404, 10401]);
export const TRANSIENT_CODES = new Set([408, 429, 500, 502, 503, 504, 1001]);
export const TLS_CODES = new Set([1006, 11006, 5011]);

export type ActivityName = 'stopped' | 'offline' | 'connecting' | 'idle' | 'busy';

export const ACTIVITY_NAMES: ActivityName[] = ['stopped', 'offline', 'connecting', 'idle', 'busy'];

export function activityName(level: number | undefined): ActivityName {
  if (level == null || level < 0 || level > 4) return 'stopped';
  return ACTIVITY_NAMES[level] ?? 'stopped';
}

export function isAuthFailureCode(code: number | undefined): boolean {
  return code != null && AUTH_FAIL_CODES.has(code);
}

export function isTransientCode(code: number | undefined): boolean {
  return code != null && (TRANSIENT_CODES.has(code) || (code >= 500 && code <= 504));
}

export function isTlsCode(code: number | undefined): boolean {
  return code != null && TLS_CODES.has(code);
}

export function metricErrorCode(code: number | undefined): string {
  if (code == null) return 'other';
  if (AUTH_FAIL_CODES.has(code) || TRANSIENT_CODES.has(code) || TLS_CODES.has(code)) return String(code);
  if (code >= 500 && code <= 504) return String(code);
  return 'other';
}
