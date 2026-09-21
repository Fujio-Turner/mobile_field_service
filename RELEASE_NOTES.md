# Release notes — mobile_field_service

Newest first. User-visible string on the phone is `{expo.version}+{ios.buildNumber|android.versionCode}` (login footer, Profile, Settings / debug). Do not hard-code that string in UI — `appVersion()` reads Expo Application APIs.

How to bump: [guides/RELEASE.md](guides/RELEASE.md).

---

## 2026-09-21 — Phase 12 (mode-aware chrome)

Shipped on app **`0.1.0+1`** in [PR #25](https://github.com/Fujio-Turner/mobile_field_service/pull/25) (`issue/12`). Closes [#7](https://github.com/Fujio-Turner/mobile_field_service/issues/7)–[#12](https://github.com/Fujio-Turner/mobile_field_service/issues/12). Device chrome now follows `users.workModes[]` on the session (seed employeeId is fallback only).

### New Features

- **Today** — sales hides Walk-up job (customer + order instead); customer keeps job **and** order walk-ups; assets keeps Walk-up job only. Live queries skip lists the login does not show.
- **Search** — collections follow the day: assets → notes + assets; sales/customer → notes + products + customers (Maya also gets assets when the open job is kit). Product and customer hits open. Hartford complete-jobs dump removed.
- **Map** — tab visible for sales. Jon keeps the assets map. Priya and Maya plot **customers** and order `site.geo` (Area / Near stop / Near me). Maya has a **Kit** chip for company assets.
- **Customers** — typeahead lookup (no button dump). Field create records address and/or lat/lon. First-class `geo` + `idx_cus_geo` / `idx_cus_fts`. Dispatch customers stay pull-only.
- **Catalog picker** — type a SKU on the order editor; Stock can add a line when an order or job is in context.

### Bug Fixes

- **Reassigned** leftovers (e.g. WO-10460) only appear on Today when `scheduled.day` is today. Your own in-progress copy can still stay overnight.

### Changes

- Session stores `workModes` in Keychain; after the DB opens, `field.users.workModes` wins.
- Live Today queries no longer `execute()` the same SQL++ on attach (the listener’s first snapshot is the paint).
- Van stock names load by product id, not a 50-row catalog dump.
- Memory/demo seed is once per process.

### Known

- Vector / CLIP (S15) is off
- POD is a photo; signature pad later
- No credit card payment
- Order editor still has no “come back Tuesday” `scheduled.day` / `needsWorkOrder` (called out on #11)

---

## v0.1.0 — 2026-09-16

First tracked build. App **`0.1.0+1`**. Expo SDK 52 / React Native 0.76.9. Development builds only (not Expo Go).

### New Features

- Three demo modes on one binary: **assets** (Jon), **customer** (Maya), **sales** (Priya)
- Copy-on-write jobs and orders; freeze on complete; amendments; Reassigned
- Today list + live clock + sync HUD
- Assets map (bbox, near job / near me); van stock; notes; employee chat
- Field customers and orders with snapshotted rates/taxes (no card capture)
- Encrypted Couchbase Lite `field.*` + replicator; tracking crumbs (TTL 30 days)
- Profile Settings / debug (versions, DB path, replicator, counts)

### Bug Fixes

- iOS compile on Xcode 26.4+ (`plugin.fmt.js` disables `{fmt}` 11.0.2 consteval)
- First iOS build needs `scripts/fetch-cbl-native.sh` (`cbl-js-swift`); skip it and Swift types are missing

### Changes

- Version bump — app `0.1.0` (build 1)
- cbl-reactnative @ `feat/vector-search-support` (`af459d16a4ff7fe93cdf1a3b1c0c4d46253c6aa2`)

### Known

- Vector / CLIP (S15) is off
- POD is a photo; signature pad later
- No credit card payment
- Mode-aware Search / Map / Today shipped 2026-09-21 — see the Phase 12 section above
