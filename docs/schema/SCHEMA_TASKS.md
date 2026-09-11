# Schema — `field.tasks`

| | |
| --- | --- |
| Id | `tsk:<ULID>` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) |

### Instance `type: task`

**Required:** `type`, `audit`, `history[]`, `title`, `status` (`open` \| `done` \| `skipped`), `workOrderOutId`.

**Optional:** `required`, `sort`, `templateId`, `readyToPush`, **`routeId`**, `assignedTo` / `employeeId`.

Channels: `emp:` (boss → Bob) and/or `route:` (everyone on that route).

Cloned from inbound `taskIds` on `StartWork`. Do not complete templates.

### Template `type: task_template`

No `workOrderOutId`. Pull only.

**Indexes:** `idx_tsk_wo`; `idx_tsk_type`.

**Replication:** PUSH instances when `readyToPush`. Templates never push.

---

## JSON Schema

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema). Instance id and template id are both `tsk:<ULID>`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Fujio-Turner/mobile_field_service/docs/schema/tasks.json",
  "title": "field.tasks",
  "oneOf": [
    { "$ref": "#/$defs/instance" },
    { "$ref": "#/$defs/template" }
  ],
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
    "instance": {
      "type": "object",
      "additionalProperties": true,
      "required": ["type", "audit", "history", "title", "status", "workOrderOutId"],
      "properties": {
        "type": { "const": "task" },
        "audit": { "$ref": "#/$defs/audit" },
        "history": {
          "type": "array",
          "maxItems": 100,
          "items": { "$ref": "#/$defs/historyEntry" }
        },
        "title": { "type": "string", "minLength": 1 },
        "status": { "type": "string", "enum": ["open", "done", "skipped"] },
        "workOrderOutId": { "type": "string" },
        "required": { "type": "boolean" },
        "sort": { "type": "number" },
        "templateId": { "type": "string" },
        "readyToPush": { "type": "boolean" }
      }
    },
    "template": {
      "type": "object",
      "additionalProperties": true,
      "required": ["type", "audit", "title"],
      "properties": {
        "type": { "const": "task_template" },
        "audit": { "$ref": "#/$defs/audit" },
        "title": { "type": "string", "minLength": 1 },
        "required": { "type": "boolean" },
        "sort": { "type": "number" }
      },
      "not": { "required": ["workOrderOutId"] }
    }
  }
}
```
