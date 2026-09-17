import { asStringIds, nextPendingList, nextSuccessList } from '../../src/sync/pushQueue';

describe('pushQueue', () => {
  it('keeps the newest 10 successes', () => {
    let list: { id: string; collection: string; dt?: number }[] = [];
    for (let i = 0; i < 12; i++) {
      list = nextSuccessList(list, { id: `woout:${i}`, collection: 'workordersout', dt: i });
    }
    expect(list).toHaveLength(10);
    expect(list[0].id).toBe('woout:11');
    expect(list[9].id).toBe('woout:2');
  });

  it('moves a re-pushed id to the front', () => {
    const list = nextSuccessList(
      [
        { id: 'a', collection: 'workordersout' },
        { id: 'b', collection: 'workordersout' },
      ],
      { id: 'b', collection: 'workordersout', dt: 9 },
    );
    expect(list.map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('caps pending at 10', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      id: `id:${i}`,
      collection: 'workordersout',
    }));
    expect(nextPendingList(items)).toHaveLength(10);
    expect(nextPendingList(items)[0].id).toBe('id:0');
  });
});

describe('asStringIds', () => {
  it('reads arrays and dictionary-shaped RN bridges', () => {
    expect(asStringIds(['a', 'b'])).toEqual(['a', 'b']);
    expect(asStringIds({ pendingDocumentIds: ['x'] })).toEqual(['x']);
    expect(asStringIds({ 0: 'p', 1: 'q' })).toEqual(['p', 'q']);
  });
});
