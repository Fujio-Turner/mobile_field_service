import { SEED_CUSTOMER_ID, SEED_INBOUND_ORDER_ID, SEED_USER_ID } from '../../src/db/seedData';
import { seedIfNeeded } from '../../src/db/seed';

describe('seedIfNeeded', () => {
  it('skips remaining KV gets when seed markers already exist', async () => {
    const got: string[] = [];
    const col = {
      document: async (id: string) => {
        got.push(id);
        if (id === SEED_USER_ID || id === SEED_INBOUND_ORDER_ID) return { id };
        return null;
      },
      save: async () => {
        throw new Error('should not save');
      },
    };
    await seedIfNeeded({ collection: async () => col });
    expect(got).toEqual([SEED_USER_ID, SEED_INBOUND_ORDER_ID]);
    expect(got).not.toContain(SEED_CUSTOMER_ID);
  });
});
