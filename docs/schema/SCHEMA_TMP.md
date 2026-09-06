# Schema — `local.tmp`

| | |
| --- | --- |
| Id | `tmp:<ULID>` |
| `type` | `tmp` |
| Scope | **`local`** (not `field`) |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) (`audit` only; no `history[]`) |

Scratch: camera staging, draft text. **Never replicated** — omitted from replicator allow-list. Expiration 24 h (`setDocumentExpiration`).

**Required:** `type`, `audit`, `kind` (e.g. `photo_stage`).

**Optional:** `workOrderOutId`, `localUri`.

**Indexes:** none. SQL++: `FROM local.tmp`.

---

## JSON Schema

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema). Document body; id is `tmp:<ULID>`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Fujio-Turner/mobile_field_service/docs/schema/tmp.json",
  "title": "local.tmp",
  "type": "object",
  "additionalProperties": true,
  "required": ["type", "audit", "kind"],
  "properties": {
    "type": { "const": "tmp" },
    "audit": { "$ref": "#/$defs/audit" },
    "kind": { "type": "string", "minLength": 1 },
    "workOrderOutId": { "type": "string" },
    "orderId": { "type": "string" },
    "localUri": { "type": "string" },
    "expiresAt": {
      "type": "integer",
      "minimum": 0,
      "description": "Unix seconds. 24 h after stage (`TMP_TTL_MS`)."
    }
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
