# Schema — `field.customers`

| | |
| --- | --- |
| Id | `cus:<ULID>` |
| `type` | `customer` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) |

**Required:** `type`, `audit`, `name`. Field-created also `history[]`.

**Optional:** `origin` (`dispatch` \| `field`), `accountNumber`, `contacts[]`, `sites[]`, `readyToPush`, `assignedTo`.

**Never patch** `origin: dispatch`. Walk-up → `CreateCustomer` new id, `origin: field`.

**Indexes:** `idx_cus_name`; `idx_cus_account`; `idx_cus_origin`.

**Replication:** PULL master. PUSH if `origin == 'field' && readyToPush`.

---

## JSON Schema

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema). Document body; id is `cus:<ULID>`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Fujio-Turner/mobile_field_service/docs/schema/customers.json",
  "title": "field.customers",
  "type": "object",
  "additionalProperties": true,
  "required": ["type", "audit", "name"],
  "properties": {
    "type": { "const": "customer" },
    "audit": { "$ref": "#/$defs/audit" },
    "history": {
      "type": "array",
      "maxItems": 100,
      "items": { "$ref": "#/$defs/historyEntry" }
    },
    "historyTruncated": { "type": "boolean" },
    "name": { "type": "string", "minLength": 1 },
    "origin": { "type": "string", "enum": ["dispatch", "field"] },
    "accountNumber": { "type": "string" },
    "contacts": { "type": "array", "items": { "type": "object", "additionalProperties": true } },
    "sites": { "type": "array", "items": { "type": "object", "additionalProperties": true } },
    "readyToPush": { "type": "boolean" },
    "assignedTo": { "$ref": "#/$defs/assignedTo" }
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
    }
  }
}
```
