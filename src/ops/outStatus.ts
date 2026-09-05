export const OUT_STATUSES = ['assigned', 'in_progress', 'blocked', 'complete', 'cancelled'] as const;
export type OutStatus = (typeof OUT_STATUSES)[number];

export const OP_STATUSES = ['pending', 'in_progress', 'done', 'skipped'] as const;
export type OpStatus = (typeof OP_STATUSES)[number];

export const BLOCK_REASONS = ['access', 'parts', 'customer', 'weather', 'safety', 'other'] as const;
export type BlockReason = (typeof BLOCK_REASONS)[number];

export function isFrozen(doc: Record<string, unknown>): boolean {
  const status = String(doc.status ?? '');
  const owner = String(doc.owner ?? '');
  return status === 'complete' || status === 'cancelled' || owner === 'backend';
}

export function canTransition(from: string, op: string): boolean {
  if (op === 'StartOrResumeWork') return from === 'assigned' || from === 'blocked' || from === 'in_progress';
  if (op === 'BlockWork') return from === 'in_progress';
  if (op === 'CompleteWork') return from === 'in_progress';
  if (op === 'CancelWork') return from === 'assigned' || from === 'in_progress' || from === 'blocked';
  return false;
}

export function nextStatus(op: string): OutStatus {
  if (op === 'StartOrResumeWork') return 'in_progress';
  if (op === 'BlockWork') return 'blocked';
  if (op === 'CompleteWork') return 'complete';
  if (op === 'CancelWork') return 'cancelled';
  throw new Error('unknown_transition');
}

export function cycleOpStatus(current: string): OpStatus {
  const i = OP_STATUSES.indexOf(current as OpStatus);
  return OP_STATUSES[(i + 1) % OP_STATUSES.length];
}

export function completeBlockedReason(doc: Record<string, unknown>): string | null {
  const ops = Array.isArray(doc.operations) ? doc.operations : [];
  for (const op of ops) {
    const rec = op as { required?: boolean; status?: string; name?: string };
    if (rec.required && rec.status !== 'done') {
      return `Required operation not done: ${rec.name ?? 'step'}`;
    }
  }
  const checks = Array.isArray(doc.checklist) ? doc.checklist : [];
  for (const c of checks) {
    const rec = c as { required?: boolean; done?: boolean; label?: string };
    if (rec.required && rec.done !== true) {
      return `Required checklist open: ${rec.label ?? 'item'}`;
    }
  }
  return null;
}

export function isBlockReason(v: string): v is BlockReason {
  return (BLOCK_REASONS as readonly string[]).includes(v);
}
