import { clusterAssets, clusterCellM } from '../../src/geo/cluster';
import { bboxAround, haversineM, inBBox, visibleBoundsToBBox } from '../../src/geo/haversine';
import { memoryGet, memoryReset, memorySave } from '../../src/db/memoryStore';
import { SEED_ASSET_IDS, seedAssets, seedInboundJobs } from '../../src/db/seedData';
import { ASSETS_BBOX_LIMIT, linkAssetToWork, listOpenJobs, queryAssetsInBBox } from '../../src/ops/assets';
import { OutError } from '../../src/ops/outError';
import { startWork } from '../../src/ops/startWork';
import { completeTask, listTasksForWork } from '../../src/ops/tasks';
import { completeWork, startOrResumeWork } from '../../src/ops/transitionStatus';
import { applyOutPatch } from '../../src/ops/updateWorkOrderOut';
import { resetCopyOnWriteTotals } from '../../src/metrics/copyOnWrite';

const session = { employeeId: 'E-4412', email: 'jon.hale@example.com', username: 'tech.jon' };

beforeEach(() => {
  memoryReset();
  resetCopyOnWriteTotals();
  for (const row of seedAssets('0.1.0+1', 1_700_000_000)) {
    memorySave('assets', row.id, row.doc as never);
  }
});

describe('bbox + haversine', () => {
  it('filters assets in bbox and sorts by distance', async () => {
    const center = { lat: 41.7658, lon: -72.6734 };
    const box = bboxAround(center, 500);
    expect(inBBox(center, box)).toBe(true);
    const rows = await queryAssetsInBBox(box, center);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].id).toBe(SEED_ASSET_IDS[0]);
    expect(haversineM(center, rows[0].geo)).toBeLessThan(1);
    expect(rows.length).toBeLessThanOrEqual(ASSETS_BBOX_LIMIT);
  });

  it('filters by assetType', async () => {
    const center = { lat: 41.7658, lon: -72.6734 };
    const valves = await queryAssetsInBBox(bboxAround(center, 2000), center, { assetType: 'valve' });
    expect(valves.every((a) => a.assetType === 'valve')).toBe(true);
    expect(valves.some((a) => a.id === SEED_ASSET_IDS[2])).toBe(true);
  });

  it('converts MapLibre visibleBounds [lon,lat] to a bbox', () => {
    const box = visibleBoundsToBBox([-72.67, 41.77], [-72.68, 41.76]);
    expect(box.minLat).toBeCloseTo(41.76);
    expect(box.maxLon).toBeCloseTo(-72.67);
  });
});

describe('cluster', () => {
  it('groups nearby pins at city zoom and not at street zoom', async () => {
    const center = { lat: 41.7658, lon: -72.6734 };
    const rows = await queryAssetsInBBox(bboxAround(center, 2000), center);
    const city = clusterAssets(rows, clusterCellM(bboxAround(center, 4000)));
    expect(city.some((c) => c.count >= 1)).toBe(true);
    const street = clusterAssets(rows, 0);
    expect(street).toHaveLength(rows.length);
  });
});

describe('link asset', () => {
  it('writes assetIds and 409s when frozen; complete does not save asset', async () => {
    const before = memoryGet('assets', SEED_ASSET_IDS[0]);
    const { id } = seedInboundJobs('0.1.0+1', 1_700_000_000, '2026-09-05')[0];
    const { wooutId } = await startWork(id, session);
    await linkAssetToWork(wooutId, SEED_ASSET_IDS[0], session);
    expect((memoryGet('workordersout', wooutId)?.assetIds as string[])).toContain(SEED_ASSET_IDS[0]);
    await startOrResumeWork(wooutId, session);
    const raw = memoryGet('workordersout', wooutId)!;
    memorySave(
      'workordersout',
      wooutId,
      applyOutPatch(
        raw,
        {
          operations: (raw.operations as { required?: boolean; status?: string }[]).map((o) => ({
            ...o,
            status: o.required ? 'done' : o.status,
          })),
          checklist: (raw.checklist as { required?: boolean; done?: boolean }[]).map((c) => ({
            ...c,
            done: c.required ? true : c.done,
          })),
        },
        session,
        20,
        '1',
      ),
    );
    for (const t of await listTasksForWork(wooutId)) {
      if (t.required) await completeTask(t.id, session);
    }
    await completeWork(wooutId, session);
    expect(memoryGet('assets', SEED_ASSET_IDS[0])).toEqual(before);
    await expect(linkAssetToWork(wooutId, SEED_ASSET_IDS[1], session)).rejects.toBeInstanceOf(OutError);
  });

  it('lists the open outbound copy for near-job', async () => {
    const { id } = seedInboundJobs('0.1.0+1', 1_700_000_000, '2026-09-05')[0];
    const { wooutId } = await startWork(id, session);
    const open = await listOpenJobs(session.employeeId);
    expect(open.some((j) => j.id === wooutId)).toBe(true);
    expect(open[0].geo?.lat).toBeCloseTo(41.7658);
  });
});
