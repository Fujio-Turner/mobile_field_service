import { memoryReset, memorySave } from '../../src/db/memoryStore';
import {
  SEED_DISPATCH_EMPLOYEE_ID,
  SEED_DISPATCH_USER_ID,
  SEED_INBOUND_ORDER_ID,
  SEED_USER_ID,
  seedDispatchUserDoc,
  seedInboundJobs,
  seedInboundOrder,
  seedUserDoc,
} from '../../src/db/seedData';
import { matchEmployee, parseChatRefs, resolveChatRefs } from '../../src/ops/chatRefs';
import { resetCopyOnWriteTotals } from '../../src/metrics/copyOnWrite';

beforeEach(() => {
  memoryReset();
  resetCopyOnWriteTotals();
  memorySave('users', SEED_USER_ID, seedUserDoc('0.1.0+1', 1_700_000_000) as never);
  memorySave('users', SEED_DISPATCH_USER_ID, seedDispatchUserDoc('0.1.0+1', 1_700_000_000) as never);
});

describe('parseChatRefs', () => {
  it('pulls @mentions, WO-, and ORD- tokens', () => {
    const p = parseChatRefs(
      'Hey @E-DISP-01 the job WO-10482 needs more repair than I can do. Also ORD-3301.',
    );
    expect(p.mentionTokens).toEqual(['E-DISP-01']);
    expect(p.workNumbers).toEqual(['WO-10482']);
    expect(p.orderNumbers).toEqual(['ORD-3301']);
  });
});

describe('matchEmployee', () => {
  it('matches id, username, and unique first name', () => {
    const people = [
      { employeeId: 'E-DISP-01', username: 'dispatch.maya', displayName: 'Maya Dispatch' },
      { employeeId: 'E-4412', username: 'tech.jon', displayName: 'Jon Hale' },
    ];
    expect(matchEmployee('E-DISP-01', people)?.employeeId).toBe('E-DISP-01');
    expect(matchEmployee('tech.jon', people)?.employeeId).toBe('E-4412');
    expect(matchEmployee('Jon', people)?.employeeId).toBe('E-4412');
  });
});

describe('resolveChatRefs', () => {
  it('attaches WO and ORD ids from seed docs', async () => {
    const job = seedInboundJobs('0.1.0+1', 1_700_000_000, '2026-09-05').find(
      (j) => String((j.doc as { number?: string }).number) === 'WO-10482',
    )!;
    memorySave('workordersin', job.id, job.doc as never);
    const ord = seedInboundOrder('0.1.0+1', 1_700_000_000, '2026-09-05');
    memorySave('orders', ord.id, ord.doc as never);
    const refs = await resolveChatRefs(
      `Hey @${SEED_DISPATCH_EMPLOYEE_ID} WO-10482 and ORD-3301`,
      'E-4412',
    );
    expect(refs.toEmployeeIds).toEqual([SEED_DISPATCH_EMPLOYEE_ID]);
    expect(refs.workOrderInId).toBe(job.id);
    expect(refs.workOrderNumber).toBe('WO-10482');
    expect(refs.orderId).toBe(SEED_INBOUND_ORDER_ID);
    expect(refs.orderNumber).toBe('ORD-3301');
  });
});
