# Schema — `field.assets`

| | |
| --- | --- |
| Id | `ast:<ULID>` |
| `type` | `asset` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) (no `history[]`; pull catalog) |

**Required:** `type`, `audit`, `name`, `assetType`, `geo` `{ lat, lon }`.

**Optional:** `code`, `status`, `ownership` (`company` \| `customer`), `customerId`, `address`, `parentAssetId`, `tags[]`, `embedding`.

v1: **pull catalog**. Completing a move WO does **not** `save` the asset; backend applies location from the frozen outbound.

**Indexes:** `idx_ast_geo` (`geo.lat`, `geo.lon`); `idx_ast_type`; FTS `idx_ast_fts` (`name`, `code`, `assetType`).

**Replication:** PULL. Push filter false.

---

## JSON Schema

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema). Document body; id is `ast:<ULID>`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Fujio-Turner/mobile_field_service/docs/schema/assets.json",
  "title": "field.assets",
  "type": "object",
  "additionalProperties": true,
  "required": ["type", "audit", "name", "assetType", "geo"],
  "properties": {
    "type": { "const": "asset" },
    "audit": { "$ref": "#/$defs/audit" },
    "name": { "type": "string", "minLength": 1 },
    "assetType": { "type": "string", "minLength": 1 },
    "geo": { "$ref": "#/$defs/geo" },
    "code": { "type": "string" },
    "status": { "type": "string" },
    "ownership": { "type": "string", "enum": ["company", "customer"] },
    "customerId": { "type": "string" },
    "address": { "$ref": "#/$defs/address" },
    "parentAssetId": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
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
    },
    "geo": {
      "type": "object",
      "additionalProperties": false,
      "required": ["lat", "lon"],
      "properties": {
        "lat": { "type": "number", "minimum": -90, "maximum": 90 },
        "lon": { "type": "number", "minimum": -180, "maximum": 180 },
        "accuracyM": { "type": "number", "minimum": 0 }
      }
    },
    "address": {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "line1": { "type": "string" },
        "city": { "type": "string" },
        "region": { "type": "string" },
        "postal": { "type": "string" },
        "country": { "type": "string" }
      }
    }
  }
}
```
