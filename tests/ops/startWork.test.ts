import { memoryGet, memoryReset, memorySave } from '../../src/db/memoryStore';
import { seedInboundJobs } from '../../src/db/seedData';
import { cloneTaskIds, shouldCloneTask } from '../../src/ops/cloneTasks';
import { assertInboundStartable, buildWorkOrderOut, pickOldestPrimary } from '../../src/ops/copyInbound';
import { createWorkOrderIn, CreateWorkOrderInError } from '../../src/ops/createWorkOrderIn';
import { copyOnWriteTotals, resetCopyOnWriteTotals } from '../../src/metrics/copyOnWrite';
import { startWork, StartWorkError } from '../../src/ops/startWork';

const session = {
  employeeId: 'E-4412',
  email: 'jon.hale@example.com',
  username: 'tech.jon',
  displayName: 'Jon Hale',
};

const seed = () => seedInboundJobs('0.1.0+1', 1_700_000_000, '2026-09-05')[0];

beforeEach(() => {
  memoryReset();
  resetCopyOnWriteTotals();
});

describe('buildWorkOrderOut', () => {
  it('copies inbound without mutating it or keeping embedding', () => {
    const { id, doc } = seed();
    const raw = { ...(doc as unknown as Record<string, unknown>), embedding: { clip512: [1] } };
    Object.freeze(raw);
    const out = buildWorkOrderOut({
      inboundRaw: raw,
      inboundId: id,
      outId: 'woout:new',
      session,
      ver: '0.1.0+1',
      dt: 50,
    });
    expect(raw.embedding).toEqual({ clip512: [1] });
    expect(out.embedding).toBeUndefined();
    expect(out.type).toBe('workorderout');
    expect(out.role).toBe('primary');
    expect(out.owner).toBe('technician');
    expect(out.syncState).toBe('local_draft');
    expect((out.source as { id: string }).id).toBe(id);
    expect((out.history as { op: string }[])[0].op).toBe('StartWork');
    expect(out.lastAction).toBeUndefined();
  });
});

describe('assertInboundStartable', () => {
  it('rejects cancelled and other assignees', () => {
    const raw = seed().doc as unknown as Record<string, unknown>;
    expect(assertInboundStartable({ ...raw, status: 'cancelled' }, 'E-4412')).toBe('inbound_not_startable');
    expect(assertInboundStartable({ ...raw, status: 'superseded' }, 'E-4412')).toBe('inbound_not_startable');
    expect(
      assertInboundStartable(
        { ...raw, assignedTo: { employeeId: 'E-OTHER' } },
        'E-4412',
      ),
    ).toBe('inbound_not_assigned');
    expect(assertInboundStartable(raw, 'E-4412')).toBe('ok');
  });
});

describe('startWork memory', () => {
  it('creates one outbound and is idempotent', async () => {
    const { id } = seed();
    const first = await startWork(id, session);
    expect(first.created).toBe(true);
    const inboundAfter = seed().doc;
    expect((inboundAfter as { origin?: string }).origin).toBe('dispatch');
    const second = await startWork(id, session);
    expect(second.created).toBe(false);
    expect(second.wooutId).toBe(first.wooutId);
    expect(copyOnWriteTotals().created).toBe(1);
    expect(copyOnWriteTotals().idempotent_hit).toBe(1);
    expect(memoryGet('workordersin', id)).toBeNull();
  });

  it('does not save dispatch inbound', async () => {
    const { id, doc } = seed();
    await startWork(id, session);
    expect(memoryGet('workordersin', id)).toBeNull();
    expect((doc as { origin: string }).origin).toBe('dispatch');
  });

  it('throws when not assigned', async () => {
    await expect(startWork(seed().id, { ...session, employeeId: 'E-NOPE' })).rejects.toBeInstanceOf(StartWorkError);
  });
});

describe('cloneTaskIds', () => {
  it('clones templates and not existing instances', () => {
    const templates: Record<string, Record<string, unknown>> = {
      'tsk:tmpl': { type: 'task_template', title: 'Lockout', required: true },
      'tsk:inst': { type: 'task', title: 'Done', workOrderOutId: 'woout:old' },
    };
    expect(shouldCloneTask(templates['tsk:tmpl'])).toBe(true);
    expect(shouldCloneTask(templates['tsk:inst'])).toBe(false);
    const cloned = cloneTaskIds(['tsk:tmpl', 'tsk:inst'], (id) => templates[id], {
      outId: 'woout:new',
      session,
      ver: '1',
      dt: 1,
      newId: () => 'tsk:clone',
    });
    expect(cloned.instanceIds).toEqual(['tsk:clone']);
    expect(cloned.instances[0].doc.workOrderOutId).toBe('woout:new');
    expect(cloned.instances[0].doc.type).toBe('task');
  });
});

describe('createWorkOrderIn', () => {
  it('writes origin field only', async () => {
    const { woinId } = await createWorkOrderIn({ session, summary: 'Walk-up leak' });
    const saved = memoryGet('workordersin', woinId);
    expect(saved?.origin).toBe('field');
    expect(saved?.readyToPush).toBe(true);
  });

  it('rejects empty summary', async () => {
    await expect(createWorkOrderIn({ session, summary: '  ' })).rejects.toBeInstanceOf(CreateWorkOrderInError);
  });
});

describe('pickOldestPrimary', () => {
  it('keeps oldest cr.dt then lowest id', () => {
    expect(
      pickOldestPrimary([
        { id: 'woout:b', auditCrDt: 2 },
        { id: 'woout:a', auditCrDt: 2 },
        { id: 'woout:c', auditCrDt: 1 },
      ]),
    ).toBe('woout:c');
  });
});

describe('memorySave helper for inbound field docs', () => {
  it('stores a field ticket for later start', () => {
    memorySave('workordersin', 'woin:x', { origin: 'field', summary: 'x' });
    expect(memoryGet('workordersin', 'woin:x')?.origin).toBe('field');
  });
});
