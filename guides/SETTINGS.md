# Settings — where they live and what they mean

One page for **developers**. Operators and field users only see Profile + **Settings / debug**.

Restart Expo (and rebuild a native binary) after changing `EXPO_PUBLIC_*`. Device toggles persist in **SecureStore** (Keychain / Keystore) until you change them or wipe the app.

| Layer | When it applies | Where |
| --- | --- | --- |
| Build env | Compile / Metro inline | `.env` (gitignored; copy [`.env.example`](../.env.example)) |
| Profile | Tech on the phone | `app/(tabs)/profile.tsx` |
| Settings / debug | Lab / support | `app/debug/index.tsx` |
| Keychain | Session + encryption | `src/session/enclave.ts`, `src/session/dbKey.ts` |

---

## 1. Build-time env (`EXPO_PUBLIC_*`)

Metro inlines these. Empty string is “unset” unless noted.

### Auth and Sync Gateway

| Variable | Default | Meaning |
| --- | --- | --- |
| `EXPO_PUBLIC_AUTH_STRATEGY` | `basic` in code; **`demo` in `.env.example`** | `demo` — no network, replicator never starts. Known emails/usernames: Jon Hale, Maya Chen, Priya Shah, Maya Dispatch. Any other non-empty id signs in as Jon. Empty field is rejected. `basic` — email + password → SG session. `oidc_implicit` / `oidc_code` — IdP button (screens stubbed; issuer env is **not** read by `src/` yet). |
| `EXPO_PUBLIC_SG_URL` | empty | Sync Gateway / App Services WebSocket URL (`wss://…`). Required for `basic`. Demo ignores it. |
| `EXPO_PUBLIC_SG_DB` | `mfs` | SG database name (`POST /{db}/_session`). |
| `EXPO_PUBLIC_SG_SELF_SIGNED` | unset | `true` allows self-signed TLS (also implied by `ws://`). Lab only. |
| `EXPO_PUBLIC_SG_CHANNELS` | empty | Optional pull-channel list applied to **every** `field.*` collection when nothing is saved on Settings / debug. Empty = all channels the session can access (SG still grants). |
| `EXPO_PUBLIC_SESSION_REFRESH_SKEW_SEC` | `300` | Mint a new SG session this many seconds **before** `expiresAt`. |

Documented for a later OIDC build (not wired in `src/` today): `EXPO_PUBLIC_OIDC_ISSUER`, `EXPO_PUBLIC_OIDC_CLIENT_ID`, `EXPO_PUBLIC_OIDC_SCOPES`, `EXPO_PUBLIC_AUTH_BEARER_ON_REPL`. See [AUTH.md](../docs/AUTH.md).

### Replication schema (not a Profile toggle)

| Variable | Default | Meaning |
| --- | --- | --- |
| `EXPO_PUBLIC_REPL_SCHEMA` | `simple` | `simple` — one continuous `PUSH_AND_PULL` replicator for all `field.*` except `tmp`. `oneshot` — one-shot `workordersin`+`orders` first, then one-shot all field collections on a timer and on foreground. |
| `EXPO_PUBLIC_REPL_ONESHOT_SEC` | `300` | Seconds between follow-up oneshots. Floor **30**. |

Details: [REPLICATION.md](REPLICATION.md).

### Tracking, map, queries

| Variable | Default | Meaning |
| --- | --- | --- |
| `EXPO_PUBLIC_TRACK_MIN_MOVE_M` | `100` | Meters of movement before a GPS crumb is stored (~328 ft). `152` ≈ 500 ft. OS `distanceInterval` uses the same value. Accuracy worse than this is skipped. Per-day docs **TTL 30 days**. |
| `EXPO_PUBLIC_MAP_STYLE_URL` | OpenFreeMap Liberty | MapLibre style URL. Pins always come from local `field.assets`. Basemap needs network. |
| `EXPO_PUBLIC_QUERY_EXPLAIN` | unset | `1` runs CBL `query.explain()` (opt-in). Do not leave on in a ship build. |

**Not on this train:** `VECTOR_SEARCH_ENABLED`, `VECTOR_BRUTE_FORCE_DEBUG` (S15). Do not add them to `.env` until the native model lands.

---

## 2. Profile (field user)

Persisted in SecureStore. Sign-out does **not** clear these (or the DB encryption key).

| Control | Key | Default | Meaning |
| --- | --- | --- | --- |
| **Large screen optimize** | `mfs.ui.thumbOptimize` | off (`0`) | Parks primary buttons in the easy thumb zone and sizes them for this viewport. Off = full-width 48pt buttons. |
| **Left hand** | `mfs.ui.leftHand` | off | Only shown when Large screen optimize is on. Mirrors the zone (and tab order / Back) for left-thumb reach. |

Also on Profile (read-only): username, email, `employeeId`, `workModes`, auth strategy, encrypted DB name, app version, **Crumbs today** (point count, not a map), sync activity.

