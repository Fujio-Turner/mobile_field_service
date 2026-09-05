import { nowSec, stampAuditUpdate, stampHistory } from '../audit';
import { appVersion } from '../version';
import type { StartSession } from './copyInbound';
import { OutError } from './outError';
import { loadOutboundRaw, saveOutboundRaw } from './outboundStore';
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

export async function stagePhoto(
  wooutId: string,
  localUri: string,
  session: StartSession,
): Promise<string> {
  const out = await loadOutboundRaw(wooutId);
  if (!out) throw new OutError('missing');
  assertCanCommitPhoto(out);
  const dt = nowSec();
  const tmpId = newTmpId();
  const body = buildPhotoStageTmp({
    tmpId,
    wooutId,
    localUri,
    session,
    dt,
    ver: appVersion(),
  });
  await saveTmp(tmpId, body);
  return tmpId;
}

export async function commitPhoto(
  wooutId: string,
  tmpId: string,
  session: StartSession,
  meta: { kind?: PhotoKind; caption?: string; byteLength?: number },
): Promise<PhotoMeta> {
  const out = await loadOutboundRaw(wooutId);
  if (!out) throw new OutError('missing');
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
  await saveOutboundRaw(wooutId, next);
  await purgeTmp(tmpId);
  return row;
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
}

export function photosFromDoc(doc: Record<string, unknown>): PhotoMeta[] {
  return photoList(doc);
}
