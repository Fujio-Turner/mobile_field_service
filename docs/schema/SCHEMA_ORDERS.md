# Schema — `field.orders`

| Field | Value |
| --- | --- |
| Collection | `orders` (scope `field`) |
| Doc id | `ord:<ULID>` |
| `type` | `order` |
| Repo | [Fujio-Turner/mobile_field_service](https://github.com/Fujio-Turner/mobile_field_service) |
| Date | 2026-09-04 |
| Design | [DESIGN.md](../DESIGN.md) |
| Use cases | [DAY_IN_LIFE_CUSTOMER.md](../DAY_IN_LIFE_CUSTOMER.md), [DAY_IN_LIFE_SALES.md](../DAY_IN_LIFE_SALES.md) |

Commercial document: customer, lines, **snapshotted** prices and tax, fulfillment pointer. One collection (founder name). Conflict rules match work orders, but copies stay **in this collection** (there is no `ordersin` / `ordersout`).

---

## Conflict and ownership

| Role | Who writes | Replication |
| --- | --- | --- |
| `inbound` | Dispatch / backend only | **PULL**. Device never `save`s these ids. |
| `working` | Technician / sales (`origin: dispatch` copy or `origin: field` create) | PUSH_AND_PULL when `syncState` is `ready_to_push` \| `pushed` \| `push_error` |
| `amendment` | Same person, after freeze | Same as working |

- **`StartOrder`:** copy inbound JSON → new `ord:<ulid>`, `role: working`, `source.id` = inbound id. Idempotent on `(employeeId, source.id, role=working)` excluding amendments.
- **`CreateOrder`:** `origin: field`, `role: working`, no inbound source.
- **No payment in v1.** Do not collect cards or wallets at create/submit. Billing is a later ROADMAP item.
- **Assume product is available.** Do not reserve van/warehouse qty or fail `CreateOrder` on stock. Inventory consume on delivery is still a movement when they hand the part over.
- **`SubmitOrder`** is allowed at `quoted` \| `accepted` \| `complete` \| `cancelled` (office can see a quote without delivery or payment). `CompleteOrder` still freezes the body (`owner: backend`).
- Forgotten lines → **`CreateOrderAmendment`** (`role: amendment`, `amends.id`). Backend consolidates by `number` / `source.id`.
- Reassignment of inbound does not stop a working copy from pushing. Today badges **Reassigned**. Multiple `ord:` per order number is expected.

---

## Shared envelope

Every document: `type`, `audit.cr|up.{dt,ver,by}` (unix **seconds**), `history[]` on working copies ([SCHEMA_COMMON.md](./SCHEMA_COMMON.md)).

`assignedTo` includes `employeeId`, `email`, `username`, `displayName`, `userId`. Channel: `emp:{employeeId}`.

---

## Fields

**Required:** `type`, `audit`, `role`, `origin`, `owner`, `status`, `syncState`, `number`, `currency`, `assignedTo`, `lines`, `totals`. Working copies also `history[]`.

**Optional:** `customerId`, `site`, `scheduled`, `kind`, `notesPreview`, `fulfillment`, `source`, `amends`, `taxIds` (header-level defaults), `photos[]` (POD on working copies; blobs top-level `photo:<id>`), `needsWorkOrder`, `workOrderOutId` (if taken during a WO).

| Field | Values |
| --- | --- |
| `origin` | `dispatch` \| `field` |
| `role` | `inbound` \| `working` \| `amendment` |
| `owner` | `technician` \| `backend` |
| `status` | `draft` \| `quoted` \| `accepted` \| `in_fulfillment` \| `complete` \| `cancelled` |
| `syncState` | `local_draft` \| `ready_to_push` \| `pushed` \| `push_error` |
| `kind` | `product` \| `service` \| `mixed` |
| `currency` | ISO 4217, e.g. `USD` |

### Line

| Field | Notes |
| --- | --- |
| `id` | Stable line id (`ln_` + ulid, no extra colons) |
| `productId` | Optional `prd:…` |
| `rateId` | `rate:…` used to price; **do not live-join later** |
| `description` | Copied from product/rate at add time |
| `qty`, `uom` | |
| `unitPrice` | Snapshot of `rates.amount` (minor units: **integer cents**) |
| `taxIds[]` | `tax:…` applied |
| `lineSubtotal`, `lineTax`, `lineTotal` | Integer cents; stored, not only computed in UI |

### Totals (integer cents)

```
subtotal = Σ lineSubtotal
taxTotal = Σ lineTax
total    = subtotal + taxTotal   // exclusive tax
```

Inclusive tax: still store `lineTax` as the extracted portion; see [SCHEMA_TAXES.md](./SCHEMA_TAXES.md).

---

## Example — inbound (pull only)

```json
{
  "type": "order",
  "audit": {
    "cr": { "dt": 1788480000, "ver": "server-dispatch", "by": "dispatch.maya" },
    "up": { "dt": 1788480000, "ver": "server-dispatch", "by": "dispatch.maya" }
  },
  "history": [],
  "role": "inbound",
  "origin": "dispatch",
  "owner": "backend",
  "status": "accepted",
  "syncState": "local_draft",
  "number": "ORD-3301",
  "kind": "product",
  "currency": "USD",
  "customerId": "cus:01K4Q6CCC00000000000000001",
  "assignedTo": {
    "userId": "usr:01K4Q6PRI00000000000000001",
    "employeeId": "E-8801",
    "email": "priya.shah@example.com",
    "username": "sales.priya",
    "displayName": "Priya Shah"
  },
  "scheduled": {
    "startDt": 1788523200,
    "endDt": 1788534000,
    "day": "2026-09-04"
  },
  "site": {
    "name": "Riverside Pump Station",
    "geo": { "lat": 41.7658, "lon": -72.6734 }
  },
  "lines": [
    {
      "id": "ln_01K4Q7LINE000000000000001",
      "productId": "prd:01K4Q6PPP00000000000000001",
      "rateId": "rate:01K4Q6RATE00000000000001",
      "description": "Check valve 4in",
      "qty": 2,
      "uom": "ea",
      "unitPrice": 18500,
      "taxIds": ["tax:01K4Q6TAX00000000000001"],
      "lineSubtotal": 37000,
      "lineTax": 2331,
      "lineTotal": 39331
    }
  ],
  "totals": { "subtotal": 37000, "taxTotal": 2331, "total": 39331 }
}
```

## Example — working copy after StartOrder / field create

Same shape plus:

```json
{
  "role": "working",
  "origin": "field",
  "owner": "technician",
  "status": "draft",
  "syncState": "local_draft",
  "needsWorkOrder": true,
  "workOrderOutId": "woout:01K4Q7H3S00000000000000001",
  "source": {
    "id": "ord:01K4Q7INBOUND000000000001",
    "type": "order",
    "copiedAt": 1788523500
  }
}
```

Field-created orders omit `source` or set `source` to the parent WO (`type: workorderout`) when taken on site.

---

## Indexes

| Name | Kind | Keys |
| --- | --- | --- |
| `idx_ord_today` | value | `assignedTo.employeeId`, `role`, `scheduled.day`, `scheduled.startDt` |
| `idx_ord_source` | value | `assignedTo.employeeId`, `source.id`, `role` |
| `idx_ord_customer` | value | `customerId`, `status` |
| `idx_ord_number` | value | `number` |
| `idx_ord_sync` | value | `syncState`, `role` |
| `idx_ord_amends` | value | `amends.id` |

Today (inbound): `role = 'inbound' AND assignedTo.employeeId = $employeeId AND scheduled.day = $day AND status NOT IN ['cancelled'] ORDER BY scheduled.startDt DESC LIMIT 20 OFFSET n`.

Active working: `role IN ['working','amendment'] AND assignedTo.employeeId = $employeeId AND status IN ['draft','quoted','accepted','in_fulfillment']` (no day filter). Collapse per `source.id` / `number`, preferring working.

Open: **KV** `orders.document(id)` — not a second query.

---

## Operations (catalog names)

| Op | Writes |
| --- | --- |
| `ListTodayOrders` | no |
| `GetOrder` | no (KV) |
| `StartOrder` | new working copy; **never** inbound |
| `CreateOrder` | new working, `origin: field` |
| `AddOrderLine` / `RemoveOrderLine` | working only; calls `PriceLines` |
| `PriceLines` | reads `rates` + `taxes`; writes cents onto lines + `totals` |
| `CompleteOrder` / `CancelOrder` | freeze, `owner: backend` |
| `SubmitOrder` | `SetSyncState` `ready_to_push` |
| `CreateOrderAmendment` | new `role: amendment` |
| `LinkOrderToWork` | set `workOrderOutId` on working order, `orderId` on woout (both editable) |

Photos/POD use the same blob keys as workorders (`photo:<id>`), cap 20.

---

## Money

- Store **integer cents** (or currency minor units). Never binary floats on money fields.
- `PriceLines` is the only place rates/taxes are read for an order. Changing a `rate` tomorrow does not change a frozen or even a draft line until `AddOrderLine` / explicit **Reprice** (allowed only while `owner === technician`).
- Inventory consume on a sales delivery: `inventory_tx.orderId` (in addition to optional `workOrderOutId`).

---

## Replication

Push filter (working + amendment only):

```typescript
function ordersPushFilter(document: any, _flags: any): boolean {
  "show source";
  if (document["role"] === "inbound") return false;
  const s = document["syncState"];
  return s === "ready_to_push" || s === "pushed" || s === "push_error";
}
```

Channel: `emp:{assignedTo.employeeId}`.
