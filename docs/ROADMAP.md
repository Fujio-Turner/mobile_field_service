# Mobile Field Service — Roadmap

| Field | Value |
| --- | --- |
| Title | Product and engineering roadmap |
| Repo | [Fujio-Turner/mobile_field_service](https://github.com/Fujio-Turner/mobile_field_service) |
| Author | Fujio-Turner / mobile_field_service |
| Date | 2026-09-04 |
| Status | Draft |
| Architecture | [DESIGN.md](./DESIGN.md) |
| Use cases | [DAY_IN_LIFE.md](./DAY_IN_LIFE.md) |

This is a **Fujio-Turner** offline-first field app (Expo + [cbl-reactnative fork](https://github.com/Fujio-Turner/cbl-reactnative), CBL **4.x EE** target + vector index). Repo: https://github.com/Fujio-Turner/mobile_field_service. Walk a mode day before implementing screens: [assets](./DAY_IN_LIFE_ASSETS.md), [customer](./DAY_IN_LIFE_CUSTOMER.md), [sales](./DAY_IN_LIFE_SALES.md). Auth: [AUTH.md](./AUTH.md).

How to read checkboxes:

| Mark | Meaning |
| --- | --- |
| `[x]` | Done in this repo |
| `[ ]` | Not done |

PRs **00–05 are a linear spine**. After that, photos / tasks / map / inventory / chat can overlap; the replicator PR waits until outbound + children + messages exist so push filters are real. “Independently mergeable” means each PR leaves the app building; it does **not** mean 06–14 can land in any order.

---

## Phase 0 — Docs and constraints

- [x] Apache-2.0 LICENSE
- [x] React Native / Expo / native `.gitignore` (Windows entries = **dev machines**, not a runtime)
- [x] Architecture: collections, copy-on-write, queries, sync matrix ([DESIGN.md](./DESIGN.md))
- [x] Day-in-the-life use cases: assets, customer, sales ([DAY_IN_LIFE.md](./DAY_IN_LIFE.md))
- [x] Schemas: [docs/schema/](./schema/README.md)
- [x] This roadmap + PR plan
- [x] Engineering guides: logging, UI, release, replication ([guides/](../guides/README.md))
- [x] [AGENT.md](../AGENT.md); tests live in `tests/`; local slices in gitignored `work/`
- [ ] README: EE license, Expo **development builds**, iOS/Android only, CBL **3.3.3 EE** (lands with first code PR)

**Exit:** an engineer can implement without inventing field names, prefixes, or SQL++.

---

## Phase 1 — App shell and session UI

- [ ] Expo SDK **52**, RN **0.76.6**, Node ≥ 20, `newArchEnabled: true`
- [ ] iOS **15.1+**, Android **API 24+**
- [ ] Expo Router: Login, Today placeholder, Profile
- [ ] Login UI (email or username + password) — [AUTH.md](./AUTH.md)
- [ ] `EXPO_PUBLIC_AUTH_STRATEGY=basic|oidc_implicit|oidc_code|demo` (default **basic**)
- [ ] Keychain/Keystore session + expiry; `RefreshAuth`; replicator 401/404 → re-auth
- [ ] Phone-first tabs; large-phone / small-tablet safe areas
- [ ] Camera / location **usage strings** in `app.json` (runtime prompts in later PRs)
- [ ] Jest (or equivalent) test runner wired
- [ ] “Development build required” if the native module is missing

**Exit:** installable iOS/Android binary; login navigates to an empty Today screen.

---

## Phase 2 — Encrypted database, collections, seed

- [ ] `CblReactNativeEngine` singleton
- [ ] Open `mfs_<safe>_<hash8>` with AES-256 **string** key from Keychain + `FileSystem.getDefaultPath()`
- [ ] Create scope `field` (**fourteen** collections including `messages`, `orders`, `rates`, `taxes`, `tracking`) + `local.tmp`
- [ ] Value + FTS indexes from DESIGN.md
- [ ] `stampAuditCreate` / `stampAuditUpdate` / `stampHistory` (unix **seconds**, app version, path from/to, lat/lon when GPS)
- [ ] ULID + prefixes (`woin`, `woout`, `ast`, `prd`, `inv`, `invtx`, `usr`, `cus`, `tsk`, `nte`, `msg`, `ord`, `rate`, `tax`, `tmp`) + tracking `track:{day}:{employeeId}`
- [ ] Users seed with `employeeId` + `email` (channel `emp:E-4412`)
- [ ] Optional pre-built / JSON seed: ~12 inbound jobs, assets near sites, van stock, products, one user, one customer
- [ ] `tmp` in scope `local`; replicator allow-list cannot include it; expiration helper
- [ ] `RebuildStock` read-model stub (no stock `save`; unused until inventory PR)

**Exit:** `cblite` / VSCode CBL inspector shows `field.workordersin` seed docs with audit stamps.

**Load:** seed ≤ 20 jobs, ≤ 200 assets, ≤ 50 products — small enough for first-run demo, not a district dump.

---

## Phase 3 — Today list + KV detail

- [ ] `ListTodayWork`: inbound `assignedTo.employeeId = $employeeId`, `status NOT IN ('cancelled','superseded')`, `scheduled.day = $day`, `ORDER BY scheduled.startDt DESC LIMIT 20 OFFSET n`
- [ ] **Reassigned** / **Assignment changed** badge when inbound assignee ≠ session but local outbound exists
- [ ] Page 0 **UNION ALL** active outbound: `workordersout` `status IN ('assigned','in_progress','blocked')` — **no** `day` filter; unpaged; collapse one row per `source.id` preferring outbound
- [ ] Infinite scroll (offset += 20) on inbound only
- [ ] Live query on inbound page 0 only; re-run active-outbound on those callbacks and pull-to-refresh
- [ ] Empty / error / stale-sync states
- [ ] Batched `FindOutboundForSources` → `openId` + `openCollection` on each row
- [ ] Row tap → **one** KV get on `openCollection`
- [ ] Read-only inbound detail screen
- [ ] `query.explain()` debug on today list (index `idx_woin_today`)

**Exit:** scrolling 40+ seed jobs stays on the indexed plan; tap does not re-query the list.

**Latency:** today list p95 &lt; 50 ms local; KV p95 &lt; 10 ms.

---

## Phase 4 — Copy-on-write

- [ ] `StartWork`: copy `workordersin` → `workordersout` (new `woout:<ulid>`, `role: primary`, `owner: technician`)
- [ ] Reject start if inbound `assignedTo.employeeId` ≠ session
- [ ] Clone inbound `taskIds` templates into `type:'task'` instances
- [ ] Idempotent reopen via `idx_woout_source` (`employeeId`, `source.id`, `role=primary`)
- [ ] Race: duplicate copy discarded; oldest `audit.cr.dt` wins
- [ ] Provenance `source.*` with **full body snapshot** minus `embedding` / blobs
- [ ] **No writes** to `workordersin`
- [ ] Today screen routes started rows to `app/wo/out/[id]` using `openCollection`
- [ ] Metric `mfs_copy_on_write_total`
- [ ] `StartWork` rejects inbound `cancelled` / `superseded`
- [ ] `CreateWorkOrderIn`: new `woin:` `origin: field`, assigned to self; never patch dispatch inbound

**Exit:** double-tap Start opens one outbound id; dispatch inbound JSON unchanged; field-created inbound pushes; Today tap on a started job KV-gets the out doc.

---

## Phase 5 — Outbound editor, status, Submit (no camera yet)

- [ ] Status machine: `assigned` → `in_progress` ⇄ `blocked` → `complete` / `cancelled`
- [ ] Operation statuses `pending | in_progress | done | skipped`
- [ ] Editable operations + embedded checklist
- [ ] `CompleteWork` gates required operations `status === 'done'` and required checklist `done === true` (required **tasks** added in the tasks PR)
- [ ] `CancelWork` with reason (tech); dispatch cancel is inbound-only
- [ ] `SubmitWork` only after complete/cancel; sets `syncState=ready_to_push`
- [ ] Complete/Cancel set `owner: backend` and **freeze the body** (no notes/photos on that id)
- [ ] `CreateAmendment`: new `woout` with `role: amendment`, `amends.id`
- [ ] `history[]` on user saves (path + from/to + dt + lat/lon); skip `SetSyncState`
- [ ] Dispatch-updated banner (inbound KV vs snapshot; no auto-merge)
- [ ] Reassigned banner on an in-progress copy whose inbound assignee changed

**Exit:** a tech can start, edit ops, complete, freeze, submit, and open a follow-up paper fully offline (without photos).

---

## Phase 6 — Photos and `local.tmp`

- [ ] Camera runtime permission
- [ ] Camera → `StagePhoto` (`local.tmp`, 24 h expiration) → `CommitPhoto`
- [ ] Top-level blobs `photo:<id>` + `photo:<id>:thumb` (not array paths)
- [ ] Cap 20 photos/job; compress 200–800 KB; strip EXIF
- [ ] Delete photo; periodic compact
- [ ] **No** embedding enqueue

**Exit:** 10 photos on a job survive process death; `local.tmp` staging expires.

**Storage:** 10 photos × 400 KB ≈ 4 MB/job; 15 jobs/day ≈ 60 MB/day photos. v1 cap is the only growth control.

---

## Phase 7 — Tasks and notes

- [ ] `tasks` instances + templates; `CompleteWork` gains required-task predicate
- [ ] `notes` job/general; FTS on notes; **409 on frozen parent**
- [ ] New notes/tasks copy parent `readyToPush` if parent already submitted (editable only)
- [ ] Push-filter expressions for notes/tasks documented for the replicator PR

**Exit:** CompleteWork refuses a job with an open required task; notes cannot land on a frozen WO.

---

## Phase 7b — Chat

- [ ] `field.messages` collection, prefix `msg:`
- [ ] Job thread `thr:wo:{woinId}` and DM `thr:dm:{empA}:{empB}`
- [ ] `SendMessage` `readyToPush: true` (not gated on WO Submit)
- [ ] Chat tab + job-scoped composer from outbound editor
- [ ] Push filter + `emp:` / `wo:` channels documented for the replicator PR

**Exit:** airplane-mode send appears after radio returns; completing a WO does not freeze the thread.

---

## Phase 8 — Assets map

- [ ] MapLibre RN + OpenFreeMap Liberty **when online**
- [ ] Document: basemap needs network / last style cache; **pins from CBL work offline**
- [ ] BBox query `idx_ast_geo`; cluster; tap → KV asset
- [ ] Filters: type, near job, near GPS
- [ ] “Use asset on this job” writes `assetIds` on `woout` (needs PR-05+)
- [ ] Location permission
- [ ] Follow-up (not this phase): region MBTiles pack

**Exit:** map shows seed pumps/sites; pin opens KV detail; airplane mode still shows pins.

---

## Phase 8b — Location crumbs (`tracking`)

- [ ] Collection `field.tracking`, id `track:{YYYY-MM-DD}:{employeeId}` (device-local day; not email)
- [ ] `RecordTrackPoint` when haversine ≥ `EXPO_PUBLIC_TRACK_MIN_MOVE_M` (default 100 m; `152` ≈ 500 ft)
- [ ] Map `tracking` keyed by unix seconds → `[lat, lon]`; cap 4000/day; `last` `[lat, lon, ts]` for O(1) compare
- [ ] `GetTrackingDay` / `GetTrackingLastNDays(n=7)` — seven KV gets, no query
- [ ] Push filter always true; never log the map
- [ ] Foreground / while-using only in v1 (background trail later)

**Exit:** moving ~100 m+ writes a point; last 7 constructed ids KV-get; still docs do not dump crumbs.

---

## Phase 9 — Products and inventory

- [ ] Catalog browse + FTS (`idx_prd_fts`)
- [ ] Van stock list (`locationId` of current user)
- [ ] `ConsumeInventoryOnWork`: write **only** `inventory_tx` + `woout.materials` (**never `save` stock rows**)
- [ ] Display qty = pulled `qtyOnHand` + `SUM(qtyDelta WHERE inventory_tx.audit.cr.dt > snapshot.audit.up.dt)`
- [ ] `RebuildStock` read model (no writer)
- [ ] Insufficient stock error; `allowNegative` only `supervisor` / `technician_lead`
- [ ] v1: one van per technician; **stock not pushed and not saved**; `inventory_tx` push when `readyToPush`

**Exit:** consuming a valve on the job writes `invtx:` and a materials line; van list shows snapshot + txs newer than `snapshot.audit.up.dt`; crash between tx and materials is repaired via `appliedToWo` only.

---

## Phase 9b — Orders, rates, taxes, field customers

- [ ] Pull `rates` + `taxes`; never save those catalogs
- [ ] `ListTodayOrders` / `StartOrder` (copy inbound → working; never mutate inbound)
- [ ] `CreateOrder` `origin: field`; `PriceLines` integer cents
- [ ] `CompleteOrder` freeze + `CreateOrderAmendment`
- [ ] `CreateCustomer` `origin: field` (do not patch pulled customers)
- [ ] Optional `orderId` on delivery WOs; `workOrderOutId` on orders taken on site
- [ ] Seed: one inbound order, two rates, one tax, Hartford customer

**Exit:** sales-mode Today lists an inbound order; copy + complete does not change inbound JSON; walk-up creates `cus:` + `ord:`.

---

## Phase 10 — Sync

- [ ] Lab SG/App Services **fixture documented** in DESIGN (collections `field.*` except `tmp`, session auth, channels `emp:{employeeId}`)
- [ ] `SessionAuthenticator` after `POST /_session` (default); optional `BasicAuthenticator` or `Authorization: Bearer` header ([AUTH.md](./AUTH.md))
- [ ] Replicator change listener: 401 / 404 / 10401 → `OnReplicatorAuthFailure`
- [ ] `await Replicator.create`; collection allow-list; **`local.tmp` not included**
- [ ] RN `"show source"` push filters (never-push for pull-only; woout/notes/tasks/tx as specified)
- [ ] **No pull filters** in v1
- [ ] `addDocumentChangeListener` → `syncState` `pushed` / `push_error`
- [ ] Feature-detect pending-ids; else COUNT `ready_to_push`
- [ ] Sync status on Profile; foreground restart
- [ ] `ReconcileDuplicateOutbound` on pull
- [ ] Channels sketch; SG sync function is **external**

**Exit:** lab SG round-trip: pull inbound, push submitted outbound + blobs + txs.

---

## Phase 11 — Search, polish, observability

- [ ] FTS notes / products / assets
- [ ] Structured logs (no PII/doc dumps)
- [ ] Metrics: query latency, copy-on-write, blob bytes, replicator
- [ ] Database compact on idle after photo deletes
- [ ] Customer history (local complete `workordersout`)

---

## Phase EE — Vector similarity (gated)

**Binding:** [Fujio-Turner/cbl-reactnative](https://github.com/Fujio-Turner/cbl-reactnative) `feat/vector-search-support` (`VectorIndexConfiguration`). Official `@couchbase/couchbase-lite-react-native` 1.1 does **not** expose vector search — do not use it.

**Still needed:** native CBL **4.x** bump on that fork if not already, **and** on-device MobileCLIP runtime (model size, NNAPI/CoreML). Lab/testing **does not require** an EE license.

- [ ] Lock MobileCLIP-S2 **512-d** (`embedding.clip512`)
- [ ] On-device embed at `CommitPhoto` **only in this phase**
- [ ] Never write `clip512: []`
- [ ] Create vector index when API exists (cosine, dim=512, centroids ≈ √N)
- [ ] `APPROX_VECTOR_DISTANCE(embedding.clip512, $vec)`
- [ ] Similarity screen behind `VECTOR_SEARCH_ENABLED && nativeVectorApi`
- [ ] **No** production JS brute-force cosine over the full catalog

---

## Phase future — POD signature

- [ ] Signature capture (name + blob) on complete/deliver, in addition to photo proof
- [ ] Store as top-level blob on working `workordersout` / `orders`, not nested arrays

---

## Non-goals on this roadmap

- Web / Windows / macOS app
- SAP adapter, Zeus Hub, sibling ops dashboard
- koten-ai branding or remotes
- P2P CBL sync
- Passwords in CBL
- Mutating **dispatch** inbound `workordersin` (field `origin: field` create is allowed) or reopening a completed `workordersout` id
- POD **signature** pad (photo proof now; see Phase future)
- Credit-card processing at order create (later)
- Inventory reservation / “out of stock” on create (assume plenty)
- Customer-facing chat
- Official `@couchbase/couchbase-lite-react-native` 1.1 as the binding SoT
- Offline MBTiles as a v1 requirement
- Offline login after Logout

---

## PR Plan

Ordered, independently reviewable PRs. Each PR should build, typecheck, and leave the app runnable (stub screens allowed until their PR). **00→05 must land in order.** After 05, 07/08/09/10 can overlap; **11 (replicator) waits for 07 and 10** so notes/tasks/tx filters exist. Completeness of push filters is extended in 07/10 if 11 were started early — do not start 11 early.

### PR-00 — Docs

| | |
| --- | --- |
| Title | `docs: field-service architecture, day-in-the-life, and roadmap` |
| Files | `docs/DESIGN.md`, `docs/ROADMAP.md`, `docs/DAY_IN_LIFE*.md`, `docs/schema/*`, `guides/*`, `AGENT.md`, `README.md` |
| Deps | none |
| Description | Fujio-Turner architecture on https://github.com/Fujio-Turner/mobile_field_service: fourteen `field` collections (including `tracking`), `history[]` audit trail, three modes, field-created inbound WOs, cbl-reactnative fork + vector, auth session TTL. No application code. |

### PR-01 — Expo app shell + login UI

| | |
| --- | --- |
| Title | `feat: Expo SDK 52 shell, navigation, and login screen` |
| Files | `package.json` (Expo **52**, `react-native` **0.76.6**, Node engines ≥ 20), `app.json` (`newArchEnabled`, iOS 15.1, camera/location usage strings), `app/_layout.tsx`, `app/login.tsx`, `app/(tabs)/*`, `src/theme.ts`, `src/session/AuthContext.tsx` (HTTP stub), `plugin.config.js`, `jest.config.js` (or equivalent), `.env.example` |
| Deps | PR-00 |
| Description | Development-build Expo app, New Architecture on, phone-first tabs. Login per [AUTH.md](./AUTH.md) (default basic → Keychain session). Demo strategy skips SG. README: EE license, no Expo Go, native CBL 3.3.3. Test runner wired with a smoke test. |

### PR-02 — CBL open, collections, audit, seed

| | |
| --- | --- |
| Title | `feat: encrypted CBL 3.3.3 database, field collections, local.tmp, seed` |
| Files | `src/db/engine.ts`, `src/db/database.ts`, `src/db/collections.ts`, `src/db/indexes.ts`, `src/db/seed.ts`, `src/ids.ts`, `src/audit.ts`, `src/session/dbKey.ts` |
| Deps | PR-01 |
| Description | Singleton engine, per-employee encrypted DB (`mfs_<safe>_<hash8>`), `setDirectory(FileSystem.getDefaultPath())`, string `setEncryptionKey`, **fourteen** `field.*` collections (including `messages`, `orders`, `rates`, `taxes`, `tracking`) + `local.tmp`, value/FTS indexes, ULID helpers, audit + `stampHistory`. Seed users with `employeeId`/`email`/`workModes`. Optional seed of today’s jobs + inbound order. Guard if native module missing. |

### PR-03 — Today list query + pagination

| | |
| --- | --- |
| Title | `feat: today’s work list with LIMIT/OFFSET, filters, and live query` |
| Files | `src/ops/listTodayWork.ts`, `src/ops/findOutboundForSources.ts`, `app/(tabs)/index.tsx`, `src/features/today/*` |
| Deps | PR-02 |
| Description | SQL++ today list keyed by `assignedTo.employeeId` (`idx_woin_today`) excluding cancelled/superseded, page size 20, infinite scroll. Page 0 UNION ALL active outbound, collapse per `source.id`. **Reassigned** badge. Live query inbound only; re-run active-outbound on callbacks. `openId`/`openCollection` via batched lookup. |

### PR-04 — KV inbound detail

| | |
| --- | --- |
| Title | `feat: work-order inbound detail via KV get` |
| Files | `src/ops/getWorkOrderIn.ts`, `app/wo/in/[id].tsx` |
| Deps | PR-03 |
| Description | Inbound route uses `workordersin.document(id)` only. Read-only site, schedule, ops, materials, asset refs. Started jobs are **not** this route (see PR-05). |

### PR-05 — Copy-on-write StartWork + Today routing

| | |
| --- | --- |
| Title | `feat: copy-on-write start work and route Today to outbound editor` |
| Files | `src/ops/startWork.ts`, `src/ops/getWorkOrderOut.ts`, `app/wo/out/[id].tsx` (shell), `app/(tabs)/index.tsx` (tap → `openCollection`), tests for idempotency |
| Deps | PR-04 |
| Description | Copy inbound JSON to new `woout:<ulid>` (`role: primary`, `owner: technician`) with `source.*` full snapshot; clone task templates; idempotent by **employeeId** + `source.id` + `role=primary`. Reject if inbound not assigned to session. Never writes inbound. Today tap KV-gets `openCollection.document(openId)` and navigates to in vs out. Metric counter. |

### PR-06 — Outbound editor + status + Submit

| | |
| --- | --- |
| Title | `feat: outbound editor, status machine, and submit` |
| Files | `app/wo/out/[id].tsx`, `src/ops/updateWorkOrderOut.ts`, `src/ops/transitionStatus.ts`, `src/ops/submitWork.ts` |
| Deps | PR-05 |
| Description | Editor for operations/checklist; status transitions including tech cancel; CompleteWork ops+checklist gates; Complete/Cancel freeze body and set `owner: backend`; `CreateAmendment` for forgotten info; `history[]` path/from/to + geo/time; Submit only after complete/cancel via `SetSyncState`. No camera. CompleteWork task gate is a documented hook for PR-08. |

### PR-07 — Photos + local.tmp

| | |
| --- | --- |
| Title | `feat: photo blobs on stable keys and tmp staging` |
| Files | `src/ops/photos.ts`, `src/ops/tmp.ts`, camera permission flow in `app/wo/out/[id].tsx` |
| Deps | PR-06 |
| Description | Stage in `local.tmp` with expiration; commit top-level `photo:<id>` / `:thumb` blobs; cap 20; JPEG budget; delete + compact. No CLIP embed. |

### PR-08 — Tasks and notes

| | |
| --- | --- |
| Title | `feat: job tasks and notes collections` |
| Files | `src/ops/tasks.ts`, `src/ops/notes.ts`, `app/(tabs)/notes.tsx`, `app/note/[id].tsx`, `src/ops/transitionStatus.ts` (required-task hook) |
| Deps | PR-06 (CompleteWork hook); photos not required |
| Description | `tasks` instances + templates; `notes` job/general; FTS on notes. CompleteWork honors required tasks. Post-submit children inherit `readyToPush`. |

### PR-09 — Assets map

| | |
| --- | --- |
| Title | `feat: MapLibre asset map and KV asset detail` |
| Files | `app/(tabs)/map.tsx`, `app/asset/[id].tsx`, `src/ops/assets.ts` |
| Deps | **PR-05** (link-to-job needs `woout`); PR-02 is not sufficient |
| Description | OpenFreeMap when online + MapLibre; bbox query; cluster; tap KV; link asset to open `woout`. Document offline pins vs online basemap. Location permission. |

### PR-16 — Tracking crumbs

| | |
| --- | --- |
| Title | `feat: per-day tracking collection and RecordTrackPoint` |
| Files | `src/ops/tracking.ts`, `src/geo/haversine.ts`, location watch in app shell |
| Deps | **PR-02** (collection); **PR-09** (location permission). Replicator allow-list in PR-11. |
| Description | `field.tracking`, id `track:{YYYY-MM-DD}:{employeeId}`. Map keyed by unix seconds → `[lat, lon]`. Write when moved ≥ `EXPO_PUBLIC_TRACK_MIN_MOVE_M` (default 100 m). `GetTrackingLastNDays` = N KV gets. Cap 4000/day. Never log the map. Foreground / while-using only. |

### PR-10 — Inventory and products

| | |
| --- | --- |
| Title | `feat: product catalog, van stock, consume-on-job, rebuild` |
| Files | `app/(tabs)/inventory.tsx`, `src/ops/products.ts`, `src/ops/inventory.ts` |
| Deps | PR-06 |
| Description | FTS catalog. Display qty = snapshot `qtyOnHand` + `SUM(qtyDelta WHERE tx.audit.cr.dt > snapshot.audit.up.dt)`. Consume writes **only** `inventory_tx` + materials — **never `save` stock**. `RebuildStock` is a read model with that cutoff. Movements-only push. Role-gated `allowNegative`. |

### PR-11 — Replicator and sync UI

| | |
| --- | --- |
| Title | `feat: collection replicator, RN push filters, and sync status` |
| Files | `src/sync/replicator.ts`, `src/sync/filters.ts`, `app/(tabs)/profile.tsx`, `src/ops/syncSnapshot.ts` |
| Deps | **PR-07, PR-08, PR-10, PR-14** (woout + photos + notes/tasks/tx + messages filters). Do not merge before those filters exist. |
| Description | Session auth, `Replicator.create`, explicit allow-list of **fourteen** `field` collections (including `tracking`), omit `local.tmp`, `"show source"` push filters, `emp:{employeeId}` channels, document listener calls **`SetSyncState`** for `pushed`/`push_error`, pending-count fallback, foreground restart, duplicate-outbound reconcile (primaries only). Lab `wss` URL via env. Lab SG collection list lives in DESIGN.md. |

### PR-12 — Observability and FTS search chrome

| | |
| --- | --- |
| Title | `feat: structured logs, metrics, and FTS search` |
| Files | `src/log/logger.ts`, `src/metrics/index.ts`, `app/search/index.tsx` |
| Deps | PR-11 |
| Description | JSON logs without PII; latency histograms; FTS across notes/products/assets. |

### PR-14 — Chat / messages

| | |
| --- | --- |
| Title | `feat: messages collection and job/direct chat` |
| Files | `src/ops/messages.ts`, `app/(tabs)/chat.tsx`, `app/chat/[threadId].tsx` |
| Deps | PR-02 (collection); better after PR-05 so job threads have a `woin` |
| Description | `field.messages`, `msg:<ulid>`, `SendMessage` with `readyToPush: true` and `history[]`. Job `thr:wo:{woinId}` and DM threads. Completing a WO does not freeze chat. |

### PR-15 — Orders, rates, taxes, field customers

| | |
| --- | --- |
| Title | `feat: orders copy-on-write, rates/taxes catalogs, field customers` |
| Files | `src/ops/orders.ts`, `src/ops/pricing.ts`, `src/ops/customers.ts`, `app/order/**` |
| Deps | PR-02; better after PR-06 so freeze/amendment UX is reused |
| Description | Inbound orders pull-only; `StartOrder` / `CreateOrder`; `PriceLines` snapshots cents; freeze + amendment; `CreateCustomer` origin field. Do not mutate inbound orders or dispatch customers. |

### PR-13 — EE vector similarity (later)

| | |
| --- | --- |
| Title | `feat: mobile-CLIP embeddings and gated vector search` |
| Files | `src/embed/clip.ts`, `src/ops/similar.ts`, `app/search/similar.tsx`, native module **if** RN plugin still lacks vector indexes |
| Deps | PR-07, PR-12; **blocked** on vector API **and** native CLIP runtime |
| Description | Persist `embedding.clip512` (512 floats, never `[]`) on commit photo when the model exists. Create vector index only when the API exists. Similarity UI behind `VECTOR_SEARCH_ENABLED && nativeVectorApi`. Do not fake ANN. |

### Merge notes

- Spine: 00 → 01 → 02 → 03 → 04 → 05.
- After 05: **06** (editor + freeze + amendment) then **07** (photos). **08** (tasks/notes) can parallel 07. **09** (map) depends on **05**, not 04. **16** (tracking) after **09** location permission (collection exists from **02**). **10** (inventory) depends on **06**. **14** (chat) can parallel 06+ after 02/05.
- **11** (sync) after **07 + 08 + 10 + 14 + 15**. If filters must land incrementally, extend `src/sync/filters.ts` — but prefer 11 last among them.
- **15** (orders) after **02**; reuse freeze UX from **06**.
- PR-06 CompleteWork ships without the required-task predicate; PR-08 adds it in the same operation.
- No PR may add Web or Windows runtime targets.
- No PR may write passwords into CBL, mutate **dispatch** inbound WOs/orders, reopen a completed outbound/order id, nest blobs in arrays, or replicate `tmp`.
- Prefer [Fujio-Turner/cbl-reactnative](https://github.com/Fujio-Turner/cbl-reactnative) over official 1.1. Native 4.x + vector live on that fork.
- No PR may brand this as koten-ai.
