import { parseReplicatorChange } from '../../src/sync/parseReplicatorChange';

describe('parseReplicatorChange', () => {
  it('reads CBL RN change.status methods', () => {
    const raw = {
      status: {
        getActivityLevel: () => 4,
        getProgress: () => ({ getCompleted: () => 3, getTotal: () => 10 }),
        getError: () => 'WebSocket error 1006 connection closed abnormally',
      },
    };
    const p = parseReplicatorChange(raw);
    expect(p.activityLevel).toBe(4);
    expect(p.progressCompleted).toBe(3);
    expect(p.progressTotal).toBe(10);
    expect(p.errorCode).toBe(1006);
    expect(p.errorMessage).toMatch(/1006/);
  });

  it('reads native JSON activityLevel + error.message', () => {
    const p = parseReplicatorChange({
      activityLevel: 0,
      error: { message: 'CouchbaseLiteException (CBLErrorDomain, 10401)' },
      progress: { completed: 0, total: 0 },
    });
    expect(p.activityLevel).toBe(0);
    expect(p.errorCode).toBe(10401);
    expect(p.errorMessage).toMatch(/10401/);
  });
});
