# Schema — `field.messages`

| | |
| --- | --- |
| Id | `msg:<ULID>` |
| `type` | `message` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) |

**Required:** `type`, `audit`, `history[]`, `threadId`, `kind` (`job` \| `direct`), `from`, `body`, `readyToPush`.

**Optional:** `workOrderInId`, `workOrderOutId`, `toEmployeeIds[]`.

`threadId`: `thr:wo:{woinId}` or `thr:dm:{empA}:{empB}` (ids sorted).

**Employees only.** Completing a WO does not freeze the thread. `readyToPush: true` on create.

**Indexes:** `idx_msg_thread`; `idx_msg_wo`.

**Replication:** PUSH_AND_PULL when `readyToPush`.
