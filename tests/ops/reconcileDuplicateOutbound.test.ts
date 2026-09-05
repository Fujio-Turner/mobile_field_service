import { stampAuditCreate } from '../../src/audit';
import { memoryReset, memorySave, memoryGet } from '../../src/db/memoryStore';
import { pickKeeper, reconcileDuplicateOutbound } from '../../src/ops/reconcileDuplicateOutbound';

beforeEach(() => {
  memoryReset();
});

describe('pickKeeper', () => {
  it('keeps oldest cr.dt then lowest id', () => {
    const result = pickKeeper([
      { id: 'woout:b', auditCrDt: 2 },
      { id: 'woout:a', auditCrDt: 2 },
      { id: 'woout:c', auditCrDt: 1 },
    ]);
    expect(result?.keeperId).toBe('woout:c');
    expect(result?.duplicateIds.sort()).toEqual(['woout:a', 'woout:b']);
  });

  it('no-ops on a single primary', () => {
    expect(pickKeeper([{ id: 'woout:a', auditCrDt: 1 }])).toBeNull();
  });
});

describe('reconcileDuplicateOutbound', () => {
  it('marks extras duplicateOf without history', async () => {
    const session = { employeeId: 'E-4412' };
    memorySave(
      'workordersout',
      'woout:old',
      stampAuditCreate(
        {
          type: 'workorderout',
          role: 'primary',
          assignedTo: session,
          source: { id: 'woin:1' },
        },
        { by: 'a', ver: '1', dt: 10 },
      ) as never,
    );
    memorySave(
      'workordersout',
      'woout:new',
      stampAuditCreate(
        {
          type: 'workorderout',
          role: 'primary',
          assignedTo: session,
          source: { id: 'woin:1' },
          history: [{ op: 'StartWork' }],
        },
        { by: 'a', ver: '1', dt: 20 },
      ) as never,
    );
    const result = await reconcileDuplicateOutbound('woout:new', 'E-4412');
    expect(result?.keeperId).toBe('woout:old');
    expect(memoryGet('workordersout', 'woout:new')?.duplicateOf).toBe('woout:old');
    expect((memoryGet('workordersout', 'woout:new')?.history as { op: string }[])[0].op).toBe('StartWork');
    expect(memoryGet('workordersout', 'woout:old')?.duplicateOf).toBeUndefined();
  });
});
