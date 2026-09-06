# Schema — `field.users`

| | |
| --- | --- |
| Id | `usr:<ULID>` |
| `type` | `user` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) (no `history[]`; pull profile) |

**Required:** `type`, `audit`, `employeeId`, `email`, `username`, `displayName`, `role`.

**Optional:** `workModes[]` (`assets` \| `customer` \| `sales`), `crewId`, `districtId`, `vanId`, `phone`, `active`.

**Never:** `password`, `hash`, `session`, `token`.

SG login = **email**. Channel = `emp:{employeeId}`. `audit.by` = `username`.

**Indexes:** `idx_usr_employee`; `idx_usr_email`; `idx_usr_username`.

**Replication:** PULL.

---

## JSON Schema

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema). Document body; id is `usr:<ULID>`. Never `password`, `hash`, `session`, or `token`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Fujio-Turner/mobile_field_service/docs/schema/users.json",
  "title": "field.users",
  "type": "object",
  "additionalProperties": true,
  "required": ["type", "audit", "employeeId", "email", "username", "displayName", "role"],
  "not": {
    "anyOf": [
      { "required": ["password"] },
      { "required": ["hash"] },
      { "required": ["session"] },
      { "required": ["token"] }
    ]
  },
  "properties": {
    "type": { "const": "user" },
    "audit": { "$ref": "#/$defs/audit" },
    "employeeId": { "type": "string", "minLength": 1, "pattern": "^[^:]+$" },
    "email": { "type": "string", "format": "email" },
    "username": { "type": "string", "minLength": 1 },
    "displayName": { "type": "string", "minLength": 1 },
    "role": { "type": "string", "minLength": 1 },
    "workModes": {
      "type": "array",
      "items": { "type": "string", "enum": ["assets", "customer", "sales"] },
      "uniqueItems": true
    },
    "crewId": { "type": "string" },
    "districtId": { "type": "string" },
    "vanId": { "type": "string" },
    "phone": { "type": "string" },
    "active": { "type": "boolean" }
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
