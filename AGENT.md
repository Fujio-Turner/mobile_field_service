# Agent notes — mobile_field_service

Repo: [Fujio-Turner/mobile_field_service](https://github.com/Fujio-Turner/mobile_field_service)  
Not koten-ai. Product design: `docs/`. How we code: `guides/`.

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

Canonical collection docs: **`docs/schema/SCHEMA_*.md`**. Index: `docs/schema/README.md`. Do not invent field names — read the schema file first.

---

## Product rules (do not regress)

- Dispatch inbound: **never patch**. Field jobs: **new** `woin:` `origin: field`.
- Labor/sales work on a **copy**. Complete **freezes**. Forgotten facts → **amendment** (`amends.id`).
- SG login = **email**. Channel = `emp:{employeeId}`. Session via `POST /_session`, honor TTL. [docs/AUTH.md](docs/AUTH.md)
- One person, one device. Chat = employees only. No card processing. Snapshot prices. No stock reservation on quote.
- Binding: [Fujio-Turner/cbl-reactnative](https://github.com/Fujio-Turner/cbl-reactnative). Not official plugin 1.1 as SoT.
- `local.tmp` never in the replicator. Push filters: `"show source"` pure functions. [guides/REPLICATION.md](guides/REPLICATION.md)
- User/device docs append `history[]` (path + from/to + lat/lon/dt). No `lastAction`. Movement crumbs: `field.tracking` id `track:{YYYY-MM-DD}:{employeeId}` — last 7 days is seven KV gets. Never log the tracking map. [docs/schema/SCHEMA_COMMON.md](docs/schema/SCHEMA_COMMON.md), [docs/schema/SCHEMA_TRACKING.md](docs/schema/SCHEMA_TRACKING.md)
- Logs: [guides/LOGGING.md](guides/LOGGING.md) — no secrets/PII/doc bodies / tracking maps.
- UI: [guides/HTML_CSS.md](guides/HTML_CSS.md). Release: [guides/RELEASE.md](guides/RELEASE.md).

---

## Code hygiene

- Expo **development builds**, not Expo Go.
- Version from `app.json` / Expo Application APIs — never hard-code in UI.
- After Hub-style JS templates: no nested backticks (if any web/HTML strings appear).
- Prefer `src/ops/*` names matching the DESIGN catalog.
