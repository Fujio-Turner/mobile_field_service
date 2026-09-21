import { memoryReset, memorySave } from '../../src/db/memoryStore';
import { seedPriyaUserDoc, seedUserDoc } from '../../src/db/seedData';
import { getUserProfile } from '../../src/ops/users';

beforeEach(() => {
  memoryReset();
});

describe('getUserProfile', () => {
  it('reads workModes from the user doc', async () => {
    memorySave('users', 'usr:priya', seedPriyaUserDoc('0.1.0+1', 1_700_000_000) as never);
    const priya = await getUserProfile('E-8801');
    expect(priya?.workModes).toEqual(['sales']);
    expect(priya?.role).toBe('technician');
  });

  it('defaults missing workModes to assets', async () => {
    const doc = seedUserDoc('0.1.0+1', 1_700_000_000) as Record<string, unknown>;
    delete doc.workModes;
    memorySave('users', 'usr:jon', doc as never);
    const jon = await getUserProfile('E-4412');
    expect(jon?.workModes).toEqual(['assets']);
  });
});
