import {
  parseSessionExpires,
  sessionEndpoint,
  acceptSelfSigned,
  basicAuthHeader,
  fetchWithTimeout,
  mintSgSession,
  mintedFromPublicSession,
} from '../../src/session/sgSession';

describe('sessionEndpoint', () => {
  it('maps wss db URL to https _session', () => {
    expect(sessionEndpoint('wss://sg.example:4984/mfs', 'mfs')).toBe('https://sg.example:4984/mfs/_session');
    expect(sessionEndpoint('wss://host.apps.cloud.couchbase.com:4984/test', 'test')).toBe(
      'https://host.apps.cloud.couchbase.com:4984/test/_session',
    );
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

describe('mintedFromPublicSession', () => {
  it('reads Admin session_id', () => {
    const minted = mintedFromPublicSession({ session_id: 'sess-1', cookie_name: 'SyncGatewaySession' }, undefined, 0);
    expect(minted?.sessionId).toBe('sess-1');
  });

  it('reads Public API ok + Set-Cookie', () => {
    const headers = { get: (n: string) => (n === 'set-cookie' ? 'SyncGatewaySession=abc123; Path=/test; HttpOnly' : null) } as unknown as Headers;
    const minted = mintedFromPublicSession({ ok: true, userCtx: { name: 'a' } }, headers, 0);
    expect(minted?.sessionId).toBe('abc123');
    expect(minted?.cookieName).toBe('SyncGatewaySession');
  });

  it('accepts Public API ok when JS cannot see the cookie', () => {
    const minted = mintedFromPublicSession({ ok: true }, undefined, 0);
    expect(minted?.sessionId).toBe('public');
  });
});

describe('mintSgSession', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps an aborted POST to a timeout message', async () => {
    global.fetch = jest.fn(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }) as unknown as typeof fetch;
    const result = await mintSgSession({
      identifier: 'a@b.c',
      password: 'x',
      sgUrl: 'wss://sg.example:4984/mfs',
      nowSec: 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/timed out/i);
  });
});

describe('fetchWithTimeout', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('aborts after the deadline', async () => {
    global.fetch = jest.fn((_url: string, init?: RequestInit) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }) as unknown as typeof fetch;
    await expect(fetchWithTimeout('https://example.test', { method: 'POST' }, 20)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
