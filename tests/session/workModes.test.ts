import { SEED_EMPLOYEE_ID, SEED_MAYA_EMPLOYEE_ID, SEED_PRIYA_EMPLOYEE_ID } from '../../src/db/seedData';
import {
  mapPlotsAssets,
  mapPlotsCustomers,
  parseWorkModes,
  searchKinds,
  showsMapTab,
  showsTodayJobs,
  showsTodayOrders,
  showsWalkUpJob,
  workModesForEmployee,
  workModesFromSession,
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

  it('reads workModes from the session before the seed employeeId switch', () => {
    expect(workModesFromSession({ employeeId: 'E-9999', workModes: ['sales'] })).toEqual(['sales']);
    expect(workModesFromSession({ employeeId: SEED_PRIYA_EMPLOYEE_ID })).toEqual(['sales']);
    expect(workModesFromSession({ employeeId: 'E-9999' })).toEqual(['assets']);
  });

  it('gates Today walk-up and always shows Map', () => {
    expect(showsTodayJobs(['assets'])).toBe(true);
    expect(showsTodayOrders(['assets'])).toBe(false);
    expect(showsWalkUpJob(['assets'])).toBe(true);
    expect(showsMapTab(['assets'])).toBe(true);
    expect(showsTodayJobs(['customer'])).toBe(true);
    expect(showsTodayOrders(['customer'])).toBe(true);
    expect(showsWalkUpJob(['customer'])).toBe(true);
    expect(showsTodayJobs(['sales'])).toBe(false);
    expect(showsTodayOrders(['sales'])).toBe(true);
    expect(showsWalkUpJob(['sales'])).toBe(false);
    expect(showsMapTab(['sales'])).toBe(true);
  });

  it('picks search collections and map layers by mode', () => {
    expect(searchKinds(['assets'])).toEqual(['note', 'asset']);
    expect(searchKinds(['sales'])).toEqual(['note', 'product', 'customer']);
    expect(searchKinds(['customer'])).toEqual(['note', 'product', 'customer']);
    expect(searchKinds(['customer'], { kitJob: true })).toEqual(['note', 'product', 'customer', 'asset']);
    expect(mapPlotsCustomers(['sales'])).toBe(true);
    expect(mapPlotsAssets(['sales'])).toBe(false);
    expect(mapPlotsAssets(['customer'])).toBe(false);
    expect(mapPlotsAssets(['customer'], { kitFilter: true })).toBe(true);
    expect(mapPlotsAssets(['assets'])).toBe(true);
  });
});
