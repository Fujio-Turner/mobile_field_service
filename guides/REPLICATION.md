# Couchbase Lite replication — mobile_field_service

How this app syncs with Sync Gateway / Capella App Services.

**Official API:** [cbl-reactnative.dev — Remote sync](https://cbl-reactnative.dev/DataSync/remote-sync-gateway)  
**Worked Expo sample:** [couchbase-examples/expo-cbl-travel](https://github.com/couchbase-examples/expo-cbl-travel) (`services/database.service.ts`)  
**Auth / session TTL:** [docs/AUTH.md](../docs/AUTH.md)  
**Env / debug channel keys:** [SETTINGS.md](SETTINGS.md)  
**Allow-list / push filters:** [docs/DESIGN.md](../docs/DESIGN.md)

Binding: **[Fujio-Turner/cbl-reactnative](https://github.com/Fujio-Turner/cbl-reactnative)** (`import { … } from 'cbl-reactnative'`). The travel sample imports `@couchbase/couchbase-lite-react-native` — same API shape; we do **not** use official 1.1 as SoT (no vector).

---

## TL;DR

1. **One** `CblReactNativeEngine` per process (travel sample singleton).
2. **Schema is build-time** (`EXPO_PUBLIC_REPL_SCHEMA`, not Profile): **`simple`** (default) = one continuous `PUSH_AND_PULL` replicator for all `field.*` except `tmp`. **`oneshot`** = one-shot `workordersin`+`orders` first, then one-shot all `field.*` every `EXPO_PUBLIC_REPL_ONESHOT_SEC` (default 300) and on foreground.
3. `new ReplicatorConfiguration(endpoint)` then **`addCollection(col, CollectionConfig)`** per allow-listed `field.*` collection (`CollectionConfig` from the Fujio-Turner fork). **Never** `local.tmp`.
4. Each collection config takes a **`channels: string[]`**. **Default empty** — do not call `setChannels`; pull every channel the SG session can access. A non-empty list is a pull filter for lab/debug.
5. Authenticate with **`SessionAuthenticator`** after `POST /{db}/_session`. Honor `expires`. Do not put a fat OIDC JWT on every request.
6. Push filters are **pure** functions with `"show source"`.
7. **401 / 404 / 10401** → replicator **STOPPED** (no retry). Stop, refresh session, recreate replicator, `start(false)` (do not reset checkpoint).
8. Production `wss://` + system CAs (`acceptOnlySelfSignedServerCertificate = false`). Lab may use `ws://` + self-signed.

---

## 1. Pattern (from expo-cbl-travel, adapted)

Travel sample:

- `new CblReactNativeEngine()` once
- `FileSystem.getDefaultPath()` + `DatabaseConfiguration.setDirectory`
- `createCollection` per linked SG collection
- `new CollectionConfig(channels | null, null)` + `setPushFilter`
- `new ReplicatorConfiguration(endpoint)` + `addCollection(col, config)`
- `setContinuous(true)`, `Replicator.create`, `start`

**We change:**

| Travel sample | This app |
| --- | --- |
| `BasicAuthenticator(user, pass)` on the replicator | `POST /mfs/_session` → `SessionAuthenticator(sessionId, cookieName)` |
| Credentials in `app.json` extra | Keychain ([AUTH.md](../docs/AUTH.md)); never commit passwords |
| All linked collections, no push filter | Allow-list + per-collection push filters |
| `start(true)` in their init (resets checkpoint) | `start(false)` except a deliberate rebuild-from-zero |
| Encryption key hardcoded in the sample | Keychain `mfs.dbkey.<employeeId>` |
| Scope `inventory` hotels/landmarks | Scope `field` (+ `local.tmp` **not** replicated) |

```ts
const endpoint = new URLEndpoint(sgUrl); // wss://host:4984/mfs
const session = new SessionAuthenticator(sessionId, cookieName ?? 'SyncGatewaySession');
const config = new ReplicatorConfiguration(endpoint);

for (const col of fieldCollections) {
  // channels default [] → pass null so SG grants decide the pull set
  const channels = channelsFor(col.name); // string[]
  const cc = new CollectionConfig(channels.length ? channels : null, null);
  cc.setPushFilter(pushFilterFor(col.name)); // "show source" pure fn
  if (channels.length) cc.setChannels(channels);
  config.addCollection(col, cc);
}
// do not include local.tmp

config.setAuthenticator(session);
config.setContinuous(true);
config.setAcceptOnlySelfSignedCerts(false); // production

const replicator = await Replicator.create(config);
await replicator.addChangeListener(onReplicatorStatus);
await replicator.addDocumentChangeListener(onReplicatedDoc);
await replicator.start(false);
```

SG user example (email): [README.md](../README.md).

---

## 2. What replicates

| Collection | Push? |
| --- | --- |
| `field.workordersin` | only `origin == 'field' && readyToPush` |
| `field.workordersout` | `syncState` in ready_to_push \| pushed \| push_error |
| `field.orders` | not inbound; same syncState rule |
| `field.customers` | only `origin == 'field' && readyToPush` |
| `field.messages` / notes / task instances / inventory_tx | `readyToPush` |
| `field.tracking` | **always** (device-owned crumbs; do not wait for Submit) |
| `field.assets` products rates taxes users (dispatch) | **never** (filter false) |
| `local.tmp` | **omitted** from `CollectionConfiguration[]` |

### Notes and tasks (PR-08)

Documented here for the replicator PR. RN push filters must be **pure** with `"show source"`.

```ts
function tasksPushFilter(document: any, _flags: any): boolean {
  "show source";
  return document["type"] === "task" && document["readyToPush"] === true;
}

function notesPushFilter(document: any, _flags: any): boolean {
  "show source";
  return document["readyToPush"] === true;
}
```

- Templates (`type == 'task_template'`) never push.
- Job notes/tasks start `readyToPush: false`. `SubmitWork` flips existing children. New children on an **editable** parent that is already submitted copy `readyToPush: true`.
- General notes (no parent) set `readyToPush: true` on create.
- Frozen parent → 409; do not push a follow-up onto the frozen copy.

### Messages (PR-14)

```ts
function messagesPushFilter(document: any, _flags: any): boolean {
  "show source";
  return document["readyToPush"] === true;
}
```

- `SendMessage` sets `readyToPush: true` on create (not gated on job Submit).
- Completing a WO does **not** freeze the thread.
- Channels: `emp:{from.employeeId}` plus each `toEmployeeIds` entry; job threads also `wo:{workOrderInId}` when SG grants that channel.

### Orders (PR-15)

```ts
function ordersPushFilter(document: any, _flags: any): boolean {
  "show source";
  if (document["role"] === "inbound") return false;
  const s = document["syncState"];
  return s === "ready_to_push" || s === "pushed" || s === "push_error";
}
```

- Never `save` inbound orders. `rates` / `taxes` push filter is `false`.
- `SubmitOrder` allowed at quoted | accepted | complete | cancelled (no payment).

### Tracking (PR-16)

```ts
function trackingPushFilter(_document: any, _flags: any): boolean {
  "show source";
  return true;
}
```

- Device-owned crumbs; do not wait for Submit.
- Never log the `tracking` map. Channel `emp:{employeeId}`. Id uses employeeId, not email.

Channels come from document fields: `emp:{employeeId}`, `email:{lowercase}`, `cus:{customerId}` (at least one on users / workorders* / orders / notes). Catalogs use `type:` / `sku:` / `loc:` / … — never `channel("!")`. See DESIGN matrix.

### Pull channel lists (optional)

Each `CollectionConfig` has `channels: string[]`.

| Value | Pull behaviour |
| --- | --- |
| `[]` / omitted (**default**) | All channels the session user can access |
| `['emp:E-4412']` | Only docs in that channel (SG still ignores channels the user cannot read) |

Do **not** put `tmp` in the map. Persist lab overrides in Keychain `mfs.sync.collectionChannels`. Optional env `EXPO_PUBLIC_SG_CHANNELS` (comma-separated) applies to every field collection only when nothing is stored.

Edit and restart from **Profile → Settings / debug**.

---

## 3. Session, not Basic-on-the-wire (default)

1. Login: `POST /mfs/_session` with HTTP Basic (email + password) **or** `Authorization: Bearer <id_token>`.
2. Store `session_id`, `cookie_name`, `expires` in Keychain.
3. Replicator: `SessionAuthenticator` only.

OIDC ID tokens are large — **exchange for a session**. Rebuild the replicator when you get a new session (`stop` → `create` → `start(false)`).

Pre-refresh ~5 minutes before `expires` ([AUTH.md](../docs/AUTH.md)).

---

## 4. Status listener

| Activity | UI |
| --- | --- |
| 0 STOPPED | If error 401/404/10401 → `OnReplicatorAuthFailure`. Else show error. |
| 1 OFFLINE | Banner; local work continues (transient net) |
| 2 CONNECTING | Spinner on Profile |
| 3 IDLE | Last success time |
| 4 BUSY | `progress.completed/total` |

**Permanent (replicator STOPPED):** 401, 404, 10401.  
**Transient (retry):** 408, 429, 500–504, 1001 DNS.  
**Document-level (do not log the tech out):** 409 conflict, 404 on a single doc, 413 payload, 403 forbidden.

| HTTP / CBL | Class | Listener | Action |
| --- | --- | --- | --- |
| 400, 405, 422 | client | status + doc | log `mfs.repl.http_client` / `doc_client` |
| 401, 10401 | auth | status | STOPPED → refresh session |
| 403 | forbidden | status + doc | log; do not wipe the session |
| 404 | not_found | **status** = missing db (fatal); **doc** = missing/purged doc | |
| 408 | timeout | status | OFFLINE, CBL retries |
| 409 | conflict | **doc** (usual) | log `mfs.repl.conflict` + collection policy; CBL default resolver |
| 413 | payload | doc | log; compress photos, do not retry that blob as-is |
| 429 | rate_limit | status | OFFLINE, CBL retries |
| 500–504 | transient | status | OFFLINE |
| 1006 / 11006 / 5011 | tls | status | fatal TLS |

TLS: `ws` vs `wss` mismatch → 11006/1006. Unknown/self-signed on `wss` → 5011. Fix URL/certs; do not log the cookie.

### Conflict resolvers (per collection)

`src/sync/conflicts.ts` is a **switch/case per `field.*` collection**. Today every case returns CBL **default** (`null` from the `"show source"` hook). Each case documents what a custom resolver *could* do (e.g. tracking map union, `workordersout` by `audit.up.dt`). Wired via `CollectionConfig.setConflictResolver` when the native API exists.

### Completed / pending

- **Pending:** `pendingDocumentIdsInCollection` when present, else COUNT `ready_to_push`.
- **Completed this run:** document listener counters `docsPushOk` / `docsPullOk` (and failed / conflict).
- **Progress:** CBL `progress.completed/total` while BUSY.

---

## 5. Document listener

`onReplicatedDoc`:

- Push of `workordersout` / working `orders` with no error → `SetSyncState(id, 'pushed')`
- Document error → `SetSyncState(id, 'push_error', code)`
- Skip if already at target (avoid loops)
- Log `mfs.repl.doc` with id + collection only ([LOGGING.md](LOGGING.md))

---

## 6. Lifecycle

### Simple (default)

- **Foreground:** if replicator null (iOS killed) or STOPPED without a fatal config error, recreate + `start(false)`.
- **Background:** stop or let the OS freeze sockets; always restart on active.

### Oneshot

- **Login / first foreground:** one-shot `PUSH_AND_PULL` for `workordersin` + `orders` only (`setContinuous(false)`). Get today’s board.
- **After that shot IDLE/STOPPED without auth/TLS error:** mark bootstrap done. Do **not** keep a socket open.
- **Then:** one-shot **all** `field.*` except `tmp` (so outbound, chat, tracking, catalogs actually move) on:
  - app **foreground**
  - every `EXPO_PUBLIC_REPL_ONESHOT_SEC` seconds (default **300**) while the process is running
- Overlapping shots are skipped. Foreground within 5 s of the last shot is skipped (Provider + AppState both fire on mount).
- Interval shots wait until bootstrap finished.

Both schemas:

- **Logout:** `stop()`, close DB, delete auth keys.
- **Do not** `start(true)` (reset checkpoint) unless an operator action says “full resync”.
- Not configurable on Profile. Debug **shows** the compiled schema.

---

## 7. Lab vs production

| | Lab | Production |
| --- | --- | --- |
| URL | `ws://` or `wss://` from env | `wss://` only |
| Certs | self-signed allowed | system CAs |
| Auth | README email user | same pattern, real passwords |
| Delta sync | optional on SG | enable if EE server supports it |
| Guest | disabled | disabled |

Capella: same `wss` replicator; travel sample’s App Endpoint + collection **link** steps still apply — link every `field.*` collection except do not create `tmp` on the server.

---

## 8. Checklist before merge

- [x] Engine singleton
- [x] Directory + encryption key from Keychain
- [x] `tmp` not in replicator configs
- [x] `"show source"` on every push filter
- [x] `channels: string[]` per collection; default empty (no `setChannels`)
- [x] SessionAuthenticator + stored `expires`
- [x] 401 path tested
- [x] `start(false)`
- [x] No password in `app.json` (unlike the travel sample extra field)
- [x] Profile **Settings / debug**: versions, DB path/name, replicator URL/status/last success, collection counts, start/stop/restart
- [x] Operator sync bar: connected / not connected + last synced / pending push / downloading
- [x] Build-time `EXPO_PUBLIC_REPL_SCHEMA=simple|oneshot` (oneshot interval `EXPO_PUBLIC_REPL_ONESHOT_SEC`)
