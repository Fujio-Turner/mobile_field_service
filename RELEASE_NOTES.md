# Release notes — mobile_field_service

Newest first. User-visible string on the phone is `{expo.version}+{ios.buildNumber|android.versionCode}` (login footer, Profile, Settings / debug). Do not hard-code that string in UI — `appVersion()` reads Expo Application APIs.

How to bump: [guides/RELEASE.md](guides/RELEASE.md).

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

- Device chrome is still an assets app with an orders sidecar (sales Search/Map). Follow-up: [docs/ROADMAP.md](docs/ROADMAP.md)
- Vector / CLIP (S15) is off
- POD is a photo; signature pad later
- No credit card payment
