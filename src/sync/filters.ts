/**
 * Pure push filters for CollectionConfiguration.setPushFilter.
 * Native CBL evals filter.toString() in JavaScriptCore. Hermes toString() is not
 * source, so we pin ES5 strings on each function (and CollectionConfig.pushFilter).
 */

export type PushDoc = Record<string, unknown>;

function pinSource<T extends (document: PushDoc, flags?: unknown) => boolean>(fn: T, src: string): T {
  Object.defineProperty(fn, 'toString', { value: () => src, configurable: true });
  return fn;
}

export const WORKORDERSIN_PUSH_FILTER_SRC =
  'function(document,flags){return document["origin"]=="field"&&document["readyToPush"]==true;}';
export const WORKORDERSOUT_PUSH_FILTER_SRC =
  'function(document,flags){var s="";try{s=document.syncState;}catch(e){}if(s==null||s===""){try{s=document["syncState"];}catch(e2){}}if(typeof s!=="string"&&s!=null)s=String(s);var ok=s=="ready_to_push"||s=="pushed"||s=="push_error";try{console.log("woout filter s="+s+" ok="+ok);}catch(e3){}return ok;}';
export const ORDERS_PUSH_FILTER_SRC =
  'function(document,flags){if(document["role"]=="inbound")return false;var s=document["syncState"];return s=="ready_to_push"||s=="pushed"||s=="push_error";}';
export const CUSTOMERS_PUSH_FILTER_SRC =
  'function(document,flags){return document["origin"]=="field"&&document["readyToPush"]==true;}';
export const READY_TO_PUSH_FILTER_SRC =
  'function(document,flags){return document["readyToPush"]==true;}';
export const NOTES_PUSH_FILTER_SRC = 'function(document,flags){return true;}';
export const MESSAGES_PUSH_FILTER_SRC =
  'function(document,flags){return document["readyToPush"]==true;}';
export const TASKS_PUSH_FILTER_SRC =
  'function(document,flags){return document["type"]=="task"&&document["readyToPush"]==true;}';
export const INVENTORY_PUSH_FILTER_SRC =
  'function(document,flags){if(document["type"]!="inventory_tx")return false;return document["readyToPush"]==true;}';
export const TRACKING_PUSH_FILTER_SRC = 'function(document,flags){return true;}';
export const NEVER_PUSH_FILTER_SRC = 'function(document,flags){return false;}';

export const workordersinPushFilter = pinSource(function workordersinPushFilter(
  document: PushDoc,
  _flags?: unknown,
): boolean {
  'show source';
  return document['origin'] == 'field' && document['readyToPush'] == true;
}, WORKORDERSIN_PUSH_FILTER_SRC);

export const workordersoutPushFilter = pinSource(function workordersoutPushFilter(
  document: PushDoc,
  _flags?: unknown,
): boolean {
  'show source';
  const s = document['syncState'];
  return s == 'ready_to_push' || s == 'pushed' || s == 'push_error';
}, WORKORDERSOUT_PUSH_FILTER_SRC);

export const ordersPushFilter = pinSource(function ordersPushFilter(
  document: PushDoc,
  _flags?: unknown,
): boolean {
  'show source';
  if (document['role'] == 'inbound') return false;
  const s = document['syncState'];
  return s == 'ready_to_push' || s == 'pushed' || s == 'push_error';
}, ORDERS_PUSH_FILTER_SRC);

export const customersPushFilter = pinSource(function customersPushFilter(
  document: PushDoc,
  _flags?: unknown,
): boolean {
  'show source';
  return document['origin'] == 'field' && document['readyToPush'] == true;
}, CUSTOMERS_PUSH_FILTER_SRC);

export const readyToPushFilter = pinSource(function readyToPushFilter(
  document: PushDoc,
  _flags?: unknown,
): boolean {
  'show source';
  return document['readyToPush'] == true;
}, READY_TO_PUSH_FILTER_SRC);

export const notesPushFilter = pinSource(function notesPushFilter(
  _document: PushDoc,
  _flags?: unknown,
): boolean {
  'show source';
  return true;
}, NOTES_PUSH_FILTER_SRC);

export const messagesPushFilter = pinSource(function messagesPushFilter(
  document: PushDoc,
  _flags?: unknown,
): boolean {
  'show source';
  return document['readyToPush'] == true;
}, MESSAGES_PUSH_FILTER_SRC);

export const tasksPushFilter = pinSource(function tasksPushFilter(
  document: PushDoc,
  _flags?: unknown,
): boolean {
  'show source';
  return document['type'] == 'task' && document['readyToPush'] == true;
}, TASKS_PUSH_FILTER_SRC);

export const inventoryPushFilter = pinSource(function inventoryPushFilter(
  document: PushDoc,
  _flags?: unknown,
): boolean {
  'show source';
  if (document['type'] != 'inventory_tx') return false;
  return document['readyToPush'] == true;
}, INVENTORY_PUSH_FILTER_SRC);

export const trackingPushFilter = pinSource(function trackingPushFilter(
  _document: PushDoc,
  _flags?: unknown,
): boolean {
  'show source';
  return true;
}, TRACKING_PUSH_FILTER_SRC);

export const neverPushFilter = pinSource(function neverPushFilter(
  _document: PushDoc,
  _flags?: unknown,
): boolean {
  'show source';
  return false;
}, NEVER_PUSH_FILTER_SRC);

export const FILTER_SOURCE: Record<string, string> = {
  workordersin: WORKORDERSIN_PUSH_FILTER_SRC,
  workordersout: WORKORDERSOUT_PUSH_FILTER_SRC,
  orders: ORDERS_PUSH_FILTER_SRC,
  customers: CUSTOMERS_PUSH_FILTER_SRC,
  messages: MESSAGES_PUSH_FILTER_SRC,
  notes: NOTES_PUSH_FILTER_SRC,
  tasks: TASKS_PUSH_FILTER_SRC,
  inventory: INVENTORY_PUSH_FILTER_SRC,
  tracking: TRACKING_PUSH_FILTER_SRC,
  assets: NEVER_PUSH_FILTER_SRC,
  products: NEVER_PUSH_FILTER_SRC,
  rates: NEVER_PUSH_FILTER_SRC,
  taxes: NEVER_PUSH_FILTER_SRC,
  users: NEVER_PUSH_FILTER_SRC,
};

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
