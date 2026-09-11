import {
  SEED_DISPATCH_EMAIL,
  SEED_DISPATCH_EMPLOYEE_ID,
  SEED_DISPATCH_USERNAME,
  SEED_EMAIL,
  SEED_EMPLOYEE_ID,
  SEED_MAYA_EMAIL,
  SEED_MAYA_EMPLOYEE_ID,
  SEED_MAYA_USERNAME,
  SEED_PRIYA_EMAIL,
  SEED_PRIYA_EMPLOYEE_ID,
  SEED_PRIYA_USERNAME,
  SEED_REGION,
  SEED_ROUTE_ID,
  SEED_STORE_ID,
  SEED_USERNAME,
} from '../db/seedData';
import type { WorkMode } from './workModes';

export type LoginIdentity = {
  employeeId: string;
  email: string;
  username: string;
  displayName?: string;
  workModes: WorkMode[];
  routeId?: string;
  routeIds?: string[];
  region?: string;
  storeId?: string;
};

const PERSONAS: LoginIdentity[] = [
  {
    employeeId: SEED_EMPLOYEE_ID,
    email: SEED_EMAIL,
    username: SEED_USERNAME,
    displayName: 'Jon Hale',
    workModes: ['assets'],
    routeId: SEED_ROUTE_ID,
    routeIds: [SEED_ROUTE_ID],
    region: SEED_REGION,
    storeId: SEED_STORE_ID,
  },
  {
    employeeId: SEED_DISPATCH_EMPLOYEE_ID,
    email: SEED_DISPATCH_EMAIL,
    username: SEED_DISPATCH_USERNAME,
    displayName: 'Maya Dispatch',
    workModes: ['assets'],
    routeId: SEED_ROUTE_ID,
    routeIds: [SEED_ROUTE_ID],
    region: SEED_REGION,
    storeId: SEED_STORE_ID,
  },
  {
    employeeId: SEED_MAYA_EMPLOYEE_ID,
    email: SEED_MAYA_EMAIL,
    username: SEED_MAYA_USERNAME,
    displayName: 'Maya Chen',
    workModes: ['customer'],
    routeId: SEED_ROUTE_ID,
    routeIds: [SEED_ROUTE_ID],
    region: SEED_REGION,
    storeId: SEED_STORE_ID,
  },
  {
    employeeId: SEED_PRIYA_EMPLOYEE_ID,
    email: SEED_PRIYA_EMAIL,
    username: SEED_PRIYA_USERNAME,
    displayName: 'Priya Shah',
    workModes: ['sales'],
    routeId: SEED_ROUTE_ID,
    routeIds: [SEED_ROUTE_ID],
    region: SEED_REGION,
    storeId: SEED_STORE_ID,
  },
];

const KNOWN: Record<string, LoginIdentity> = {};
for (const p of PERSONAS) {
  KNOWN[p.email.toLowerCase()] = p;
  KNOWN[p.username.toLowerCase()] = p;
  KNOWN[p.employeeId.toLowerCase()] = p;
}

export const DEMO_LOGIN_HINT =
  'Demo — Jon Hale (assets), Maya Chen (customer), Priya Shah (sales). Unknown ids sign in as Jon.';

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
      workModes: ['assets'],
    };
  }
  return null;
}

export function demoIdentity(identifier: string): LoginIdentity | null {
  const raw = identifier.trim();
  if (!raw) return null;
  return resolveLoginIdentity(raw) ?? PERSONAS[0];
}
