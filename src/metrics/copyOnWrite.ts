export type CopyOnWriteResult = 'created' | 'idempotent_hit';

const totals: Record<CopyOnWriteResult, number> = {
  created: 0,
  idempotent_hit: 0,
};

export function bumpCopyOnWrite(result: CopyOnWriteResult): void {
  totals[result] += 1;
}

export function copyOnWriteTotals(): Readonly<Record<CopyOnWriteResult, number>> {
  return { ...totals };
}

export function resetCopyOnWriteTotals(): void {
  totals.created = 0;
  totals.idempotent_hit = 0;
}
