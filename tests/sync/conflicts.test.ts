import { FIELD_COLLECTIONS } from '../../src/db/collections';
import {
  FIELD_CONFLICT_RESOLVERS,
  conflictPolicyFor,
  conflictPolicyMatrix,
  conflictResolverFor,
  resolveConflictDocument,
} from '../../src/sync/conflicts';
import { collectionConfigFor } from '../../src/sync/replicator';
import { neverPushFilter } from '../../src/sync/filters';
import { handleReplicatedDoc, parseReplicatedDocs } from '../../src/sync/documentListener';
import { replDocStats, resetReplDocStats } from '../../src/sync/replStats';

describe('per-collection conflict policy', () => {
  it('has a switch case for every field collection, all default today', () => {
    const matrix = conflictPolicyMatrix();
    expect(Object.keys(matrix)).toEqual([...FIELD_COLLECTIONS]);
    for (const name of FIELD_COLLECTIONS) {
      expect(conflictPolicyFor(name).strategy).toBe('default');
      expect(FIELD_CONFLICT_RESOLVERS[name]).toBeTruthy();
      expect(FIELD_CONFLICT_RESOLVERS[name].toString().includes('show source')).toBe(true);
      expect(conflictResolverFor(name)?.(null, null)).toBeNull();
    }
  });

  it('default strategy returns null (CBL default resolver)', () => {
    expect(
      resolveConflictDocument({
        collection: 'workordersout',
        documentId: 'woout:1',
        local: { a: 1 },
        remote: { a: 2 },
      }),
    ).toBeNull();
  });
});

describe('collectionConfigFor conflict resolver', () => {
  it('attaches setConflictResolver when the API exists', () => {
    const resolvers: unknown[] = [];
    const CollectionConfig = class {
      constructor(_ch: string[] | null, _ids: string[] | null) {}
      setPushFilter() {}
      setConflictResolver(fn: unknown) {
        resolvers.push(fn);
      }
    };
    collectionConfigFor(
      { CollectionConfig: CollectionConfig as never },
      {},
      neverPushFilter,
      [],
      'tracking',
    );
    expect(resolvers).toHaveLength(1);
    expect(resolvers[0]).toBe(conflictResolverFor('tracking'));
  });
});

describe('document listener HTTP errors + stats', () => {
  beforeEach(() => resetReplDocStats());

  it('parses 409 and counts a conflict without treating it as auth', async () => {
    const evs = parseReplicatedDocs({
      isPush: true,
      documents: [{ id: 'woout:1', collectionName: 'workordersout', error: { code: 409, message: 'conflict' } }],
    });
    expect(evs[0].error?.code).toBe(409);
    await handleReplicatedDoc(evs[0], { employeeId: 'E-4412', email: 'a@b.c', username: 'tech.jon' });
    const s = replDocStats();
    expect(s.conflict).toBe(1);
    expect(s.pushErr).toBe(1);
    expect(s.lastDocErrorClass).toBe('conflict');
  });

  it('counts a successful pull as completed', async () => {
    await handleReplicatedDoc(
      { id: 'woin:1', collection: 'workordersin', isPush: false },
      { employeeId: 'E-4412', email: 'a@b.c', username: 'tech.jon' },
    );
    expect(replDocStats().pullOk).toBe(1);
    expect(replDocStats().completed).toBe(1);
    expect(replDocStats().failed).toBe(0);
  });
});
