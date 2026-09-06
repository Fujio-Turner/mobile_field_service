import { memoryReset, memorySave } from '../../src/db/memoryStore';
import { SEED_CUSTOMER_ID } from '../../src/db/seedData';
import { listCustomerHistory } from '../../src/ops/customerHistory';

beforeEach(() => {
  memoryReset();
});

describe('listCustomerHistory', () => {
  it('returns only complete workordersout for that customer', async () => {
    memorySave('workordersout', 'woout:done', {
      type: 'workorderout',
      customerId: SEED_CUSTOMER_ID,
      status: 'complete',
      number: 'WO-100',
      summary: 'Replaced valve',
      completedAt: 1_700_000_100,
    });
    memorySave('workordersout', 'woout:open', {
      type: 'workorderout',
      customerId: SEED_CUSTOMER_ID,
      status: 'in_progress',
      number: 'WO-101',
      summary: 'Still open',
    });
    memorySave('workordersout', 'woout:other', {
      type: 'workorderout',
      customerId: 'cus:other',
      status: 'complete',
      number: 'WO-900',
      summary: 'Other customer',
    });
    const rows = await listCustomerHistory(SEED_CUSTOMER_ID);
    expect(rows.map((r) => r.id)).toEqual(['woout:done']);
    expect(rows[0].number).toBe('WO-100');
    expect(rows[0].status).toBe('complete');
  });
});
