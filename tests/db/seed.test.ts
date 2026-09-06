import {
  SEED_CUSTOMER_ID,
  SEED_DELIVER_WOIN_ID,
  SEED_INBOUND_ORDER_ID,
  SEED_MAYA_USER_ID,
  SEED_PRIYA_USER_ID,
  SEED_REASSIGN_WOIN_ID,
  SEED_REASSIGN_WOOUT_ID,
  SEED_USER_ID,
} from '../../src/db/seedData';
import { seedIfNeeded } from '../../src/db/seed';

const MARKERS = new Set([
  SEED_USER_ID,
  SEED_MAYA_USER_ID,
  SEED_PRIYA_USER_ID,
  SEED_INBOUND_ORDER_ID,
  SEED_REASSIGN_WOIN_ID,
  SEED_DELIVER_WOIN_ID,
  SEED_REASSIGN_WOOUT_ID,
]);

describe('seedIfNeeded', () => {
  it('skips remaining KV gets when v2 seed markers already exist', async () => {
    const got: string[] = [];
    const col = {
      document: async (id: string) => {
        got.push(id);
        if (MARKERS.has(id)) return { id };
        return null;
      },
      save: async () => {
        throw new Error('should not save');
      },
    };
    await seedIfNeeded({ collection: async () => col });
    expect(got).toEqual([
      SEED_REASSIGN_WOOUT_ID,
      SEED_USER_ID,
      SEED_MAYA_USER_ID,
      SEED_PRIYA_USER_ID,
      SEED_INBOUND_ORDER_ID,
      SEED_REASSIGN_WOIN_ID,
      SEED_DELIVER_WOIN_ID,
      SEED_REASSIGN_WOOUT_ID,
    ]);
    expect(got).not.toContain(SEED_CUSTOMER_ID);
  });
});
