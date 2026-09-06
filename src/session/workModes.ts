import {
  SEED_DISPATCH_EMPLOYEE_ID,
  SEED_EMPLOYEE_ID,
  SEED_MAYA_EMPLOYEE_ID,
  SEED_PRIYA_EMPLOYEE_ID,
} from '../db/seedData';

export const WORK_MODES = ['assets', 'customer', 'sales'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export function parseWorkModes(raw: unknown): WorkMode[] {
  if (!Array.isArray(raw)) return ['assets'];
  const next = raw.filter((m): m is WorkMode => m === 'assets' || m === 'customer' || m === 'sales');
  return next.length > 0 ? [...new Set(next)] : ['assets'];
}

export function showsTodayJobs(modes: WorkMode[]): boolean {
  return modes.includes('assets') || modes.includes('customer');
}

export function showsTodayOrders(modes: WorkMode[]): boolean {
  return modes.includes('customer') || modes.includes('sales');
}

export function showsMapTab(modes: WorkMode[]): boolean {
  return modes.includes('assets') || modes.includes('customer');
}

export function workModesForEmployee(employeeId: string | undefined): WorkMode[] {
  if (employeeId === SEED_MAYA_EMPLOYEE_ID) return ['customer'];
  if (employeeId === SEED_PRIYA_EMPLOYEE_ID) return ['sales'];
  if (employeeId === SEED_EMPLOYEE_ID || employeeId === SEED_DISPATCH_EMPLOYEE_ID) return ['assets'];
  return ['assets'];
}
