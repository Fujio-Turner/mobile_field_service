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
export const SEED_MAYA_USER_ID = 'usr:01K4Q6AAA00000000000000003';
export const SEED_MAYA_EMPLOYEE_ID = 'E-7703';
export const SEED_MAYA_EMAIL = 'maya.chen@example.com';
export const SEED_MAYA_USERNAME = 'tech.maya';
export const SEED_PRIYA_USER_ID = 'usr:01K4Q6AAA00000000000000004';
export const SEED_PRIYA_EMPLOYEE_ID = 'E-8801';
export const SEED_PRIYA_EMAIL = 'priya.shah@example.com';
export const SEED_PRIYA_USERNAME = 'sales.priya';
export const SEED_TASK_TEMPLATE_ID = 'tsk:01K4Q6TTT00000000000000001';
export const SEED_REASSIGN_WOIN_ID = 'woin:01K4Q7H3R8N2M1K9P5T6V8W0X3';
export const SEED_REASSIGN_WOOUT_ID = 'woout:01K4Q7H3R8N2M1K9P5T6V8W0X4';
export const SEED_DELIVER_WOIN_ID = 'woin:01K4Q7H3R8N2M1K9P5T6V8W0X5';
export const SEED_DELIVER_ORDER_ID = 'ord:01K4Q7INBOUND000000000002';

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
          routeId: SEED_ROUTE_ID,
        },
        { by: 'dispatch.maya', ver: 'server-dispatch', dt },
      ),
    },
  ];
}

const assignedJon = {
  userId: SEED_USER_ID,
  employeeId: SEED_EMPLOYEE_ID,
  email: SEED_EMAIL,
  username: SEED_USERNAME,
  displayName: 'Jon Hale',
};

const assignedMaya = {
  userId: SEED_MAYA_USER_ID,
  employeeId: SEED_MAYA_EMPLOYEE_ID,
  email: SEED_MAYA_EMAIL,
  username: SEED_MAYA_USERNAME,
  displayName: 'Maya Chen',
};

const assignedPriya = {
  userId: SEED_PRIYA_USER_ID,
  employeeId: SEED_PRIYA_EMPLOYEE_ID,
  email: SEED_PRIYA_EMAIL,
  username: SEED_PRIYA_USERNAME,
  displayName: 'Priya Shah',
};

export const SEED_YARD_GEO = { lat: 41.7692, lon: -72.681 };
export const SEED_SITE_GEO = { lat: 41.7658, lon: -72.6734 };

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
      routeIds: [SEED_ROUTE_ID],
      customerIds: [SEED_CUSTOMER_ID],
      assetTypes: ['pump', 'valve'],
      region: SEED_REGION,
      storeId: SEED_STORE_ID,
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

export function seedMayaUserDoc(ver: string, dt: number) {
  return stampAuditCreate(
    {
      type: 'user',
      employeeId: SEED_MAYA_EMPLOYEE_ID,
      email: SEED_MAYA_EMAIL,
      username: SEED_MAYA_USERNAME,
      displayName: 'Maya Chen',
      role: 'technician',
      workModes: ['customer'],
      vanId: 'van:12',
      routeIds: [SEED_ROUTE_ID],
      region: SEED_REGION,
      storeId: SEED_STORE_ID,
      active: true,
    },
    { by: 'seed', ver, dt },
  );
}

