import { memoryAll } from '../db/memoryStore';
import type { InboundHit, OutboundHit, OutboundRef } from './todayTypes';

export function memoryInboundHits(employeeId: string, day: string): InboundHit[] {
  return memoryAll('workordersin')
    .filter((row) => {
      const assigned = row.doc.assignedTo as { employeeId?: string } | undefined;
      const scheduled = row.doc.scheduled as { day?: string } | undefined;
      const status = String(row.doc.status ?? '');
      return (
        assigned?.employeeId === employeeId &&
        scheduled?.day === day &&
        status !== 'cancelled' &&
        status !== 'superseded'
      );
    })
    .map((row) => {
      const site = row.doc.site as { name?: string } | undefined;
      const scheduled = row.doc.scheduled as { startDt?: number; endDt?: number } | undefined;
      const assigned = row.doc.assignedTo as { employeeId?: string };
      return {
        id: row.id,
        number: String(row.doc.number ?? ''),
        priority: String(row.doc.priority ?? 'normal'),
        status: String(row.doc.status ?? ''),
        summary: String(row.doc.summary ?? ''),
        siteName: String(site?.name ?? ''),
        startDt: Number(scheduled?.startDt ?? 0),
        endDt: scheduled?.endDt != null ? Number(scheduled.endDt) : undefined,
        assignedEmployeeId: String(assigned.employeeId ?? ''),
      };
    });
}

export function memoryActiveOutbound(employeeId: string): OutboundHit[] {
  const active = new Set(['assigned', 'in_progress', 'blocked']);
  return memoryAll('workordersout')
    .filter((row) => {
      const assigned = row.doc.assignedTo as { employeeId?: string } | undefined;
      return assigned?.employeeId === employeeId && active.has(String(row.doc.status ?? ''));
    })
    .map((row) => {
      const source = row.doc.source as { id?: string } | undefined;
      const site = row.doc.site as { name?: string } | undefined;
      const scheduled = row.doc.scheduled as { startDt?: number; endDt?: number } | undefined;
      const assigned = row.doc.assignedTo as { employeeId?: string };
      return {
        id: row.id,
        sourceId: String(source?.id ?? ''),
        number: String(row.doc.number ?? ''),
        priority: String(row.doc.priority ?? 'normal'),
        status: String(row.doc.status ?? ''),
        summary: String(row.doc.summary ?? ''),
        siteName: String(site?.name ?? ''),
        startDt: Number(scheduled?.startDt ?? 0),
        endDt: scheduled?.endDt != null ? Number(scheduled.endDt) : undefined,
        role: String(row.doc.role ?? 'primary'),
        assignedEmployeeId: String(assigned.employeeId ?? ''),
      };
    });
}

export function memoryOutboundRefs(employeeId: string, sourceIds: string[]): Map<string, OutboundRef> {
  const want = new Set(sourceIds);
  const map = new Map<string, OutboundRef>();
  for (const row of memoryAll('workordersout')) {
    const source = row.doc.source as { id?: string } | undefined;
    const assigned = row.doc.assignedTo as { employeeId?: string } | undefined;
    if (!source?.id || !want.has(source.id)) continue;
    if (assigned?.employeeId !== employeeId) continue;
    const role = String(row.doc.role ?? 'primary');
    const auditCrDt = Number((row.doc.audit as { cr?: { dt?: number } } | undefined)?.cr?.dt ?? 0);
    const next = {
      id: row.id,
      sourceId: source.id,
      status: String(row.doc.status ?? ''),
      role,
      auditCrDt,
    };
    const prev = map.get(source.id);
    if (prev && prev.role === 'primary' && role !== 'primary') continue;
    if (prev && prev.role === 'primary' && role === 'primary') {
      if (auditCrDt > (prev.auditCrDt ?? 0)) continue;
      if (auditCrDt === (prev.auditCrDt ?? 0) && row.id > prev.id) continue;
    }
    map.set(source.id, next);
  }
  return map;
}
