# Schema — `field.workordersin`

| | |
| --- | --- |
| Id | `woin:<ULID>` |
| `type` | `workorderin` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) |

**Required:** `type`, `audit`, `number`, `priority`, `status`, `assignedTo`, `customerId` (or omit on pure asset jobs), `site`, `scheduled`, `summary`.

**Optional:** `origin` (`dispatch` \| `field`), `kind` (`inspect` \| `repair` \| `move` \| `maintain` \| `deliver` \| `service`), `orderId`, `operations[]`, `taskIds[]`, `checklist[]`, `materials[]`, `assetIds[]`, `readyToPush`.

**Optional for `kind: move`:** `move.from` / `move.to` — `{ name, geo: { lat, lon } }`. Copied onto the outbound working copy; the asset master is not patched.

`status` (dispatch-owned on pulled docs): `scheduled` \| `assigned` \| `cancelled` \| `superseded`.

**Writes:** never patch `origin: dispatch`. Phone may **create** `origin: field` (`CreateWorkOrderIn`, assigned to self) with `history[]`. Labor still uses [SCHEMA_WORKORDERSOUT.md](./SCHEMA_WORKORDERSOUT.md) after `StartWork`.

**Indexes:** `idx_woin_today` (`assignedTo.employeeId`, `scheduled.day`, `scheduled.startDt`); `idx_woin_number`; `idx_woin_customer`.

**Replication:** PULL dispatch. PUSH if `origin == 'field' && readyToPush`.

---

## JSON Schema

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema). Document body; id is `woin:<ULID>`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Fujio-Turner/mobile_field_service/docs/schema/workordersin.json",
  "title": "field.workordersin",
  "type": "object",
  "additionalProperties": true,
  "required": ["type", "audit", "number", "priority", "status", "assignedTo", "site", "scheduled", "summary"],
  "properties": {
    "type": { "const": "workorderin" },
    "audit": { "$ref": "#/$defs/audit" },
    "history": {
      "type": "array",
      "maxItems": 100,
      "items": { "$ref": "#/$defs/historyEntry" }
    },
    "number": { "type": "string", "minLength": 1 },
    "priority": { "type": "string" },
    "status": { "type": "string", "enum": ["scheduled", "assigned", "cancelled", "superseded"] },
    "assignedTo": { "$ref": "#/$defs/assignedTo" },
    "customerId": { "type": "string" },
    "site": { "$ref": "#/$defs/site" },
    "scheduled": { "$ref": "#/$defs/scheduled" },
    "summary": { "type": "string" },
    "description": { "type": "string" },
    "origin": { "type": "string", "enum": ["dispatch", "field"] },
    "kind": {
      "type": "string",
      "enum": ["inspect", "repair", "move", "maintain", "deliver", "service"]
    },
    "orderId": { "type": "string" },
    "operations": { "type": "array", "items": { "$ref": "#/$defs/operation" } },
    "taskIds": { "type": "array", "items": { "type": "string" } },
    "checklist": { "type": "array", "items": { "$ref": "#/$defs/checkItem" } },
    "materials": { "type": "array", "items": { "$ref": "#/$defs/materialPlan" } },
    "assetIds": { "type": "array", "items": { "type": "string" } },
    "move": {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "from": { "$ref": "#/$defs/movePoint" },
        "to": { "$ref": "#/$defs/movePoint" }
      }
    },
    "readyToPush": { "type": "boolean" }
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
    "historyChange": {
      "type": "object",
      "additionalProperties": false,
      "required": ["path"],
      "properties": { "path": { "type": "string" }, "from": true, "to": true }
    },
    "historyEntry": {
      "type": "object",
      "additionalProperties": false,
      "required": ["dt", "by", "ver", "op"],
      "properties": {
        "dt": { "$ref": "#/$defs/unixSeconds" },
        "lat": { "type": "number" },
        "lon": { "type": "number" },
        "accuracyM": { "type": "number" },
        "by": { "type": "string" },
        "ver": { "type": "string" },
        "op": { "type": "string" },
        "changes": { "type": "array", "items": { "$ref": "#/$defs/historyChange" } }
      }
    },
    "assignedTo": {
      "type": "object",
      "additionalProperties": false,
      "required": ["employeeId"],
      "properties": {
        "userId": { "type": "string" },
        "employeeId": { "type": "string" },
        "email": { "type": "string" },
        "username": { "type": "string" },
        "displayName": { "type": "string" }
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
    },
    "site": {
      "type": "object",
      "additionalProperties": true,
      "required": ["name"],
      "properties": {
        "name": { "type": "string" },
        "address": { "$ref": "#/$defs/address" },
        "geo": { "$ref": "#/$defs/geo" }
      }
    },
    "scheduled": {
      "type": "object",
      "additionalProperties": true,
      "required": ["startDt"],
      "properties": {
        "startDt": { "$ref": "#/$defs/unixSeconds" },
        "endDt": { "$ref": "#/$defs/unixSeconds" },
        "day": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" }
      }
    },
    "operation": {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "code": { "type": "string" },
        "status": { "type": "string" },
        "required": { "type": "boolean" }
      }
    },
    "checkItem": {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "id": { "type": "string" },
        "label": { "type": "string" },
        "done": { "type": "boolean" },
        "required": { "type": "boolean" }
      }
    },
    "materialPlan": {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "sku": { "type": "string" },
        "name": { "type": "string" },
        "qtyPlanned": { "type": "number" },
        "productId": { "type": "string" }
      }
    },
    "movePoint": {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "name": { "type": "string" },
        "geo": { "$ref": "#/$defs/geo" }
      }
    }
  }
}
```
