import { getOpenedDatabase, nativeDbAvailable } from '../db/database';
import { applyParams, normalizeResults, runQuery } from '../db/query';
import { deviceLocalDay } from '../ids';
import { collapseTodayPage } from './collapseToday';
import { findOutboundForSources } from './findOutboundForSources';
import { listTodayWork, parseInboundHits, parseOutboundHits } from './listTodayWork';
import { ACTIVE_OUTBOUND_SQL, inboundTodaySql } from './todaySql';
import { TODAY_PAGE_SIZE, type TodayRow } from './todayTypes';

export type WatchTodayHandle = {
  stop: () => Promise<void>;
};

/**
 * Live inbound page 0 only. Each callback re-runs active outbound and collapse.
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

  const refresh = async (inboundRaw: unknown) => {
    try {
      const inbound = parseInboundHits(normalizeResults(inboundRaw));
      const outRows = await runQuery(db, ACTIVE_OUTBOUND_SQL, {
        employeeId: input.employeeId,
      });
      const activeOutbound = parseOutboundHits(outRows);
      const outboundBySource = await findOutboundForSources(
        input.employeeId,
        inbound.map((h) => h.id),
      );
      const rows = collapseTodayPage({
        employeeId: input.employeeId,
        inbound,
        activeOutbound,
        outboundBySource,
        includeActiveOutbound: true,
      });
      onRows(rows, { preview: false, inboundCount: inbound.length });
    } catch (e) {
      onRows([], { preview: false, error: e instanceof Error ? e.message : 'Query failed' });
    }
  };

  if (typeof inboundQuery.addChangeListener !== 'function') {
    const first = await listTodayWork({ employeeId: input.employeeId, day, offset: 0 });
    onRows(first.rows, { preview: first.preview, inboundCount: first.inboundCount });
    return { stop: async () => undefined };
  }

  const token = await inboundQuery.addChangeListener((change) => {
    if (change.error) {
      onRows([], { preview: false, error: change.error });
      return;
    }
    void refresh(change.results);
  });

  return {
    stop: async () => {
      if (token && typeof (token as { remove?: () => Promise<void> }).remove === 'function') {
        await (token as { remove: () => Promise<void> }).remove();
      } else if (typeof inboundQuery.removeChangeListener === 'function') {
        await inboundQuery.removeChangeListener(token);
      }
    },
  };
}
