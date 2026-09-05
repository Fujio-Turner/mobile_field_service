# Schema — `field.products`

| | |
| --- | --- |
| Id | `prd:<ULID>` |
| `type` | `product` |
| Envelope | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) (no `history[]`; pull catalog) |

**Required:** `type`, `audit`, `sku`, `name`, `uom`.

**Optional:** `description`, `category`, `barcode`, `active`, `defaultRateId` (`rate:`), `embedding`.

**Indexes:** `idx_prd_sku`; FTS `idx_prd_fts` (`name`, `sku`, `description`).

**Replication:** PULL. List price lives on [SCHEMA_RATES.md](./SCHEMA_RATES.md); orders **snapshot** cents onto lines.
