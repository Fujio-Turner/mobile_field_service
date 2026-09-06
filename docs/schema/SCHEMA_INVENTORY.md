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

---

## JSON Schema

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema). Two `type`s in one collection. Stock id `inv:<ULID>`; movement id `invtx:<ULID>`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/Fujio-Turner/mobile_field_service/docs/schema/inventory.json",
  "title": "field.inventory",
  "oneOf": [
    { "$ref": "#/$defs/stock" },
    { "$ref": "#/$defs/movement" }
  ],
  "$defs": {
    "unixSeconds": { "type": "integer", "minimum": 0 },
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
    "stock": {
      "type": "object",
      "additionalProperties": true,
      "required": ["type", "audit", "productId", "sku", "locationId", "locationType", "qtyOnHand", "uom"],
      "properties": {
        "type": { "const": "inventory" },
        "audit": { "$ref": "#/$defs/audit" },
        "productId": { "type": "string" },
        "sku": { "type": "string" },
        "locationId": { "type": "string" },
        "locationType": { "type": "string" },
        "qtyOnHand": { "type": "number" },
        "uom": { "type": "string" }
      }
    },
    "movement": {
      "type": "object",
      "additionalProperties": true,
      "required": ["type", "audit", "history", "productId", "locationId", "qtyDelta", "reason"],
      "properties": {
        "type": { "const": "inventory_tx" },
        "audit": { "$ref": "#/$defs/audit" },
        "history": {
          "type": "array",
          "maxItems": 100,
          "items": { "$ref": "#/$defs/historyEntry" }
        },
        "productId": { "type": "string" },
        "locationId": { "type": "string" },
        "qtyDelta": { "type": "number" },
        "reason": { "type": "string" },
        "workOrderOutId": { "type": "string" },
        "orderId": { "type": "string" },
        "sku": { "type": "string" },
        "readyToPush": { "type": "boolean" },
        "appliedToWo": { "type": "boolean" }
      },
      "anyOf": [
        { "required": ["workOrderOutId"] },
        { "required": ["orderId"] }
      ]
    }
  }
}
```
