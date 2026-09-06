import {
  classifyReplError,
  extractErrorCode,
  isAuthFailureCode,
  isDocumentAuthFailure,
  metricErrorCode,
} from '../../src/sync/codes';

describe('classifyReplError', () => {
  it('maps common HTTP and CBL codes', () => {
    expect(classifyReplError(401)).toBe('auth');
    expect(classifyReplError(10401)).toBe('auth');
    expect(classifyReplError(403)).toBe('forbidden');
    expect(classifyReplError(404)).toBe('not_found');
    expect(classifyReplError(409)).toBe('conflict');
    expect(classifyReplError(413)).toBe('payload');
    expect(classifyReplError(408)).toBe('timeout');
    expect(classifyReplError(429)).toBe('rate_limit');
    expect(classifyReplError(500)).toBe('transient');
    expect(classifyReplError(503)).toBe('transient');
    expect(classifyReplError(400)).toBe('client');
    expect(classifyReplError(5011)).toBe('tls');
  });

  it('replicator 404 is fatal; document 409 is not auth', () => {
    expect(isAuthFailureCode(404)).toBe(true);
    expect(isAuthFailureCode(409)).toBe(false);
    expect(isDocumentAuthFailure(404)).toBe(false);
    expect(isDocumentAuthFailure(401)).toBe(true);
  });

  it('extracts codes from strings and objects', () => {
    expect(extractErrorCode(409)).toBe(409);
    expect(extractErrorCode('HTTP 409 Conflict')).toBe(409);
    expect(extractErrorCode({ code: 404 })).toBe(404);
    expect(extractErrorCode({ getCode: () => 401 })).toBe(401);
    expect(metricErrorCode(409)).toBe('409');
  });
});
