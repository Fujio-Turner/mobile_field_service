import { memoryReset, memorySave } from '../../src/db/memoryStore';
import { collectionCounts } from '../../src/ops/collectionCounts';
import { formatEpoch, runtimeVersions } from '../../src/ops/runtimeVersions';
import { syncSnapshot } from '../../src/ops/syncSnapshot';
import { resetReplicatorTestState } from '../../src/sync/replicator';

beforeEach(() => {
  memoryReset();
  resetReplicatorTestState();
});

describe('collectionCounts', () => {
  it('counts memory docs per field collection and tmp', async () => {
    memorySave('workordersin', 'woin:1', { type: 'workorderin' });
    memorySave('workordersin', 'woin:2', { type: 'workorderin' });
    memorySave('tmp', 'tmp:a', { type: 'tmp' });
    const rows = await collectionCounts();
    const woin = rows.find((r) => r.name === 'workordersin');
    const tmp = rows.find((r) => r.name === 'tmp');
    expect(woin?.count).toBe(2);
    expect(woin?.replicated).toBe(true);
    expect(tmp?.count).toBe(1);
    expect(tmp?.replicated).toBe(false);
    expect(tmp?.scope).toBe('local');
    expect(rows).toHaveLength(15);
  });
});

describe('runtimeVersions', () => {
  it('reports app version without hard-coding', () => {
    const v = runtimeVersions();
    expect(v.app).toMatch(/\+/);
    expect(v.cblNative === 'linked' || v.cblNative === 'missing').toBe(true);
    expect(v.os).toBeTruthy();
  });

  it('formats missing epoch as never', () => {
    expect(formatEpoch(undefined)).toBe('never');
    expect(formatEpoch(0)).toBe('never');
  });
});

describe('syncSnapshot channels', () => {
  it('defaults to no client channel filters', () => {
    const snap = syncSnapshot();
    expect(snap.channelFilterCollections).toBe(0);
    expect(snap.channels.workordersin).toEqual([]);
    expect(snap.replicatorUrl).toBeTruthy();
    expect(snap.tmpExcluded).toBe(true);
  });
});
