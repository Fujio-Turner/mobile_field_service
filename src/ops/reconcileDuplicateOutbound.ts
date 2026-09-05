import { pickOldestPrimary } from './copyInbound';
import { listChildrenMemory, loadChild, queryChildRowsIfNative, saveChild } from './childStore';

const PRIMARIES_SQL = `
SELECT META().id AS id, audit.cr.dt AS auditCrDt, source.id AS sourceId
FROM field.workordersout
WHERE assignedTo.employeeId = $employeeId
  AND source.id = $sourceId
  AND role = 'primary'
`;

export type ReconcileResult = {
  keeperId: string;
  duplicateIds: string[];
};

export function pickKeeper(
  candidates: Array<{ id: string; auditCrDt: number }>,
): ReconcileResult | null {
  if (candidates.length <= 1) return null;
  const keeperId = pickOldestPrimary(candidates);
  if (!keeperId) return null;
  return {
    keeperId,
    duplicateIds: candidates.map((c) => c.id).filter((id) => id !== keeperId),
  };
}

async function listPrimaries(
  employeeId: string,
  sourceId: string,
): Promise<Array<{ id: string; auditCrDt: number }>> {
  const native = await queryChildRowsIfNative(PRIMARIES_SQL, { employeeId, sourceId });
  if (native) {
    return native.map((row) => ({
      id: String(row.id ?? ''),
      auditCrDt: Number(row.auditCrDt ?? 0),
    }));
  }
  return listChildrenMemory('workordersout', (_id, doc) => {
    const assigned = doc.assignedTo as { employeeId?: string } | undefined;
    const source = doc.source as { id?: string } | undefined;
    return (
      String(doc.role ?? 'primary') === 'primary' &&
      assigned?.employeeId === employeeId &&
      source?.id === sourceId
    );
  }).map((row) => ({
    id: row.id,
    auditCrDt: Number((row.doc.audit as { cr?: { dt?: number } } | undefined)?.cr?.dt ?? 0),
  }));
}

/**
 * On pull of a primary workordersout: keep oldest audit.cr.dt (then lowest id).
 * Mark extras `duplicateOf` — do not create a third, do not append history.
 */
export async function reconcileDuplicateOutbound(
  pulledId: string,
  employeeId: string,
): Promise<ReconcileResult | null> {
  const pulled = await loadChild('workordersout', pulledId);
  if (!pulled || String(pulled.role ?? 'primary') !== 'primary') return null;
  const sourceId = String((pulled.source as { id?: string } | undefined)?.id ?? '');
  if (!sourceId) return null;
  const result = pickKeeper(await listPrimaries(employeeId, sourceId));
  if (!result) return null;
  for (const id of result.duplicateIds) {
    const doc = await loadChild('workordersout', id);
    if (!doc || doc.duplicateOf === result.keeperId) continue;
    await saveChild('workordersout', id, { ...doc, duplicateOf: result.keeperId });
  }
  return result;
}
