# Schema — `field.workordersout`

| | |
| --- | --- |
| Id | `woout:<ULID>` |
| `type` | `workorderout` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) |

**Required:** `type`, `audit`, `history[]`, `number`, `priority`, `status`, `syncState`, `role` (`primary` \| `amendment`), `owner` (`technician` \| `backend`), `assignedTo`, `site`, `scheduled`, `summary`, `source`.

**Optional:** kit fields from inbound, `blockedReason`, `photos[]` (metadata; blobs at `photo:<id>`), `amends`, `completedAt`, `historyTruncated`.

`status`: `assigned` \| `in_progress` \| `blocked` \| `complete` \| `cancelled`.  
`syncState`: `local_draft` \| `ready_to_push` \| `pushed` \| `push_error`.

Complete/cancel → `owner: backend`, body **frozen**. Forgotten facts → new doc `role: amendment`, `amends.id`. Never mutate inbound.

**Indexes:** `idx_woout_source` (`assignedTo.employeeId`, `source.id`, `role`); `idx_woout_today`; `idx_woout_amends`; `idx_woout_sync`.

**Replication:** PUSH_AND_PULL. Filter: `syncState` in ready_to_push \| pushed \| push_error.

---

## JSON Schema

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema). Document body; id is `woout:<ULID>`. Extra inbound kit fields and top-level `photo:<id>` blob keys are allowed (`additionalProperties`).

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Fujio-Turner/mobile_field_service/docs/schema/workordersout.json",
  "title": "field.workordersout",
  "type": "object",
  "additionalProperties": true,
  "required": [
    "type", "audit", "history", "number", "priority", "status", "syncState",
    "role", "owner", "assignedTo", "site", "scheduled", "summary", "source"
  ],
  "properties": {
    "type": { "const": "workorderout" },
    "audit": { "$ref": "#/$defs/audit" },
    "history": {
      "type": "array",
      "maxItems": 100,
      "items": { "$ref": "#/$defs/historyEntry" }
    },
    "historyTruncated": { "type": "boolean" },
    "number": { "type": "string", "minLength": 1 },
    "priority": { "type": "string" },
    "status": {
      "type": "string",
      "enum": ["assigned", "in_progress", "blocked", "complete", "cancelled"]
    },
    "syncState": {
      "type": "string",
      "enum": ["local_draft", "ready_to_push", "pushed", "push_error"]
    },
    "role": { "type": "string", "enum": ["primary", "amendment"] },
    "owner": { "type": "string", "enum": ["technician", "backend"] },
    "assignedTo": { "$ref": "#/$defs/assignedTo" },
    "site": { "$ref": "#/$defs/site" },
    "scheduled": { "$ref": "#/$defs/scheduled" },
    "summary": { "type": "string" },
    "source": {
      "type": "object",
      "additionalProperties": true,
      "required": ["id"],
      "properties": {
        "id": { "type": "string" },
        "type": { "type": "string" },
        "collection": { "type": "string" },
        "copiedAt": { "$ref": "#/$defs/unixSeconds" },
        "snapshot": { "type": "object" },
        "dropped": { "type": "boolean" }
      }
    },
    "kind": { "type": "string" },
    "customerId": { "type": "string" },
    "blockedReason": { "type": "string" },
    "blockedNote": { "type": "string" },
    "cancelledReason": { "type": "string" },
    "completedAt": { "$ref": "#/$defs/unixSeconds" },
    "photos": { "type": "array", "maxItems": 20, "items": { "$ref": "#/$defs/photoMeta" } },
    "amends": {
      "type": "object",
      "additionalProperties": true,
      "required": ["id"],
      "properties": {
        "id": { "type": "string" },
        "number": { "type": "string" },
        "completedAt": { "$ref": "#/$defs/unixSeconds" }
      }
    },
    "operations": { "type": "array", "items": { "type": "object", "additionalProperties": true } },
    "checklist": { "type": "array", "items": { "type": "object", "additionalProperties": true } },
    "materials": { "type": "array", "items": { "type": "object", "additionalProperties": true } },
    "assetIds": { "type": "array", "items": { "type": "string" } },
    "orderId": { "type": "string" },
    "move": { "type": "object", "additionalProperties": true },
    "taskIds": { "type": "array", "items": { "type": "string" } }
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
    "site": {
      "type": "object",
      "additionalProperties": true,
      "required": ["name"],
      "properties": {
        "name": { "type": "string" },
        "address": { "type": "object", "additionalProperties": true },
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
    "photoMeta": {
      "type": "object",
      "additionalProperties": true,
      "required": ["id", "kind", "contentType", "byteLength", "capturedAt", "blobKey", "thumbKey"],
      "properties": {
        "id": { "type": "string" },
        "kind": { "type": "string", "enum": ["before", "during", "after", "other"] },
        "caption": { "type": "string" },
        "contentType": { "const": "image/jpeg" },
        "byteLength": { "type": "integer", "minimum": 0 },
        "capturedAt": { "$ref": "#/$defs/unixSeconds" },
        "blobKey": { "type": "string" },
        "thumbKey": { "type": "string" },
        "localUri": { "type": "string" }
      }
    }
  }
}
```
