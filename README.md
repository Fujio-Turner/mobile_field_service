# Mobile Field Service

Offline-first field technician app for **[Fujio-Turner](https://github.com/Fujio-Turner/mobile_field_service)**.

| | |
| --- | --- |
| Repo | https://github.com/Fujio-Turner/mobile_field_service |
| Stack | Expo (development builds) + [Fujio-Turner/cbl-reactnative](https://github.com/Fujio-Turner/cbl-reactnative) (CBL EE + vector index) |
| Platforms | iOS and Android |

This is **not** a koten-ai product.

## Sync Gateway user (example)

Login identifier is the **email**. The durable channel is `employeeId` on the profile document.

```text
Sync Gateway public user (example)

  username:     jon.hale@example.com
  password:     (set on SG; never stored in CBL)
  session:      POST /mfs/_session  →  session_id + expires
  replicator:   SessionAuthenticator(session_id, "SyncGatewaySession")

Pulled profile  usr:…  (field.users)

  employeeId:   E-4412
  email:        jon.hale@example.com
  username:     tech.jon          # audit.by only
  workModes:    ["assets"]        # or customer / sales

Channel grant:  emp:E-4412
```

OIDC: the ID token can be large. **Do not** put it on every replicator request. `POST /mfs/_session` with `Authorization: Bearer <id_token>`, then replicate with the **session** (TTL/`expires` honored). See [docs/AUTH.md](docs/AUTH.md).

## Docs (read these before code)

| Doc | What it is |
| --- | --- |
| [docs/DAY_IN_LIFE.md](docs/DAY_IN_LIFE.md) | Index: three modes (assets / customer / sales) |
| [docs/DAY_IN_LIFE_ASSETS.md](docs/DAY_IN_LIFE_ASSETS.md) | Inspect, repair, move company assets |
| [docs/DAY_IN_LIFE_CUSTOMER.md](docs/DAY_IN_LIFE_CUSTOMER.md) | Delivery WO + new order / new customer on site |
| [docs/DAY_IN_LIFE_SALES.md](docs/DAY_IN_LIFE_SALES.md) | Order, deliver, next stop |
| [docs/SCHEMA_ORDERS.md](docs/SCHEMA_ORDERS.md) | `orders` collection |
| [docs/SCHEMA_RATES.md](docs/SCHEMA_RATES.md) | `rates` price book |
| [docs/SCHEMA_TAXES.md](docs/SCHEMA_TAXES.md) | `taxes` |
| [docs/AUTH.md](docs/AUTH.md) | Login page, basic vs OIDC, Keychain, token expiry |
| [docs/DESIGN.md](docs/DESIGN.md) | Architecture, all collections, queries, sync |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phases and PR plan |

No application code yet. Pick a day-in-the-life, then the design.

## Hard rules (short)

- Dispatch **and the phone** can create `workordersin` / jobs. **Never mutate a pulled dispatch inbound.** Field-created inbound is a new `woin:` (`origin: field`).
- Work happens on a **copy** (`workordersout` / working `orders`). Complete **freezes** that copy; forgotten facts → `amends.id`.
- Channels: `emp:{employeeId}`. SG login username = **email** (example above).
- One person, one device (v1).
- Orders: **snapshot catalog prices**, assume stock is available, **no credit-card processing** (later). Chat is **employees only**.
- POD / signature capture is a **future** roadmap item (photo proof is enough for now).
- Testing the CBL RN module does **not** require an EE license. Production still needs EE for shipping encrypted + vector builds.
- Every mutation stamps `lastAction` (unix time + lat/lon when GPS exists).
