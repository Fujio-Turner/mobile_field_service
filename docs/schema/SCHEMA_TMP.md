# Schema — `local.tmp`

| | |
| --- | --- |
| Id | `tmp:<ULID>` |
| `type` | `tmp` |
| Scope | **`local`** (not `field`) |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) |

Scratch: camera staging, draft text. **Never replicated** — omitted from replicator allow-list. Expiration 24 h (`setDocumentExpiration`).

**Required:** `type`, `audit`, `kind` (e.g. `photo_stage`).

**Optional:** `workOrderOutId`, `localUri`.

**Indexes:** none. SQL++: `FROM local.tmp`.
