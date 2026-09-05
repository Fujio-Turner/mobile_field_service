import {
  parseSessionExpires,
  sessionEndpoint,
  acceptSelfSigned,
  basicAuthHeader,
} from '../../src/session/sgSession';

describe('sessionEndpoint', () => {
  it('maps wss db URL to https _session', () => {
    expect(sessionEndpoint('wss://sg.example:4984/mfs', 'mfs')).toBe('https://sg.example:4984/mfs/_session');
    expect(sessionEndpoint('ws://localhost:4984', 'mfs')).toBe('http://localhost:4984/mfs/_session');
    expect(sessionEndpoint('https://sg.example:4984/mfs/_session', 'mfs')).toBe(
      'https://sg.example:4984/mfs/_session',
    );
  });
});

describe('parseSessionExpires', () => {
  it('parses ISO and unix seconds', () => {
    expect(parseSessionExpires('2026-09-04T18:00:00.000Z', 0)).toBe(Date.parse('2026-09-04T18:00:00.000Z') / 1000);
    expect(parseSessionExpires(1_700_000_000, 0)).toBe(1_700_000_000);
    expect(parseSessionExpires(1_700_000_000_000, 0)).toBe(1_700_000_000);
    expect(parseSessionExpires(undefined, 100)).toBe(100 + 24 * 3600);
  });
});

describe('lab TLS', () => {
  it('allows self-signed on ws://', () => {
    expect(acceptSelfSigned('ws://localhost:4984/mfs')).toBe(true);
    expect(acceptSelfSigned('wss://sg.example:4984/mfs')).toBe(false);
  });

  it('builds Basic header without logging', () => {
    expect(basicAuthHeader('a', 'b')).toMatch(/^Basic /);
  });
});
