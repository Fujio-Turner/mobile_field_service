# Schema — `field.workordersout`

| | |
| --- | --- |
| Id | `woout:<ULID>` |
| `type` | `workorderout` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) |

**Required:** `type`, `audit`, `lastAction`, `number`, `priority`, `status`, `syncState`, `role` (`primary` \| `amendment`), `owner` (`technician` \| `backend`), `assignedTo`, `site`, `scheduled`, `summary`, `source`.

**Optional:** kit fields from inbound, `blockedReason`, `photos[]` (metadata; blobs at `photo:<id>`), `amends`, `statusHistory[]`, `completedAt`.

`status`: `assigned` \| `in_progress` \| `blocked` \| `complete` \| `cancelled`.  
`syncState`: `local_draft` \| `ready_to_push` \| `pushed` \| `push_error`.

Complete/cancel → `owner: backend`, body **frozen**. Forgotten facts → new doc `role: amendment`, `amends.id`. Never mutate inbound.

**Indexes:** `idx_woout_source` (`assignedTo.employeeId`, `source.id`, `role`); `idx_woout_today`; `idx_woout_amends`; `idx_woout_sync`.

**Replication:** PUSH_AND_PULL. Filter: `syncState` in ready_to_push \| pushed \| push_error.
