/** CBL SQL++ does not accept `IN ['a','b']` or parameterized LIMIT/OFFSET. */
export function inboundTodaySql(limit = 20, offset = 0): string {
  const lim = Math.max(0, Math.min(100, Math.floor(Number(limit)) || 0));
  const off = Math.max(0, Math.floor(Number(offset)) || 0);
  return `
SELECT
  META().id AS id,
  number,
  kind,
  priority,
  status,
  summary,
  assignedTo.employeeId AS assignedEmployeeId,
  site.name AS siteName,
  scheduled.startDt AS startDt,
  scheduled.endDt AS endDt
FROM field.workordersin
WHERE assignedTo.employeeId = $employeeId
  AND scheduled.day = $day
  AND status != 'cancelled'
  AND status != 'superseded'
ORDER BY scheduled.startDt DESC
LIMIT ${lim}
OFFSET ${off}
`;
}

export const INBOUND_TODAY_SQL = inboundTodaySql(20, 0);

export const ACTIVE_OUTBOUND_SQL = `
SELECT
  META().id AS id,
  source.id AS sourceId,
  number,
  kind,
  priority,
  status,
  role,
  summary,
  assignedTo.employeeId AS assignedEmployeeId,
  site.name AS siteName,
  scheduled.startDt AS startDt,
  scheduled.endDt AS endDt,
  source.dropped AS dropped
FROM field.workordersout
WHERE assignedTo.employeeId = $employeeId
  AND (status = 'assigned' OR status = 'in_progress' OR status = 'blocked')
`;

export function outboundForSourcesSql(count: number): string {
  const ors = Array.from({ length: count }, (_, i) => `source.id = $s${i}`).join(' OR ');
  return `
SELECT META().id AS id, source.id AS sourceId, status, role, audit.cr.dt AS auditCrDt
FROM field.workordersout
WHERE assignedTo.employeeId = $employeeId
  AND (${ors})
`;
}
