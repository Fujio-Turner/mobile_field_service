import {
  SEED_DISPATCH_EMAIL,
  SEED_DISPATCH_EMPLOYEE_ID,
  SEED_DISPATCH_USERNAME,
  SEED_EMAIL,
  SEED_EMPLOYEE_ID,
  SEED_USERNAME,
} from '../db/seedData';

export type LoginIdentity = {
  employeeId: string;
  email: string;
  username: string;
};

const KNOWN: Record<string, LoginIdentity> = {
  [SEED_EMAIL.toLowerCase()]: {
    employeeId: SEED_EMPLOYEE_ID,
    email: SEED_EMAIL,
    username: SEED_USERNAME,
  },
  [SEED_USERNAME.toLowerCase()]: {
    employeeId: SEED_EMPLOYEE_ID,
    email: SEED_EMAIL,
    username: SEED_USERNAME,
  },
  [SEED_EMPLOYEE_ID.toLowerCase()]: {
    employeeId: SEED_EMPLOYEE_ID,
    email: SEED_EMAIL,
    username: SEED_USERNAME,
  },
  [SEED_DISPATCH_EMAIL.toLowerCase()]: {
    employeeId: SEED_DISPATCH_EMPLOYEE_ID,
    email: SEED_DISPATCH_EMAIL,
    username: SEED_DISPATCH_USERNAME,
  },
  [SEED_DISPATCH_USERNAME.toLowerCase()]: {
    employeeId: SEED_DISPATCH_EMPLOYEE_ID,
    email: SEED_DISPATCH_EMAIL,
    username: SEED_DISPATCH_USERNAME,
  },
  [SEED_DISPATCH_EMPLOYEE_ID.toLowerCase()]: {
    employeeId: SEED_DISPATCH_EMPLOYEE_ID,
    email: SEED_DISPATCH_EMAIL,
    username: SEED_DISPATCH_USERNAME,
  },
};

/** Map login identifier → profile. Lab users are seeded; E-* ids pass through. */
export function resolveLoginIdentity(identifier: string): LoginIdentity | null {
  const raw = identifier.trim();
  if (!raw) return null;
  const known = KNOWN[raw.toLowerCase()];
  if (known) return known;
  if (/^E-[A-Z0-9._-]+$/i.test(raw)) {
    return {
      employeeId: raw,
      email: raw.includes('@') ? raw : `${raw.toLowerCase()}@local`,
      username: raw,
    };
  }
  return null;
}
