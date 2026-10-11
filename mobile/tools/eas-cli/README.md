# Isolated EAS release toolchain

This directory pins the command-line tool used by the EAS build and submission workflows. Release jobs and the required mobile CI compatibility step install it with `--ignore-scripts`, then explicitly run `npm run compat` before using or testing the toolchain. Normal installs apply that compatibility command through postinstall. It is not a dependency of `mobile/package.json`, is not imported by application code, and is not bundled into the Android, iOS, or web app.

## Security overrides

`package.json` applies patches to the vulnerable transitive dependencies selected by EAS CLI 24.7.0:

- `minimatch` 5.1.2 to 5.1.8;
- `nanoid` 3.3.8 to 3.3.18;
- `tar` 7.5.19 to 7.5.21;
- `ts-deepmerge` to its published security-fixed 8.0.0 release. The EAS 24.7.0 project generator expects the older callable default export, so the guarded compatibility command adapts the caller to the named `merge` export. It checks exact versions and caller source, is safe to repeat, and rejects unexpected drift. The adapter also supports the previous EAS 23.2.0 pin. See [the compatibility policy](../../scripts/DEPENDENCY_COMPAT.md);
- `ajv` 8.11.0 to 8.18.0;
- `joi` 17.11.0 to 17.13.8;
- `yaml` 2.6.0 to 2.8.3;
- `diff` 7.0.0 to 8.0.3;
- `uuid` to CommonJS-compatible 11.1.1 only for `@expo/bunyan`, `@expo/rudder-sdk-node`, and `xcode`.

Keep each override until EAS CLI selects an equal or newer patched version. Do not broaden an override to unrelated dependency majors. The jsdiff major update and UUID consumer overrides are covered by behavioral compatibility tests. Compatible lockfile updates also retain the patched Moment, brace-expansion and fast-uri resolutions.

Run `npm ci --ignore-scripts --no-audit --no-fund && npm run compat && npm test` in this directory to verify build-profile validation, metadata UUID validation, fingerprint line diffs, telemetry/Xcode UUID consumers YAML parsing, and real project generation with unsafe-key filtering. The required mobile CI job runs the same compatibility suite. Preserve these checks when adding future caller adapters.

## Licence review

EAS CLI 24.7.0 selects `@expo/logger`, `@expo/steps`, and `@expo/turtle-spawn` packages whose metadata identifies the licence as BUSL-1.1. Expo's published [EAS Build licence](https://github.com/expo/eas-cli/blob/main/LICENSE-BUSL) grants use provided the work is not used to offer a CI/CD or application-build service to third parties. AR-app uses these packages only to build and submit its own application, which is within that additional use grant.

Re-review the licence before using this toolchain to expose build functionality to third parties, redistributing the toolchain, or changing its role beyond first-party AR-app release automation.
