import { authStrategy, buildDemoSession, sessionIsLive } from '../../src/session/strategy';

describe('sessionIsLive', () => {
  it('treats expiry within skew as dead', () => {
    expect(sessionIsLive(1000, 980, 30)).toBe(false);
    expect(sessionIsLive(1000, 900, 30)).toBe(true);
  });
});

describe('buildDemoSession', () => {
  it('maps Maya and Priya; unknown emails keep assets workModes', () => {
    const maya = buildDemoSession('maya.chen@example.com', 1);
    const priya = buildDemoSession('priya.shah@example.com', 1);
    const other = buildDemoSession('anyone@example.com', 1);
    expect(maya.ok && maya.session.employeeId).toBe('E-7703');
    expect(maya.ok && maya.session.workModes).toEqual(['customer']);
    expect(priya.ok && priya.session.employeeId).toBe('E-8801');
    expect(priya.ok && priya.session.workModes).toEqual(['sales']);
    expect(other.ok && other.session.employeeId).toBe('anyone@example.com');
    expect(other.ok && other.session.workModes).toEqual(['assets']);
  });
});

describe('authStrategy', () => {
  it('falls back to basic when env is missing or unknown', () => {
    const prev = process.env.EXPO_PUBLIC_AUTH_STRATEGY;
    delete process.env.EXPO_PUBLIC_AUTH_STRATEGY;
    expect(authStrategy()).toBe('basic');
    process.env.EXPO_PUBLIC_AUTH_STRATEGY = 'nope';
    expect(authStrategy()).toBe('basic');
    if (prev === undefined) delete process.env.EXPO_PUBLIC_AUTH_STRATEGY;
    else process.env.EXPO_PUBLIC_AUTH_STRATEGY = prev;
  });
});
