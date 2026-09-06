import { stampAuditCreate } from '../../src/audit';
import { memoryGet, memoryReset, memorySave } from '../../src/db/memoryStore';
import { handleReplicatedDoc, parseReplicatedDocs } from '../../src/sync/documentListener';

const session = { employeeId: 'E-4412', email: 'jon.hale@example.com', username: 'tech.jon' };

beforeEach(() => {
  memoryReset();
});

describe('parseReplicatedDocs', () => {
  it('reads collection + isPush + error code', () => {
    const evs = parseReplicatedDocs({
      isPush: true,
      documents: [
        { id: 'woout:1', collectionName: 'workordersout', error: { code: 500 } },
        { id: 'ord:1', collection: 'orders' },
      ],
    });
    expect(evs[0]).toMatchObject({ id: 'woout:1', collection: 'workordersout', isPush: true });
    expect(evs[0].error?.code).toBe(500);
    expect(evs[1].collection).toBe('orders');
  });
});

describe('handleReplicatedDoc', () => {
  it('SetSyncState pushed without extra history', async () => {
    memorySave(
      'workordersout',
      'woout:1',
      stampAuditCreate(
        {
          type: 'workorderout',
          syncState: 'ready_to_push',
          history: [{ op: 'SubmitWork', dt: 1, by: 'a', ver: '1' }],
        },
        { by: 'a', ver: '1', dt: 1 },
      ) as never,
    );
    await handleReplicatedDoc({ id: 'woout:1', collection: 'workordersout', isPush: true }, session);
    const doc = memoryGet('workordersout', 'woout:1')!;
    expect(doc.syncState).toBe('pushed');
    expect((doc.history as unknown[]).length).toBe(1);
  });

  it('skips a second pushed write', async () => {
    memorySave(
      'workordersout',
      'woout:1',
      stampAuditCreate({ type: 'workorderout', syncState: 'pushed' }, { by: 'a', ver: '1', dt: 1 }) as never,
    );
    const before = memoryGet('workordersout', 'woout:1')!;
    await handleReplicatedDoc({ id: 'woout:1', collection: 'workordersout', isPush: true }, session);
    expect(memoryGet('workordersout', 'woout:1')?.audit).toEqual(before.audit);
  });
});
