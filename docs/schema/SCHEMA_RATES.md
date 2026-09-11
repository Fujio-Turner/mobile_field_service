# Schema — `field.rates`

| Field | Value |
| --- | --- |
| Collection | `rates` (scope `field`) |
| Doc id | `rate:<ULID>` |
| `type` | `rate` |
| Repo | [Fujio-Turner/mobile_field_service](https://github.com/Fujio-Turner/mobile_field_service) |
| Date | 2026-09-04 |
| Design | [DESIGN.md](../DESIGN.md) |
| Used by | [SCHEMA_ORDERS.md](./SCHEMA_ORDERS.md) |

Price book: labor, product, service, travel, surcharge. **Pull-only catalog.** The device never `save`s rate documents. Orders **snapshot** `amount` onto `lines[].unitPrice` at add-line / reprice time.

---

## Envelope

`type`, `audit.cr|up.{dt,ver,by}` (unix seconds). No `history[]` (pull catalog).

---

## Fields

**Required:** `type`, `audit`, `code`, `name`, `kind`, `amount`, `currency`, `unit`, `active`.

**Optional:** `productId`, `description`, `effectiveFromDt`, `effectiveToDt`, `taxInclusive`, `defaultTaxIds[]`, `minQty`, `crewId`, `districtId`, **`storeId`**, **`customerId`**, **`region`**.

Channels: `store:` `cus:` `region:` (promo by store, customer, or region).

| Field | Values / notes |
| --- | --- |
| `kind` | `labor` \| `product` \| `service` \| `travel` \| `surcharge` |
| `amount` | Integer **cents** (or minor units) per `unit` |
| `currency` | `USD` |
| `unit` | `hour` \| `ea` \| `mile` \| `flat` \| `day` |
| `taxInclusive` | If true, `amount` includes tax; `PriceLines` extracts tax using [SCHEMA_TAXES.md](./SCHEMA_TAXES.md) |
| `defaultTaxIds` | Default `tax:` ids when a line does not override |
| `effectiveFromDt` / `effectiveToDt` | Unix seconds; omit `to` = open-ended |
| `productId` | When this rate is the list price of a `prd:` |

Pick the rate where `active === true` and `effectiveFromDt <= now < effectiveToDt` (missing `to` = open). If several match, prefer `districtId` then `crewId` then global (`districtId` absent).

---

## Example

```json
{
  "type": "rate",
  "audit": {
    "cr": { "dt": 1750000000, "ver": "server", "by": "pricing" },
    "up": { "dt": 1788400000, "ver": "server", "by": "pricing" }
  },
  "code": "VLV-CHK-4-LIST",
  "name": "Check valve 4in list",
  "kind": "product",
  "productId": "prd:01K4Q6PPP00000000000000001",
  "amount": 18500,
  "currency": "USD",
  "unit": "ea",
  "taxInclusive": false,
  "defaultTaxIds": ["tax:01K4Q6TAX00000000000001"],
  "effectiveFromDt": 1750000000,
  "active": true,
  "districtId": "district:north"
}
```

Labor example: `kind: service`, `code: LABOR-STD`, `amount: 12500` ($125.00), `unit: hour`.

---

## Indexes

| Name | Kind | Keys |
| --- | --- | --- |
| `idx_rate_code` | value | `code` |
| `idx_rate_product` | value | `productId`, `active` |
| `idx_rate_kind` | value | `kind`, `active` |
| FTS `idx_rate_fts` | fts | `code`, `name`, `description` |

---

## Replication

**PULL only.** Push filter `return false`. Channel: `district:{id}` and/or `public`.

Hard rule: **no live join** from an order line to `rates.amount` for display of a saved order. Show `lines[].unitPrice`.

---

## JSON Schema

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema). Document body; id is `rate:<ULID>`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Fujio-Turner/mobile_field_service/docs/schema/rates.json",
  "title": "field.rates",
  "type": "object",
  "additionalProperties": true,
  "required": ["type", "audit", "code", "name", "kind", "amount", "currency", "unit", "active"],
  "properties": {
    "type": { "const": "rate" },
    "audit": { "$ref": "#/$defs/audit" },
    "code": { "type": "string", "minLength": 1 },
    "name": { "type": "string", "minLength": 1 },
    "kind": { "type": "string", "enum": ["labor", "product", "service", "travel", "surcharge"] },
    "amount": { "type": "integer", "description": "Integer cents per unit" },
    "currency": { "type": "string", "minLength": 3, "maxLength": 3 },
    "unit": { "type": "string", "enum": ["hour", "ea", "mile", "flat", "day"] },
    "active": { "type": "boolean" },
    "productId": { "type": "string" },
    "description": { "type": "string" },
    "effectiveFromDt": { "$ref": "#/$defs/unixSeconds" },
    "effectiveToDt": { "$ref": "#/$defs/unixSeconds" },
    "taxInclusive": { "type": "boolean" },
    "defaultTaxIds": { "type": "array", "items": { "type": "string" } },
    "minQty": { "type": "number" },
    "crewId": { "type": "string" },
    "districtId": { "type": "string" }
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
