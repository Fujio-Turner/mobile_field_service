# Schema — `field.customers`

| | |
| --- | --- |
| Id | `cus:<ULID>` |
| `type` | `customer` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) |

**Required:** `type`, `audit`, `name`. Field-created also `history[]`.

**Optional:** `origin` (`dispatch` \| `field`), `accountNumber`, `contacts[]`, `sites[]`, `readyToPush`, `assignedTo`.

**Never patch** `origin: dispatch`. Walk-up → `CreateCustomer` new id, `origin: field`.

**Indexes:** `idx_cus_name`; `idx_cus_account`; `idx_cus_origin`.

**Replication:** PULL master. PUSH if `origin == 'field' && readyToPush`.
