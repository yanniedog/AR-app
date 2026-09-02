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
