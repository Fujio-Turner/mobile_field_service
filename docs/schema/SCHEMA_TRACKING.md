# Schema — `field.tracking`

Per-employee, per-day location crumbs. **Not** document `history[]` (that is field diffs on a WO/order). This is “where was the device.”

| | |
| --- | --- |
| Id | `track:{YYYY-MM-DD}:{employeeId}` |
| `type` | `tracking` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) (`audit` only; **no** `history[]`) |
| TTL | **30 days** after `day` (`expiresAt` + CBL `setDocumentExpiration`) |

Example: `track:2026-01-15:E-4412`  
`YYYY-MM-DD` is **device-local** calendar day (same convention as `scheduled.day`). Third segment is **`employeeId`** (stable). Do **not** put email or username in the id (they change). `employeeId` must not contain `:`.

**Last 7 days** for employee `xyz` = seven KV gets, no query:

```ts
for (const day of lastNLocalDays(7)) {
  await tracking.document(`track:${day}:${employeeId}`);
}
```

Missing id = no crumbs that day.

---

## When to write

Append a point when the device has moved **≥ threshold** from the last stored point (haversine). Default **100 m** (~328 ft). App-definable: `EXPO_PUBLIC_TRACK_MIN_MOVE_M` (use `152` for ~500 ft). Ignore fixes with `accuracyM` worse than the threshold. Do not sample on a timer if the user is still. Same unix second as the last point → overwrite that key.

v1 records while the app is **foreground** (or the OS still delivers a “while using” fix). Background/always-on trail is a later ROADMAP item.

---

## Body

`tracking` is a **map** (JSON object), not a JSON array. Key = unix **seconds** as a string. Value = `[lat, lon]` — do **not** repeat the timestamp in the array; the key is the time.

```json
{
  "type": "tracking",
  "audit": {
    "cr": { "dt": 1768435200, "ver": "0.1.0+12", "by": "tech.jon" },
    "up": { "dt": 1768478400, "ver": "0.1.0+12", "by": "tech.jon" }
  },
  "employeeId": "E-4412",
  "email": "jon.hale@example.com",
  "day": "2026-01-15",
  "thresholdM": 100,
  "last": [41.7669, -72.6710, 1768438920],
  "capped": false,
  "expiresAt": 1771027200,
  "tracking": {
    "1768438800": [41.7658, -72.6734],
    "1768438920": [41.7669, -72.6710]
  }
}
```

| Field | Notes |
| --- | --- |
| `employeeId` | Same as id segment 3. Channel `emp:{employeeId}`. |
| `email` | Login alias on the body only. |
| `day` | Device-local `YYYY-MM-DD`. |
| `thresholdM` | Meters used for this doc (copied from the env at create). |
| `last` | Last stored `[lat, lon, ts]` so the next move check is O(1). Keeps `ts` because this field is **not** keyed. |
| `capped` | `true` after **4000** points; skip new points (do not drop the start of the day). |
| `pointCount` | Optional cached `Object.keys(tracking).length` so a write does not walk the map. |
| `expiresAt` | Unix seconds. Local midnight of `day` + **30** calendar days (`TRACKING_TTL_DAYS`). |
| `tracking` | Map of points. **Never log this map.** |

**TTL:** location PII. Phone purges via `setDocumentExpiration` at `expiresAt`. Reads skip expired bodies if the purge has not run. Sync Gateway / backend should honor `expiresAt` so the cluster copy does not outlive the device. Last-7-days shotgun is unchanged.

**Indexes:** none (id is the access path). Optional later: `idx_track_emp_day` (`employeeId`, `day`).

**Replication:** PUSH_AND_PULL, channel `emp:{employeeId}`. Push filter **always true** (device-owned; do not wait for Submit). Other phones do not pull this unless SG grants the channel. Last-7 shotgun for “employee xyz” is **constructed ids** (phone debug or server KV/N1QL), not a list query.

**Ops:** `RecordTrackPoint` · `GetTrackingDay(employeeId, day)` · `GetTrackingLastNDays(employeeId, n=7)`.

See [DESIGN.md](../DESIGN.md) tracking section.

---

## JSON Schema

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema). Document body; id is `track:{YYYY-MM-DD}:{employeeId}` (not in the body).

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Fujio-Turner/mobile_field_service/docs/schema/tracking.json",
  "title": "field.tracking",
  "type": "object",
  "additionalProperties": false,
  "required": ["type", "audit", "employeeId", "day", "thresholdM", "capped", "tracking", "expiresAt"],
  "properties": {
    "type": { "const": "tracking" },
    "audit": { "$ref": "#/$defs/audit" },
    "employeeId": { "type": "string", "minLength": 1, "pattern": "^[^:]+$" },
    "email": { "type": "string", "format": "email" },
    "day": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
    "thresholdM": { "type": "number", "exclusiveMinimum": 0 },
    "last": {
      "oneOf": [
        { "type": "null" },
        {
          "type": "array",
          "minItems": 3,
          "maxItems": 3,
          "prefixItems": [
            { "type": "number", "minimum": -90, "maximum": 90 },
            { "type": "number", "minimum": -180, "maximum": 180 },
            { "$ref": "#/$defs/unixSeconds" }
          ]
        }
      ]
    },
    "capped": { "type": "boolean" },
    "pointCount": { "type": "integer", "minimum": 0, "maximum": 4000 },
    "expiresAt": {
      "$ref": "#/$defs/unixSeconds",
      "description": "Local midnight of day + 30 calendar days"
    },
    "tracking": {
      "type": "object",
      "maxProperties": 4000,
      "additionalProperties": {
        "type": "array",
        "minItems": 2,
        "maxItems": 2,
        "prefixItems": [
          { "type": "number", "minimum": -90, "maximum": 90 },
          { "type": "number", "minimum": -180, "maximum": 180 }
        ]
      },
      "propertyNames": { "type": "string", "pattern": "^[0-9]+$" }
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
