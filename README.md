# AR-app

Installable Expo app and APK release automation for Australian Rates.

## Mobile app


<!-- app-android-install:start -->
### Android preview install

Scan with **Android Chrome** to install the latest preview APK. Asset path is stable (`app-apk-latest/app-preview-qr.png`); the README embed adds `?v=<build>` so the image refreshes after each APK publish.

| | |
|---|---|
| Version | **1.0.37** (build 142) |
| QR | ![Install QR](https://github.com/yanniedog/AR-app/releases/download/app-apk-latest/app-preview-qr.png?v=142) |
| APK | [app-preview.apk](https://github.com/yanniedog/AR-app/releases/download/app-apk-latest/app-preview.apk) |
| Install page | [install.html](https://github.com/yanniedog/AR-app/releases/download/app-apk-latest/install.html) |
| Version history | [app-v* releases](https://github.com/yanniedog/AR-app/releases?q=app-v&expanded=true) |

In-app self-update uses the rolling manifest `app-apk-latest.json` on tag `app-apk-latest`.
<!-- app-android-install:end -->

The app code stays under `mobile/` for the initial split from `AR-local`.

Daily CDR payloads still come from `yanniedog/AR-local`:

- `app-payload-latest`
- `app-payload-YYYY-MM-DD`

APK releases are owned by this repo:

- `app-apk-latest`
- `app-v*`

## Development

```sh
cd mobile
npm ci
npm run ci
```

## Automation and release channels

- `app-ci` runs mobile typecheck, lint, unit tests, script tests, and export.
- `mobile-android-apk` builds the internal Android preview APK and publishes it to this repo.
- `mobile-auto-release-on-queue-drain` bumps `mobile/app.json` and dispatches `mobile-android-apk`.
- `mobile-eas-build` and `mobile-eas-submit` remain manual EAS workflows.

Required GitHub Actions secrets mirror the old app build setup:

- `GOOGLE_SERVICES_JSON` and `GOOGLE_SERVICE_INFO_PLIST` are optional Firebase configs.
- `EXPO_TOKEN` is optional for fetching EAS Android credentials.
- `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` are the preferred GitHub Actions signing path.
- `AR_LOCAL_RELEASE_TOKEN` is optional and only used to bridge the legacy `yanniedog/AR-local` `app-apk-latest` release for old installed APKs.

The Pi, dashboard, ingest jobs, and payload publisher remain in `yanniedog/AR-local`.
