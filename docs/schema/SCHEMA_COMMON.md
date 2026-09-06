# Schema — shared envelope

Every product document (except raw CBL internals) has `type` + `audit`. **User/device-created** docs also carry `history[]` (self-contained audit trail). Pull catalogs (`rates`, `taxes`, `products`, dispatch `assets` / `users`) omit `history`.

```ts
type: string;

audit: {
  cr: { dt: number; ver: string; by: string }; // unix **seconds**
  up: { dt: number; ver: string; by: string };
};

/** Field-level trail. Newest last. Cap 100; then drop oldest, set historyTruncated. */
history?: HistoryEntry[];
historyTruncated?: boolean;
```

```ts
interface HistoryEntry {
  dt: number;            // unix seconds
  lat?: number;          // omit if no GPS
  lon?: number;
  accuracyM?: number;
  by: string;            // username (audit.by)
  ver: string;           // app version
  op: string;            // catalog name: StartWork, UpdateWorkOrderOutFields
  changes?: Array<{
    path: string;        // JSON path: "materials.0.qtyUsed", "status"
    from?: unknown;      // previous value (scalars / short strings)
    to?: unknown;
  }>;
}
```

Example: qty 10 → 5 on site:

```json
{
  "dt": 1788526100,
  "lat": 41.7659,
  "lon": -72.6735,
  "accuracyM": 8,
  "by": "tech.jon",
  "ver": "0.1.0+12",
  "op": "UpdateWorkOrderOutFields",
  "changes": [{ "path": "materials.0.qtyUsed", "from": 10, "to": 5 }]
}
```

On create, `up` may equal `cr`. First `history` row is the create (`op` = `StartWork` / `CreateOrder` / …). GPS best-effort — never block a save. Do **not** append history on `SetSyncState` (push bookkeeping). Do **not** dump whole arrays/objects into `from`/`to` (ids and scalars only).

There is **no** `lastAction` object. Place-time lives on each `history[]` row. Status transitions are rows with `path: "status"`.

Breadcrumb GPS that is **not** tied to a field edit lives in [SCHEMA_TRACKING.md](./SCHEMA_TRACKING.md), not here.

| `history[]` | Collections |
| --- | --- |
| **Yes** (user/device writes) | `workordersout`; `inventory_tx`; `notes`; `messages`; `tasks` instances; `customers` `origin: field`; `workordersin` `origin: field`; `orders` `role` working/amendment |
| **No** | Pull catalogs (`assets`, `products`, `users`, `rates`, `taxes`, stock `inventory`, `task_template`, dispatch inbound, inbound orders); `tracking`; `tmp` |

`assignedTo` (when present): `{ userId, employeeId, email, username, displayName }`. Channel `emp:{employeeId}`. SG login = **email**.

Ids: `<prefix>:<ULID>`. Reserved: `_id`, `_rev`, `_sequence`, `_attachments`, `_deleted`, `_removed`.

---

## JSON Schema

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema). Shared `$defs` for every collection body. Collection files include a copy so each document is self-contained.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Fujio-Turner/mobile_field_service/docs/schema/common.json",
  "title": "MFS shared envelope",
  "type": "object",
  "required": ["type", "audit"],
  "additionalProperties": true,
  "properties": {
    "type": { "type": "string", "minLength": 1 },
    "audit": { "$ref": "#/$defs/audit" },
    "history": {
      "type": "array",
      "maxItems": 100,
      "items": { "$ref": "#/$defs/historyEntry" }
    },
    "historyTruncated": { "type": "boolean" }
  },
  "$defs": {
    "unixSeconds": {
      "type": "integer",
      "minimum": 0,
      "description": "Unix time in seconds, not milliseconds"
    },
    "auditStamp": {
      "type": "object",
      "additionalProperties": false,
      "required": ["dt", "ver", "by"],
      "properties": {
        "dt": { "$ref": "#/$defs/unixSeconds" },
        "ver": { "type": "string" },
        "by": { "type": "string", "description": "username (audit.by)" }
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
      "properties": {
        "path": { "type": "string", "minLength": 1 },
        "from": true,
        "to": true
      }
    },
    "historyEntry": {
      "type": "object",
      "additionalProperties": false,
      "required": ["dt", "by", "ver", "op"],
      "properties": {
        "dt": { "$ref": "#/$defs/unixSeconds" },
        "lat": { "type": "number", "minimum": -90, "maximum": 90 },
        "lon": { "type": "number", "minimum": -180, "maximum": 180 },
        "accuracyM": { "type": "number", "minimum": 0 },
        "by": { "type": "string" },
        "ver": { "type": "string" },
        "op": { "type": "string", "minLength": 1 },
        "changes": {
          "type": "array",
          "items": { "$ref": "#/$defs/historyChange" }
        }
      }
    },
    "assignedTo": {
      "type": "object",
      "additionalProperties": false,
      "required": ["employeeId"],
      "properties": {
        "userId": { "type": "string" },
        "employeeId": { "type": "string", "minLength": 1 },
        "email": { "type": "string", "format": "email" },
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
    "cents": {
      "type": "integer",
      "description": "Currency minor units (integer cents). Never a binary float."
    }
  }
}
```
