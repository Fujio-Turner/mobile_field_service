# Couchbase Lite replication — mobile_field_service

How this app syncs with Sync Gateway / Capella App Services.

**Official API:** [cbl-reactnative.dev — Remote sync](https://cbl-reactnative.dev/DataSync/remote-sync-gateway)  
**Worked Expo sample:** [couchbase-examples/expo-cbl-travel](https://github.com/couchbase-examples/expo-cbl-travel) (`services/database.service.ts`)  
**Auth / session TTL:** [docs/AUTH.md](../docs/AUTH.md)  
**Allow-list / push filters:** [docs/DESIGN.md](../docs/DESIGN.md)

Binding: **[Fujio-Turner/cbl-reactnative](https://github.com/Fujio-Turner/cbl-reactnative)** (`import { … } from 'cbl-reactnative'`). The travel sample imports `@couchbase/couchbase-lite-react-native` — same API shape; we do **not** use official 1.1 as SoT (no vector).

---

## TL;DR

1. **One** `CblReactNativeEngine` per process (travel sample singleton).
2. **One** continuous `PUSH_AND_PULL` replicator.
3. Collections passed as `CollectionConfiguration[]` into `new ReplicatorConfiguration(configs, endpoint)` then `await Replicator.create(config)` — not deprecated `addCollection`.
4. **Explicit allow-list** of `field.*`. **Never** `local.tmp`.
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
- `collections.map(col => new CollectionConfiguration(col))`
- `ReplicatorConfiguration(collectionConfigs, URLEndpoint)`
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

const configs = fieldCollections.map((col) => {
  const cc = new CollectionConfiguration(col);
  cc.setPushFilter(pushFilterFor(col.name)); // "show source" pure fn
  return cc;
});
// do not include local.tmp

const config = new ReplicatorConfiguration(configs, endpoint);
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

Channels: `emp:{employeeId}` (SG username is **email**). See DESIGN matrix.

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

**Permanent (no retry):** 401, 404.  
**Transient (retry):** 408, 429, 500–504, 1001 DNS.

TLS: `ws` vs `wss` mismatch → 11006/1006. Unknown/self-signed on `wss` → 5011. Fix URL/certs; do not log the cookie.

---

## 5. Document listener

`onReplicatedDoc`:

- Push of `workordersout` / working `orders` with no error → `SetSyncState(id, 'pushed')`
- Document error → `SetSyncState(id, 'push_error', code)`
- Skip if already at target (avoid loops)
- Log `mfs.repl.doc` with id + collection only ([LOGGING.md](LOGGING.md))

---

## 6. Lifecycle

- **Foreground:** if replicator null (iOS killed) or STOPPED without a fatal config error, recreate + `start(false)`.
- **Background:** stop or let the OS freeze sockets; always restart on active.
- **Logout:** `stop()`, close DB, delete auth keys.
- **Do not** `start(true)` (reset checkpoint) unless an operator action says “full resync”.

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
- [x] SessionAuthenticator + stored `expires`
- [x] 401 path tested
- [x] `start(false)`
- [x] No password in `app.json` (unlike the travel sample extra field)
