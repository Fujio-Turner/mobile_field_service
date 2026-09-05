# Schema — `field.notes`

| | |
| --- | --- |
| Id | `nte:<ULID>` |
| `type` | `note` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) |

**Required:** `type`, `audit`, `history[]`, `body`, `kind` (`job` \| `general`).

**Optional:** `title`, `workOrderOutId`, `readyToPush`.

**409** if parent WO is frozen — use amendment or [SCHEMA_MESSAGES.md](./SCHEMA_MESSAGES.md).

**Indexes:** `idx_nte_wo`; FTS `idx_nte_fts` (`body`, `title`).

**Replication:** PUSH_AND_PULL when `readyToPush`.
