import { nowSec, stampAuditUpdate, stampHistory } from '../audit';
import { log } from '../log/logger';
import { recordMetric } from '../metrics';
import { appVersion } from '../version';
import { scheduleCompactSoon } from './compactDb';
import type { StartSession } from './copyInbound';
import { OutError } from './outError';
import { loadChild, saveChild } from './childStore';
import { loadOutboundRaw, saveOutboundRaw } from './outboundStore';
import { isOrderFrozen } from './orders';
import {
  applyCommitPhoto,
  applyDeletePhoto,
  assertCanCommitPhoto,
  newPhotoId,
  photoBlobKeys,
  photoList,
  type PhotoKind,
  type PhotoMeta,
} from './photoKeys';
import { buildPhotoStageTmp, loadTmp, newTmpId, purgeTmp, saveTmp, tmpIsExpired } from './tmp';

export { PHOTO_CAP, PHOTO_LONG_EDGE, PHOTO_THUMB_EDGE, PHOTO_JPEG_QUALITY } from './photoKeys';
export type { PhotoKind, PhotoMeta };

async function loadPhotoTarget(
  collection: 'workordersout' | 'orders',
  id: string,
): Promise<Record<string, unknown> | null> {
  if (collection === 'workordersout') return loadOutboundRaw(id);
  return loadChild('orders', id);
}

async function savePhotoTarget(
  collection: 'workordersout' | 'orders',
  id: string,
  body: Record<string, unknown>,
): Promise<void> {
  if (collection === 'workordersout') {
    await saveOutboundRaw(id, body);
    return;
  }
  await saveChild('orders', id, body);
}

function assertPhotoWritable(collection: 'workordersout' | 'orders', doc: Record<string, unknown>): void {
  if (collection === 'orders') {
    if (String(doc.role) === 'inbound') throw new OutError('frozen', 'never mutate inbound');
    if (isOrderFrozen(doc)) throw new OutError('frozen');
  }
  assertCanCommitPhoto(doc);
}

export async function stagePhotoOn(
  target: { collection: 'workordersout' | 'orders'; id: string },
  localUri: string,
  session: StartSession,
): Promise<string> {
  const doc = await loadPhotoTarget(target.collection, target.id);
  if (!doc) throw new OutError('missing');
  assertPhotoWritable(target.collection, doc);
  const dt = nowSec();
  const tmpId = newTmpId();
  const body = buildPhotoStageTmp({
    tmpId,
    wooutId: target.collection === 'workordersout' ? target.id : undefined,
    orderId: target.collection === 'orders' ? target.id : undefined,
    localUri,
    session,
    dt,
    ver: appVersion(),
  });
  await saveTmp(tmpId, body);
  return tmpId;
}

export async function stagePhoto(
  wooutId: string,
  localUri: string,
  session: StartSession,
): Promise<string> {
  return stagePhotoOn({ collection: 'workordersout', id: wooutId }, localUri, session);
}

export async function commitPhotoOn(
  target: { collection: 'workordersout' | 'orders'; id: string },
  tmpId: string,
  session: StartSession,
  meta: { kind?: PhotoKind; caption?: string; byteLength?: number },
): Promise<PhotoMeta> {
  const out = await loadPhotoTarget(target.collection, target.id);
  if (!out) throw new OutError('missing');
  if (target.collection === 'orders' && String(out.role) === 'inbound') {
    throw new OutError('frozen', 'never mutate inbound');
  }
  const tmp = await loadTmp(tmpId);
  if (!tmp || tmpIsExpired(tmp, nowSec())) throw new OutError('tmp_missing');
  const photoId = newPhotoId();
  const keys = photoBlobKeys(photoId);
  const row: PhotoMeta = {
    id: photoId,
    kind: meta.kind ?? 'during',
    caption: meta.caption,
    contentType: 'image/jpeg',
    byteLength: meta.byteLength ?? 0,
    capturedAt: nowSec(),
    blobKey: keys.blobKey,
    thumbKey: keys.thumbKey,
    localUri: String(tmp.localUri ?? ''),
  };
  let next = applyCommitPhoto(out, row);
  next = stampAuditUpdate(next as never, { by: session.username, ver: appVersion(), dt: nowSec() });
  next = stampHistory(next as never, {
    op: 'CommitPhoto',
    by: session.username,
    ver: appVersion(),
    dt: nowSec(),
    changes: [{ path: 'photos', to: photoId }],
  });
  delete next.embedding;
  await savePhotoTarget(target.collection, target.id, next);
  await purgeTmp(tmpId);
  recordMetric('mfs_blob_bytes_total', row.byteLength, { op: 'commit' });
  recordMetric('mfs_photo_commit_total', 1, { kind: row.kind });
  log.info('mfs.blob.commit', { op: 'CommitPhoto', docId: target.id, byteLength: row.byteLength });
  return row;
}

export async function commitPhoto(
  wooutId: string,
  tmpId: string,
  session: StartSession,
  meta: { kind?: PhotoKind; caption?: string; byteLength?: number },
): Promise<PhotoMeta> {
  return commitPhotoOn({ collection: 'workordersout', id: wooutId }, tmpId, session, meta);
}

export async function deletePhoto(wooutId: string, photoId: string, session: StartSession): Promise<void> {
  const out = await loadOutboundRaw(wooutId);
  if (!out) throw new OutError('missing');
  let next = applyDeletePhoto(out, photoId);
  next = stampAuditUpdate(next as never, { by: session.username, ver: appVersion(), dt: nowSec() });
  next = stampHistory(next as never, {
    op: 'DeletePhoto',
    by: session.username,
    ver: appVersion(),
    dt: nowSec(),
    changes: [{ path: 'photos', from: photoId }],
  });
  await saveOutboundRaw(wooutId, next);
  recordMetric('mfs_blob_bytes_total', 0, { op: 'delete' });
  scheduleCompactSoon();
}

export function photosFromDoc(doc: Record<string, unknown>): PhotoMeta[] {
  return photoList(doc);
}
