# Isolated EAS release toolchain

This directory pins the command-line tool used by the EAS build and submission workflows. Release jobs and the required mobile CI compatibility step install it with `--ignore-scripts`, then explicitly run `npm run compat` before using or testing the toolchain. Normal installs apply that compatibility command through postinstall. It is not a dependency of `mobile/package.json`, is not imported by application code, and is not bundled into the Android, iOS, or web app.

## Security overrides

`package.json` retains scoped security overrides for the EAS CLI dependency tree. With EAS CLI 27.11.0, the lockfile resolves `nanoid` 3.3.20, `tar` 7.5.22, `joi` 17.13.9, `yaml` 2.9.1 and `diff` 8.0.3. It has both a root `ajv` 8.18.0 and an EAS-local 8.20.0, and both a root `minimatch` 5.1.8 and an EAS-local 5.1.9. The `uuid` override targets CommonJS-compatible 11.1.1 for `@expo/bunyan`, `@expo/rudder-sdk-node`, and `xcode`.

The EAS 27.11.0 project generator, like 27.9.0, expects the older callable default export of `ts-deepmerge`. The guarded compatibility command adapts the caller to the named `merge` export in the patched 8.0.0 release. It checks exact versions and caller source, is safe to repeat, and rejects unexpected drift. See [the compatibility policy](../../scripts/DEPENDENCY_COMPAT.md).

Keep each override until EAS CLI selects an equal or newer patched version. Keep overrides scoped to the affected dependency ranges and consumers. The jsdiff major update and UUID consumer overrides have behavioral compatibility tests. Compatible lockfile updates also retain the patched Moment, brace-expansion and fast-uri resolutions.

The `js-yaml@3.15.2` override selects dependency-free `argparse@2.0.1` to remove
`sprintf-js`. The compatibility command adapts only the legacy YAML CLI caller
to argparse 2, with exact installed-version and source-hash checks. Tests cover
the real CLI and both Expo plugins' Oclif YAML table output. See the
[compatibility and remaining-alert assessment](../../scripts/DEPENDENCY_COMPAT.md#legacy-yaml-command-line-parser).

Run `npm ci --ignore-scripts --no-audit --no-fund && npm run compat && npm test` in this directory to verify build-profile validation, metadata UUID validation, fingerprint line diffs, telemetry/Xcode UUID consumers YAML parsing, and real project generation with unsafe-key filtering. The required mobile CI job runs the same compatibility suite. Preserve these checks when adding future caller adapters.

## Licence review

EAS CLI 27.11.0 selects `@expo/logger`, `@expo/steps`, and `@expo/turtle-spawn` at 27.11.0, with the same BUSL-1.1 licence metadata as 27.9.0. The [EAS Build licence reviewed at 27.9.0](https://github.com/expo/eas-cli/blob/v27.9.0/LICENSE-BUSL) grants use provided the work is not used to offer a CI/CD or application-build service to third parties. AR-app uses these packages only to build and submit its own application, which is within that additional use grant. Confirm the [27.11.0 licence text](https://github.com/expo/eas-cli/blob/v27.11.0/LICENSE-BUSL) carries the same grant when next reviewing this toolchain.

Re-review the licence before using this toolchain to expose build functionality to third parties, redistributing the toolchain, or changing its role beyond first-party AR-app release automation.
