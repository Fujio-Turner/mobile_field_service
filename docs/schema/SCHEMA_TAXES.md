# Schema — `field.taxes`

| Field | Value |
| --- | --- |
| Collection | `taxes` (scope `field`) |
| Doc id | `tax:<ULID>` |
| `type` | `tax` |
| Repo | [Fujio-Turner/mobile_field_service](https://github.com/Fujio-Turner/mobile_field_service) |
| Date | 2026-09-04 |
| Design | [DESIGN.md](../DESIGN.md) |
| Used by | [SCHEMA_ORDERS.md](./SCHEMA_ORDERS.md), [SCHEMA_RATES.md](./SCHEMA_RATES.md) |

Tax codes / jurisdictions. **Pull-only catalog.** Orders snapshot computed `lineTax` in cents. The device never `save`s tax documents.

---

## Envelope

`type`, `audit.cr|up.{dt,ver,by}` (unix seconds). No `history[]` (pull catalog).

---

## Fields

**Required:** `type`, `audit`, `code`, `name`, `rateBps`, `active`.

**Optional:** `jurisdiction`, `compound`, `inclusive`, `effectiveFromDt`, `effectiveToDt`, `stack` (apply order, integer).

| Field | Notes |
| --- | --- |
| `rateBps` | Integer **basis points**. `625` = 6.25%. Never a float percent. |
| `inclusive` | Tax is already in `rates.amount` / `unitPrice` |
| `compound` | Applied to (subtotal + earlier taxes) when `stack` is higher |
| `jurisdiction` | `{ country, region?, city? }` e.g. `US` / `CT` |
| `effectiveFromDt` / `effectiveToDt` | Unix seconds |

v1 `PriceLines` (exclusive, non-compound — the default):

```
lineTax = round_half_up(lineSubtotal * rateBps / 10000)
```

Inclusive:

```
lineTax = round_half_up(lineSubtotal - lineSubtotal * 10000 / (10000 + rateBps))
```

Multiple `taxIds` on a line: apply in `stack` ascending, then `code`. Store the **sum** on `lineTax` (v1 does not persist a per-tax breakdown; add `taxBreak[]` later if invoicing needs it).

---

## Example

```json
{
  "type": "tax",
  "audit": {
    "cr": { "dt": 1750000000, "ver": "server", "by": "tax" },
    "up": { "dt": 1788400000, "ver": "server", "by": "tax" }
  },
  "code": "CT-SALES",
  "name": "Connecticut sales tax",
  "rateBps": 630,
  "inclusive": false,
  "compound": false,
  "stack": 10,
  "jurisdiction": { "country": "US", "region": "CT" },
  "effectiveFromDt": 1750000000,
  "active": true
}
```

`630` bps = 6.30%. Line subtotal $370.00 (`37000` cents) → `37000 * 630 / 10000 = 2331` cents. Seed and [SCHEMA_ORDERS.md](./SCHEMA_ORDERS.md) examples **must** use this formula.

---

## Indexes

| Name | Kind | Keys |
| --- | --- | --- |
| `idx_tax_code` | value | `code` |
| `idx_tax_active` | value | `active`, `jurisdiction.region` |

---

## Replication

**PULL only.** Push filter `return false`. Channel: `district:{id}` and/or `public`.

Hard rule: saved orders display `lines[].lineTax` / `totals.taxTotal`, not a live join to `taxes.rateBps`.

---

## JSON Schema

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema). Document body; id is `tax:<ULID>`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Fujio-Turner/mobile_field_service/docs/schema/taxes.json",
  "title": "field.taxes",
  "type": "object",
  "additionalProperties": true,
  "required": ["type", "audit", "code", "name", "rateBps", "active"],
  "properties": {
    "type": { "const": "tax" },
    "audit": { "$ref": "#/$defs/audit" },
    "code": { "type": "string", "minLength": 1 },
    "name": { "type": "string", "minLength": 1 },
    "rateBps": {
      "type": "integer",
      "minimum": 0,
      "description": "Integer basis points. 630 = 6.30%."
    },
    "active": { "type": "boolean" },
    "jurisdiction": {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "country": { "type": "string" },
        "region": { "type": "string" },
        "city": { "type": "string" }
      }
    },
    "compound": { "type": "boolean" },
    "inclusive": { "type": "boolean" },
    "effectiveFromDt": { "$ref": "#/$defs/unixSeconds" },
    "effectiveToDt": { "$ref": "#/$defs/unixSeconds" },
    "stack": { "type": "integer" }
  },
  "$defs": {
    "unixSeconds": { "type": "integer", "minimum": 0 },
    "auditStamp": {
      "type": "object",
      "additionalProperties": false,
      "required": ["dt", "ver", "by"],
      "properties": {
        "dt": { "$ref": "#/$defs/unixSeconds" },
        "ver": { "type": "string" },
        "by": { "type": "string" }
      }
    },
    "audit": {
      "type": "object",
      "additionalProperties": false,
      "required": ["cr", "up"],
      "properties": {
        "cr": { "$ref": "#/$defs/auditStamp" },
        "up": { "$ref": "#/$defs/auditStamp" }
      }
    }
  }
}
```