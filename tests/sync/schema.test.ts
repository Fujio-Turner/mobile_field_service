import {
  allReplicatorCollections,
  oneshotBootstrapCollections,
  oneshotCollectionsFor,
  parseOneshotIntervalSec,
  parseReplSchema,
  shouldRunOneshot,
} from '../../src/sync/schema';

describe('parseReplSchema', () => {
  it('defaults to simple', () => {
    expect(parseReplSchema(undefined)).toBe('simple');
    expect(parseReplSchema('')).toBe('simple');
    expect(parseReplSchema('SIMPLE')).toBe('simple');
  });

  it('accepts oneshot aliases', () => {
    expect(parseReplSchema('oneshot')).toBe('oneshot');
    expect(parseReplSchema('one-shot')).toBe('oneshot');
    expect(parseReplSchema('scheduled')).toBe('oneshot');
  });

  it('floors interval at 30s and defaults to 300', () => {
    expect(parseOneshotIntervalSec(undefined)).toBe(300);
    expect(parseOneshotIntervalSec('5')).toBe(30);
    expect(parseOneshotIntervalSec('120')).toBe(120);
  });
});

describe('oneshot collections', () => {
  it('bootstrap is workordersin + orders and never tmp', () => {
    expect(oneshotBootstrapCollections()).toEqual(['workordersin', 'orders']);
    expect(oneshotCollectionsFor(false)).toEqual(['workordersin', 'orders']);
    expect(oneshotCollectionsFor(true)).toEqual(allReplicatorCollections());
    expect(oneshotCollectionsFor(true).includes('tmp')).toBe(false);
    expect(oneshotCollectionsFor(true)).toHaveLength(14);
  });
});

describe('shouldRunOneshot', () => {
  const base = {
    busy: false,
    bootstrapDone: true,
    now: 1_000,
    intervalSec: 300,
    reason: 'interval' as const,
  };

  it('skips when a shot is already running', () => {
    expect(shouldRunOneshot({ ...base, busy: true })).toBe(false);
  });

  it('skips interval until bootstrap finished', () => {
    expect(shouldRunOneshot({ ...base, bootstrapDone: false, reason: 'interval' })).toBe(false);
    expect(shouldRunOneshot({ ...base, bootstrapDone: false, reason: 'bootstrap' })).toBe(true);
  });

  it('skips interval inside the window', () => {
    expect(shouldRunOneshot({ ...base, lastAt: 800, now: 1_000 })).toBe(false);
    expect(shouldRunOneshot({ ...base, lastAt: 600, now: 1_000 })).toBe(true);
  });

  it('debounces foreground within 5s', () => {
    expect(
      shouldRunOneshot({ ...base, reason: 'foreground', lastAt: 997, now: 1_000 }),
    ).toBe(false);
    expect(
      shouldRunOneshot({ ...base, reason: 'foreground', lastAt: 990, now: 1_000 }),
    ).toBe(true);
  });
});
