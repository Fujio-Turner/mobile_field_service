import { listChildrenMemory, queryChildRowsIfNative } from './childStore';
import { parseWorkModes, type WorkMode } from '../session/workModes';

const USER_PROFILE_SQL = `
SELECT META().id AS id, employeeId, role, vanId, workModes
FROM field.users
WHERE employeeId = $employeeId
LIMIT 1
`;

export type UserProfile = {
  id: string;
  employeeId: string;
  role: string;
  vanId?: string;
  workModes: WorkMode[];
};

function parseUserProfile(id: string, raw: Record<string, unknown>): UserProfile | null {
  const employeeId = String(raw.employeeId ?? '');
  if (!employeeId) return null;
  return {
    id,
    employeeId,
    role: String(raw.role ?? 'technician'),
    vanId: raw.vanId != null ? String(raw.vanId) : undefined,
    workModes: parseWorkModes(raw.workModes),
  };
}

/** KV/query the signed-in `field.users` row. Prefer this over the seed employeeId switch. */
export async function getUserProfile(employeeId: string): Promise<UserProfile | null> {
  const native = await queryChildRowsIfNative(USER_PROFILE_SQL, { employeeId });
  if (native?.[0]) {
    return parseUserProfile(String(native[0].id ?? ''), native[0]);
  }
  const hit = listChildrenMemory('users', (_id, doc) => String(doc.employeeId ?? '') === employeeId)[0];
  if (!hit) return null;
  return parseUserProfile(hit.id, hit.doc);
}
