import { stampAuditCreate } from '../audit';
import { deviceLocalDay } from '../ids';

export const SEED_USER_ID = 'usr:01K4Q6AAA00000000000000001';
export const SEED_CUSTOMER_ID = 'cus:01K4Q6CCC00000000000000001';
export const SEED_EMPLOYEE_ID = 'E-4412';
export const SEED_EMAIL = 'jon.hale@example.com';
export const SEED_USERNAME = 'tech.jon';
export const SEED_TASK_TEMPLATE_ID = 'tsk:01K4Q6TTT00000000000000001';

export function seedTaskTemplates(ver: string, dt: number) {
  return [
    {
      id: SEED_TASK_TEMPLATE_ID,
      doc: stampAuditCreate(
        {
          type: 'task_template',
          title: 'Lockout / tagout',
          required: true,
          sort: 10,
        },
        { by: 'dispatch.maya', ver: 'server-dispatch', dt },
      ),
    },
  ];
}

const assignedTo = {
  userId: SEED_USER_ID,
  employeeId: SEED_EMPLOYEE_ID,
  email: SEED_EMAIL,
  username: SEED_USERNAME,
  displayName: 'Jon Hale',
};

export function seedUserDoc(ver: string, dt: number) {
  return stampAuditCreate(
    {
      type: 'user',
      employeeId: SEED_EMPLOYEE_ID,
      email: SEED_EMAIL,
      username: SEED_USERNAME,
      displayName: 'Jon Hale',
      role: 'technician',
      workModes: ['assets'],
      vanId: 'van:12',
      active: true,
    },
    { by: 'seed', ver, dt },
  );
}

export function seedCustomerDoc(ver: string, dt: number) {
  return stampAuditCreate(
    {
      type: 'customer',
      origin: 'dispatch',
      name: 'Hartford Water Works',
      accountNumber: 'HWW-100',
    },
    { by: 'seed', ver, dt },
  );
}

export function seedInboundJobs(ver: string, dt: number, day = deviceLocalDay()) {
  const site = {
    name: 'Riverside Pump Station',
    address: {
      line1: '410 River Rd',
      city: 'Hartford',
      region: 'CT',
      postal: '06103',
      country: 'US',
    },
    geo: { lat: 41.7658, lon: -72.6734, accuracyM: 15 },
  };
  const jobs = [
    {
      id: 'woin:01K4Q7H3R8N2M1K9P5T6V8W0XY',
      number: 'WO-10482',
      kind: 'repair',
      priority: 'high',
      summary: 'Replace failed check valve; verify flow.',
    },
    {
      id: 'woin:01K4Q7H3R8N2M1K9P5T6V8W0X1',
      number: 'WO-10470',
      kind: 'inspect',
      priority: 'normal',
      summary: 'Quarterly inspect pump P-12.',
    },
    {
      id: 'woin:01K4Q7H3R8N2M1K9P5T6V8W0X2',
      number: 'WO-10490',
      kind: 'move',
      priority: 'low',
      summary: 'Move asset M-7 from yard to Riverside.',
    },
  ];
  return jobs.map((j) => ({
    id: j.id,
    doc: stampAuditCreate(
      {
        type: 'workorderin',
        origin: 'dispatch',
        number: j.number,
        kind: j.kind,
        priority: j.priority,
        status: 'assigned',
        assignedTo,
        customerId: SEED_CUSTOMER_ID,
        site,
        scheduled: {
          startDt: dt + 3600,
          endDt: dt + 7200,
          day,
        },
        summary: j.summary,
        operations: [
          { id: 'op-1', name: 'Site check', required: true, status: 'pending' },
          { id: 'op-2', name: 'Close out', required: false, status: 'pending' },
        ],
        checklist: [{ id: 'cl-ppe', label: 'PPE on', required: true, done: false }],
        taskIds: [SEED_TASK_TEMPLATE_ID],
      },
      { by: 'dispatch.maya', ver: 'server-dispatch', dt },
    ),
  }));
}
