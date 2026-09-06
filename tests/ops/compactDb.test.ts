import {
  clearCompactSchedule,
  compactIsScheduled,
  scheduleCompactSoon,
} from '../../src/ops/compactDb';

afterEach(() => {
  clearCompactSchedule();
  jest.useRealTimers();
});

describe('scheduleCompactSoon', () => {
  it('debounces to a single compact timer', () => {
    jest.useFakeTimers();
    scheduleCompactSoon(1000);
    scheduleCompactSoon(1000);
    expect(compactIsScheduled()).toBe(true);
    jest.advanceTimersByTime(999);
    expect(compactIsScheduled()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(compactIsScheduled()).toBe(false);
  });
});