**Search** (Profile button) is FTS over notes, products, and assets — not a setting.

---

## 3. Settings / debug (lab)

Route: `/debug`. Do **not** show session cookies or the DB encryption string.

### Database encryption (`mfs.dev.dbEncryption`)

| Value | Meaning |
| --- | --- |
| **off** (default, `'0'`) | Open CBL **without** `setEncryptionKey`. Lab/default. |
| **on** (`'1'`) | Mint/load `mfs.dbkey.<employeeId>` in Keychain and pass it to `setEncryptionKey` (AES-256). |

Switching **deletes the local database and reseeds** (encrypted vs plain files are not interchangeable). The key is never shown on this screen. If a leftover encrypted file cannot open with encryption off, the app closes any native handle, deletes the `.cblite2` folder, and opens a new file matching the toggle.

### Job rules (`mfs.dev.jobRules`)

JSON `{ reassign, inbound }`. Defaults: **keep editing** + **local wins**. Lab policy for how a started copy treats dispatch changes — not a production SG rule.

| Field | Values | Meaning |
| --- | --- | --- |
| `reassign` | `keep_editing` (default) | Inbound went to someone else: banner, you may still edit your copy. |
| | `forbid_edits` | Same banner plus lock: dock gone, ops display-only, chat still works. |
| `inbound` | `local_wins` (default) | After you have edited, keep your fields; show a diff. **Untouched** copies still take new inbound (or hide if dispatch cancelled). |
| | `remote_wins` | After edits, inbound overwrites the changed kit fields. |
| | `prompt` | After edits, pick keep-mine / take-inbound per field. |

Try buttons and deep link `mfs://debug?demo=local\|prompt\|remote\|reassign\|untouched` run `simulateDispatchKitChange` on a seed job (lab only; never patch dispatch inbound on a product path).

### Pull channels (`mfs.sync.collectionChannels`)

Per-collection `string[]` on the replicator config. **Empty (default)** = no client filter; SG grants channels from document fields (`emp:` / `email:` / `cus:` / `type:`). A non-empty list only **narrows** pull. Saved from the debug form; `EXPO_PUBLIC_SG_CHANNELS` is the fallback when nothing is stored.

### Sync timestamps

| Key | Meaning |
| --- | --- |
| `mfs.sync.lastPullSuccessAt` | Unix seconds, last successful pull (memory + SecureStore). |
| `mfs.sync.lastPushSuccessAt` | Same for push. |

Today’s clock HUD (green / yellow / red + `12m`/`2h` + pending count) and the one-line bar on other screens use these timestamps plus replicator activity and pending-push count. Debug also shows software versions, CBL db name/path, replicator URL/status/progress, collection counts, schema (`simple`/`oneshot`). Demo never starts the replicator.

---

## 4. Keychain (not toggles)

Logout deletes **auth.*** and keeps **dbkey**.

| Key | Meaning |
| --- | --- |
| `mfs.auth.strategy` | `demo` \| `basic` \| `oidc_*` |
| `mfs.auth.username` / `email` / `employeeId` | Who this device is |
| `mfs.auth.password` | **basic only**, to mint sessions |
| `mfs.auth.sessionId` / `cookieName` / `sessionExpiresAt` | SG session |
| `mfs.dbkey.<employeeId>` | CBL encryption string (base64 of 32 random bytes). Created only when encryption is **on**. **Never log.** |
| `mfs.cbluid.<employeeId>` | Native CBL unique open-name (not a secret). Used to close leftover handles after Fast Refresh. |

---

## 5. Deep links (scheme `mfs`)

Useful in the simulator: `xcrun simctl openurl booted 'mfs://…'`.

| URL | Screen |
| --- | --- |
| `mfs://` | Today |
| `mfs://notes` `map` `inventory` `chat` `profile` | Tabs |
| `mfs://search` | FTS |
| `mfs://debug` | Settings / debug |
| `mfs://debug?demo=local` (also `prompt`, `remote`, `reassign`, `untouched`) | Lab inbound-merge demo |
| `mfs://wo/in/{id}` / `mfs://wo/out/{id}` | Job ticket / copy |
| `mfs://order/{id}` `customer/{id}` `note/{id}` `asset/{id}` | Other KV screens |

---

## 6. OS permissions

| Permission | Why |
| --- | --- |
| Camera | Job / order photos |
| Location when in use | `history[]` geo (best-effort) + `field.tracking` crumbs while foreground |

Tracking is **foreground / while-using** only. Background trail is later.

---

## What is not a setting

- **Credit card payment** — not in this version. Orders snapshot catalog cents. ROADMAP item.
- **Replication schema** — build env, not Profile.
- **Vector / CLIP** — blocked (S15).
- **`local.tmp`** — never in the replicator; 24 h expiration. Not user-visible.
