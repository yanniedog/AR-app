# Isolated EAS release toolchain

This directory pins the command-line tool used by the EAS build and submission workflows. It is installed with `--ignore-scripts` only inside those release jobs. It is not a dependency of `mobile/package.json`, is not imported by application code, and is not bundled into the Android, iOS, or web app.

## Security overrides

`package.json` applies version-scoped patch overrides only to the vulnerable transitive versions selected by EAS CLI 23.2.0:

- `minimatch` 5.1.2 to 5.1.8;
- `nanoid` 3.3.8 to 3.3.18;
- `tar` 7.5.19 to 7.5.21.

Keep each override until EAS CLI selects an equal or newer patched version. Do not broaden an override to unrelated dependency majors.

## Licence review

EAS CLI 23.2.0 selects `@expo/logger`, `@expo/steps`, and `@expo/turtle-spawn` packages whose metadata identifies the licence as BUSL-1.1. Expo's published [EAS Build licence](https://github.com/expo/eas-cli/blob/main/LICENSE-BUSL) grants use provided the work is not used to offer a CI/CD or application-build service to third parties. AR-app uses these packages only to build and submit its own application, which is within that additional use grant.

Re-review the licence before using this toolchain to expose build functionality to third parties, redistributing the toolchain, or changing its role beyond first-party AR-app release automation.
