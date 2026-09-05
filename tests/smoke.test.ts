import { theme } from '../src/theme';
import { buildDemoSession, sessionIsLive } from '../src/session/strategy';

describe('theme', () => {
  it('exposes required color tokens', () => {
    expect(theme.color.bg).toBeTruthy();
    expect(theme.color.accent).toBeTruthy();
    expect(theme.color.danger).toBeTruthy();
    expect(theme.space.lg).toBe(16);
    expect(theme.type.title).toBe(22);
  });
});

describe('demo login helper', () => {
  it('rejects a blank identifier', () => {
    const result = buildDemoSession('   ', 1_700_000_000);
    expect(result.ok).toBe(false);
  });

  it('builds a live session', () => {
    const now = 1_700_000_000;
    const result = buildDemoSession('jon.hale@example.com', now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.username).toBe('jon.hale@example.com');
    expect(result.session.strategy).toBe('demo');
    expect(sessionIsLive(result.session.sessionExpiresAt, now)).toBe(true);
  });
});
