# Schemas

One file per collection (or pair). Shared envelope: [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) (`audit` + `history[]` on user/device docs; **no** `lastAction`). Movement crumbs: [SCHEMA_TRACKING.md](./SCHEMA_TRACKING.md) (**TTL 30 days**). Architecture: [DESIGN.md](../DESIGN.md). Settings: [guides/SETTINGS.md](../../guides/SETTINGS.md).

Each file includes a **[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema)** (`"$schema": "https://json-schema.org/draft/2020-12/schema"`) for the document body. Copy a block into a [JSON Schema](https://json-schema.org) validator. `$defs` for `audit` / `history[]` / `assignedTo` / `geo` live in [SCHEMA_COMMON.md](./SCHEMA_COMMON.md); collection files repeat a copy so each schema is self-contained.

| Collection | File | Prefix |
| --- | --- | --- |
| *(envelope)* | [SCHEMA_COMMON.md](./SCHEMA_COMMON.md) | — |
| `workordersin` | [SCHEMA_WORKORDERSIN.md](./SCHEMA_WORKORDERSIN.md) | `woin:` |
| `workordersout` | [SCHEMA_WORKORDERSOUT.md](./SCHEMA_WORKORDERSOUT.md) | `woout:` |
| `assets` | [SCHEMA_ASSETS.md](./SCHEMA_ASSETS.md) | `ast:` |
| `products` | [SCHEMA_PRODUCTS.md](./SCHEMA_PRODUCTS.md) | `prd:` |
| `inventory` | [SCHEMA_INVENTORY.md](./SCHEMA_INVENTORY.md) | `inv:` / `invtx:` |
| `users` | [SCHEMA_USERS.md](./SCHEMA_USERS.md) | `usr:` |
| `customers` | [SCHEMA_CUSTOMERS.md](./SCHEMA_CUSTOMERS.md) | `cus:` |
| `tasks` | [SCHEMA_TASKS.md](./SCHEMA_TASKS.md) | `tsk:` |
| `notes` | [SCHEMA_NOTES.md](./SCHEMA_NOTES.md) | `nte:` |
| `messages` | [SCHEMA_MESSAGES.md](./SCHEMA_MESSAGES.md) | `msg:` |
| `orders` | [SCHEMA_ORDERS.md](./SCHEMA_ORDERS.md) | `ord:` |
| `rates` | [SCHEMA_RATES.md](./SCHEMA_RATES.md) | `rate:` |
| `taxes` | [SCHEMA_TAXES.md](./SCHEMA_TAXES.md) | `tax:` |
| `tracking` | [SCHEMA_TRACKING.md](./SCHEMA_TRACKING.md) | `track:{day}:{employeeId}` |
| `tmp` | [SCHEMA_TMP.md](./SCHEMA_TMP.md) | `tmp:` |
