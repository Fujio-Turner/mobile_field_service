# Schema — `field.messages`

| | |
| --- | --- |
| Id | `msg:<ULID>` |
| `type` | `message` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) |

**Required:** `type`, `audit`, `history[]`, `threadId`, `kind` (`job` \| `direct`), `from`, `body`, `readyToPush`.

**Optional:** `workOrderInId`, `workOrderOutId`, `workOrderNumber`, `orderId`, `orderNumber`, `toEmployeeIds[]`.

`threadId`: `thr:wo:{woinId}` or `thr:dm:{empA}:{empB}` (ids sorted).

Body may include `@username` / `@employeeId` and `WO-10482` / `ORD-3301`. `SendMessage` resolves those to `toEmployeeIds` and the work/order ids. Completing a WO does not freeze the thread. The tagged job document is **not** mutated by the chat.

**Employees only.** Completing a WO does not freeze the thread. `readyToPush: true` on create.

**Indexes:** `idx_msg_thread`; `idx_msg_wo`.

**Replication:** PUSH_AND_PULL when `readyToPush`.

---

## JSON Schema

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema). Document body; id is `msg:<ULID>`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Fujio-Turner/mobile_field_service/docs/schema/messages.json",
  "title": "field.messages",
  "type": "object",
  "additionalProperties": true,
  "required": ["type", "audit", "history", "threadId", "kind", "from", "body", "readyToPush"],
  "properties": {
    "type": { "const": "message" },
    "audit": { "$ref": "#/$defs/audit" },
    "history": {
      "type": "array",
      "maxItems": 100,
      "items": { "$ref": "#/$defs/historyEntry" }
    },
    "threadId": { "type": "string", "pattern": "^thr:(wo|dm):.+" },
    "kind": { "type": "string", "enum": ["job", "direct"] },
    "from": { "$ref": "#/$defs/assignedTo" },
    "body": { "type": "string", "minLength": 1 },
    "readyToPush": { "type": "boolean" },
    "workOrderInId": { "type": "string" },
    "workOrderOutId": { "type": "string" },
    "workOrderNumber": { "type": "string" },
    "orderId": { "type": "string" },
    "orderNumber": { "type": "string" },
    "toEmployeeIds": { "type": "array", "items": { "type": "string" } }
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
