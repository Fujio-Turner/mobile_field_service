# Release — mobile_field_service

Use this every time you cut a store / TestFlight / Play internal build. Replace `x.y.z` with the semver (e.g. `0.1.0`).

**Standards that must stay green:**

| Guide | Obligation |
| --- | --- |
| [LOGGING.md](LOGGING.md) | No secrets/PII; LogSinks not deprecated API |
| [HTML_CSS.md](HTML_CSS.md) | Theme tokens; phone-first |
| [REPLICATION.md](REPLICATION.md) | Session TTL; `tmp` not in replicator; 401 path |
| [SETTINGS.md](SETTINGS.md) | Env defaults still match `.env.example` |

---

## Version method

**Semver** `MAJOR.MINOR.PATCH` (optional `+ios.N` / Play `versionCode` is numeric).

**User-visible version** (what `audit.cr.ver` / `audit.up.ver` store):

```text
{expo.version}+{ios.buildNumber|android.versionCode}
```

Example: `0.1.0+12`. Read at runtime from `expo-application` (`nativeApplicationVersion` + `nativeBuildVersion`). **Do not** hard-code the version in screens.

### Sources of truth (bump all of these)

Bump these files on every ship. The app is real (`app.json` `expo.version` is what Profile shows).

| File | Field | Example |
| --- | --- | --- |
| `app.json` / `app.config.ts` | `expo.version` | `"0.1.0"` |
| `app.json` | `expo.ios.buildNumber` | `"12"` (string, increment every iOS ship) |
| `app.json` | `expo.android.versionCode` | `12` (int, increment every Play ship) |
| `package.json` | `version` | `"0.1.0"` (same as expo.version) |
| `ios/.../Info.plist` | `CFBundleShortVersionString` / `CFBundleVersion` | EAS/prebuild usually copies from `app.json` — **verify after prebuild** |
| `android/app/build.gradle` | `versionName` / `versionCode` | Same — **verify after prebuild** |
| `RELEASE_NOTES.md` | New section **at the top** | `## v0.1.0 — YYYY-MM-DD` |
| `README.md` | Badge / “current version” if present | Match |

**Native module pin** (not the app semver, but must be recorded in notes):

| File | What |
| --- | --- |
| `package.json` | `cbl-reactnative` → git URL + commit/branch of [Fujio-Turner/cbl-reactnative](https://github.com/Fujio-Turner/cbl-reactnative) |
| `package-lock.json` | Lockfile commit |

Do not ship official `@couchbase/couchbase-lite-react-native` 1.1 as the production binding (no vector). See [DESIGN.md](../docs/DESIGN.md) stack.

---

## 1. Branch

```bash
git checkout main && git pull
git checkout -b release-x.y.z
```

---

## 2. Bump versions

1. Set `expo.version` / `package.json` `version` to `x.y.z`.
2. Increment iOS `buildNumber` and Android `versionCode` (never reuse a Play `versionCode`).
3. Confirm `audit` / logger `appVer` still read from Expo Application APIs (no new literals).
4. Native CBL: if the fork moved, pin the new git SHA and note CBL native (3.3 / 4.x) in RELEASE_NOTES.

---

## 3. RELEASE_NOTES.md

Create or update at repo root. Newest section first:

```markdown
## vx.y.z — YYYY-MM-DD

### New Features
- …

### Bug Fixes
- …

### Changes
- Version bump — app `x.y.z` (build N)
- cbl-reactnative @ &lt;git sha&gt;
```

---

## 4. Docs sweep

- [ ] README version / SG example still true
- [ ] `docs/DESIGN.md` / `docs/AUTH.md` / `guides/*` not contradicting the binary
- [ ] Replication allow-list still excludes `local.tmp`

---

## 5. Quality gates

```bash
npx tsc --noEmit
npm test
npx expo-doctor          # when Expo app exists
```

Manual:

- [ ] Login (email) → Today (airplane mode still lists local work)
- [ ] StartWork copy; dispatch inbound JSON unchanged
- [ ] Complete → freeze → amendment
- [ ] Replicator: stop network → OFFLINE; 401 → login/refresh ([AUTH.md](../docs/AUTH.md))
- [ ] No password / session in Metro logs ([LOGGING.md](LOGGING.md))

Lab/testing **does not require** a CBL EE license. Store production with encryption + vector **does**.

---

## 6. Build artifacts

**Development:** `npx expo run:ios` / `run:android` (dev client, not Expo Go).

**Release:** EAS or local archive.

| Store | Artifact |
| --- | --- |
| TestFlight | `.ipa` signed with distribution profile |
| Play internal | `.aab` (`versionCode` unique) |

Never commit keystores. Android signing stays in EAS secrets / local `keystore.properties` (gitignored).

---

## 7. Tag and GitHub release

```bash
git add -A
git commit -m "release: v x.y.z"
git tag -a vx.y.z -m "v x.y.z"
git push origin release-x.y.z
git push origin vx.y.z
```

GitHub Release: attach notes; do not attach keystores or `.cblite2` with customer data.

Merge the release branch to `main` after the build is accepted.

---

## 8. Post-release

- [ ] Confirm Hub/device `appVer` matches the tag
- [ ] Confirm SG session TTL still matches AUTH (pre-refresh)
- [ ] If native CBL changed, smoke vector index create on one device

---

## Checklist (copy)

- [ ] `package.json` version
- [ ] `app.json` `expo.version`
- [ ] iOS `buildNumber`
- [ ] Android `versionCode`
- [ ] `RELEASE_NOTES.md`
- [ ] `cbl-reactnative` git pin
- [ ] Tests + tsc
- [ ] Auth + replication smoke
- [ ] Tag `vx.y.z`
