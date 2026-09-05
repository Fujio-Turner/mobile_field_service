# Schema — shared envelope

Every product document (except raw CBL internals) has `type` + `audit`. **User/device-created** docs also carry `history[]` (self-contained audit trail). Pull catalogs (`rates`, `taxes`, `products`, dispatch `assets` / `users`) omit `history`.

```ts
type: string;

audit: {
  cr: { dt: number; ver: string; by: string }; // unix **seconds**
  up: { dt: number; ver: string; by: string };
};

/** Field-level trail. Newest last. Cap 100; then drop oldest, set historyTruncated. */
history?: HistoryEntry[];
historyTruncated?: boolean;
```

```ts
interface HistoryEntry {
  dt: number;            // unix seconds
  lat?: number;          // omit if no GPS
  lon?: number;
  accuracyM?: number;
  by: string;            // username (audit.by)
  ver: string;           // app version
  op: string;            // catalog name: StartWork, UpdateWorkOrderOutFields
  changes?: Array<{
    path: string;        // JSON path: "materials.0.qtyUsed", "status"
    from?: unknown;      // previous value (scalars / short strings)
    to?: unknown;
  }>;
}
```

Example: qty 10 → 5 on site:

```json
{
  "dt": 1788526100,
  "lat": 41.7659,
  "lon": -72.6735,
  "accuracyM": 8,
  "by": "tech.jon",
  "ver": "0.1.0+12",
  "op": "UpdateWorkOrderOutFields",
  "changes": [{ "path": "materials.0.qtyUsed", "from": 10, "to": 5 }]
}
```

On create, `up` may equal `cr`. First `history` row is the create (`op` = `StartWork` / `CreateOrder` / …). GPS best-effort — never block a save. Do **not** append history on `SetSyncState` (push bookkeeping). Do **not** dump whole arrays/objects into `from`/`to` (ids and scalars only).

There is **no** `lastAction` object. Place-time lives on each `history[]` row. Status transitions are rows with `path: "status"`.

Breadcrumb GPS that is **not** tied to a field edit lives in [SCHEMA_TRACKING.md](./SCHEMA_TRACKING.md), not here.

| `history[]` | Collections |
| --- | --- |
| **Yes** (user/device writes) | `workordersout`; `inventory_tx`; `notes`; `messages`; `tasks` instances; `customers` `origin: field`; `workordersin` `origin: field`; `orders` `role` working/amendment |
| **No** | Pull catalogs (`assets`, `products`, `users`, `rates`, `taxes`, stock `inventory`, `task_template`, dispatch inbound, inbound orders); `tracking`; `tmp` |

`assignedTo` (when present): `{ userId, employeeId, email, username, displayName }`. Channel `emp:{employeeId}`. SG login = **email**.

Ids: `<prefix>:<ULID>`. Reserved: `_id`, `_rev`, `_sequence`, `_attachments`, `_deleted`, `_removed`.
