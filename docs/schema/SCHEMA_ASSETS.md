# Schema — `field.assets`

| | |
| --- | --- |
| Id | `ast:<ULID>` |
| `type` | `asset` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) |

**Required:** `type`, `audit`, `name`, `assetType`, `geo` `{ lat, lon }`.

**Optional:** `code`, `status`, `ownership` (`company` \| `customer`), `customerId`, `address`, `parentAssetId`, `tags[]`, `embedding`.

v1: **pull catalog**. Completing a move WO does **not** `save` the asset; backend applies location from the frozen outbound.

**Indexes:** `idx_ast_geo` (`geo.lat`, `geo.lon`); `idx_ast_type`; FTS `idx_ast_fts` (`name`, `code`, `assetType`).

**Replication:** PULL. Push filter false.
