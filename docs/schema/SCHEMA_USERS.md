# Schema — `field.users`

| | |
| --- | --- |
| Id | `usr:<ULID>` |
| `type` | `user` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) |

**Required:** `type`, `audit`, `employeeId`, `email`, `username`, `displayName`, `role`.

**Optional:** `workModes[]` (`assets` \| `customer` \| `sales`), `crewId`, `districtId`, `vanId`, `phone`, `active`.

**Never:** `password`, `hash`, `session`, `token`.

SG login = **email**. Channel = `emp:{employeeId}`. `audit.by` = `username`.

**Indexes:** `idx_usr_employee`; `idx_usr_email`; `idx_usr_username`.

**Replication:** PULL.
