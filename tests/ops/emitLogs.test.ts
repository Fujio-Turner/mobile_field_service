import * as fs from 'fs';
import * as path from 'path';
import { stampAuditCreate } from '../../src/audit';
import { memoryReset, memorySave } from '../../src/db/memoryStore';
import { seedInboundJobs } from '../../src/db/seedData';
import { resetLogLevel, setLogLevel } from '../../src/log/logger';
import { resetMetrics } from '../../src/metrics';
import { resetCopyOnWriteTotals } from '../../src/metrics/copyOnWrite';
import { submitOrder } from '../../src/ops/orders';
import { startWork } from '../../src/ops/startWork';
import { submitWork } from '../../src/ops/submitWork';

const session = {
  employeeId: 'E-4412',
  email: 'jon.hale@example.com',
  username: 'tech.jon',
};

beforeEach(() => {
  memoryReset();
  resetCopyOnWriteTotals();
  resetMetrics();
  setLogLevel('info');
});

afterEach(() => {
  resetLogLevel();
});

function parseInfo(spy: jest.SpyInstance): Record<string, unknown>[] {
  return spy.mock.calls.map((c) => JSON.parse(String(c[0])));
}

describe('mutation logs', () => {
  it('emits mfs.wo.start without email or password', async () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const { id } = seedInboundJobs('0.1.0+1', 1_700_000_000, '2026-09-05')[0];
    const { wooutId } = await startWork(id, session);
    const hit = parseInfo(spy).find((l) => l.event === 'mfs.wo.start');
    expect(hit).toMatchObject({ op: 'StartWork', collection: 'workordersout', docId: wooutId });
    expect(hit?.email).toBeUndefined();
    expect(hit?.password).toBeUndefined();
    expect(JSON.stringify(hit)).not.toMatch(/jon\.hale/);
    spy.mockRestore();
  });

  it('emits mfs.wo.submit without PII', async () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    memorySave(
      'workordersout',
      'woout:done',
      stampAuditCreate(
        { type: 'workorderout', status: 'complete', owner: 'backend' },
        { by: 'seed', ver: '0.1.0+1', dt: 1_700_000_000 },
      ) as never,
    );
    await submitWork('woout:done', session);
    const hit = parseInfo(spy).find((l) => l.event === 'mfs.wo.submit');
    expect(hit).toMatchObject({ op: 'SubmitWork', docId: 'woout:done' });
    expect(JSON.stringify(hit)).not.toMatch(/jon\.hale/);
    spy.mockRestore();
  });

  it('emits mfs.order.submit without PII', async () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    memorySave(
      'orders',
      'ord:1',
      stampAuditCreate(
        { type: 'order', role: 'working', status: 'quoted', owner: 'technician' },
        { by: 'seed', ver: '0.1.0+1', dt: 1_700_000_000 },
      ) as never,
    );
    await submitOrder('ord:1', session);
    const hit = parseInfo(spy).find((l) => l.event === 'mfs.order.submit');
    expect(hit).toMatchObject({
      op: 'SubmitOrder',
      collection: 'orders',
      docId: 'ord:1',
      syncState: 'ready_to_push',
    });
    expect(JSON.stringify(hit)).not.toMatch(/jon\.hale/);
    spy.mockRestore();
  });
});

describe('login log wiring', () => {
  it('AuthContext login events omit identifier and password', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../src/session/AuthContext.tsx'), 'utf8');
    expect(src).toMatch(/mfs\.auth\.login_ok/);
    expect(src).toMatch(/mfs\.auth\.login_fail/);
    expect(src).not.toMatch(/log\.(info|warn|error)\([^;]*password/);
    expect(src).not.toMatch(/log\.(info|warn|error)\([^;]*identifier/);
  });
});