export function seedPriyaUserDoc(ver: string, dt: number) {
  return stampAuditCreate(
    {
      type: 'user',
      employeeId: SEED_PRIYA_EMPLOYEE_ID,
      email: SEED_PRIYA_EMAIL,
      username: SEED_PRIYA_USERNAME,
      displayName: 'Priya Shah',
      role: 'technician',
      workModes: ['sales'],
      vanId: 'van:12',
      routeIds: [SEED_ROUTE_ID],
      region: SEED_REGION,
      storeId: SEED_STORE_ID,
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
      routeId: SEED_ROUTE_ID,
      region: SEED_REGION,
      assignedTo: assignedJon,
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
export const SEED_ROUTE_ID = 'HFD-NORTH';
export const SEED_REGION = 'CT';
export const SEED_STORE_ID = 'HFD-YARD';
export const SEED_WAREHOUSE_ID = 'wh:north';

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
        region: SEED_REGION,
        storeId: SEED_STORE_ID,
        locationId: SEED_WAREHOUSE_ID,
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
            class: 'store',
            storeId: SEED_STORE_ID,
            region: SEED_REGION,
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
            region: SEED_REGION,
            storeId: SEED_STORE_ID,
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
            region: SEED_REGION,
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
            jurisdiction: { country: 'US', region: 'CT', county: 'Hartford', city: 'Hartford' },
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
            storeId: SEED_STORE_ID,
            region: SEED_REGION,
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
    geo: { ...SEED_SITE_GEO, accuracyM: 15 },
  };
  const ops = [
    { id: 'op-1', name: 'Site check', required: true, status: 'pending' },
    { id: 'op-2', name: 'Close out', required: false, status: 'pending' },
  ];
  const checklist = [{ id: 'cl-ppe', label: 'PPE on', required: true, done: false }];
  const jobs: Array<{
    id: string;
    number: string;
    kind: string;
    priority: string;
    summary: string;
    assignedTo: typeof assignedJon;
    assetIds?: string[];
    orderId?: string;
    materials?: Array<{ sku: string; name: string; productId: string; qtyPlanned: number }>;
    move?: { from: { name: string; geo: { lat: number; lon: number } }; to: { name: string; geo: { lat: number; lon: number } } };
  }> = [
    {
      id: 'woin:01K4Q7H3R8N2M1K9P5T6V8W0XY',
      number: 'WO-10482',
      kind: 'repair',
      priority: 'high',
      summary: 'Replace failed check valve; verify flow.',
      assignedTo: assignedJon,
      assetIds: [SEED_ASSET_IDS[0]],
    },
    {
      id: 'woin:01K4Q7H3R8N2M1K9P5T6V8W0X1',
      number: 'WO-10470',
      kind: 'inspect',
      priority: 'normal',
      summary: 'Quarterly inspect pump P-12.',
      assignedTo: assignedJon,
      assetIds: [SEED_ASSET_IDS[0]],
    },
    {
      id: 'woin:01K4Q7H3R8N2M1K9P5T6V8W0X2',
      number: 'WO-10490',
      kind: 'move',
      priority: 'low',
      summary: 'Move asset M-7 from yard to Riverside.',
      assignedTo: assignedJon,
      assetIds: [SEED_ASSET_IDS[2]],
      move: {
        from: { name: 'North yard', geo: SEED_YARD_GEO },
        to: { name: 'Riverside Pump Station', geo: SEED_SITE_GEO },
      },
    },
    {
      id: SEED_REASSIGN_WOIN_ID,
      number: 'WO-10460',
      kind: 'repair',
      priority: 'normal',
      summary: 'Safety close-out after reassignment.',
      assignedTo: assignedPriya,
      assetIds: [SEED_ASSET_IDS[1]],
    },
    {
      id: SEED_DELIVER_WOIN_ID,
      number: 'WO-2201',
      kind: 'deliver',
      priority: 'normal',
      summary: 'Deliver 4in valves for Hartford Water Works.',
      assignedTo: assignedMaya,
      orderId: SEED_DELIVER_ORDER_ID,
      materials: [
        { sku: 'VLV-CHK-4', name: 'Check valve 4in', productId: SEED_PRODUCT_ID, qtyPlanned: 2 },
      ],
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
        assignedTo: j.assignedTo,
        customerId: SEED_CUSTOMER_ID,
        routeId: SEED_ROUTE_ID,
        region: SEED_REGION,
        site,
        scheduled: {
          startDt: dt + 3600,
          endDt: dt + 7200,
          day,
        },
        summary: j.summary,
        operations: ops,
        checklist,
        taskIds: [SEED_TASK_TEMPLATE_ID],
        assetIds: j.assetIds ?? [],
        orderId: j.orderId,
        materials: j.materials ?? [],
        move: j.move,
      },
      { by: 'dispatch.maya', ver: 'server-dispatch', dt },
    ),
  }));
}

function seedOrderDoc(
  input: {
    id: string;
    number: string;
    assignedTo: typeof assignedJon;
    qty: number;
    day: string;
  },
  ver: string,
  dt: number,
) {
  const qty = input.qty;
  const lineSubtotal = 18500 * qty;
  const lineTax = Math.round((lineSubtotal * 630) / 10000);
  return {
    id: input.id,
    doc: stampAuditCreate(
      {
        type: 'order',
        role: 'inbound',
        origin: 'dispatch',
        owner: 'backend',
        status: 'accepted',
        syncState: 'local_draft',
        number: input.number,
        kind: 'product',
        currency: 'USD',
        customerId: SEED_CUSTOMER_ID,
        assignedTo: input.assignedTo,
        scheduled: { startDt: dt + 3600, endDt: dt + 7200, day: input.day },
        site: {
          name: 'Riverside Pump Station',
          geo: SEED_SITE_GEO,
        },
        lines: [
          {
            id: `ln_${input.number.replace(/[^A-Z0-9]/g, '')}`,
            productId: SEED_PRODUCT_ID,
            rateId: SEED_RATE_ID,
            description: 'Check valve 4in',
            qty,
            uom: 'ea',
            unitPrice: 18500,
            taxIds: [SEED_TAX_ID],
            lineSubtotal,
            lineTax,
            lineTotal: lineSubtotal + lineTax,
          },
        ],
        totals: { subtotal: lineSubtotal, taxTotal: lineTax, total: lineSubtotal + lineTax },
      },
      { by: 'dispatch.maya', ver: 'server-dispatch', dt },
    ),
  };
}

export function seedInboundOrder(ver: string, dt: number, day = deviceLocalDay()) {
  return seedOrderDoc(
    { id: SEED_INBOUND_ORDER_ID, number: 'ORD-3301', assignedTo: assignedPriya, qty: 2, day },
    ver,
    dt,
  );
}

export function seedDeliverOrder(ver: string, dt: number, day = deviceLocalDay()) {
  return seedOrderDoc(
    { id: SEED_DELIVER_ORDER_ID, number: 'ORD-2201', assignedTo: assignedMaya, qty: 2, day },
    ver,
    dt,
  );
}

export function seedInboundOrders(ver: string, dt: number, day = deviceLocalDay()) {
  return [seedInboundOrder(ver, dt, day), seedDeliverOrder(ver, dt, day)];
}
