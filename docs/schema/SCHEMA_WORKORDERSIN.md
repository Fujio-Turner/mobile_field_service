# Schema — `field.workordersin`

| | |
| --- | --- |
| Id | `woin:<ULID>` |
| `type` | `workorderin` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) |

**Required:** `type`, `audit`, `number`, `priority`, `status`, `assignedTo`, `customerId` (or omit on pure asset jobs), `site`, `scheduled`, `summary`.

**Optional:** `origin` (`dispatch` \| `field`), `kind` (`inspect` \| `repair` \| `move` \| `maintain` \| `deliver` \| `service`), `orderId`, `operations[]`, `taskIds[]`, `checklist[]`, `materials[]`, `assetIds[]`, `readyToPush`.

`status` (dispatch-owned on pulled docs): `scheduled` \| `assigned` \| `cancelled` \| `superseded`.

**Writes:** never patch `origin: dispatch`. Phone may **create** `origin: field` (`CreateWorkOrderIn`, assigned to self) with `history[]`. Labor still uses [SCHEMA_WORKORDERSOUT.md](./SCHEMA_WORKORDERSOUT.md) after `StartWork`.

**Indexes:** `idx_woin_today` (`assignedTo.employeeId`, `scheduled.day`, `scheduled.startDt`); `idx_woin_number`; `idx_woin_customer`.

**Replication:** PULL dispatch. PUSH if `origin == 'field' && readyToPush`.
