import { memoryGet, memoryReset } from '../../src/db/memoryStore';
import { tmpExpiryDate, TMP_TTL_MS } from '../../src/db/tmp';
import { seedInboundJobs } from '../../src/db/seedData';
import { resetCopyOnWriteTotals } from '../../src/metrics/copyOnWrite';
import {
  applyCommitPhoto,
  applyDeletePhoto,
  blobKeysAreTopLevel,
  PHOTO_CAP,
  photoBlobKeys,
} from '../../src/ops/photoKeys';
import { clearCompactSchedule, compactIsScheduled } from '../../src/ops/compactDb';
import { commitPhoto, deletePhoto, stagePhoto } from '../../src/ops/photos';
import { OutError } from '../../src/ops/outError';
import { startWork } from '../../src/ops/startWork';
import { completeTask, listTasksForWork } from '../../src/ops/tasks';
import { completeWork, startOrResumeWork } from '../../src/ops/transitionStatus';
import { applyOutPatch } from '../../src/ops/updateWorkOrderOut';

const session = {
  employeeId: 'E-4412',
  email: 'jon.hale@example.com',
  username: 'tech.jon',
};

beforeEach(() => {
  memoryReset();
  resetCopyOnWriteTotals();
  clearCompactSchedule();
});

afterEach(() => {
  clearCompactSchedule();
});

function meta(i: number) {
  const id = `ph_${String(i).padStart(26, 'A')}`;
  const keys = photoBlobKeys(id);
  return {
    id,
    kind: 'during' as const,
    contentType: 'image/jpeg' as const,
    byteLength: 100,
    capturedAt: 1,
    blobKey: keys.blobKey,
    thumbKey: keys.thumbKey,
  };
}

describe('photo keys', () => {
  it('uses top-level photo: keys, not array paths', () => {
    const keys = photoBlobKeys('ph_01AAAAAAAAAAAAAAAAAAAAAAAA');
    expect(keys.blobKey).toBe('photo:ph_01AAAAAAAAAAAAAAAAAAAAAAAA');
    expect(keys.thumbKey).toBe('photo:ph_01AAAAAAAAAAAAAAAAAAAAAAAA:thumb');
    expect(blobKeysAreTopLevel({ ...meta(1), ...keys, id: 'ph_01AAAAAAAAAAAAAAAAAAAAAAAA' })).toBe(true);
  });

  it('rejects a colon inside photoId', () => {
    expect(() => photoBlobKeys('ph:bad')).toThrow(/colon/);
  });
});

describe('commit rules', () => {
  it('caps at 20', () => {
    const photos = Array.from({ length: PHOTO_CAP }, (_, i) => meta(i));
    const doc = { status: 'in_progress', owner: 'technician', photos };
    expect(() => applyCommitPhoto(doc, meta(99))).toThrow(OutError);
    try {
      applyCommitPhoto(doc, meta(99));
    } catch (e) {
      expect((e as OutError).code).toBe('photo_cap');
    }
  });

  it('409s when frozen', () => {
    const doc = { status: 'complete', owner: 'backend', photos: [] };
    expect(() => applyCommitPhoto(doc, meta(1))).toThrow(OutError);
    expect(() => applyDeletePhoto(doc, 'ph_x')).toThrow(OutError);
  });

  it('does not write embedding.clip512', () => {
    const next = applyCommitPhoto({ status: 'assigned', owner: 'technician', photos: [], embedding: { clip512: [] } }, meta(1));
    expect(next.embedding).toBeUndefined();
    expect(next.photos).toHaveLength(1);
  });
});

describe('stage and commit', () => {
  it('stages tmp then commits onto the outbound copy', async () => {
    const { id } = seedInboundJobs('0.1.0+1', 1_700_000_000, '2026-09-05')[0];
    const { wooutId } = await startWork(id, session);
    const tmpId = await stagePhoto(wooutId, 'file://cache/a.jpg', session);
    expect(memoryGet('tmp', tmpId)?.kind).toBe('photo_stage');
    const row = await commitPhoto(wooutId, tmpId, session, { byteLength: 4000 });
    expect(memoryGet('tmp', tmpId)).toBeNull();
    const out = memoryGet('workordersout', wooutId)!;
    expect((out.photos as { id: string }[])[0].id).toBe(row.id);
    expect(out.embedding).toBeUndefined();
    expect(compactIsScheduled()).toBe(false);
    await deletePhoto(wooutId, row.id, session);
    expect(compactIsScheduled()).toBe(true);
  });
});

describe('tmp ttl', () => {
  it('is 24 hours', () => {
    expect(tmpExpiryDate(0).getTime()).toBe(TMP_TTL_MS);
  });
});

describe('frozen job cannot stage via commit path', () => {
  it('complete then commit fails', async () => {
    const { id } = seedInboundJobs('0.1.0+1', 1_700_000_000, '2026-09-05')[0];
    const { wooutId } = await startWork(id, session);
    await startOrResumeWork(wooutId, session);
    const raw = memoryGet('workordersout', wooutId)!;
    const operations = (raw.operations as { required?: boolean; status?: string }[]).map((o) => ({
      ...o,
      status: o.required ? 'done' : o.status,
    }));
    const checklist = (raw.checklist as { required?: boolean; done?: boolean }[]).map((c) => ({
      ...c,
      done: c.required ? true : c.done,
    }));
    const { memorySave } = require('../../src/db/memoryStore') as typeof import('../../src/db/memoryStore');
    memorySave('workordersout', wooutId, applyOutPatch(raw, { operations, checklist }, session, 20, '1'));
    for (const t of await listTasksForWork(wooutId)) {
      if (t.required && t.status !== 'done') await completeTask(t.id, session);
    }
    await completeWork(wooutId, session);
    await expect(stagePhoto(wooutId, 'file://x.jpg', session)).rejects.toBeInstanceOf(OutError);
  });
});
