import { seedInboundJobs } from '../../src/db/seedData';
import { getWorkOrderInFromSeed } from '../../src/ops/getWorkOrderIn';
import {
  documentToObject,
  getWorkOrderInFromCollection,
  parseWorkOrderIn,
} from '../../src/ops/workOrderIn';

const minimal = {
  type: 'workorderin',
  number: 'WO-1',
  priority: 'high',
  status: 'assigned',
  summary: 'Fix pump',
  assignedTo: { employeeId: 'E-4412', displayName: 'Jon Hale' },
  site: { name: 'Yard', geo: { lat: 1, lon: 2 } },
  scheduled: { startDt: 10, endDt: 20, day: '2026-09-05' },
};

describe('parseWorkOrderIn', () => {
  it('reads a dispatch ticket', () => {
    const wo = parseWorkOrderIn('woin:a', minimal);
    expect(wo?.id).toBe('woin:a');
    expect(wo?.number).toBe('WO-1');
    expect(wo?.site.name).toBe('Yard');
    expect(wo?.site.geo).toEqual({ lat: 1, lon: 2, accuracyM: undefined });
    expect(wo?.assignedTo.employeeId).toBe('E-4412');
    expect(wo?.origin).toBe('dispatch');
  });

  it('returns null for missing id payload or wrong type', () => {
    expect(parseWorkOrderIn('x', null)).toBeNull();
    expect(parseWorkOrderIn('x', { ...minimal, type: 'workorderout' })).toBeNull();
    expect(parseWorkOrderIn('x', { type: 'workorderin' })).toBeNull();
  });

  it('unwraps CBL getData()', () => {
    const obj = documentToObject({ getData: () => minimal });
    expect(obj?.number).toBe('WO-1');
  });
});

describe('getWorkOrderInFromCollection', () => {
  it('is a KV get and never save', async () => {
    const save = jest.fn();
    const col = {
      document: jest.fn(async (id: string) => (id === 'woin:a' ? { getData: () => minimal } : null)),
      save,
    };
    const wo = await getWorkOrderInFromCollection(col, 'woin:a');
    expect(col.document).toHaveBeenCalledWith('woin:a');
    expect(col.document).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(wo?.number).toBe('WO-1');
  });

  it('returns null when the id is missing', async () => {
    const save = jest.fn();
    const wo = await getWorkOrderInFromCollection(
      { document: async () => null, save },
      'woin:missing',
    );
    expect(wo).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});

describe('seed fallback', () => {
  it('finds a seeded inbound id', () => {
    const jobs = seedInboundJobs('0.1.0+1', 1_700_000_000, '2026-09-05');
    const first = jobs[0];
    const wo = getWorkOrderInFromSeed(first.id);
    expect(wo?.id).toBe(first.id);
    expect(wo?.number).toBe(first.doc.number);
  });

  it('returns null for an unknown id', () => {
    expect(getWorkOrderInFromSeed('woin:nope')).toBeNull();
  });
});
