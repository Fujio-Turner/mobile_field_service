import { memoryGet, memoryReset, memorySave } from '../../src/db/memoryStore';
import { seedInboundJobs } from '../../src/db/seedData';
import { simulateDispatchKitChange } from '../../src/dev/simulateInbound';
import { applyInboundKit } from '../../src/ops/inboundApply';
import { dispatchChangedFields, inboundUpdateVsCopy, kitFieldDiffs } from '../../src/ops/inboundDiff';
import { startWork } from '../../src/ops/startWork';
import { resetCopyOnWriteTotals } from '../../src/metrics/copyOnWrite';

const session = { employeeId: 'E-4412', email: 'jon.hale@example.com', username: 'tech.jon' };

beforeEach(() => {
  memoryReset();
  resetCopyOnWriteTotals();
});

describe('dispatchChangedFields', () => {
  it('ignores identical kit and reports summary/checklist/taskIds', () => {
    const snap = {
      summary: 'Inspect',
      checklist: [{ id: 'cl-ppe', label: 'PPE on', required: true }],
      taskIds: ['tsk:a'],
    };
    expect(dispatchChangedFields(snap, { ...snap })).toEqual([]);
    expect(
      dispatchChangedFields(snap, {
        ...snap,
        summary: 'Inspect plus nameplate',
        checklist: [{ id: 'cl-ppe', label: 'PPE on', required: true }, { id: 'cl-lock', label: 'Lockout' }],
        taskIds: ['tsk:a', 'tsk:b'],
      }),
    ).toEqual(['summary', 'taskIds', 'checklist']);
  });
});

describe('inboundUpdateVsCopy', () => {
  it('does not treat the tech copy as stale when inbound is unchanged', async () => {
    const job = seedInboundJobs('0.1.0+1', 1_700_000_000, '2026-09-05')[0];
    memorySave('workordersin', job.id, job.doc as never);
    const { wooutId } = await startWork(job.id, session);
    const vs = await inboundUpdateVsCopy(wooutId);
    expect(vs.inboundMissing).toBe(false);
    expect(vs.fields).toEqual([]);
  });

  it('lists inbound field names when dispatch patched the ticket after StartWork', async () => {
    const job = seedInboundJobs('0.1.0+1', 1_700_000_000, '2026-09-05')[0];
    memorySave('workordersin', job.id, job.doc as never);
    const { wooutId } = await startWork(job.id, session);
    memorySave('workordersin', job.id, {
      ...(job.doc as object),
      summary: 'Dispatch added a second pump',
    } as never);
    const vs = await inboundUpdateVsCopy(wooutId);
    expect(vs.fields).toContain('summary');
  });

  it('copies inbound summary onto an untouched outbound and refreshes snapshot', async () => {
    const job = seedInboundJobs('0.1.0+1', 1_700_000_000, '2026-09-05')[0];
    memorySave('workordersin', job.id, job.doc as never);
    const { wooutId } = await startWork(job.id, session);
    const out = memoryGet('workordersout', wooutId)!;
    const inbound = { ...(job.doc as object), summary: 'Office added a second pump' } as Record<string, unknown>;
    const next = applyInboundKit(out, inbound, job.id, ['summary'], session);
    expect(next.summary).toBe('Office added a second pump');
    expect((next.source as { snapshot: { summary: string } }).snapshot.summary).toBe('Office added a second pump');
    expect((next.history as { op: string }[]).some((h) => h.op === 'ApplyInboundKit')).toBe(true);
  });
});

describe('simulateDispatchKitChange', () => {
  it('dirties the copy and changes inbound kit', async () => {
    const job = seedInboundJobs('0.1.0+1', 1_700_000_000, '2026-09-05')[0];
    memorySave('workordersin', job.id, job.doc as never);
    const { wooutId } = await startWork(job.id, session);
    await simulateDispatchKitChange(session, wooutId, { dirtyLocal: true });
    const out = memoryGet('workordersout', wooutId)!;
    const inn = memoryGet('workordersin', job.id)!;
    expect(String(out.summary)).toMatch(/on site/);
    expect(String(inn.summary)).toMatch(/dispatch/);
  });
});

describe('kitFieldDiffs', () => {
  it('marks dirty when local diverged from snapshot', () => {
    const rows = kitFieldDiffs({
      snapshot: { summary: 'A' },
      local: { summary: 'mine' },
      remote: { summary: 'office' },
    });
    expect(rows[0]?.key).toBe('summary');
    expect(rows[0]?.dirty).toBe(true);
  });
});
