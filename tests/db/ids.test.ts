import {
  dbNameForUser,
  encodeUlid,
  newDocId,
  trackingDocId,
  deviceLocalDay,
  ulid,
} from '../../src/ids';

describe('ulid', () => {
  it('is 26 Crockford characters', () => {
    const id = encodeUlid(1_700_000_000_000, new Uint8Array(10).fill(1));
    expect(id).toHaveLength(26);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('sorts by time', () => {
    const rand = new Uint8Array(10).fill(7);
    const a = encodeUlid(1, rand);
    const b = encodeUlid(2, rand);
    expect(a < b).toBe(true);
  });

  it('newDocId prefixes', () => {
    expect(newDocId('woin', '01AAAAAAAAAAAAAAAAAAAAAAAA')).toBe('woin:01AAAAAAAAAAAAAAAAAAAAAAAA');
    expect(() => newDocId('track')).toThrow(/trackingDocId/);
  });
});

describe('trackingDocId', () => {
  it('is track:day:employeeId', () => {
    expect(trackingDocId('2026-01-15', 'E-4412')).toBe('track:2026-01-15:E-4412');
  });

  it('rejects colons in employeeId and bad days', () => {
    expect(() => trackingDocId('2026-01-15', 'E:4412')).toThrow(/colon/i);
    expect(() => trackingDocId('01-15', 'E-4412')).toThrow(/YYYY-MM-DD/);
  });
});

describe('dbNameForUser', () => {
  it('uses employeeId not punctuation-only strip', () => {
    const hex = 'abcdef0123456789';
    expect(dbNameForUser('E-4412', hex)).toBe('mfs_E-4412_abcdef01');
    expect(dbNameForUser('tech.jon', hex)).toBe('mfs_tech_jon_abcdef01');
  });
});

describe('deviceLocalDay', () => {
  it('formats YYYY-MM-DD', () => {
    expect(deviceLocalDay(new Date(2026, 0, 15, 12))).toBe('2026-01-15');
  });
});

describe('ulid random default', () => {
  it('returns 26 chars', () => {
    expect(ulid().length).toBe(26);
  });
});
