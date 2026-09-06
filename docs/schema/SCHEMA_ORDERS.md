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
- **No credit card payment in v1.** Do not collect cards or wallets at create/submit. Billing is a later ROADMAP item.
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

Today (inbound): `role = 'inbound' AND assignedTo.employeeId = $employeeId AND scheduled.day = $day AND status != 'cancelled'` (CBL Mobile: no `IN [...]`; numeric LIMIT). Working/amendment rows use status equality/`OR` (`draft` / `quoted` / `accepted` / `in_fulfillment`). App: `ListTodayOrders` projection — no per-row KV get.

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

---

## JSON Schema

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema). Document body; id is `ord:<ULID>`. Money fields are integer cents.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Fujio-Turner/mobile_field_service/docs/schema/orders.json",
  "title": "field.orders",
  "type": "object",
  "additionalProperties": true,
  "required": [
    "type", "audit", "role", "origin", "owner", "status", "syncState",
    "number", "currency", "assignedTo", "lines", "totals"
  ],
  "properties": {
    "type": { "const": "order" },
    "audit": { "$ref": "#/$defs/audit" },
    "history": {
      "type": "array",
      "maxItems": 100,
      "items": { "$ref": "#/$defs/historyEntry" }
    },
    "historyTruncated": { "type": "boolean" },
    "role": { "type": "string", "enum": ["inbound", "working", "amendment"] },
    "origin": { "type": "string", "enum": ["dispatch", "field"] },
    "owner": { "type": "string", "enum": ["technician", "backend"] },
    "status": {
      "type": "string",
      "enum": ["draft", "quoted", "accepted", "in_fulfillment", "complete", "cancelled"]
    },
    "syncState": {
      "type": "string",
      "enum": ["local_draft", "ready_to_push", "pushed", "push_error"]
    },
    "number": { "type": "string", "minLength": 1 },
    "currency": { "type": "string", "minLength": 3, "maxLength": 3 },
    "kind": { "type": "string", "enum": ["product", "service", "mixed"] },
    "assignedTo": { "$ref": "#/$defs/assignedTo" },
    "lines": { "type": "array", "items": { "$ref": "#/$defs/line" } },
    "totals": { "$ref": "#/$defs/totals" },
    "customerId": { "type": "string" },
    "site": { "type": "object", "additionalProperties": true },
    "scheduled": { "$ref": "#/$defs/scheduled" },
    "notesPreview": { "type": "string" },
    "fulfillment": { "type": "object", "additionalProperties": true },
    "source": {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "id": { "type": "string" },
        "type": { "type": "string" },
        "copiedAt": { "$ref": "#/$defs/unixSeconds" }
      }
    },
    "amends": {
      "type": "object",
      "additionalProperties": true,
      "properties": { "id": { "type": "string" } }
    },
    "taxIds": { "type": "array", "items": { "type": "string" } },
    "photos": { "type": "array", "maxItems": 20, "items": { "type": "object", "additionalProperties": true } },
    "needsWorkOrder": { "type": "boolean" },
    "workOrderOutId": { "type": "string" }
  },
  "$defs": {
    "unixSeconds": { "type": "integer", "minimum": 0 },
    "cents": { "type": "integer", "description": "Integer cents" },
    "auditStamp": {
      "type": "object",
      "additionalProperties": false,
      "required": ["dt", "ver", "by"],
      "properties": {
        "dt": { "$ref": "#/$defs/unixSeconds" },
        "ver": { "type": "string" },
        "by": { "type": "string" }
      }
    },
    "audit": {
      "type": "object",
      "additionalProperties": false,
      "required": ["cr", "up"],
      "properties": {
        "cr": { "$ref": "#/$defs/auditStamp" },
        "up": { "$ref": "#/$defs/auditStamp" }
      }
    },
    "historyChange": {
      "type": "object",
      "additionalProperties": false,
      "required": ["path"],
      "properties": { "path": { "type": "string" }, "from": true, "to": true }
    },
    "historyEntry": {
      "type": "object",
      "additionalProperties": false,
      "required": ["dt", "by", "ver", "op"],
      "properties": {
        "dt": { "$ref": "#/$defs/unixSeconds" },
        "lat": { "type": "number" },
        "lon": { "type": "number" },
        "accuracyM": { "type": "number" },
        "by": { "type": "string" },
        "ver": { "type": "string" },
        "op": { "type": "string" },
        "changes": { "type": "array", "items": { "$ref": "#/$defs/historyChange" } }
      }
    },
    "assignedTo": {
      "type": "object",
      "additionalProperties": false,
      "required": ["employeeId"],
      "properties": {
        "userId": { "type": "string" },
        "employeeId": { "type": "string" },
        "email": { "type": "string" },
        "username": { "type": "string" },
        "displayName": { "type": "string" }
      }
    },
    "scheduled": {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "startDt": { "$ref": "#/$defs/unixSeconds" },
        "endDt": { "$ref": "#/$defs/unixSeconds" },
        "day": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" }
      }
    },
    "line": {
      "type": "object",
      "additionalProperties": true,
      "required": ["id", "qty", "uom", "unitPrice", "lineSubtotal", "lineTax", "lineTotal"],
      "properties": {
        "id": { "type": "string" },
        "productId": { "type": "string" },
        "rateId": { "type": "string" },
        "description": { "type": "string" },
        "qty": { "type": "number" },
        "uom": { "type": "string" },
        "unitPrice": { "$ref": "#/$defs/cents" },
        "taxIds": { "type": "array", "items": { "type": "string" } },
        "lineSubtotal": { "$ref": "#/$defs/cents" },
        "lineTax": { "$ref": "#/$defs/cents" },
        "lineTotal": { "$ref": "#/$defs/cents" }
      }
    },
    "totals": {
      "type": "object",
      "additionalProperties": false,
      "required": ["subtotal", "taxTotal", "total"],
      "properties": {
        "subtotal": { "$ref": "#/$defs/cents" },
        "taxTotal": { "$ref": "#/$defs/cents" },
        "total": { "$ref": "#/$defs/cents" }
      }
    }
  }
}
```
