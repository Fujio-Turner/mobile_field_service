import { SEED_EMPLOYEE_ID, SEED_MAYA_EMPLOYEE_ID, SEED_PRIYA_EMPLOYEE_ID } from '../../src/db/seedData';
import {
  parseWorkModes,
  showsMapTab,
  showsTodayJobs,
  showsTodayOrders,
  workModesForEmployee,
} from '../../src/session/workModes';

describe('workModes', () => {
  it('defaults empty or junk to assets', () => {
    expect(parseWorkModes(undefined)).toEqual(['assets']);
    expect(parseWorkModes(['nope'])).toEqual(['assets']);
    expect(parseWorkModes(['customer', 'customer'])).toEqual(['customer']);
  });

  it('maps seed employees', () => {
    expect(workModesForEmployee(SEED_EMPLOYEE_ID)).toEqual(['assets']);
    expect(workModesForEmployee(SEED_MAYA_EMPLOYEE_ID)).toEqual(['customer']);
    expect(workModesForEmployee(SEED_PRIYA_EMPLOYEE_ID)).toEqual(['sales']);
  });

  it('gates Today and Map', () => {
    expect(showsTodayJobs(['assets'])).toBe(true);
    expect(showsTodayOrders(['assets'])).toBe(false);
    expect(showsMapTab(['assets'])).toBe(true);
    expect(showsTodayJobs(['customer'])).toBe(true);
    expect(showsTodayOrders(['customer'])).toBe(true);
    expect(showsTodayJobs(['sales'])).toBe(false);
    expect(showsTodayOrders(['sales'])).toBe(true);
    expect(showsMapTab(['sales'])).toBe(false);
  });
});
