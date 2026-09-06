import { listChildrenMemory, loadChild, queryChildRowsIfNative } from './childStore';

const RATES_SQL = `
SELECT META().id AS id, code, name, kind, amount, currency, unit, active, taxInclusive, defaultTaxIds, productId
FROM field.rates
WHERE type = 'rate'
`;

const TAXES_SQL = `
SELECT META().id AS id, code, name, rateBps, active, inclusive, compound, stack
FROM field.taxes
WHERE type = 'tax'
`;

export type RateDoc = {
  id: string;
  code: string;
  name: string;
  kind: string;
  amount: number;
  currency: string;
  unit: string;
  active: boolean;
  taxInclusive?: boolean;
  defaultTaxIds?: string[];
  productId?: string;
};

export type TaxDoc = {
  id: string;
  code: string;
  name: string;
  rateBps: number;
  active: boolean;
  inclusive?: boolean;
  compound?: boolean;
  stack?: number;
};

export function parseRate(id: string, raw: Record<string, unknown>): RateDoc | null {
  if (String(raw.type ?? 'rate') !== 'rate') return null;
  return {
    id,
    code: String(raw.code ?? ''),
    name: String(raw.name ?? ''),
    kind: String(raw.kind ?? 'product'),
    amount: Number(raw.amount ?? 0),
    currency: String(raw.currency ?? 'USD'),
    unit: String(raw.unit ?? 'ea'),
    active: raw.active !== false,
    taxInclusive: raw.taxInclusive === true,
    defaultTaxIds: Array.isArray(raw.defaultTaxIds) ? raw.defaultTaxIds.map(String) : undefined,
    productId: raw.productId != null ? String(raw.productId) : undefined,
  };
}

export function parseTax(id: string, raw: Record<string, unknown>): TaxDoc | null {
  if (String(raw.type ?? 'tax') !== 'tax') return null;
  return {
    id,
    code: String(raw.code ?? ''),
    name: String(raw.name ?? ''),
    rateBps: Number(raw.rateBps ?? 0),
    active: raw.active !== false,
    inclusive: raw.inclusive === true,
    compound: raw.compound === true,
    stack: raw.stack != null ? Number(raw.stack) : 0,
  };
}

/** half-up integer cents */
export function roundHalfUp(n: number): number {
  return Math.sign(n) * Math.floor(Math.abs(n) + 0.5);
}

export function taxOnSubtotal(lineSubtotal: number, tax: TaxDoc): number {
  if (tax.inclusive) {
    return roundHalfUp(lineSubtotal - (lineSubtotal * 10000) / (10000 + tax.rateBps));
  }
  return roundHalfUp((lineSubtotal * tax.rateBps) / 10000);
}

export type PricedLine = {
  id: string;
  productId?: string;
  rateId?: string;
  description: string;
  qty: number;
  uom: string;
  unitPrice: number;
  taxIds: string[];
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
};

export function priceLines(
  lines: Array<{
    id: string;
    productId?: string;
    rateId?: string;
    description?: string;
    qty: number;
    uom?: string;
    unitPrice?: number;
    taxIds?: string[];
  }>,
  rates: Map<string, RateDoc>,
  taxes: Map<string, TaxDoc>,
): { lines: PricedLine[]; totals: { subtotal: number; taxTotal: number; total: number } } {
  const priced: PricedLine[] = [];
  for (const line of lines) {
    const rate = line.rateId ? rates.get(line.rateId) : undefined;
    const unitPrice = line.unitPrice != null ? line.unitPrice : rate?.amount ?? 0;
    const taxIds =
      line.taxIds && line.taxIds.length > 0
        ? line.taxIds
        : rate?.defaultTaxIds ?? [];
    const lineSubtotal = roundHalfUp(unitPrice * line.qty);
    const taxDocs = taxIds
      .map((id) => taxes.get(id))
      .filter((t): t is TaxDoc => t != null && t.active)
      .sort((a, b) => (a.stack ?? 0) - (b.stack ?? 0) || a.code.localeCompare(b.code));
    let lineTax = 0;
    for (const t of taxDocs) {
      lineTax += taxOnSubtotal(lineSubtotal, t);
    }
    priced.push({
      id: line.id,
      productId: line.productId,
      rateId: line.rateId,
      description: line.description ?? rate?.name ?? 'Line',
      qty: line.qty,
      uom: line.uom ?? rate?.unit ?? 'ea',
      unitPrice,
      taxIds,
      lineSubtotal,
      lineTax,
      lineTotal: lineSubtotal + lineTax,
    });
  }
  const subtotal = priced.reduce((s, l) => s + l.lineSubtotal, 0);
  const taxTotal = priced.reduce((s, l) => s + l.lineTax, 0);
  return { lines: priced, totals: { subtotal, taxTotal, total: subtotal + taxTotal } };
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const n = Math.abs(Math.trunc(cents));
  return `${sign}$${Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}`;
}

export async function loadRateMap(): Promise<Map<string, RateDoc>> {
  const map = new Map<string, RateDoc>();
  const native = await queryChildRowsIfNative(RATES_SQL);
  const rows = native
    ? native.map((row) => ({ id: String(row.id ?? ''), doc: { type: 'rate', ...row } }))
    : listChildrenMemory('rates', () => true);
  for (const row of rows) {
    const r = parseRate(row.id, row.doc);
    if (r) map.set(row.id, r);
  }
  return map;
}

export async function loadTaxMap(): Promise<Map<string, TaxDoc>> {
  const map = new Map<string, TaxDoc>();
  const native = await queryChildRowsIfNative(TAXES_SQL);
  const rows = native
    ? native.map((row) => ({ id: String(row.id ?? ''), doc: { type: 'tax', ...row } }))
    : listChildrenMemory('taxes', () => true);
  for (const row of rows) {
    const t = parseTax(row.id, row.doc);
    if (t) map.set(row.id, t);
  }
  return map;
}

export async function getRate(id: string): Promise<RateDoc | null> {
  const raw = await loadChild('rates', id);
  return raw ? parseRate(id, raw) : null;
}

export async function getTax(id: string): Promise<TaxDoc | null> {
  const raw = await loadChild('taxes', id);
  return raw ? parseTax(id, raw) : null;
}
