import { collectDocChannels, assertDocChannels } from '../../src/sync/docChannels';

describe('collectDocChannels', () => {
  it('channels workorders from assignedTo + customerId + email', () => {
    expect(
      collectDocChannels(
        {
          type: 'workorderin',
          assignedTo: { employeeId: 'E-4412', email: 'Jon.Hale@example.com' },
          customerId: 'cus:01K4Q6CCC00000000000000001',
        },
        'workordersin',
      ),
    ).toEqual(['emp:E-4412', 'email:jon.hale@example.com', 'cus:01K4Q6CCC00000000000000001']);
  });

  it('requires identity fields on notes / users / orders', () => {
    expect(() => assertDocChannels({ type: 'note', body: 'x' }, 'notes')).toThrow(/employeeId/);
    expect(
      assertDocChannels(
        { type: 'user', employeeId: 'E-4412', email: 'jon.hale@example.com', role: 'technician' },
        'users',
      ),
    ).toEqual(['emp:E-4412', 'email:jon.hale@example.com', 'type:user', 'role:technician']);
  });

  it('does not use a hardcoded public channel on catalogs', () => {
    const products = collectDocChannels(
      { type: 'product', sku: 'VLV-CHK-4', category: 'valves' },
      'products',
    );
    expect(products).toEqual(['type:product', 'cat:valves', 'sku:VLV-CHK-4']);
    expect(products.some((c) => c === '!' || c === 'public')).toBe(false);

    const assets = collectDocChannels(
      { type: 'asset', ownership: 'company', assetType: 'pump', code: 'P-12' },
      'assets',
    );
    expect(assets).toEqual(['type:asset', 'ownership:company', 'assetType:pump', 'code:P-12']);
  });

  it('channels inventory stock by location and products by sku', () => {
    expect(
      collectDocChannels(
        { type: 'inventory', locationId: 'van:12', productId: 'prd:01abc' },
        'inventory',
      ),
    ).toEqual(['type:inventory', 'loc:van:12', 'prd:01abc']);
  });
});
