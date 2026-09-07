# Logging — mobile_field_service

Single standard for **app logs** and **Couchbase Lite LogSinks**. One style everywhere. No `console.log` in `src/ops`, `src/db`, or `src/sync`.

CBL sink API: [Using logs](https://cbl-reactnative.dev/Troubleshooting/using-logs). Travel sample: [`hooks/startLogging.ts`](https://github.com/couchbase-examples/expo-cbl-travel/blob/main/hooks/startLogging.ts).

---

## TL;DR

1. **App code** logs through `src/log/logger.ts` (`log.debug|info|warn|error`).
2. **CBL native** logs through `LogSinks.setConsole` / `setFile` — never `Database.setLogLevel` (deprecated; cannot mix with LogSinks).
3. **Four app levels:** `debug`, `info`, `warn`, `error`. Production default **info**.
4. **Structured key/value.** Message is a stable event name. Fields are pairs, not `JSON.stringify(doc)`.
5. **Always** `"err"` + error on failures. Never stringify the error into the message.
6. **Never log secrets, PII, document bodies, blobs, session ids, passwords, Bearer tokens, encryption keys, street notes.**
7. Configure **once** at process start (`src/db/engine.ts` after `new CblReactNativeEngine()`).

---

## 1. App logger (`src/log/logger.ts`)

Target shape (one JSON line):

```ts
{
  ts: number;          // unix seconds (same unit as audit.dt)
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;       // dotted, stable: mfs.wo.start, mfs.repl.auth_fail
  op?: string;         // catalog name: StartWork, SubmitOrder
  employeeId?: string; // never email/password
  collection?: string;
  docId?: string;      // id only
  durMs?: number;
  err?: string;        // err.message, not stack in production
  errCode?: string | number;
  appVer: string;      // same string as audit.*.ver
}
```

```ts
import { log } from '../log/logger';

log.info('mfs.wo.start', { op: 'StartWork', collection: 'workordersout', docId: outId, durMs });

if (err) {
  log.error('mfs.repl.auth_fail', { op: 'OnReplicatorAuthFailure', err, errCode: 401 });
}
```

**Do**

```ts
log.info('mfs.order.submit', { op: 'SubmitOrder', docId, syncState: 'ready_to_push' });
```

**Don't**

```ts
console.log('submitted', JSON.stringify(order));
log.info(`submitted ${id} for ${email}`);
log.info('fail ' + err);
```

Screens may `console.warn` only while prototyping; any merged `src/ops/*` / `src/sync/*` / `src/db/*` must use `log`.

---

## 2. Levels

| Level | When |
| --- | --- |
| `debug` | Query explain, replicator progress ticks, index create. **Dev only.** |
| `info` | Successful mutations, copy-on-write, replicator start/stop, login success (no secrets), Submit. |
| `warn` | Retry, stale session refresh, missing GPS on a `history[]` stamp, tracking skip (accuracy/capped), push_error then retry. |
| `error` | Save failed, 401/404 stopped replicator, encryption open failed. Always `"err"`. |

---

## 3. Event names

Prefix `mfs.`. Keep a closed set; add in the same PR as the code.

| Event | Meaning |
| --- | --- |
| `mfs.auth.login_ok` / `mfs.auth.login_fail` | LoginRemote |
| `mfs.auth.refresh` | RefreshAuth |
| `mfs.repl.start` / `mfs.repl.stop` | Replicator lifecycle |
| `mfs.repl.auth_fail` | 401 / 404 / 10401 |
| `mfs.repl.doc` | Document listener: collection + id + isPush + errCode (no body) |
| `mfs.wo.start` / `mfs.wo.complete` / `mfs.wo.amend` | Work-order ops |
| `mfs.wo.inbound_apply` / `mfs.wo.inbound_drop` | Inbound kit merge / hide untouched cancelled inbound |
| `mfs.order.create` / `mfs.order.submit` | Orders |
| `mfs.blob.commit` | Photo commit: byteLength only |
| `mfs.track.point` | RecordTrackPoint: `docId` + `ts` + result only — **never** the `tracking` map |
| `mfs.dev.simulate_inbound` | Lab-only dispatch kit simulate (Settings / debug) |
| `mfs.repl.skip` | Replicator not started (demo, native missing) |
| `mfs.db.open` | DB opened; `encryption` true/false only — **never** the key |
| `mfs.db.open_fail` / `mfs.db.wipe` / `mfs.db.recover` | Open failed (often encrypt mismatch); leftover native handle closed, file deleted, then re-open. `recover` logs `from_encryption` / `to_encryption` only |

---

## 4. What never to log

| Forbidden | Why |
| --- | --- |
| Password, session_id, cookie, Bearer / ID token | Auth |
| DB encryption string | Device theft |
| Full document JSON | PII + size |
| `tracking` map / lat-lon series | Location PII + size |
| Photo / blob bytes, local file paths with names | PII |
| Customer phone, street address, note `body` | PII |
| SQL++ with interpolated PII | Prefer parameterized queries; log query **name**, not string |

Allowed: `docId`, `collection`, `employeeId`, counts, `errCode`, `durMs`, `syncState`, HTTP status.

---

## 5. Couchbase Lite LogSinks

Configure immediately after the engine singleton (travel sample does this in `initializeDatabase`).

**Development**

```ts
import { LogSinks, LogLevel, LogDomain } from 'cbl-reactnative';

await LogSinks.setConsole({
  level: LogLevel.DEBUG,
  domains: [LogDomain.ALL],
});
```

**Production**

```ts
await LogSinks.setConsole({
  level: LogLevel.INFO,
  domains: [LogDomain.REPLICATOR, LogDomain.NETWORK, LogDomain.DATABASE],
});
```

`VERBOSE` / `DEBUG` + `LogDomain.ALL` — **debug builds only**. Official docs: do not ship VERBOSE in production.

Optional file sink for support bundles (`LogSinks.setFile`). Wrapper lines look like `RN ::DEBUG:: database_Open` — still no payloads.

Do **not** call deprecated `Database.setLogLevel` alongside LogSinks.

App messages can enter the same pipeline with `LogSinks.write(LogLevel.WARNING, LogDomain.REPLICATOR, 'session refresh')` — still no secrets in that string.

---

## 6. Replication errors

Map replicator `status.getError()` to app logs:

| Condition | App event | Level |
| --- | --- | --- |
| 401, 404, 10401 (replicator) | `mfs.repl.auth_fail` / `http_auth` / `http_not_found` | error → then [AUTH.md](../docs/AUTH.md) refresh |
| 403 | `mfs.repl.http_forbidden` | warn |
| 409 | `mfs.repl.conflict` / `http_conflict` | warn (per-collection policy, default CBL) |
| 413 | `mfs.repl.doc_payload` | error |
| 408, 429, 5xx, 1001 | `mfs.repl.offline` / `http_timeout` / `http_rate_limit` | warn (CBL retries) |
| 400, 422 | `mfs.repl.http_client` | warn |
| 11006 / 1006 TLS mismatch | `mfs.repl.tls` | error |
| 5011 unknown/self-signed cert | `mfs.repl.tls` | error |

Log **code + domain**, not the session cookie that failed.

---

## 7. Version on every line

`appVer` is `Application.nativeApplicationVersion` + `nativeBuildVersion` (same as `audit.*.ver`). Operators match a support log to a store build without opening the binary.
