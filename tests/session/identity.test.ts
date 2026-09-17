import { resolveLoginIdentity } from '../../src/session/identity';

describe('resolveLoginIdentity', () => {
  it('maps seed email and username to E-4412', () => {
    expect(resolveLoginIdentity('jon.hale@example.com')?.employeeId).toBe('E-4412');
    expect(resolveLoginIdentity('tech.jon')?.username).toBe('tech.jon');
    expect(resolveLoginIdentity('E-DISP-01')?.email).toBe('maya.dispatch@example.com');
    expect(resolveLoginIdentity('maya.chen@example.com')?.employeeId).toBe('E-7703');
    expect(resolveLoginIdentity('priya.shah@example.com')?.workModes).toEqual(['sales']);
  });

  it('rejects a blank identifier', () => {
    expect(resolveLoginIdentity('')).toBeNull();
    expect(resolveLoginIdentity('   ')).toBeNull();
  });

  it('passes through unknown emails for Capella / SG login', () => {
    const id = resolveLoginIdentity('tech@capella.example');
    expect(id?.email).toBe('tech@capella.example');
    expect(id?.username).toBe('tech');
    expect(id?.employeeId).toBe('tech@capella.example');
  });
});
