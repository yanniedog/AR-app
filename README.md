# AR-app

Installable Expo app and APK release automation for Australian Rates.

## Mobile app


<!-- app-android-install:start -->
### Android preview install

Open the install page in **Android Chrome** for the current APK and QR code.

| | |
|---|---|
| ARM APK (most phones) | [app-preview.apk](https://github.com/yanniedog/AR-app/releases/download/app-apk-arm-latest/app-preview.apk) |
| Install page | [install.html](https://github.com/yanniedog/AR-app/releases/download/app-apk-arm-latest/install.html) |
| Version history | [app-arm-v* releases](https://github.com/yanniedog/AR-app/releases?q=app-arm-v&expanded=true) |
| Universal/x86 fallback | [APK](https://github.com/yanniedog/AR-app/releases/download/app-apk-latest/app-preview.apk) · [install page](https://github.com/yanniedog/AR-app/releases/download/app-apk-latest/install.html) · [version history](https://github.com/yanniedog/AR-app/releases?q=app-v&expanded=true) |

The displayed version and QR follow the phone-optimised ARM channel. x86 and x86_64 emulators or devices must use the universal fallback above.

In-app self-update reads `app-apk-latest.json` from tag `app-apk-arm-latest` on ARM devices and from tag `app-apk-latest` on x86 and x86_64 devices.
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
- `mobile-android-apk` runs after app/build-workflow changes merge to `main`, or
  from **Run workflow**. Unrelated open PRs do not block releases.
- One build job allocates a version from both published channels, prepares
  Android once, and builds universal and ARM APKs using the same native outputs.
  Signing, package identity, ABI, size and payload privacy checks gate both.
  `mobile/app.json` supplies the source version floor; the build stamps its
  allocated version locally. Published manifests are the release version record.
- A separate publish job checks public data delivery and publishes both APKs,
  manifests, install pages and QR codes. On an upload/delivery failure, use
  **Re-run failed jobs** to retry publication without recompiling. Signed APKs
  and their private verification evidence are retained for three days.
- Reviewed source can finish building when later PRs merge. Publication rejects
  older source or version downgrades. There are no generated version or README
  PRs; the stable install links above always lead to the current release.
- `mobile-eas-build` and `mobile-eas-submit` remain manual EAS workflows.
- The [review bot control guide](docs/REVIEW-BOT-CONTROL.md) links the pinned
  GitHub dashboard for Qwen and repository-owned review automation.

Required GitHub Actions secrets mirror the old app build setup:

- `GOOGLE_SERVICES_JSON` and `GOOGLE_SERVICE_INFO_PLIST` are optional Firebase configs.
- `EXPO_TOKEN` is optional for fetching EAS Android credentials.
- `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` are the preferred GitHub Actions signing path.

The Pi, dashboard, ingest jobs, and payload publisher remain in `yanniedog/AR-local`.
