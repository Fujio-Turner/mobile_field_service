/** Synced `field.*` collections. Never put `tmp` here. */
export const FIELD_COLLECTIONS = [
  'workordersin',
  'workordersout',
  'assets',
  'products',
  'inventory',
  'users',
  'customers',
  'tasks',
  'notes',
  'messages',
  'orders',
  'rates',
  'taxes',
  'tracking',
] as const;

export type FieldCollection = (typeof FIELD_COLLECTIONS)[number];

export const FIELD_SCOPE = 'field';
export const LOCAL_SCOPE = 'local';
export const TMP_COLLECTION = 'tmp';

export function replicatorAllowList(): readonly string[] {
  return FIELD_COLLECTIONS;
}

export function isReplicatorCollection(name: string): boolean {
  return (FIELD_COLLECTIONS as readonly string[]).includes(name);
}

/** Operator-facing lists (debug). `tracking` is internal movement crumbs — not shown. */
export const OPERATOR_COLLECTIONS = FIELD_COLLECTIONS.filter((n) => n !== 'tracking');

export function isOperatorCollection(name: string): boolean {
  return name !== 'tracking' && name !== TMP_COLLECTION && isReplicatorCollection(name);
}
