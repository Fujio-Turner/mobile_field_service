const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const ID_PREFIX = {
  workordersin: 'woin',
  workordersout: 'woout',
  assets: 'ast',
  products: 'prd',
  inventory: 'inv',
  inventory_tx: 'invtx',
  users: 'usr',
  customers: 'cus',
  tasks: 'tsk',
  notes: 'nte',
  messages: 'msg',
  orders: 'ord',
  rates: 'rate',
  taxes: 'tax',
  tracking: 'track',
  tmp: 'tmp',
} as const;

export type IdPrefix = (typeof ID_PREFIX)[keyof typeof ID_PREFIX];

export function encodeUlid(timeMs: number, rand10: Uint8Array): string {
  if (rand10.length !== 10) throw new Error('ULID random must be 10 bytes');
  let t = timeMs;
  let timePart = '';
  for (let i = 0; i < 10; i++) {
    timePart = CROCKFORD[t % 32] + timePart;
    t = Math.floor(t / 32);
  }
  let n = 0n;
  for (const b of rand10) n = (n << 8n) + BigInt(b);
  let randPart = '';
  for (let i = 0; i < 16; i++) {
    randPart = CROCKFORD[Number(n % 32n)] + randPart;
    n /= 32n;
  }
  return timePart + randPart;
}

export function ulid(nowMs = Date.now(), rand10?: Uint8Array): string {
  const bytes = rand10 ?? crypto.getRandomValues(new Uint8Array(10));
  return encodeUlid(nowMs, bytes);
}

export function newDocId(prefix: IdPrefix, ulidStr = ulid()): string {
  if (prefix === 'track') {
    throw new Error('use trackingDocId for tracking documents');
  }
  return `${prefix}:${ulidStr}`;
}

export function trackingDocId(day: string, employeeId: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error('tracking day must be YYYY-MM-DD');
  }
  if (!employeeId || employeeId.includes(':')) {
    throw new Error('employeeId must be non-empty and must not contain a colon');
  }
  return `track:${day}:${employeeId}`;
}

export function deviceLocalDay(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** `mfs_<safe>_<first 8 hex of sha256(employeeId)>` */
export function dbNameForUser(employeeId: string, sha256Hex: string): string {
  const safe = employeeId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `mfs_${safe}_${sha256Hex.slice(0, 8).toLowerCase()}`;
}
