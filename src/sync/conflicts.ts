import { FIELD_COLLECTIONS, type FieldCollection } from '../db/collections';

/**
 * Per-collection conflict policy.
 * Native CBL still uses its default resolver until CollectionConfig.setConflictResolver exists.
 * Each case is a hook: keep `strategy: 'default'` today; swap the strategy later without
 * touching the replicator wiring.
 */
export type ConflictStrategy = 'default' | 'local' | 'remote';

export type ConflictPolicy = {
  collection: string;
  strategy: ConflictStrategy;
  /** What a future custom resolver would do. */
  intended: string;
};

export type ConflictInput = {
  collection: string;
  documentId: string;
  local?: Record<string, unknown> | null;
  remote?: Record<string, unknown> | null;
};

const DEFAULT: ConflictStrategy = 'default';

export function conflictPolicyFor(collection: string): ConflictPolicy {
  switch (collection as FieldCollection | 'tmp') {
    case 'workordersin':
      return {
        collection,
        strategy: DEFAULT,
        intended: 'Prefer remote (dispatch owns inbound). Phone never patches origin:dispatch.',
      };
    case 'workordersout':
      return {
        collection,
        strategy: DEFAULT,
        intended: 'Prefer higher audit.up.dt, then more photo keys, then higher rev generation.',
      };
    case 'orders':
      return {
        collection,
        strategy: DEFAULT,
        intended: 'Same as workordersout for working copies; inbound orders are pull-only.',
      };
    case 'customers':
      return {
        collection,
        strategy: DEFAULT,
        intended: 'Prefer remote master; field-origin docs prefer local until pushed.',
      };
    case 'assets':
      return {
        collection,
        strategy: DEFAULT,
        intended: 'Pull-only catalog — remote wins.',
      };
    case 'products':
      return {
        collection,
        strategy: DEFAULT,
        intended: 'Pull-only catalog — remote wins.',
      };
    case 'rates':
      return {
        collection,
        strategy: DEFAULT,
        intended: 'Pull-only catalog — remote wins.',
      };
    case 'taxes':
      return {
        collection,
        strategy: DEFAULT,
        intended: 'Pull-only catalog — remote wins.',
      };
    case 'users':
      return {
        collection,
        strategy: DEFAULT,
        intended: 'Pull-only profile/directory — remote wins.',
      };
    case 'inventory':
      return {
        collection,
        strategy: DEFAULT,
        intended: 'Stock rows are not pushed; txs are new ids so they should not conflict.',
      };
    case 'tasks':
      return {
        collection,
        strategy: DEFAULT,
        intended: 'Prefer local task instance if readyToPush; templates are pull-only.',
      };
    case 'notes':
      return {
        collection,
        strategy: DEFAULT,
        intended: 'Prefer local if readyToPush (device-authored).',
      };
    case 'messages':
      return {
        collection,
        strategy: DEFAULT,
        intended: 'New ids per send — conflict should be rare; default is fine.',
      };
    case 'tracking':
      return {
        collection,
        strategy: DEFAULT,
        intended: 'Union-merge tracking map keys; do not last-write-wins crumbs.',
      };
    case 'tmp':
      return { collection, strategy: DEFAULT, intended: 'Not replicated.' };
    default:
      return {
        collection,
        strategy: DEFAULT,
        intended: 'Unknown collection — CBL default resolver.',
      };
  }
}

/** Native-shaped hook. Returning null means “leave CBL default”. */
export function resolveConflictDocument(input: ConflictInput): Record<string, unknown> | null {
  const policy = conflictPolicyFor(input.collection);
  switch (policy.strategy) {
    case 'local':
      return input.local ?? input.remote ?? null;
    case 'remote':
      return input.remote ?? input.local ?? null;
    case 'default':
    default:
      return null;
  }
}

/**
 * Per-collection native conflict resolver. Must stay `"show source"` pure like push filters.
 * Returning null keeps the Couchbase Lite default resolver.
 */
export function workordersinConflictResolver(_local: unknown, _remote: unknown): unknown {
  'show source';
  return null;
}
export function workordersoutConflictResolver(_local: unknown, _remote: unknown): unknown {
  'show source';
  return null;
}
export function ordersConflictResolver(_local: unknown, _remote: unknown): unknown {
  'show source';
  return null;
}
export function customersConflictResolver(_local: unknown, _remote: unknown): unknown {
  'show source';
  return null;
}
export function assetsConflictResolver(_local: unknown, _remote: unknown): unknown {
  'show source';
  return null;
}
export function productsConflictResolver(_local: unknown, _remote: unknown): unknown {
  'show source';
  return null;
}
export function ratesConflictResolver(_local: unknown, _remote: unknown): unknown {
  'show source';
  return null;
}
export function taxesConflictResolver(_local: unknown, _remote: unknown): unknown {
  'show source';
  return null;
}
export function usersConflictResolver(_local: unknown, _remote: unknown): unknown {
  'show source';
  return null;
}
export function inventoryConflictResolver(_local: unknown, _remote: unknown): unknown {
  'show source';
  return null;
}
export function tasksConflictResolver(_local: unknown, _remote: unknown): unknown {
  'show source';
  return null;
}
export function notesConflictResolver(_local: unknown, _remote: unknown): unknown {
  'show source';
  return null;
}
export function messagesConflictResolver(_local: unknown, _remote: unknown): unknown {
  'show source';
  return null;
}
export function trackingConflictResolver(_local: unknown, _remote: unknown): unknown {
  'show source';
  return null;
}

export const FIELD_CONFLICT_RESOLVERS: Record<
  string,
  (local: unknown, remote: unknown) => unknown
> = {
  workordersin: workordersinConflictResolver,
  workordersout: workordersoutConflictResolver,
  orders: ordersConflictResolver,
  customers: customersConflictResolver,
  assets: assetsConflictResolver,
  products: productsConflictResolver,
  rates: ratesConflictResolver,
  taxes: taxesConflictResolver,
  users: usersConflictResolver,
  inventory: inventoryConflictResolver,
  tasks: tasksConflictResolver,
  notes: notesConflictResolver,
  messages: messagesConflictResolver,
  tracking: trackingConflictResolver,
};

export function conflictResolverFor(
  collectionName: string,
): ((local: unknown, remote: unknown) => unknown) | undefined {
  return FIELD_CONFLICT_RESOLVERS[collectionName];
}

export function conflictPolicyMatrix(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of FIELD_COLLECTIONS) {
    out[name] = conflictPolicyFor(name).strategy;
  }
  return out;
}
