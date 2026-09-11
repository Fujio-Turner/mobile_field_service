# Schema — `field.notes`

| | |
| --- | --- |
| Id | `nte:<ULID>` |
| `type` | `note` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) |

**Required:** `type`, `audit`, `history[]`, `body`, `kind` (`job` \| `general`).

**Optional:** `title`, `workOrderOutId`, `readyToPush`, `customerId`.

**Required for sync:** `assignedTo` (or `employeeId` / `email` / `customerId` / `routeId`) — at least one. **Push and pull** so notes appear on phone and tablet.

**409** if parent WO is frozen — use amendment or [SCHEMA_MESSAGES.md](./SCHEMA_MESSAGES.md).

**Indexes:** `idx_nte_wo`; FTS `idx_nte_fts` (`body`, `title`).

**Replication:** PUSH_AND_PULL when `readyToPush`.

---

## JSON Schema

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema). Document body; id is `nte:<ULID>`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Fujio-Turner/mobile_field_service/docs/schema/notes.json",
  "title": "field.notes",
  "type": "object",
  "additionalProperties": true,
  "required": ["type", "audit", "history", "body", "kind"],
  "properties": {
    "type": { "const": "note" },
    "audit": { "$ref": "#/$defs/audit" },
    "history": {
      "type": "array",
      "maxItems": 100,
      "items": { "$ref": "#/$defs/historyEntry" }
    },
    "historyTruncated": { "type": "boolean" },
    "body": { "type": "string", "minLength": 1 },
    "kind": { "type": "string", "enum": ["job", "general"] },
    "title": { "type": "string" },
    "workOrderOutId": { "type": "string" },
    "customerId": { "type": "string" },
    "assignedTo": { "$ref": "#/$defs/assignedTo" },
    "employeeId": { "type": "string" },
    "email": { "type": "string", "format": "email" },
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
      "additionalProperties": true,
      "properties": {
        "employeeId": { "type": "string" },
        "email": { "type": "string", "format": "email" },
        "username": { "type": "string" },
        "displayName": { "type": "string" },
        "userId": { "type": "string" }
      }
    }
  }
}
```
