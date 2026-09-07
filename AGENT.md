# Agent notes — mobile_field_service

Repo: [Fujio-Turner/mobile_field_service](https://github.com/Fujio-Turner/mobile_field_service)  
Official site: [https://mobile.fuj.io](https://mobile.fuj.io) (HTML source: [mobile_field_service_pages](https://github.com/Fujio-Turner/mobile_field_service_pages)).  
Not koten-ai. Product design: `docs/`. How we code: `guides/`. Env / Profile / debug: [guides/SETTINGS.md](guides/SETTINGS.md).

---

## `work/` — keep files small

`work/` is **gitignored**. Step-by-step slice checklists live there so we can tick boxes while building **without bloating git**.

**Hard limit: ~80 lines per `work/*.md`.** If a file grows, **split** (`S03a`, `S03b`). Do **not**:

- Paste logs, diffs, JSON dumps, or DESIGN excerpts into work files
- Append a “what we did” novel after each checkbox
- Keep one giant `TODO.md`

Each slice file: goal (1–2 lines), files to touch, checkboxes, `Status:`. Check the box. Stop.

Index: `work/00-index.md` (links only).

---

## Tests

All automated tests go in **`tests/`** (not next to `src/`). Mirror ops names: `tests/ops/startWork.test.ts`. See `tests/README.md`.

---

## Schema

Canonical collection docs: **`docs/schema/SCHEMA_*.md`**. Index: `docs/schema/README.md`. Each file includes a [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema) for the document body. Do not invent field names — read the schema file first.

---

## Product rules (do not regress)

- Dispatch inbound: **never patch**. Field jobs: **new** `woin:` `origin: field`.
- Labor/sales work on a **copy**. Complete **freezes**. Forgotten facts → **amendment** (`amends.id`).
- SG login = **email**. Channel = `emp:{employeeId}`. Session via `POST /_session`, honor TTL. [docs/AUTH.md](docs/AUTH.md)
- One person, one device. Chat = employees only. **No credit card payment** in this version. Snapshot prices. No stock reservation on quote.
- Binding: [Fujio-Turner/cbl-reactnative](https://github.com/Fujio-Turner/cbl-reactnative). Not official plugin 1.1 as SoT.
- `local.tmp` never in the replicator. Push filters: `"show source"` pure functions. Per-collection **pull channels** are a `string[]` on each collection config; **default empty** (no client filter — SG grants). Replication **schema** is build-time `EXPO_PUBLIC_REPL_SCHEMA=simple|oneshot` — not a Profile control. Conflict resolvers are a **switch per collection** (CBL default today). Listeners classify HTTP 401/403/404/409/413/429/5xx. [guides/REPLICATION.md](guides/REPLICATION.md)
- Operator **sync HUD** on the Today clock (green = connected, yellow + `12m`/`2h` when not, pending-push count). Other `NativeBanner` screens keep a one-line bar. Demo: yellow dot / **Local only**. Profile **Settings / debug** shows software versions, CBL db name/path, replicator URL/status/last pull+push, document counts, optional pull channels, **job rules**, and **DB encryption** (default **off**). Do not show session cookies or the DB encryption key. Catalog: [guides/SETTINGS.md](guides/SETTINGS.md).
- User/device docs append `history[]` (path + from/to + lat/lon/dt). No `lastAction`. Movement crumbs: `field.tracking` id `track:{YYYY-MM-DD}:{employeeId}` — last 7 days is seven KV gets. **TTL 30 days** after `day`. Never log the tracking map. [docs/schema/SCHEMA_COMMON.md](docs/schema/SCHEMA_COMMON.md), [docs/schema/SCHEMA_TRACKING.md](docs/schema/SCHEMA_TRACKING.md)
- Logs: [guides/LOGGING.md](guides/LOGGING.md) — no secrets/PII/doc bodies / tracking maps.
- UI: [guides/HTML_CSS.md](guides/HTML_CSS.md). Release: [guides/RELEASE.md](guides/RELEASE.md).

---

## Code hygiene

- Expo **development builds**, not Expo Go. `postinstall` fetches `ios/cbl-js-swift` + `src/cblite-js` (npm does not clone those).
- Version from `app.json` / Expo Application APIs — never hard-code in UI.
- After Hub-style JS templates: no nested backticks (if any web/HTML strings appear).
- Prefer `src/ops/*` names matching the DESIGN catalog.
- **CBL SQL++ (Mobile):** no `IN ['a','b']` / `NOT IN [...]`, no `LIMIT $limit` / `OFFSET $offset`. Use `status != 'x' AND status != 'y'`, `status = 'a' OR status = 'b'`, and interpolate integer LIMIT/OFFSET. `FindOutboundForSources` is a bounded `OR` list (max 20).
- **Live queries:** Today jobs + orders use `Query.addChangeListener` (`src/db/liveQuery.ts`, `watchTodayWork`, `watchTodayOrders`). Pages 2+ stay one-shot `execute()`. Native pull-to-refresh applies inbound kit on on-screen outbound copies; the live list is the source of truth.
- **ULID random:** `expo-crypto` `getRandomBytes` — Hermes has no `global.crypto`.
- **Query explain:** opt-in `EXPO_PUBLIC_QUERY_EXPLAIN=1`, not every `runQuery` in `__DEV__`.
- **UI:** theme tokens in `src/theme.ts`. Job ops/checklist use `DoneToggle` (outline ↔ filled), not a 4-way status cycle. Inputs: `src/ui/FieldInput.tsx` (`showSoftInputOnFocus`). Optional **Large screen optimize** (and **Left hand**) on Profile — default off is full-width buttons. Stack screens show **Back** (`goStackBack`: pop, else Today); Left hand puts Back on the right.

## Do not start S15

Vector / CLIP stays blocked until the native model and vector index land. Do not scaffold `src/embed/` or a similarity screen.
