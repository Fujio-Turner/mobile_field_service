import { getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { applyParams, normalizeResults } from '../db/query';
import { deviceLocalDay } from '../ids';
import { collapseTodayPage } from './collapseToday';
import { findOutboundForSources, sourceIdsNeedingOutboundLookup } from './findOutboundForSources';
import { listTodayWork, parseInboundHits, parseOutboundHits } from './listTodayWork';
import { ACTIVE_OUTBOUND_SQL, inboundTodaySql } from './todaySql';
import { TODAY_PAGE_SIZE, type InboundHit, type OutboundHit, type TodayRow } from './todayTypes';

export type WatchTodayHandle = {
  stop: () => Promise<void>;
};

type QueryLike = {
  execute: () => Promise<unknown>;
  addChangeListener?: (cb: (change: { error?: string; results?: unknown }) => void) => Promise<unknown>;
  removeChangeListener?: (token: unknown) => Promise<void>;
};

async function detachListener(query: QueryLike, token: unknown): Promise<void> {
  if (token && typeof (token as { remove?: () => Promise<void> }).remove === 'function') {
    await (token as { remove: () => Promise<void> }).remove();
  } else if (typeof query.removeChangeListener === 'function') {
    await query.removeChangeListener(token);
  }
}

/**
 * Live page 0. Inbound and outbound listeners share last hits so a change on
 * one side does not re-query the other. Lookup skips sources already in active outbound.
 */
export async function watchTodayWork(
  input: { employeeId: string; day?: string },
  onRows: (rows: TodayRow[], meta: { preview: boolean; error?: string; inboundCount?: number }) => void,
): Promise<WatchTodayHandle> {
  const day = input.day ?? deviceLocalDay();
  if (!nativeDbAvailable() || !getOpenedDatabase()) {
    const first = await listTodayWork({ employeeId: input.employeeId, day, offset: 0 });
    onRows(first.rows, { preview: first.preview, inboundCount: first.inboundCount });
    return { stop: async () => undefined };
  }

  const db = getOpenedDatabase();
  if (!db) {
    onRows([], { preview: false, error: 'Database not open' });
    return { stop: async () => undefined };
  }

  const inboundQuery = db.createQuery(inboundTodaySql(TODAY_PAGE_SIZE, 0));
  await applyParams(inboundQuery, {
    employeeId: input.employeeId,
    day,
  });
  const outboundQuery = db.createQuery(ACTIVE_OUTBOUND_SQL);
  await applyParams(outboundQuery, { employeeId: input.employeeId });

  let lastInbound: InboundHit[] = [];
  let lastActive: OutboundHit[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let running = false;
  let dirty = false;

  const emit = async () => {
    if (stopped) return;
    running = true;
    try {
      do {
        dirty = false;
        const outboundBySource = await findOutboundForSources(
          input.employeeId,
          sourceIdsNeedingOutboundLookup(
            lastInbound.map((h) => h.id),
            lastActive,
          ),
        );
        const rows = collapseTodayPage({
          employeeId: input.employeeId,
          inbound: lastInbound,
          activeOutbound: lastActive,
          outboundBySource,
          includeActiveOutbound: true,
        });
        if (!stopped) onRows(rows, { preview: false, inboundCount: lastInbound.length });
      } while (dirty && !stopped);
    } catch (e) {
      if (!stopped) onRows([], { preview: false, error: e instanceof Error ? e.message : 'Query failed' });
    } finally {
      running = false;
    }
  };

  const schedule = () => {
    dirty = true;
    if (running) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void emit();
    }, 50);
  };

  const tokens: Array<{ query: QueryLike; token: unknown }> = [];
  const watchOutbound = typeof outboundQuery.addChangeListener === 'function';

  if (typeof inboundQuery.addChangeListener === 'function') {
    tokens.push({
      query: inboundQuery,
      token: await inboundQuery.addChangeListener((change) => {
        if (change.error) {
          onRows([], { preview: false, error: change.error });
          return;
        }
        lastInbound = parseInboundHits(normalizeResults(change.results));
        if (!watchOutbound) {
          void outboundQuery.execute().then((raw) => {
            lastActive = parseOutboundHits(normalizeResults(raw));
            schedule();
          });
          return;
        }
        schedule();
      }),
    });
  }

  if (watchOutbound) {
    tokens.push({
      query: outboundQuery,
      token: await outboundQuery.addChangeListener!((change) => {
        if (change.error) return;
        lastActive = parseOutboundHits(normalizeResults(change.results));
        schedule();
      }),
    });
  }

  if (tokens.length === 0) {
    const first = await listTodayWork({ employeeId: input.employeeId, day, offset: 0 });
    onRows(first.rows, { preview: first.preview, inboundCount: first.inboundCount });
    return { stop: async () => undefined };
  }

  try {
    lastInbound = parseInboundHits(normalizeResults(await inboundQuery.execute()));
    lastActive = parseOutboundHits(normalizeResults(await outboundQuery.execute()));
    await emit();
  } catch (e) {
    onRows([], { preview: false, error: e instanceof Error ? e.message : 'Query failed' });
  }

  return {
    stop: async () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      for (const { query, token } of tokens) await detachListener(query, token);
    },
  };
}
