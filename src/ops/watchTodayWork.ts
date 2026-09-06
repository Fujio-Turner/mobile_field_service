import { getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { attachLiveQuery, type LiveQueryHandle } from '../db/liveQuery';
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

/**
 * CBL live queries for Today page 0.
 * Two SQL++ listeners (inbound today + active outbound). Each update only its
 * own hits; a ~50 ms coalesce then collapses. Pages 2+ stay one-shot execute().
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

  const lives: LiveQueryHandle[] = [];

  const inboundLive = await attachLiveQuery(inboundQuery, (rows, error) => {
    if (error) {
      onRows([], { preview: false, error });
      return;
    }
    lastInbound = parseInboundHits(rows);
    schedule();
  });
  if (inboundLive) lives.push(inboundLive);

  const outboundLive = await attachLiveQuery(outboundQuery, (rows, error) => {
    if (error) return;
    lastActive = parseOutboundHits(rows);
    schedule();
  });
  if (outboundLive) lives.push(outboundLive);

  if (lives.length === 0) {
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
      for (const live of lives) await live.stop();
    },
  };
}
