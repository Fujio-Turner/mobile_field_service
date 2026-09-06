import { loginRemoteBasic } from '../../src/session/loginRemote';

describe('loginRemoteBasic', () => {
  const sgUrl = 'wss://sg.example:4984/mfs';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mints a session without putting the password on the Session', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        session_id: 'sess-1',
        cookie_name: 'SyncGatewaySession',
        expires: '2026-09-05T00:00:00.000Z',
      }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const result = await loginRemoteBasic('jon.hale@example.com', 'secret', 1_700_000_000, sgUrl);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.sessionId).toBe('sess-1');
    expect(result.session.employeeId).toBe('E-4412');
    expect(JSON.stringify(result.session)).not.toMatch(/secret/);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://sg.example:4984/mfs/_session',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('maps 401 to wrong-password copy', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const result = await loginRemoteBasic('jon.hale@example.com', 'nope', 1, sgUrl);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Wrong email or password/);
  });
});
