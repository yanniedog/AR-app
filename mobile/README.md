# AR Rates — mobile app

Polished iOS + Android app (Expo / React Native + TypeScript) for Australian Rates CDR
rates data. Offline-first: it downloads a compact daily payload from a GitHub Release
and serves everything from a local cache.

See [`../docs/MOBILE_APP.md`](../docs/MOBILE_APP.md) for the payload contract, the Pi
publishing setup, and EAS store builds.

## Quick start

```bash
npm install
npm run typecheck && npm run lint && npm test
npx expo start          # press i (iOS), a (Android), or scan with Expo Go
```

The app boots against a **bundled sample** (`assets/sample/`, a real export snapshot),
then upgrades to the live payload at `expo.extra.manifestUrl` (set in `app.json`).

## Layout

```
app/                expo-router routes
  (tabs)/           Today · Explore · Changes · My rates (Settings hidden)
  product/[key]     product detail        bank/[provider]  lender detail
  banks · compare · onboarding
src/
  config.ts types.ts constants.ts
  data/             store (zustand) · payload fetch/inflate · cache · selectors
                    · format · private rate tracking · notifications
  components/       UI primitives · ProductCard · market summaries · RBA charts
                    · BankAvatar · …
  theme/            light/dark theme + provider
assets/             icon/splash (scripts/make-icons.mjs) + sample/ payload
__tests__/          selectors · format · notifications (jest-expo)
```

## Typography

Use the bundled Commissioner faces for app text, inputs, charts, and navigation.
`src/theme/typography.ts` owns sizes, line heights, and default weights for both
`AppText` and `LedgerText`: body 16, supporting text 14/12, headings 18/22/28,
and rates 24/32. Use the shared variants instead of adding screen-specific scales.
Headers use `HEADER_TYPOGRAPHY`, including Android's stack overrides. Static
font faces carry their own weight; navigation must not apply synthetic bolding.
Keep accessibility scaling enabled and use tabular numerals for rate figures.
Diagnostic logs may use monospace for aligned technical output.

## APK storage

Release builds use Hermes, code/resource shrinking, PNG crunching, and omit the
optional development client. The ARM download retains both 32-bit and 64-bit phone
support. Native libraries stay uncompressed so Android can load them from the APK
without storing extracted copies; the Hermes bundle also stays uncompressed.

`performance-budgets.json` caps the ARM APK at 48,405,000 bytes and the universal
fallback at 92,400,000 bytes, based on the measured v1.0.191/build 260 releases.
Both GitHub and EAS publication enforce these budgets. An explicitly supplied
missing/empty APK fails the size check. On Android startup, the updater removes
its versioned installer files for builds already installed, even offline, while
preserving newer installers and native transfers that cannot be stopped.

## Scripts

| Command | What |
| --- | --- |
| `npm start` / `npm run ios` / `npm run android` | Run the dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (expo config) |
| `npm test` | Jest unit tests |
| `npm run sample` | Rebuild `assets/sample/*` from a built payload dir |
| `npm run icons` | Regenerate app icons |

Preview APK releases do not use `expo.android.versionCode` verbatim. The GitHub
workflow reads the rolling `app-apk-latest` manifest and assigns the next
monotonic Android versionCode at build time; the value in `app.json` is the
local/prebuild fallback.

<!-- apk install QR refresh v1.0.43 b156 -->
