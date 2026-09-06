import { liveChangeResults } from '../../src/db/liveQuery';
import { parseTodayOrderRows } from '../../src/ops/watchTodayOrders';

describe('liveChangeResults', () => {
  it('reads an array of rows', () => {
    const { rows, error } = liveChangeResults({
      results: [{ id: 'woin:1', number: 'WO-1' }],
    });
    expect(error).toBeUndefined();
    expect(rows[0].id).toBe('woin:1');
  });

  it('parses a JSON string payload from the native bridge', () => {
    const { rows } = liveChangeResults({
      data: JSON.stringify([{ id: 'woout:1' }]),
    });
    expect(rows[0].id).toBe('woout:1');
  });

  it('surfaces a listener error', () => {
    const { rows, error } = liveChangeResults({ error: 'boom', results: [] });
    expect(error).toBe('boom');
    expect(rows).toEqual([]);
  });
});

describe('parseTodayOrderRows', () => {
  it('keeps id number role status', () => {
    expect(
      parseTodayOrderRows([{ id: 'ord:1', number: 'SO-9', role: 'inbound', status: 'accepted' }]),
    ).toEqual([{ id: 'ord:1', number: 'SO-9', role: 'inbound', status: 'accepted' }]);
  });
});
