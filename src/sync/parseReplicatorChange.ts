import { extractErrorCode } from './codes';

/** CBL RN monitor payload: change.status.getActivityLevel / getProgress / getError. */
export type ParsedReplChange = {
  activityLevel: number;
  errorMessage?: string;
  errorCode?: number;
  progressCompleted?: number;
  progressTotal?: number;
};

function num(v: unknown): number | undefined {
  if (typeof v === 'function') {
    try {
      const n = Number(v());
      return Number.isFinite(n) ? n : undefined;
    } catch {
      return undefined;
    }
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function errorMessageOf(errRaw: unknown): string | undefined {
  if (typeof errRaw === 'string' && errRaw.trim()) return errRaw.trim();
  if (errRaw && typeof errRaw === 'object') {
    const m = (errRaw as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }
  return undefined;
}

export function parseReplicatorChange(raw: unknown): ParsedReplChange {
  const wrap = raw as { status?: unknown } | null;
  const st = (
    wrap && typeof wrap === 'object' && 'status' in wrap ? wrap.status : raw
  ) as Record<string, unknown> | null;
  if (!st || typeof st !== 'object') return { activityLevel: 0 };

  const withGet = st as {
    getActivityLevel?: () => unknown;
    getProgress?: () => unknown;
    getError?: () => unknown;
  };
  const activityLevel =
    num(withGet.getActivityLevel) ?? num(st.activityLevel) ?? num(st.activity) ?? 0;

  const progressRaw = typeof withGet.getProgress === 'function' ? withGet.getProgress() : st.progress;
  const prog = progressRaw as
    | { getCompleted?: () => unknown; getTotal?: () => unknown; completed?: unknown; total?: unknown }
    | undefined;
  const progressCompleted = prog ? (num(prog.getCompleted) ?? num(prog.completed)) : undefined;
  const progressTotal = prog ? (num(prog.getTotal) ?? num(prog.total)) : undefined;

  const errRaw = typeof withGet.getError === 'function' ? withGet.getError() : st.error;
  const errorMessage = errorMessageOf(errRaw);
  const errorCode = extractErrorCode(errRaw ?? errorMessage);
  return { activityLevel, errorMessage, errorCode, progressCompleted, progressTotal };
}
