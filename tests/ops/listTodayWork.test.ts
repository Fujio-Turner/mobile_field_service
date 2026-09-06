import { collapseTodayPage, sourceIdsFromRows } from '../../src/ops/collapseToday';
import { parseOutboundRefs, sourceIdsNeedingOutboundLookup } from '../../src/ops/findOutboundForSources';
import { TODAY_ORDERS_SQL } from '../../src/ops/orders';
import { ASSETS_BBOX_SQL } from '../../src/ops/assets';
import { inboundTodaySql } from '../../src/ops/todaySql';
import { parseInboundHits } from '../../src/ops/listTodayWork';
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

const out = (over: Partial<OutboundHit> & Pick<OutboundHit, 'id' | 'sourceId'>): OutboundHit => ({
  number: 'WO-1',
  priority: 'normal',
  status: 'in_progress',
  summary: 'job',
  siteName: 'Site',
  startDt: 100,
  role: 'primary',
  assignedEmployeeId: 'E-4412',
  ...over,
});

describe('collapseTodayPage', () => {
  it('prefers outbound for the same source.id', () => {
    const rows = collapseTodayPage({
      employeeId: 'E-4412',
      inbound: [inn({ id: 'woin:a', startDt: 50 })],
      activeOutbound: [out({ id: 'woout:a', sourceId: 'woin:a', startDt: 50 })],
      outboundBySource: new Map(),
      includeActiveOutbound: true,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].openCollection).toBe('workordersout');
    expect(rows[0].openId).toBe('woout:a');
    expect(rows[0].badge).toBe('started');
  });

  it('badges Reassigned when outbound exists and inbound is gone or assigned elsewhere', () => {
    const rows = collapseTodayPage({
      employeeId: 'E-4412',
      inbound: [],
      activeOutbound: [out({ id: 'woout:a', sourceId: 'woin:a' })],
      outboundBySource: new Map(),
      includeActiveOutbound: true,
    });
    expect(rows[0].badge).toBe('reassigned');
    expect(rows[0].openCollection).toBe('workordersout');
  });

  it('badges Amendment on role=amendment', () => {
    const rows = collapseTodayPage({
      employeeId: 'E-4412',
      inbound: [inn({ id: 'woin:a' })],
      activeOutbound: [out({ id: 'woout:b', sourceId: 'woin:a', role: 'amendment' })],
      outboundBySource: new Map(),
      includeActiveOutbound: true,
    });
    expect(rows[0].badge).toBe('amendment');
  });

  it('inbound-only rows open workordersin', () => {
    const rows = collapseTodayPage({
      employeeId: 'E-4412',
      inbound: [inn({ id: 'woin:a' })],
      activeOutbound: [],
      outboundBySource: new Map(),
      includeActiveOutbound: true,
    });
    expect(rows[0].openCollection).toBe('workordersin');
    expect(rows[0].openId).toBe('woin:a');
    expect(rows[0].badge).toBe('none');
  });

  it('pages 1+ skip sources already on page 0', () => {
    const page0 = collapseTodayPage({
      employeeId: 'E-4412',
      inbound: [inn({ id: 'woin:a', startDt: 200 })],
      activeOutbound: [out({ id: 'woout:a', sourceId: 'woin:a', startDt: 200 })],
      outboundBySource: new Map(),
      includeActiveOutbound: true,
    });
    const skip = sourceIdsFromRows(page0);
    const page1 = collapseTodayPage({
      employeeId: 'E-4412',
      inbound: [inn({ id: 'woin:a' }), inn({ id: 'woin:b', number: 'WO-2', startDt: 10 })],
      activeOutbound: [],
      outboundBySource: new Map(),
      skipSourceIds: skip,
      includeActiveOutbound: false,
    });
    expect(page1.map((r) => r.sourceId)).toEqual(['woin:b']);
  });

  it('sorts by startDt DESC', () => {
    const rows = collapseTodayPage({
      employeeId: 'E-4412',
      inbound: [inn({ id: 'woin:old', startDt: 10, number: 'WO-old' }), inn({ id: 'woin:new', startDt: 90, number: 'WO-new' })],
      activeOutbound: [],
      outboundBySource: new Map(),
      includeActiveOutbound: true,
    });
    expect(rows.map((r) => r.number)).toEqual(['WO-new', 'WO-old']);
  });
});

describe('parse helpers', () => {
  it('parses inbound hits', () => {
    const hits = parseInboundHits([{ id: 'woin:a', number: 'WO-1', startDt: 3, assignedEmployeeId: 'E-4412' }]);
    expect(hits[0].id).toBe('woin:a');
    expect(hits[0].startDt).toBe(3);
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
