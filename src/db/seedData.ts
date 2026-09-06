import { stampAuditCreate } from '../audit';
import { deviceLocalDay } from '../ids';

export const SEED_USER_ID = 'usr:01K4Q6AAA00000000000000001';
export const SEED_DISPATCH_USER_ID = 'usr:01K4Q6AAA00000000000000002';
export const SEED_CUSTOMER_ID = 'cus:01K4Q6CCC00000000000000001';
export const SEED_EMPLOYEE_ID = 'E-4412';
export const SEED_EMAIL = 'jon.hale@example.com';
export const SEED_USERNAME = 'tech.jon';
export const SEED_DISPATCH_EMPLOYEE_ID = 'E-DISP-01';
export const SEED_DISPATCH_EMAIL = 'maya.dispatch@example.com';
export const SEED_DISPATCH_USERNAME = 'dispatch.maya';
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

export function seedDispatchUserDoc(ver: string, dt: number) {
  return stampAuditCreate(
    {
      type: 'user',
      employeeId: SEED_DISPATCH_EMPLOYEE_ID,
      email: SEED_DISPATCH_EMAIL,
      username: SEED_DISPATCH_USERNAME,
      displayName: 'Maya Dispatch',
      role: 'dispatch',
      workModes: ['assets'],
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

export const SEED_ASSET_IDS = [
  'ast:01K4Q6AST00000000000000001',
  'ast:01K4Q6AST00000000000000002',
  'ast:01K4Q6AST00000000000000003',
] as const;
export const SEED_PRODUCT_ID = 'prd:01K4Q6PPP00000000000000001';
export const SEED_RATE_ID = 'rate:01K4Q6RATE00000000000001';
export const SEED_RATE_LABOR_ID = 'rate:01K4Q6RATE00000000000002';
export const SEED_TAX_ID = 'tax:01K4Q6TAX00000000000001';
export const SEED_INBOUND_ORDER_ID = 'ord:01K4Q7INBOUND000000000001';
export const SEED_INV_ID = 'inv:01K4Q6INV0000000000000001';
export const SEED_VAN_ID = 'van:12';

export function seedAssets(ver: string, dt: number) {
  const pumps = [
    { id: SEED_ASSET_IDS[0], name: 'Pump P-12', code: 'P-12', lat: 41.7658, lon: -72.6734, assetType: 'pump' },
    { id: SEED_ASSET_IDS[1], name: 'Pump P-14', code: 'P-14', lat: 41.7669, lon: -72.671, assetType: 'pump' },
    { id: SEED_ASSET_IDS[2], name: 'Valve station M-7', code: 'M-7', lat: 41.7645, lon: -72.675, assetType: 'valve' },
  ];
  return pumps.map((p) => ({
    id: p.id,
    doc: stampAuditCreate(
      {
        type: 'asset',
        name: p.name,
        code: p.code,
        assetType: p.assetType,
        status: 'active',
        ownership: 'company',
        geo: { lat: p.lat, lon: p.lon },
      },
      { by: 'seed', ver, dt },
    ),
  }));
}

export function seedProductsRatesTaxes(ver: string, dt: number) {
  return {
    products: [
      {
        id: SEED_PRODUCT_ID,
        doc: stampAuditCreate(
          {
            type: 'product',
            sku: 'VLV-CHK-4',
            name: 'Check valve 4in',
            uom: 'ea',
            description: '4 inch check valve',
            category: 'valves',
            active: true,
            defaultRateId: SEED_RATE_ID,
          },
          { by: 'seed', ver, dt },
        ),
      },
    ],
    rates: [
      {
        id: SEED_RATE_ID,
        doc: stampAuditCreate(
          {
            type: 'rate',
            code: 'VLV-CHK-4-LIST',
            name: 'Check valve 4in list',
            kind: 'product',
            productId: SEED_PRODUCT_ID,
            amount: 18500,
            currency: 'USD',
            unit: 'ea',
            taxInclusive: false,
            defaultTaxIds: [SEED_TAX_ID],
            active: true,
          },
          { by: 'seed', ver, dt },
        ),
      },
      {
        id: SEED_RATE_LABOR_ID,
        doc: stampAuditCreate(
          {
            type: 'rate',
            code: 'LABOR-STD',
            name: 'Standard labor',
            kind: 'service',
            amount: 12500,
            currency: 'USD',
            unit: 'hour',
            taxInclusive: false,
            defaultTaxIds: [SEED_TAX_ID],
            active: true,
          },
          { by: 'seed', ver, dt },
        ),
      },
    ],
    taxes: [
      {
        id: SEED_TAX_ID,
        doc: stampAuditCreate(
          {
            type: 'tax',
            code: 'CT-SALES',
            name: 'Connecticut sales tax',
            rateBps: 630,
            inclusive: false,
            compound: false,
            stack: 10,
            jurisdiction: { country: 'US', region: 'CT' },
            active: true,
          },
          { by: 'seed', ver, dt },
        ),
      },
    ],
    inventory: [
      {
        id: SEED_INV_ID,
        doc: stampAuditCreate(
          {
            type: 'inventory',
            productId: SEED_PRODUCT_ID,
            sku: 'VLV-CHK-4',
            locationId: SEED_VAN_ID,
            locationType: 'van',
            qtyOnHand: 4,
            uom: 'ea',
          },
          { by: 'seed', ver, dt },
        ),
      },
    ],
  };
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

export function seedInboundOrder(ver: string, dt: number, day = deviceLocalDay()) {
  return {
    id: SEED_INBOUND_ORDER_ID,
    doc: stampAuditCreate(
      {
        type: 'order',
        role: 'inbound',
        origin: 'dispatch',
        owner: 'backend',
        status: 'accepted',
        syncState: 'local_draft',
        number: 'ORD-3301',
        kind: 'product',
        currency: 'USD',
        customerId: SEED_CUSTOMER_ID,
        assignedTo,
        scheduled: { startDt: dt + 3600, endDt: dt + 7200, day },
        site: {
          name: 'Riverside Pump Station',
          geo: { lat: 41.7658, lon: -72.6734 },
        },
        lines: [
          {
            id: 'ln_01K4Q7LINE000000000000001',
            productId: SEED_PRODUCT_ID,
            rateId: SEED_RATE_ID,
            description: 'Check valve 4in',
            qty: 2,
            uom: 'ea',
            unitPrice: 18500,
            taxIds: [SEED_TAX_ID],
            lineSubtotal: 37000,
            lineTax: 2331,
            lineTotal: 39331,
          },
        ],
        totals: { subtotal: 37000, taxTotal: 2331, total: 39331 },
      },
      { by: 'dispatch.maya', ver: 'server-dispatch', dt },
    ),
  };
}
