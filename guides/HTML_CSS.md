# HTML & CSS / UI style — mobile_field_service

This is a **phone-first Expo (iOS/Android)** app. There is **no Web/Windows runtime**. “HTML/CSS” here means **how we build UI**: React Native `StyleSheet` + a single theme, not a DaisyUI Hub.

If a small **web** companion appears later (status page, not the field app), use the web appendix.

---

## 1. Golden rules

- **Theme tokens, not magic numbers.** Colors, type, space live in `src/theme.ts`. Screens import tokens; they do not hard-code `#fff` or `14`.
- **Phone-first.** Design at 390×844. Large phone / ~7″ tablet must not clip; no desktop layout.
- **No emoji as icons.** Use SVG (react-native-svg) or a small icon set. 24×24, 1.5 stroke, one color from the theme.
- **Touch targets ≥ 44×44 pt.** Primary actions full-width on the phone unless Profile **Large screen optimize** is on (then thumb-zone width; **Left hand** mirrors).
- **One visual language** for assets / customer / sales modes. Mode changes **data**, not a new skin.
- **No inline styles** except a one-off that cannot be a named style (rare). Prefer `StyleSheet.create`.
- **Do not ship a WebView** for core flows (login, Today, editors). OIDC uses the **system browser** ([AUTH.md](../docs/AUTH.md)).

---

## 2. Theme (`src/theme.ts`)

Keep a small palette (names, not brand fluff):

| Token | Use |
| --- | --- |
| `color.bg` / `color.surface` | Screen / card |
| `color.text` / `color.muted` | Body / secondary |
| `color.accent` | Primary button, Today row chevron |
| `color.danger` | Destructive, push_error |
| `color.warn` | Reassigned, stale sync |
| `color.ok` | Synced, complete |
| `color.okBright` / `warnBright` / `dangerBright` | Dots on the dark Today clock |
| `space.xs…xl` | 4 / 8 / 12 / 16 / 24 |
| `type.sm` / `md` / `lg` / `title` | 13 / 15 / 17 / 22 |

Light theme first. Dark: follow `useColorScheme` later; do not invert ad hoc in one screen.

**Type:** system UI font (`Platform.select` San Francisco / Roboto). No extra display font in v1.

---

## 3. Layout

- **Safe areas:** Expo Router + `SafeAreaView` / `react-native-safe-area-context`. Never draw under the notch or home indicator.
- **Lists:** `FlatList` / `FlashList`. Today is infinite scroll (`LIMIT`/`OFFSET`) — do not load the whole day into a `ScrollView` of Views.
- **Editors:** keyboard-aware scroll (`KeyboardAvoidingView` / `KeyboardStickyView`). Primary CTA pinned above the keyboard when possible.
- **Debug:** Profile → Settings / debug. Long form; keep tokens; do not dump secrets.
- **Headers:** nested stacks show **Back** (left; right if Left hand). Back pops the screen you came from; empty stack → Today. Touch target ≥ 44 pt.
- **Badges:** Started, Reassigned, Amendment, Frozen — text + color token, not color-only.

---

## 4. Components

| Pattern | Do |
| --- | --- |
| Primary button | Filled `color.accent`, white label, 48 pt height |
| Secondary | Outline / ghost |
| Destructive | `color.danger`, confirm on Complete/Cancel/Logout |
| Text field | Label above, error below, `secureTextEntry` on password |
| Row (Today) | 64+ pt, number + site + time + badge |
| Empty | One sentence + last-sync time |
| Offline | Today clock HUD (dot + elapsed + pending count), not a modal that blocks the job |

Copy: short, sentence case. “Sign in”, “Start work”, “Add follow-up”. No marketing voice.

---

## 5. Accessibility

- `accessibilityLabel` on icon-only buttons.
- Contrast: body text vs `bg` ≥ 4.5:1.
- Dynamic type: prefer `allowFontScaling`; don’t clip titles at extra-large sizes.
- Password fields: no screenshots (`secureTextEntry`).

---

## 6. Assets / images

- Job photos: JPEG 200–800 KB, no EXIF in the blob ([DESIGN.md](../docs/DESIGN.md)).
- UI icons: SVG, not PNGs per density unless a photo/illustration.
- Map: MapLibre; pins from CBL. Basemap may be empty offline — that is OK.

---

## 7. What not to do

- HTML strings + `WebView` for Today or editors.
- Nested backticks if you ever build HTML in a JS template (same footgun as Zeus Hub): use `<code>` or a normal string.
- Tailwind **in RN** unless the project explicitly adds NativeWind later. Until then, StyleSheet + theme.
- Different palettes per `workModes[]`.

---

## Appendix — web companion (if added)

Not the field app. If we add a static status or docs site:

- HTML / CSS / JS in separate files.
- Tailwind utilities + DaisyUI components (same as other Fujio-Turner tools).
- No emoji icons; Heroicons SVG.
- Never nest `` `code` `` inside `` `…${html}` `` templates.
