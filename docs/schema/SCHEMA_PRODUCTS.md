# Schema — `field.products`

| | |
| --- | --- |
| Id | `prd:<ULID>` |
| `type` | `product` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) (no `history[]`; pull catalog) |

**Required:** `type`, `audit`, `sku`, `name`, `uom`.

**Optional:** `description`, `category`, `barcode`, `active`, `defaultRateId` (`rate:`), `embedding`, **`class`** (`online` \| `store`), **`storeId`**, **`region`**.

Channels: `class:{online|store}`, `store:{storeId}`, `region:{region}` — not `type:product`.

**Indexes:** `idx_prd_sku`; FTS `idx_prd_fts` (`name`, `sku`, `description`).

**Replication:** PULL. List price lives on [SCHEMA_RATES.md](./SCHEMA_RATES.md); orders **snapshot** cents onto lines.

---

## JSON Schema

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema). Document body; id is `prd:<ULID>`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Fujio-Turner/mobile_field_service/docs/schema/products.json",
  "title": "field.products",
  "type": "object",
  "additionalProperties": true,
  "required": ["type", "audit", "sku", "name", "uom"],
  "properties": {
    "type": { "const": "product" },
    "audit": { "$ref": "#/$defs/audit" },
    "sku": { "type": "string", "minLength": 1 },
    "name": { "type": "string", "minLength": 1 },
    "uom": { "type": "string", "minLength": 1 },
    "description": { "type": "string" },
    "category": { "type": "string" },
    "class": { "type": "string", "enum": ["online", "store"] },
    "storeId": { "type": "string" },
    "region": { "type": "string" },
    "barcode": { "type": "string" },
    "active": { "type": "boolean" },
    "defaultRateId": { "type": "string" },
    "embedding": { "type": "object", "additionalProperties": true }
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
