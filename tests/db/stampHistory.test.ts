import { HISTORY_CAP, stampAuditCreate, stampHistory } from '../../src/audit';

function base() {
  return stampAuditCreate({ type: 'workorderout' }, { by: 'tech.jon', ver: '0.1.0+1', dt: 1 });
}

type HistDoc = ReturnType<typeof stampHistory>;

describe('stampHistory', () => {
  it('records qty 10 → 5 with geo', () => {
    const doc = stampHistory(base(), {
      op: 'UpdateWorkOrderOutFields',
      by: 'tech.jon',
      ver: '0.1.0+1',
      dt: 50,
      geo: { lat: 41.76, lon: -72.67, accuracyM: 8 },
      changes: [{ path: 'materials.0.qtyUsed', from: 10, to: 5 }],
    });
    expect(doc.history).toHaveLength(1);
    expect(doc.history?.[0].changes?.[0]).toEqual({
      path: 'materials.0.qtyUsed',
      from: 10,
      to: 5,
    });
    expect(doc.history?.[0].lat).toBe(41.76);
    expect('lastAction' in doc).toBe(false);
  });

  it('skips SetSyncState', () => {
    const withRow = stampHistory(base(), {
      op: 'StartWork',
      by: 'tech.jon',
      ver: '1',
      dt: 2,
    });
    const after = stampHistory(withRow, {
      op: 'SetSyncState',
      by: 'tech.jon',
      ver: '1',
      dt: 3,
    });
    expect(after.history).toHaveLength(1);
    expect(after.history?.[0].op).toBe('StartWork');
  });

  it('caps at 100 and sets historyTruncated', () => {
    let doc: HistDoc = stampHistory(base(), {
      op: 'UpdateWorkOrderOutFields',
      by: 'tech.jon',
      ver: '1',
      dt: 10,
      changes: [{ path: 'n', from: 0, to: 1 }],
    });
    for (let i = 1; i < HISTORY_CAP + 3; i++) {
      doc = stampHistory(doc, {
        op: 'UpdateWorkOrderOutFields',
        by: 'tech.jon',
        ver: '1',
        dt: i + 10,
        changes: [{ path: 'n', from: i, to: i + 1 }],
      });
    }
    expect(doc.history).toHaveLength(HISTORY_CAP);
    expect(doc.historyTruncated).toBe(true);
    expect(doc.history?.[0].dt).toBe(13);
  });
});
