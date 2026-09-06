# Day in the life — sales route

| Field | Value |
| --- | --- |
| Title | Order, deliver, next stop |
| Mode | `sales` |
| Repo | [Fujio-Turner/mobile_field_service](https://github.com/Fujio-Turner/mobile_field_service) |
| Author | Fujio-Turner / mobile_field_service |
| Date | 2026-09-06 |
| Status | Demo login `priya.shah@example.com` (`E-8801`). Today is orders (ORD-3301). Map tab hidden. |
| Index | [DAY_IN_LIFE.md](./DAY_IN_LIFE.md) |
| Orders schema | [schema/SCHEMA_ORDERS.md](./schema/SCHEMA_ORDERS.md) |
| Rates / taxes | [schema/SCHEMA_RATES.md](./schema/SCHEMA_RATES.md), [schema/SCHEMA_TAXES.md](./schema/SCHEMA_TAXES.md) |

Collections in play: `orders`, `products`, `customers`, `rates`, `taxes`, `inventory`, `messages`.  
Work orders are **optional** here. Pure sales is: quote/order → deliver product or service → freeze the order → next customer. **No credit card payment** in this version. Catalog prices are **snapshotted**; assume stock is available. POD is a **photo**; signature pad is later. If she needs a labor ticket, she `CreateWorkOrderIn` on the phone.

---

## Persona

| | |
| --- | --- |
| Name | Priya Shah |
| Role | Route sales |
| `employeeId` | `E-8801` |
| Email | `priya.shah@example.com` |
| `workModes` | `["sales"]` |
| Day | Friday 4 September 2026 |

Channel `emp:E-8801`. Today’s board is **orders** assigned to her (`role: inbound` pull, or her own `role: working` drafts). Same copy-on-write: she never mutates a pulled order; she copies to `role: working` (`StartOrder`) or creates `origin: field`.

---

## Screen map

| When | Route | Collection(s) | Operation(s) |
| --- | --- | --- | --- |
| Today | `app/(tabs)/index.tsx` (orders) | `orders` | `ListTodayOrders` |
| Order | `app/order/[id].tsx` | KV | `GetOrder`, `StartOrder` |
| Catalog | products search | `products`, `rates`, `taxes` | `AddOrderLine`, `PriceLines` |
| Customer | `app/customer/[id].tsx` | `customers` | `GetCustomer`, `CreateCustomer` |
| Deliver | same order editor | blobs + inventory | `CommitPhoto`, `ConsumeInventoryOnWork` (order-scoped) |

---

## Timeline

```mermaid
sequenceDiagram
  actor Priya
  participant Phone
  participant CBL as CBL local
  participant SG as Sync Gateway

  SG->>CBL: PULL inbound orders, customers, products, rates, taxes
  Priya->>Phone: StartOrder ORD-3301 (copy inbound → working)
  Priya->>Phone: deliver lines, photo POD, CompleteOrder + SubmitOrder
  Note over Phone: working order frozen, owner backend
  Priya->>Phone: next stop — CreateOrder origin field
  Priya->>Phone: walk-up — CreateCustomer + CreateOrder
  Phone->>SG: PUSH working orders + field customers
```

### 08:00 — Assigned order (ORD-3301)

Today lists inbound orders for the signed-in employee, `scheduled.day` today (SQL++ uses equality/`OR`, not `IN`, and a numeric LIMIT). Tap is KV. **Start order** copies inbound JSON to a new `ord:<ulid>` with `role: working`, `source.id` = inbound id. Inbound never written. Demo seed: ORD-3301 on Priya’s Today.

She delivers the catalog lines already on the snapshot, adjusts qty only on **her** copy (qty 10 → 5 is a `history[]` row), photo POD. `CompleteOrder` freezes the working copy (`owner: backend`). `SubmitOrder` sets `ready_to_push`. Backend invoices from **that** document. Driving between stops writes `tracking` crumbs.

### 10:00 — Next stop, sell on the doorstep

No inbound order. `CreateOrder` `origin: field`, pick existing customer, add lines (product + service hour). `PriceLines` applies current `rates` + `taxes` and **snapshots** amounts onto the lines. Customer signs / she completes + submits. Next.

### 11:30 — New logo, new customer

Walk-up. `CreateCustomer` (`origin: field`) then `CreateOrder`. She does not patch some other company’s customer doc.

### 13:00 — Forgot a SKU after complete

Frozen. **Add follow-up** → amendment `ord:` with `amends.id`. Backend consolidates. Same “second sheet of paper” as work orders.

### 13:15 — Dispatch reassigned ORD-3290 while she was offline

Today badge **Reassigned**. Her working copy still submits. The new assignee may `StartOrder` their own working copy. Multiple `ord:` docs, one order number, eventual consistency.

---

## Rules this day proves

1. Sales can run **without** workorders. Delivery proof lives on the **order**.
2. Inbound orders are pull-only; working copies are what push.
3. Rates and taxes are catalogs; money on the order is a **snapshot**.
4. Freeze, amendment, reassignment, `history[]` — same as WOs. Movement crumbs in `tracking`.
5. Next stop = new document or a new StartOrder, never reopen frozen.

## Beat sheet

1. Login Priya, `workModes: ["sales"]`, Today is orders not WOs.
2. StartOrder copy; inbound JSON unchanged.
3. Deliver + POD + CompleteOrder + SubmitOrder.
4. Field `CreateOrder` priced from rates/taxes.
5. `CreateCustomer` + order.
6. Amendment after freeze.
7. Reassigned inbound still shows her working copy.
