import { nowSec } from '../audit';
import { appVersion } from '../version';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown> & {
  op?: string;
  employeeId?: string;
  collection?: string;
  docId?: string;
  durMs?: number;
  err?: unknown;
  errCode?: string | number;
};

const SECRET_KEYS = new Set([
  'password',
  'token',
  'bearer',
  'session',
  'sessionId',
  'session_id',
  'cookie',
  'authorization',
  'dbKey',
  'encryptionKey',
  'body',
  'note',
  'tracking',
  'email',
  'street',
  'phone',
  'noteBody',
  'clip512',
  'identifier',
  'lat',
  'lon',
  'coords',
  'geo',
]);

function defaultMinLevel(): LogLevel {
  if (process.env.NODE_ENV === 'production') return 'info';
  if (process.env.NODE_ENV === 'test') return 'error';
  return 'debug';
}

let minLevel: LogLevel = defaultMinLevel();

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function resetLogLevel(): void {
  minLevel = defaultMinLevel();
}

export function redactFields(fields: LogFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (SECRET_KEYS.has(k)) continue;
    if (k === 'err') {
      if (v instanceof Error) out.err = v.message;
      else if (v != null) out.err = String(v);
      continue;
    }
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) continue;
    out[k] = v;
  }
  return out;
}

function emit(level: LogLevel, event: string, fields: LogFields = {}): void {
  if (ORDER[level] < ORDER[minLevel]) return;
  const line = {
    ts: nowSec(),
    level,
    event,
    appVer: appVersion(),
    ...redactFields(fields),
  };
  const text = JSON.stringify(line);
  if (level === 'error') console.error(text);
  else if (level === 'warn') console.warn(text);
  else console.info(text);
}

export const log = {
  debug: (event: string, fields?: LogFields) => emit('debug', event, fields),
  info: (event: string, fields?: LogFields) => emit('info', event, fields),
  warn: (event: string, fields?: LogFields) => emit('warn', event, fields),
  error: (event: string, fields?: LogFields) => emit('error', event, fields),
};
