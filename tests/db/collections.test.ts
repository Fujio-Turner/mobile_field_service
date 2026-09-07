import {
  FIELD_COLLECTIONS,
  OPERATOR_COLLECTIONS,
  TMP_COLLECTION,
  isOperatorCollection,
  isReplicatorCollection,
  replicatorAllowList,
} from '../../src/db/collections';
import { tmpExpiryDate, TMP_TTL_MS } from '../../src/db/tmp';
import { TRACKING_TTL_DAYS, trackingExpiryDate } from '../../src/ops/tracking';
import { FTS_INDEXES, VALUE_INDEXES } from '../../src/db/indexes';
import { trackingDocId } from '../../src/ids';
import { bytesToBase64, cblUniqueItem, dbKeyItem } from '../../src/session/dbKeyCodec';

describe('collections', () => {
  it('has fourteen field collections including tracking', () => {
    expect(FIELD_COLLECTIONS).toHaveLength(14);
    expect(FIELD_COLLECTIONS).toContain('tracking');
    expect(FIELD_COLLECTIONS).not.toContain(TMP_COLLECTION);
  });

  it('replicator allow-list never includes tmp', () => {
    expect(replicatorAllowList()).not.toContain('tmp');
    expect(isReplicatorCollection('tmp')).toBe(false);
    expect(isReplicatorCollection('tracking')).toBe(true);
  });

  it('hides tracking from operator-facing lists', () => {
    expect(OPERATOR_COLLECTIONS).not.toContain('tracking');
    expect(OPERATOR_COLLECTIONS).toContain('workordersin');
    expect(isOperatorCollection('tracking')).toBe(false);
    expect(isOperatorCollection('tmp')).toBe(false);
    expect(isOperatorCollection('orders')).toBe(true);
  });

  it('defines today-list index keys', () => {
    const today = VALUE_INDEXES.find((i) => i.name === 'idx_woin_today');
    expect(today?.properties).toEqual(['assignedTo.employeeId', 'scheduled.day', 'scheduled.startDt']);
  });

  it('defines notes FTS on body and title', () => {
    const fts = FTS_INDEXES.find((i) => i.name === 'idx_nte_fts');
    expect(fts?.collection).toBe('notes');
    expect(fts?.properties).toEqual(['body', 'title']);
  });

  it('defines asset geo index', () => {
    const geo = VALUE_INDEXES.find((i) => i.name === 'idx_ast_geo');
    expect(geo?.properties).toEqual(['geo.lat', 'geo.lon']);
  });

  it('defines product FTS on name sku description', () => {
    const fts = FTS_INDEXES.find((i) => i.name === 'idx_prd_fts');
    expect(fts?.collection).toBe('products');
    expect(fts?.properties).toEqual(['name', 'sku', 'description']);
  });

  it('defines message thread index', () => {
    const idx = VALUE_INDEXES.find((i) => i.name === 'idx_msg_thread');
    expect(idx?.properties).toEqual(['threadId', 'audit.cr.dt']);
  });
});

describe('tmp expiry', () => {
  it('is 24 hours', () => {
    expect(tmpExpiryDate(0).getTime()).toBe(TMP_TTL_MS);
  });
});

describe('tracking expiry', () => {
  it('is 30 calendar days after the tracking day', () => {
    expect(TRACKING_TTL_DAYS).toBe(30);
    const exp = trackingExpiryDate('2026-09-05');
    expect(exp.getFullYear()).toBe(2026);
    expect(exp.getMonth()).toBe(9);
    expect(exp.getDate()).toBe(5);
  });
});

describe('db key codec', () => {
  it('names the key by employeeId', () => {
    expect(dbKeyItem('E-4412')).toBe('mfs.dbkey.E-4412');
    expect(cblUniqueItem('E-4412')).toBe('mfs.cbluid.E-4412');
  });

  it('base64-encodes 32 bytes', () => {
    const bytes = new Uint8Array(32);
    bytes[0] = 1;
    const b64 = bytesToBase64(bytes);
    expect(b64.length).toBeGreaterThan(40);
    expect(atob(b64).charCodeAt(0)).toBe(1);
  });
});

describe('tracking id vs email', () => {
  it('does not put email in the id', () => {
    expect(trackingDocId('2026-09-05', 'E-4412')).not.toContain('@');
  });
});
