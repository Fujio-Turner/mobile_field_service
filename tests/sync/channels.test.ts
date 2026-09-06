import { FIELD_COLLECTIONS } from '../../src/db/collections';
import {
  applyChannelsToAll,
  emptyChannelMap,
  envGlobalChannels,
  filteredCollectionCount,
  formatChannels,
  normalizeChannels,
  parseChannelMap,
  resolveCollectionChannels,
  shouldSetChannels,
  snapshotChannelMap,
} from '../../src/sync/channels';
import { collectionConfigFor } from '../../src/sync/replicator';
import { neverPushFilter } from '../../src/sync/filters';

describe('normalizeChannels', () => {
  it('defaults to an empty list', () => {
    expect(normalizeChannels(undefined)).toEqual([]);
    expect(normalizeChannels(null)).toEqual([]);
    expect(normalizeChannels('')).toEqual([]);
    expect(normalizeChannels([])).toEqual([]);
    expect(shouldSetChannels([])).toBe(false);
  });

  it('splits comma lists and de-dupes', () => {
    expect(normalizeChannels(' emp:E-4412, public, emp:E-4412 ')).toEqual(['emp:E-4412', 'public']);
    expect(formatChannels(['emp:E-4412', 'public'])).toBe('emp:E-4412, public');
  });
});

describe('resolveCollectionChannels', () => {
  it('uses stored empty over env (cleared filters)', () => {
    expect(resolveCollectionChannels('workordersin', { workordersin: [] }, ['public'])).toEqual([]);
  });

  it('falls back to env when nothing stored', () => {
    expect(resolveCollectionChannels('assets', null, ['district:hartford'])).toEqual(['district:hartford']);
  });

  it('never filters tmp', () => {
    expect(resolveCollectionChannels('tmp', { tmp: ['emp:E-4412'] } as never, ['public'])).toEqual([]);
  });
});

describe('parseChannelMap', () => {
  it('keeps only replicator collections', () => {
    const map = parseChannelMap(
      JSON.stringify({ workordersin: ['emp:E-4412'], tmp: ['nope'], junk: ['x'] }),
    );
    expect(map?.workordersin).toEqual(['emp:E-4412']);
    expect(map && 'tmp' in map).toBe(false);
    expect(map && 'junk' in map).toBe(false);
  });

  it('emptyChannelMap is fourteen empty arrays', () => {
    const empty = emptyChannelMap();
    expect(Object.keys(empty)).toHaveLength(FIELD_COLLECTIONS.length);
    expect(filteredCollectionCount(snapshotChannelMap(empty))).toBe(0);
    const all = applyChannelsToAll(['emp:E-4412']);
    expect(all.tracking).toEqual(['emp:E-4412']);
    expect(filteredCollectionCount(snapshotChannelMap(all))).toBe(14);
  });
});

describe('collectionConfigFor', () => {
  it('does not setChannels when the list is empty', () => {
    const setCalls: string[][] = [];
    const CollectionConfig = class {
      constructor(public channels: string[] | null) {}
      setPushFilter() {}
      setChannels(ch: string[]) {
        setCalls.push(ch);
      }
    };
    const cc = collectionConfigFor({ CollectionConfig: CollectionConfig as never }, {}, neverPushFilter, []);
    expect(cc).toBeTruthy();
    expect((cc as { channels: string[] | null }).channels).toBeNull();
    expect(setCalls).toEqual([]);
  });

  it('passes a channel array when set', () => {
    const setCalls: string[][] = [];
    const CollectionConfig = class {
      constructor(public channels: string[] | null) {}
      setPushFilter() {}
      setChannels(ch: string[]) {
        setCalls.push(ch);
      }
    };
    collectionConfigFor({ CollectionConfig: CollectionConfig as never }, {}, neverPushFilter, ['emp:E-4412']);
    expect(setCalls).toEqual([['emp:E-4412']]);
  });
});

describe('envGlobalChannels', () => {
  const prev = process.env.EXPO_PUBLIC_SG_CHANNELS;
  afterEach(() => {
    if (prev == null) delete process.env.EXPO_PUBLIC_SG_CHANNELS;
    else process.env.EXPO_PUBLIC_SG_CHANNELS = prev;
  });

  it('is empty by default', () => {
    delete process.env.EXPO_PUBLIC_SG_CHANNELS;
    expect(envGlobalChannels()).toEqual([]);
  });
});
