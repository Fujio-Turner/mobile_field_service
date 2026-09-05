export const INBOUND_TODAY_SQL = `
SELECT
  META().id AS id,
  number,
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
  AND status NOT IN ['cancelled', 'superseded']
ORDER BY scheduled.startDt DESC
LIMIT $limit
OFFSET $offset
`;

export const ACTIVE_OUTBOUND_SQL = `
SELECT
  META().id AS id,
  source.id AS sourceId,
  number,
  priority,
  status,
  role,
  summary,
  assignedTo.employeeId AS assignedEmployeeId,
  site.name AS siteName,
  scheduled.startDt AS startDt,
  scheduled.endDt AS endDt
FROM field.workordersout
WHERE assignedTo.employeeId = $employeeId
  AND status IN ['assigned', 'in_progress', 'blocked']
`;

export function outboundForSourcesSql(count: number): string {
  const ors = Array.from({ length: count }, (_, i) => `source.id = $s${i}`).join(' OR ');
  return `
SELECT META().id AS id, source.id AS sourceId, status, role
FROM field.workordersout
WHERE assignedTo.employeeId = $employeeId
  AND (${ors})
`;
}
