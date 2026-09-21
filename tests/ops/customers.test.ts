import { bboxAround } from '../../src/geo/haversine';
import { memoryGet, memoryReset, memorySave } from '../../src/db/memoryStore';
import { SEED_CUSTOMER_ID, SEED_SITE_GEO, seedCustomerDoc, seedInboundOrders } from '../../src/db/seedData';
import {
  createCustomer,
  getCustomer,
  queryCustomersInBBox,
  searchCustomers,
} from '../../src/ops/customers';
import { queryOrderSitesInBBox } from '../../src/ops/orders';
import { OutError } from '../../src/ops/outError';

const session = { employeeId: 'E-8801', email: 'priya.shah@example.com', username: 'sales.priya' };

beforeEach(() => {
  memoryReset();
  memorySave('customers', SEED_CUSTOMER_ID, seedCustomerDoc('0.1.0+1', 1_700_000_000) as never);
});

describe('customers lookup and geo', () => {
  it('finds Hartford by name without listing the whole catalog', async () => {
    expect(await searchCustomers('')).toEqual([]);
    const hits = await searchCustomers('Hartford');
    expect(hits.some((c) => c.id === SEED_CUSTOMER_ID)).toBe(true);
    expect(hits[0]?.geo).toEqual(SEED_SITE_GEO);
  });

  it('creates a field customer with site geo and never reuses the dispatch id', async () => {
    const id = await createCustomer(session, {
      name: 'Walk-up cafe',
      address: { line1: '12 Main St', city: 'Hartford' },
      geo: { lat: 41.77, lon: -72.67 },
    });
    expect(id).not.toBe(SEED_CUSTOMER_ID);
    expect(id.startsWith('cus:')).toBe(true);
    const doc = await getCustomer(id);
    expect(doc?.origin).toBe('field');
    expect(doc?.geo).toEqual({ lat: 41.77, lon: -72.67 });
    expect(doc?.sites[0]?.address?.line1).toBe('12 Main St');
    const raw = memoryGet('customers', id);
    expect(raw?.origin).toBe('field');
    expect(raw?.geo).toEqual({ lat: 41.77, lon: -72.67 });
    const dispatch = await getCustomer(SEED_CUSTOMER_ID);
    expect(dispatch?.origin).toBe('dispatch');
  });

  it('rejects a blank name', async () => {
    await expect(createCustomer(session, { name: '  ' })).rejects.toBeInstanceOf(OutError);
  });

  it('queries customers in a bbox from first-class geo', async () => {
    await createCustomer(session, { name: 'Far away', geo: { lat: 40.7, lon: -74.0 } });
    const near = await queryCustomersInBBox(bboxAround(SEED_SITE_GEO, 2000), SEED_SITE_GEO);
    expect(near.some((c) => c.id === SEED_CUSTOMER_ID)).toBe(true);
    expect(near.every((c) => c.name !== 'Far away')).toBe(true);
  });

  it('plots inbound order site.geo in the same bbox', async () => {
    for (const row of seedInboundOrders('0.1.0+1', 1_700_000_000, '2026-09-05')) {
      memorySave('orders', row.id, row.doc as never);
    }
    const sites = await queryOrderSitesInBBox(bboxAround(SEED_SITE_GEO, 2000), SEED_SITE_GEO);
    expect(sites.length).toBeGreaterThan(0);
    expect(sites[0]?.geo).toEqual(SEED_SITE_GEO);
  });
});
