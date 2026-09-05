import { memoryReset, memorySave } from '../../src/db/memoryStore';
import { seedAssets, seedProductsRatesTaxes } from '../../src/db/seedData';
import { resetMetrics, metricSnapshot } from '../../src/metrics';
import { resetCopyOnWriteTotals } from '../../src/metrics/copyOnWrite';
import { createNote } from '../../src/ops/notes';
import { ftsSearch, memoryAssetNameHay } from '../../src/ops/ftsSearch';

const session = { employeeId: 'E-4412', email: 'jon.hale@example.com', username: 'tech.jon' };

beforeEach(() => {
  memoryReset();
  resetCopyOnWriteTotals();
  resetMetrics();
  for (const row of seedAssets('0.1.0+1', 1_700_000_000)) memorySave('assets', row.id, row.doc as never);
  for (const row of seedProductsRatesTaxes('0.1.0+1', 1_700_000_000).products) {
    memorySave('products', row.id, row.doc as never);
  }
});

describe('ftsSearch memory fallback', () => {
  it('returns [] for blank query', async () => {
    expect(await ftsSearch('')).toEqual([]);
    expect(await ftsSearch('   ')).toEqual([]);
  });

  it('hits products, assets, and notes without native MATCH', async () => {
    const noteId = await createNote(session, { body: 'Dog in yard after 16:00', kind: 'general', title: 'Access' });
    const valve = await ftsSearch('valve');
    expect(valve.some((h) => h.kind === 'product' && h.sub === 'VLV-CHK-4')).toBe(true);
    expect(valve.some((h) => h.kind === 'asset' && /valve/i.test(h.title))).toBe(true);

    const dogs = await ftsSearch('dog');
    expect(dogs.some((h) => h.kind === 'note' && h.id === noteId)).toBe(true);

    expect(memoryAssetNameHay({ name: 'Valve station M-7', code: 'M-7', assetType: 'valve' })).toMatch(/valve/i);

    const snap = metricSnapshot();
    expect(snap.samples.some((s) => s.name === 'mfs_query_latency_ms' && s.labels?.query === 'fts')).toBe(true);
  });
});
