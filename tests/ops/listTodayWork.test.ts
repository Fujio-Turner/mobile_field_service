import { collapseTodayPage, outboundScheduledDay, sourceIdsFromRows } from '../../src/ops/collapseToday';
import { parseOutboundRefs, sourceIdsNeedingOutboundLookup } from '../../src/ops/findOutboundForSources';
import { TODAY_ORDERS_SQL } from '../../src/ops/orders';
import { ASSETS_BBOX_SQL } from '../../src/ops/assets';
import { inboundTodaySql } from '../../src/ops/todaySql';
import { changedInboundIds, parseInboundHits } from '../../src/ops/listTodayWork';
import type { InboundHit, OutboundHit } from '../../src/ops/todayTypes';

const inn = (over: Partial<InboundHit> & Pick<InboundHit, 'id'>): InboundHit => ({
  number: 'WO-1',
  priority: 'normal',
  status: 'assigned',
  summary: 'job',
  siteName: 'Site',
  startDt: 100,
  assignedEmployeeId: 'E-4412',
  ...over,
});

const TODAY = '2026-09-21';

const out = (over: Partial<OutboundHit> & Pick<OutboundHit, 'id' | 'sourceId'>): OutboundHit => ({
  number: 'WO-1',
  priority: 'normal',
  status: 'in_progress',
  summary: 'job',
  siteName: 'Site',
  startDt: 100,
  day: TODAY,
  role: 'primary',
  assignedEmployeeId: 'E-4412',
  ...over,
});

function collapse(over: Omit<Parameters<typeof collapseTodayPage>[0], 'employeeId' | 'day' | 'includeActiveOutbound'> & {
  employeeId?: string;
  day?: string;
  includeActiveOutbound?: boolean;
}) {
  return collapseTodayPage({
    employeeId: 'E-4412',
    day: TODAY,
    includeActiveOutbound: true,
    ...over,
  });
}

describe('collapseTodayPage', () => {
  it('prefers outbound for the same source.id', () => {
    const rows = collapse({
      inbound: [inn({ id: 'woin:a', startDt: 50 })],
      activeOutbound: [out({ id: 'woout:a', sourceId: 'woin:a', startDt: 50 })],
      outboundBySource: new Map(),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].openCollection).toBe('workordersout');
    expect(rows[0].openId).toBe('woout:a');
    expect(rows[0].badge).toBe('started');
  });

  it('badges Reassigned when outbound exists and inbound is gone or assigned elsewhere', () => {
    const rows = collapse({
      inbound: [],
      activeOutbound: [out({ id: 'woout:a', sourceId: 'woin:a' })],
      outboundBySource: new Map(),
    });
    expect(rows[0].badge).toBe('reassigned');
    expect(rows[0].openCollection).toBe('workordersout');
  });

  it('omits Reassigned leftovers whose scheduled day is not Today', () => {
    const rows = collapse({
      inbound: [],
      activeOutbound: [out({ id: 'woout:old', sourceId: 'woin:old', day: '2026-09-16', number: 'WO-10460' })],
      outboundBySource: new Map(),
    });
    expect(rows).toHaveLength(0);
  });

  it('keeps a started copy from another day (still your paper)', () => {
    const rows = collapse({
      inbound: [inn({ id: 'woin:a', assignedEmployeeId: 'E-4412' })],
      activeOutbound: [out({ id: 'woout:a', sourceId: 'woin:a', day: '2026-09-16' })],
      outboundBySource: new Map(),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].badge).toBe('started');
  });

  it('badges Amendment on role=amendment', () => {
    const rows = collapse({
      inbound: [inn({ id: 'woin:a' })],
      activeOutbound: [out({ id: 'woout:b', sourceId: 'woin:a', role: 'amendment' })],
      outboundBySource: new Map(),
    });
    expect(rows[0].badge).toBe('amendment');
  });

  it('badges Done when the outbound copy is complete', () => {
    const rows = collapse({
      inbound: [inn({ id: 'woin:a' })],
      activeOutbound: [],
      outboundBySource: new Map([
        [
          'woin:a',
          { id: 'woout:a', sourceId: 'woin:a', status: 'complete', role: 'primary' },
        ],
      ]),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].badge).toBe('done');
    expect(rows[0].openId).toBe('woout:a');
  });

  it('inbound-only rows open workordersin', () => {
    const rows = collapse({
      inbound: [inn({ id: 'woin:a' })],
      activeOutbound: [],
      outboundBySource: new Map(),
    });
    expect(rows[0].openCollection).toBe('workordersin');
    expect(rows[0].openId).toBe('woin:a');
    expect(rows[0].badge).toBe('none');
  });

  it('pages 1+ skip sources already on page 0', () => {
    const page0 = collapse({
      inbound: [inn({ id: 'woin:a', startDt: 200 })],
      activeOutbound: [out({ id: 'woout:a', sourceId: 'woin:a', startDt: 200 })],
      outboundBySource: new Map(),
    });
    const skip = sourceIdsFromRows(page0);
    const page1 = collapse({
      inbound: [inn({ id: 'woin:a' }), inn({ id: 'woin:b', number: 'WO-2', startDt: 10 })],
      activeOutbound: [],
      outboundBySource: new Map(),
      skipSourceIds: skip,
      includeActiveOutbound: false,
    });
    expect(page1.map((r) => r.sourceId)).toEqual(['woin:b']);
  });

  it('sorts by startDt DESC', () => {
    const rows = collapse({
      inbound: [inn({ id: 'woin:old', startDt: 10, number: 'WO-old' }), inn({ id: 'woin:new', startDt: 90, number: 'WO-new' })],
      activeOutbound: [],
      outboundBySource: new Map(),
    });
    expect(rows.map((r) => r.number)).toEqual(['WO-new', 'WO-old']);
  });

  it('reads scheduled.day from the outbound hit', () => {
    expect(outboundScheduledDay({ day: '2026-09-16', startDt: 1_700_000_000 })).toBe('2026-09-16');
  });
});

