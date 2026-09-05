import { metricSnapshot, recordMetric, resetMetrics, timeQuery } from '../../src/metrics';
import { bumpCopyOnWrite, resetCopyOnWriteTotals } from '../../src/metrics/copyOnWrite';

beforeEach(() => {
  resetMetrics();
  resetCopyOnWriteTotals();
});

describe('metrics', () => {
  it('records query latency and copy-on-write snapshot', async () => {
    bumpCopyOnWrite('created');
    const value = await timeQuery('today', async () => 7);
    expect(value).toBe(7);
    recordMetric('mfs_blob_bytes_total', 4000, { op: 'commit' });
    const snap = metricSnapshot();
    expect(snap.copyOnWrite.created).toBe(1);
    expect(snap.copyOnWrite.idempotent_hit).toBe(0);
    const latency = snap.samples.find((s) => s.name === 'mfs_query_latency_ms');
    expect(latency?.labels).toEqual({ query: 'today' });
    expect(typeof latency?.value).toBe('number');
    expect(snap.samples.some((s) => s.name === 'mfs_blob_bytes_total' && s.labels?.op === 'commit')).toBe(true);
  });
});
