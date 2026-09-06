import { memoryReset, memorySave } from '../../src/db/memoryStore';
import { pendingPushCountMemory } from '../../src/ops/pendingPush';
import { syncSnapshot } from '../../src/ops/syncSnapshot';
import { FIELD_COLLECTIONS } from '../../src/db/collections';
import { resetReplicatorTestState } from '../../src/sync/replicator';

beforeEach(() => {
  memoryReset();
  resetReplicatorTestState();
});

describe('pendingPushCountMemory', () => {
  it('counts ready_to_push woout/orders and field inbound', () => {
    memorySave('workordersout', 'a', { syncState: 'ready_to_push' });
    memorySave('workordersout', 'b', { syncState: 'pushed' });
    memorySave('orders', 'o1', { role: 'working', syncState: 'ready_to_push' });
    memorySave('orders', 'o2', { role: 'inbound', syncState: 'ready_to_push' });
    memorySave('workordersin', 'i1', { origin: 'field', readyToPush: true });
    memorySave('workordersin', 'i2', { origin: 'dispatch', readyToPush: true });
    expect(pendingPushCountMemory()).toBe(3);
  });
});

describe('syncSnapshot', () => {
  it('lists fourteen field collections and excludes tmp', () => {
    const snap = syncSnapshot();
    expect(snap.collections).toHaveLength(14);
    expect(snap.collections).toEqual([...FIELD_COLLECTIONS]);
    expect(snap.tmpExcluded).toBe(true);
    expect(snap.collections.includes('tmp')).toBe(false);
    expect(snap.schema).toBe('simple');
    expect(snap.continuous).toBe(true);
    expect(snap.filters.tracking).toMatch(/trackingPushFilter|alwaysPush|fn/);
  });
});
