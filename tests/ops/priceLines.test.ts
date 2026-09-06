import { memoryGet, memoryReset, memorySave } from '../../src/db/memoryStore';
import {
  SEED_CUSTOMER_ID,
  SEED_INBOUND_ORDER_ID,
  SEED_PRODUCT_ID,
  SEED_RATE_ID,
  SEED_RATE_LABOR_ID,
  SEED_TAX_ID,
  seedCustomerDoc,
  seedInboundOrder,
  seedProductsRatesTaxes,
} from '../../src/db/seedData';
import { resetCopyOnWriteTotals } from '../../src/metrics/copyOnWrite';
import { createCustomer } from '../../src/ops/customers';
import {
  addOrderLine,
  completeOrder,
  createOrder,
  createOrderAmendment,
  getOrder,
  markOrderQuoted,
  setOrderLineQty,
  startOrder,
  submitOrder,
} from '../../src/ops/orders';
import { OutError } from '../../src/ops/outError';
import { formatCents, parseRate, parseTax, priceLines, taxOnSubtotal } from '../../src/ops/pricing';

const session = { employeeId: 'E-4412', email: 'jon.hale@example.com', username: 'tech.jon' };

beforeEach(() => {
  memoryReset();
  resetCopyOnWriteTotals();
  const catalog = seedProductsRatesTaxes('0.1.0+1', 1_700_000_000);
  for (const row of catalog.products) memorySave('products', row.id, row.doc as never);
  for (const row of catalog.rates) memorySave('rates', row.id, row.doc as never);
  for (const row of catalog.taxes) memorySave('taxes', row.id, row.doc as never);
  memorySave('customers', SEED_CUSTOMER_ID, seedCustomerDoc('0.1.0+1', 1_700_000_000) as never);
  const inbound = seedInboundOrder('0.1.0+1', 1_700_000_000, '2026-09-05');
  memorySave('orders', inbound.id, inbound.doc as never);
});

describe('priceLines CT 630 bps', () => {
  it('matches SCHEMA example 37000 * 630 / 10000 = 2331', () => {
    const tax = parseTax(SEED_TAX_ID, memoryGet('taxes', SEED_TAX_ID)!)!;
    expect(tax.rateBps).toBe(630);
    expect(taxOnSubtotal(37000, tax)).toBe(2331);
    const rate = parseRate(SEED_RATE_ID, memoryGet('rates', SEED_RATE_ID)!)!;
    const rates = new Map([[rate.id, rate]]);
    const taxes = new Map([[tax.id, tax]]);
    const priced = priceLines(
      [
        {
          id: 'ln_1',
          productId: SEED_PRODUCT_ID,
          rateId: SEED_RATE_ID,
          qty: 2,
          taxIds: [SEED_TAX_ID],
        },
      ],
      rates,
      taxes,
    );
    expect(priced.lines[0].unitPrice).toBe(18500);
    expect(priced.lines[0].lineSubtotal).toBe(37000);
    expect(priced.lines[0].lineTax).toBe(2331);
    expect(priced.totals.total).toBe(39331);
    expect(formatCents(39331)).toBe('$393.31');
    expect(memoryGet('rates', SEED_RATE_LABOR_ID)?.amount).toBe(12500);
  });
});

describe('orders copy-on-write', () => {
  it('never mutates inbound JSON', async () => {
    const frozen = JSON.stringify(memoryGet('orders', SEED_INBOUND_ORDER_ID));
    const { ordId, created } = await startOrder(SEED_INBOUND_ORDER_ID, session);
    expect(created).toBe(true);
    expect(JSON.stringify(memoryGet('orders', SEED_INBOUND_ORDER_ID))).toBe(frozen);
    expect(memoryGet('orders', ordId)?.role).toBe('working');
    const again = await startOrder(SEED_INBOUND_ORDER_ID, session);
    expect(again.created).toBe(false);
    expect(again.ordId).toBe(ordId);
    const working = await getOrder(ordId);
    expect((working?.totals as { total: number }).total).toBe(39331);
    const rateBefore = structuredClone(memoryGet('rates', SEED_RATE_ID)!);
    await addOrderLine(ordId, session, {
      rateId: SEED_RATE_LABOR_ID,
      qty: 1,
      uom: 'hour',
      taxIds: [SEED_TAX_ID],
    });
    expect(memoryGet('rates', SEED_RATE_ID)).toEqual(rateBefore);
    expect(((await getOrder(ordId))?.totals as { total: number }).total).toBeGreaterThan(39331);
    await markOrderQuoted(ordId, session);
    await submitOrder(ordId, session);
    expect(memoryGet('orders', ordId)?.syncState).toBe('ready_to_push');
    const fieldId = await createOrder(session, { customerName: 'Doorstep' });
    expect(memoryGet('orders', fieldId)?.origin).toBe('field');
    const dispatchCus = structuredClone(memoryGet('customers', SEED_CUSTOMER_ID)!);
    const walkUp = await createCustomer(session, { name: 'Walk-up Co' });
    expect(memoryGet('customers', walkUp)?.origin).toBe('field');
    expect(memoryGet('customers', SEED_CUSTOMER_ID)).toEqual(dispatchCus);
  });

  it('freezes on complete and 409s later line adds; amendment is a new id', async () => {
    const { ordId } = await startOrder(SEED_INBOUND_ORDER_ID, session);
    await completeOrder(ordId, session);
    expect(memoryGet('orders', ordId)?.owner).toBe('backend');
    await expect(
      addOrderLine(ordId, session, { rateId: SEED_RATE_ID, qty: 1, taxIds: [SEED_TAX_ID] }),
    ).rejects.toBeInstanceOf(OutError);
    const amendId = await createOrderAmendment(ordId, session);
    expect(amendId).not.toBe(ordId);
    expect(memoryGet('orders', amendId)?.role).toBe('amendment');
  });

  it('records qty from/to on the working copy only', async () => {
    const { ordId } = await startOrder(SEED_INBOUND_ORDER_ID, session);
    const working = await getOrder(ordId);
    const line = (working?.lines as Array<{ id: string; qty: number }>)[0];
    expect(line.qty).toBe(2);
    await setOrderLineQty(ordId, session, line.id, 1);
    const next = await getOrder(ordId);
    expect((next?.lines as Array<{ qty: number }>)[0].qty).toBe(1);
    const hist = (next?.history as Array<{ op: string }>) ?? [];
    expect(hist[hist.length - 1]?.op).toBe('SetOrderLineQty');
    expect(JSON.stringify(memoryGet('orders', SEED_INBOUND_ORDER_ID))).not.toMatch(/SetOrderLineQty/);
  });
});
