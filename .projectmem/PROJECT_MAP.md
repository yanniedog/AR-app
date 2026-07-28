# Project Map - AR-app

## Project purpose

AR-app is the installable Australian Rates mobile client. It presents Australian
consumer banking rates from daily CDR payloads, works offline from a local cache,
and owns Android preview APK build and release automation. The upstream AR-local
repository owns payload publication, ingest, the Pi, and the web dashboard.

## Stack

- Expo SDK 54 and React Native 0.81 with TypeScript and Expo Router.
- Zustand with AsyncStorage persistence for app data and user preferences.
- Jest/Expo, TypeScript, ESLint, Expo Doctor, and Expo export in the primary CI path.
- GitHub Actions and EAS for signed Android/iOS build and release workflows.

## Main folders

- `mobile/app/` — Expo Router routes; `(tabs)/` contains Home, Browse, Response,
  Outlook, Watchlist, and Settings tab screens.
- `mobile/src/components/` — reusable UI, charts, bank/product surfaces, filters,
  navigation, settings, and pass-through visualizations.
- `mobile/src/data/` — payload/cache handling, Zustand store slices, selectors,
  taxonomy, history, notifications, user preferences, and derived models.
- `mobile/src/lib/` — authentication, updates, observability, navigation, chart
  helpers, rate qualification, and platform integration.
- `mobile/src/theme/` — light/dark Material 3 theme definitions and provider.
- `mobile/assets/` — app art plus bundled sample data used for offline-first boot.
- `mobile/__tests__/` — Jest unit and regression coverage.
- `mobile/scripts/` — release, version, Firebase-placeholder, sample, and changelog
  utilities.
- `.github/workflows/` — mobile CI, APK publishing, EAS, and release automation.
- `scripts/` — repository-level PR gate, merge, and automation verification tools.

## Entry points and relationships

- `mobile/index.ts` delegates startup to `expo-router/entry`.
- `mobile/app/_layout.tsx` bootstraps the Zustand store, theme, auth/key sync,
  notifications, splash flow, and root navigation.
- `mobile/src/data/store.ts` composes persisted preferences with bootstrap, refresh,
  lazy-load, and user action slices.
- `mobile/src/data/storeBootstrap.ts` hydrates cached or bundled sample payloads,
  then schedules refresh through `storeRefresh.ts`.
- Daily payload URLs are configured for releases published by `yanniedog/AR-local`;
  APK update manifests and releases are published from this repository.

## Suggested first reads

- `AGENTS.md`
- `README.md`
- `mobile/README.md`
- `mobile/package.json`
- `mobile/app/_layout.tsx`
- `mobile/src/data/store.ts`
- The route, component, selector, and tests nearest the requested behavior
