# Schema — `field.tasks`

| | |
| --- | --- |
| Id | `tsk:<ULID>` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) |

### Instance `type: task`

**Required:** `type`, `audit`, `history[]`, `title`, `status` (`open` \| `done` \| `skipped`), `workOrderOutId`.

**Optional:** `required`, `sort`, `templateId`, `readyToPush`.

Cloned from inbound `taskIds` on `StartWork`. Do not complete templates.

### Template `type: task_template`

No `workOrderOutId`. Pull only.

**Indexes:** `idx_tsk_wo`; `idx_tsk_type`.

**Replication:** PUSH instances when `readyToPush`. Templates never push.