describe('changedInboundIds', () => {
  it('returns only new, removed, or field-changed ids', () => {
    const a = inn({ id: 'woin:a', summary: 'one' });
    const b = inn({ id: 'woin:b' });
    expect(changedInboundIds([a, b], [a, b])).toEqual([]);
    expect(changedInboundIds([a], [a, b])).toEqual(['woin:b']);
    expect(changedInboundIds([a, b], [a])).toEqual(['woin:b']);
    expect(changedInboundIds([a], [inn({ id: 'woin:a', summary: 'two' })])).toEqual(['woin:a']);
  });
});

describe('parse helpers', () => {
  it('parses inbound hits', () => {
    const hits = parseInboundHits([
      { id: 'woin:a', number: 'WO-1', kind: 'inspect', startDt: 3, assignedEmployeeId: 'E-4412' },
    ]);
    expect(hits[0].id).toBe('woin:a');
    expect(hits[0].startDt).toBe(3);
    expect(hits[0].kind).toBe('inspect');
  });

  it('skips outbound lookup for sources already on the active list', () => {
    expect(
      sourceIdsNeedingOutboundLookup(['woin:a', 'woin:b', 'woin:c'], [
        { id: 'woout:a', sourceId: 'woin:a' },
      ]),
    ).toEqual(['woin:b', 'woin:c']);
  });

  it('maps outbound refs by source, preferring primary', () => {
    const map = parseOutboundRefs([
      { id: 'woout:am', sourceId: 'woin:a', role: 'amendment', status: 'assigned' },
      { id: 'woout:p', sourceId: 'woin:a', role: 'primary', status: 'in_progress' },
    ]);
    expect(map.get('woin:a')?.id).toBe('woout:p');
  });
});

describe('mobile SQL++ does not use IN or $limit', () => {
  it('today inbound, orders, and asset bbox queries stay CBL-safe', () => {
    const inbound = inboundTodaySql(20, 0);
    expect(inbound).not.toMatch(/\bIN\s*\[/);
    expect(inbound).not.toMatch(/\$limit|\$offset/);
    expect(inbound).toMatch(/LIMIT 20/);
    expect(TODAY_ORDERS_SQL).not.toMatch(/\bIN\s*\[/);
    expect(TODAY_ORDERS_SQL).toMatch(/\$day/);
    expect(ASSETS_BBOX_SQL).not.toMatch(/\$limit/);
    expect(ASSETS_BBOX_SQL).toMatch(/LIMIT 500/);
  });
});
