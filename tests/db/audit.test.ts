import { stampAuditCreate, stampAuditUpdate } from '../../src/audit';

describe('audit stamps', () => {
  it('create sets cr and up equal', () => {
    const doc = stampAuditCreate(
      { type: 'note', body: 'x' },
      { by: 'tech.jon', ver: '0.1.0+1', dt: 100 },
    );
    expect(doc.audit.cr).toEqual({ dt: 100, ver: '0.1.0+1', by: 'tech.jon' });
    expect(doc.audit.up).toEqual(doc.audit.cr);
    expect(doc.audit.up).not.toBe(doc.audit.cr);
  });

  it('update changes up only', () => {
    const created = stampAuditCreate({ type: 'note' }, { by: 'a', ver: '1', dt: 10 });
    const updated = stampAuditUpdate(created, { by: 'b', ver: '2', dt: 20 });
    expect(updated.audit.cr.by).toBe('a');
    expect(updated.audit.up).toEqual({ dt: 20, ver: '2', by: 'b' });
  });
});
