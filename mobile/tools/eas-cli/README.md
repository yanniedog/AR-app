# Isolated EAS release toolchain

This directory pins the command-line tool used by the EAS build and submission workflows. Release jobs and required CI install it with `--ignore-scripts`, then explicitly run `npm run compat` before using or testing the toolchain. Normal installs apply that compatibility command through postinstall. It is not a dependency of `mobile/package.json`, is not imported by application code, and is not bundled into the Android, iOS, or web app.

## Security overrides

`package.json` patches vulnerable transitive dependencies selected by the pinned EAS CLI:

- `minimatch` 5.1.2 to 5.1.8;
- `nanoid` 3.3.8 to 3.3.18;
- `tar` 7.5.19 to 7.5.21;
- `ts-deepmerge` to its published security-fixed 8.0.0 release. EAS CLI 23.2.0 and 24.7.0 expect the older callable default export, so the guarded compatibility command adapts the project-generator caller to use the named `merge` export. It checks exact package versions and caller source, is safe to repeat, and fails on unexpected drift. See [the compatibility policy](../../scripts/DEPENDENCY_COMPAT.md).

Keep each override until EAS CLI selects an equal or newer patched version. Do not broaden an override to unrelated dependency majors.

## Licence review

EAS CLI 23.2.0 selects `@expo/logger`, `@expo/steps`, and `@expo/turtle-spawn` packages whose metadata identifies the licence as BUSL-1.1. Expo's published [EAS Build licence](https://github.com/expo/eas-cli/blob/main/LICENSE-BUSL) grants use provided the work is not used to offer a CI/CD or application-build service to third parties. AR-app uses these packages only to build and submit its own application, which is within that additional use grant.

Re-review the licence before using this toolchain to expose build functionality to third parties, redistributing the toolchain, or changing its role beyond first-party AR-app release automation.
