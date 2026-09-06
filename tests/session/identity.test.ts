import { resolveLoginIdentity } from '../../src/session/identity';

describe('resolveLoginIdentity', () => {
  it('maps seed email and username to E-4412', () => {
    expect(resolveLoginIdentity('jon.hale@example.com')?.employeeId).toBe('E-4412');
    expect(resolveLoginIdentity('tech.jon')?.username).toBe('tech.jon');
    expect(resolveLoginIdentity('E-DISP-01')?.email).toBe('maya.dispatch@example.com');
    expect(resolveLoginIdentity('maya.chen@example.com')?.employeeId).toBe('E-7703');
    expect(resolveLoginIdentity('priya.shah@example.com')?.workModes).toEqual(['sales']);
  });

  it('rejects unknown emails', () => {
    expect(resolveLoginIdentity('')).toBeNull();
    expect(resolveLoginIdentity('nobody@example.com')).toBeNull();
  });
});
