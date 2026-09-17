import { FIELD_COLLECTIONS } from '../../src/db/collections';
import { evalPushFilterSrc } from '../../src/sync/inspectPush';
import {
  FIELD_PUSH_FILTERS,
  WORKORDERSOUT_PUSH_FILTER_SRC,
  customersPushFilter,
  inventoryPushFilter,
  messagesPushFilter,
  neverPushFilter,
  notesPushFilter,
  ordersPushFilter,
  pushFilterFor,
  replicatorCollectionNames,
  tasksPushFilter,
  trackingPushFilter,
  workordersinPushFilter,
  workordersoutPushFilter,
} from '../../src/sync/filters';

describe('push filters', () => {
  it('workordersout uses syncState gate', () => {
    expect(workordersoutPushFilter({ syncState: 'ready_to_push' })).toBe(true);
    expect(workordersoutPushFilter({ syncState: 'local_draft' })).toBe(false);
  });

  it('orders never push inbound', () => {
    expect(ordersPushFilter({ role: 'inbound', syncState: 'ready_to_push' })).toBe(false);
    expect(ordersPushFilter({ role: 'working', syncState: 'ready_to_push' })).toBe(true);
  });

  it('field origin woin only when ready', () => {
    expect(workordersinPushFilter({ origin: 'field', readyToPush: true })).toBe(true);
    expect(workordersinPushFilter({ origin: 'dispatch', readyToPush: true })).toBe(false);
  });

  it('tasks skip templates; inventory only txs', () => {
    expect(tasksPushFilter({ type: 'task_template', readyToPush: true })).toBe(false);
    expect(tasksPushFilter({ type: 'task', readyToPush: true })).toBe(true);
    expect(inventoryPushFilter({ type: 'inventory', readyToPush: true })).toBe(false);
    expect(inventoryPushFilter({ type: 'inventory_tx', readyToPush: true })).toBe(true);
  });

  it('tracking always pushes; catalogs never', () => {
    expect(trackingPushFilter({})).toBe(true);
    expect(neverPushFilter({})).toBe(false);
    expect(pushFilterFor('assets')({})).toBe(false);
  });

  it('allow-list is fourteen field colls without tmp', () => {
    const names = replicatorCollectionNames([...FIELD_COLLECTIONS, 'tmp']);
    expect(names).toHaveLength(14);
    expect(names.includes('tracking')).toBe(true);
    expect(names.includes('tmp')).toBe(false);
    expect(names.includes('messages')).toBe(true);
  });

  it('notes/messages/customers use readyToPush; every filter has show source', () => {
    expect(notesPushFilter({ readyToPush: false })).toBe(true);
    expect(messagesPushFilter({ readyToPush: false })).toBe(false);
    expect(customersPushFilter({ origin: 'field', readyToPush: true })).toBe(true);
    expect(customersPushFilter({ origin: 'dispatch', readyToPush: true })).toBe(false);
    for (const [name, fn] of Object.entries(FIELD_PUSH_FILTERS)) {
      const src = fn.toString();
      expect({ name, evalable: src.startsWith('function(') }).toEqual({ name, evalable: true });
      expect(src.includes('[native code]')).toBe(false);
    }
    expect(workordersoutPushFilter.toString()).toContain('ready_to_push');
    expect(evalPushFilterSrc(WORKORDERSOUT_PUSH_FILTER_SRC, { syncState: 'ready_to_push' })).toBe(true);
    expect(evalPushFilterSrc(WORKORDERSOUT_PUSH_FILTER_SRC, { syncState: 'local_draft' })).toBe(false);
  });
});
