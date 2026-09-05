# Schema — `field.inventory`

Two `type`s in one collection. Envelope: [SCHEMA_COMMON.md](./SCHEMA_COMMON.md).

### Stock `type: inventory` — id `inv:<ULID>`

**Required:** `type`, `audit`, `productId`, `sku`, `locationId`, `locationType`, `qtyOnHand`, `uom`.

Device **never `save`s** stock rows. Display:

`qtyOnHand + SUM(tx.qtyDelta WHERE same location+product AND tx.audit.cr.dt > snapshot.audit.up.dt)`

### Movement `type: inventory_tx` — id `invtx:<ULID>`

**Required:** `type`, `audit`, `history[]`, `productId`, `locationId`, `qtyDelta`, `reason`, and **one of** `workOrderOutId` \| `orderId`.

**Optional:** `sku`, `readyToPush`, `appliedToWo`.

No reservation at order create. Consume on hand-over only. Assume stock is available.

**Indexes:** `idx_inv_loc_prd`; `idx_invtx_wo`; `idx_invtx_loc_prd_dt`.

**Replication:** stock never pushes. `inventory_tx` when `readyToPush`.
