import { authStrategy, sessionIsLive } from '../../src/session/strategy';

describe('sessionIsLive', () => {
  it('treats expiry within skew as dead', () => {
    expect(sessionIsLive(1000, 980, 30)).toBe(false);
    expect(sessionIsLive(1000, 900, 30)).toBe(true);
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
