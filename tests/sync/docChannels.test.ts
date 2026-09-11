import {
  assertDocChannels,
  channelsFromUserProfile,
  collectDocChannels,
} from '../../src/sync/docChannels';

describe('collectDocChannels', () => {
  it('channels workorders from employee, email, customer, and route', () => {
    expect(
      collectDocChannels(
        {
          type: 'workorderin',
          assignedTo: { employeeId: 'E-4412', email: 'Jon.Hale@example.com' },
          customerId: 'cus:01K4Q6CCC00000000000000001',
          routeId: 'HFD-NORTH',
        },
        'workordersin',
      ),
    ).toEqual([
      'emp:E-4412',
      'email:jon.hale@example.com',
      'cus:01K4Q6CCC00000000000000001',
      'route:HFD-NORTH',
    ]);
  });

  it('allows a route-only job with no employee or customer', () => {
    expect(assertDocChannels({ type: 'workorderin', routeId: 'HFD-NORTH' }, 'workordersin')).toEqual([
      'route:HFD-NORTH',
    ]);
  });

  it('requires identity or route on notes / users / orders', () => {
    expect(() => assertDocChannels({ type: 'note', body: 'x' }, 'notes')).toThrow(/routeId/);
    expect(
      assertDocChannels(
        {
          type: 'user',
          employeeId: 'E-4412',
          email: 'jon.hale@example.com',
          routeIds: ['HFD-NORTH'],
          customerIds: ['cus:01abc'],
          assetTypes: ['pump'],
          region: 'CT',
          storeId: 'HFD-YARD',
        },
        'users',
      ),
    ).toEqual([
      'emp:E-4412',
      'email:jon.hale@example.com',
      'route:HFD-NORTH',
      'region:CT',
      'store:HFD-YARD',
      'cus:01abc',
      'assetType:pump',
    ]);
  });

  it('does not channel by type or public', () => {
    const products = collectDocChannels(
      { class: 'store', storeId: 'HFD-YARD', region: 'CT', sku: 'VLV-CHK-4' },
      'products',
    );
    expect(products).toEqual(['class:store', 'store:HFD-YARD', 'region:CT']);
    expect(products.some((c) => c.startsWith('type:') || c === '!' || c === 'public')).toBe(false);

    const assets = collectDocChannels(
      { region: 'CT', storeId: 'HFD-YARD', locationId: 'wh:north', assetType: 'pump' },
      'assets',
    );
    expect(assets).toEqual(['region:CT', 'store:HFD-YARD', 'loc:wh:north', 'assetType:pump']);
  });

  it('channels taxes by state / county / city and inventory by location', () => {
    expect(
      collectDocChannels(
        { jurisdiction: { country: 'US', region: 'CT', county: 'Hartford', city: 'Hartford' } },
        'taxes',
      ),
    ).toEqual(['state:CT', 'county:Hartford', 'city:Hartford']);
    expect(
      collectDocChannels({ locationId: 'van:12', productId: 'prd:01abc' }, 'inventory'),
    ).toEqual(['loc:van:12']);
  });

  it('builds pull grants from a user profile for a shared device', () => {
    expect(
      channelsFromUserProfile({
        employeeId: 'E-4412',
        email: 'jon.hale@example.com',
        routeIds: ['HFD-NORTH'],
        customerIds: ['cus:01abc'],
        assetTypes: ['pump', 'valve'],
        region: 'CT',
        storeId: 'HFD-YARD',
      }),
    ).toEqual([
      'emp:E-4412',
      'email:jon.hale@example.com',
      'route:HFD-NORTH',
      'region:CT',
      'store:HFD-YARD',
      'cus:01abc',
      'assetType:pump',
      'assetType:valve',
    ]);
  });
});
