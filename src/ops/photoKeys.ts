import { ulid } from '../ids';
import { OutError } from './outError';
import { isFrozen } from './outStatus';

export const PHOTO_CAP = 20;
export const PHOTO_LONG_EDGE = 1600;
export const PHOTO_THUMB_EDGE = 240;
export const PHOTO_JPEG_QUALITY = 0.7;

export type PhotoKind = 'before' | 'during' | 'after' | 'other';

export type PhotoMeta = {
  id: string;
  kind: PhotoKind;
  caption?: string;
  contentType: 'image/jpeg';
  byteLength: number;
  capturedAt: number;
  blobKey: string;
  thumbKey: string;
  localUri?: string;
};

export function newPhotoId(): string {
  return `ph_${ulid()}`;
}

export function photoBlobKeys(photoId: string): { blobKey: string; thumbKey: string } {
  if (photoId.includes(':')) throw new Error('photoId must not contain a colon');
  return { blobKey: `photo:${photoId}`, thumbKey: `photo:${photoId}:thumb` };
}

export function photoList(doc: Record<string, unknown>): PhotoMeta[] {
  if (!Array.isArray(doc.photos)) return [];
  return doc.photos as PhotoMeta[];
}

export function assertCanCommitPhoto(doc: Record<string, unknown>): void {
  if (isFrozen(doc)) throw new OutError('frozen');
  if (photoList(doc).length >= PHOTO_CAP) throw new OutError('photo_cap');
}

export function applyCommitPhoto(
  doc: Record<string, unknown>,
  meta: PhotoMeta,
): Record<string, unknown> {
  assertCanCommitPhoto(doc);
  const photos = [...photoList(doc), meta];
  const next: Record<string, unknown> = { ...doc, photos };
  delete next.embedding;
  return next;
}

export function applyDeletePhoto(doc: Record<string, unknown>, photoId: string): Record<string, unknown> {
  if (isFrozen(doc)) throw new OutError('frozen');
  const { blobKey, thumbKey } = photoBlobKeys(photoId);
  const photos = photoList(doc).filter((p) => p.id !== photoId);
  const next: Record<string, unknown> = { ...doc, photos };
  delete next[blobKey];
  delete next[thumbKey];
  return next;
}

export function blobKeysAreTopLevel(meta: PhotoMeta): boolean {
  return meta.blobKey.startsWith('photo:') && !meta.blobKey.includes('[') && meta.thumbKey.endsWith(':thumb');
}
