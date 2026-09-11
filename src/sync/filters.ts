/**
 * Pure push filters for CollectionConfiguration.setPushFilter.
 * Must stay "show source" friendly — no closures over outer scope.
 */

export type PushDoc = Record<string, unknown>;

export function workordersinPushFilter(document: PushDoc, _flags?: unknown): boolean {
  'show source';
  return document['origin'] === 'field' && document['readyToPush'] === true;
}

export function workordersoutPushFilter(document: PushDoc, _flags?: unknown): boolean {
  'show source';
  const s = document['syncState'];
  return s === 'ready_to_push' || s === 'pushed' || s === 'push_error';
}

export function ordersPushFilter(document: PushDoc, _flags?: unknown): boolean {
  'show source';
  if (document['role'] === 'inbound') return false;
  const s = document['syncState'];
  return s === 'ready_to_push' || s === 'pushed' || s === 'push_error';
}

export function customersPushFilter(document: PushDoc, _flags?: unknown): boolean {
  'show source';
  return document['origin'] === 'field' && document['readyToPush'] === true;
}

export function readyToPushFilter(document: PushDoc, _flags?: unknown): boolean {
  'show source';
  return document['readyToPush'] === true;
}

export function notesPushFilter(_document: PushDoc, _flags?: unknown): boolean {
  'show source';
  return true;
}

export function messagesPushFilter(document: PushDoc, _flags?: unknown): boolean {
  'show source';
  return document['readyToPush'] === true;
}

export function tasksPushFilter(document: PushDoc, _flags?: unknown): boolean {
  'show source';
  return document['type'] === 'task' && document['readyToPush'] === true;
}

export function inventoryPushFilter(document: PushDoc, _flags?: unknown): boolean {
  'show source';
  if (document['type'] !== 'inventory_tx') return false;
  return document['readyToPush'] === true;
}

/** Device-owned crumbs — always push. */
export function trackingPushFilter(_document: PushDoc, _flags?: unknown): boolean {
  'show source';
  return true;
}

/** Pull-only catalogs. */
export function neverPushFilter(_document: PushDoc, _flags?: unknown): boolean {
  'show source';
  return false;
}

export const FIELD_PUSH_FILTERS: Record<string, (document: PushDoc, flags?: unknown) => boolean> = {
  workordersin: workordersinPushFilter,
  workordersout: workordersoutPushFilter,
  orders: ordersPushFilter,
  customers: customersPushFilter,
  messages: messagesPushFilter,
  notes: notesPushFilter,
  tasks: tasksPushFilter,
  inventory: inventoryPushFilter,
  tracking: trackingPushFilter,
  assets: neverPushFilter,
  products: neverPushFilter,
  rates: neverPushFilter,
  taxes: neverPushFilter,
  users: neverPushFilter,
};

export function pushFilterFor(collectionName: string): (document: PushDoc, flags?: unknown) => boolean {
  return FIELD_PUSH_FILTERS[collectionName] ?? neverPushFilter;
}

/** local.tmp must never appear in replicator CollectionConfiguration[]. */
export function replicatorCollectionNames(fieldCollections: readonly string[]): string[] {
  return fieldCollections.filter((n) => n !== 'tmp' && !n.includes('tmp'));
}
