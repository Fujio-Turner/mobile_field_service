import { listChildrenMemory, queryChildRowsIfNative } from './childStore';

const HISTORY_SQL = `
SELECT META().id AS id, number, status, summary, completedAt
FROM field.workordersout
WHERE customerId = $customerId AND status = 'complete'
`;

export type CustomerHistoryRow = {
  id: string;
  number: string;
  status: string;
  summary: string;
  completedAt?: number;
};

export async function listCustomerHistory(customerId: string): Promise<CustomerHistoryRow[]> {
  const native = await queryChildRowsIfNative(HISTORY_SQL, { customerId });
  if (native) {
    return native.map((row) => ({
      id: String(row.id ?? ''),
      number: String(row.number ?? ''),
      status: String(row.status ?? 'complete'),
      summary: String(row.summary ?? ''),
      completedAt: row.completedAt != null ? Number(row.completedAt) : undefined,
    }));
  }
  return listChildrenMemory('workordersout', (_id, doc) => {
    return String(doc.customerId ?? '') === customerId && String(doc.status) === 'complete';
  }).map((row) => ({
    id: row.id,
    number: String(row.doc.number ?? ''),
    status: String(row.doc.status ?? ''),
    summary: String(row.doc.summary ?? ''),
    completedAt: row.doc.completedAt != null ? Number(row.doc.completedAt) : undefined,
  }));
}
