# Patched dependency export compatibility

The app installs the published `decode-uri-component@0.5.0` release, which fixes
GHSA-vcc3-ghjq-m6fr. `query-string@7.1.3` still calls its decoder as a CommonJS
function. The mobile postinstall script changes only that caller's require to
select the patched decoder's default export. Jest transforms the ESM decoder;
Metro's normal module transformation handles it in release bundles. Node's
CommonJS `require(ESM)` support needs Node 20.19 or newer; this repository already
requires Node 24, and its CI and EAS build profiles pin Node 24, so install scripts
and release tooling satisfy that requirement.

The isolated EAS CLI installs the published `ts-deepmerge@8.0.0` release, which
fixes GHSA-87mf-gv2c-c62c. The project generators in EAS 23.2.0 and 24.7.0 still
import the legacy callable default export. The EAS compatibility command changes
only that caller to use the patched library's named `merge` export.

These are guarded caller adaptations, not modifications to either patched
library. Each patch checks the package versions and exact original call site,
accepts a previously applied patch, and fails on source drift. A future upstream
version requires explicit review. Remove each adapter when its parent adopts
the patched API.

Normal mobile `npm ci` applies its postinstall automatically. EAS release CI
intentionally installs its isolated toolchain with `--ignore-scripts`; every
such workflow runs `npm run compat --prefix tools/eas-cli` before invoking EAS.
The isolated package also applies the adapter during ordinary postinstall and
before tests, so clean installs and repeat application follow the same path.

Validation exercises actual React Navigation route parsing and the actual EAS
project generator, including malformed URI input, nested config preservation,
and unsafe merge-key rejection. The install-source guard has an independent
idempotency and drift test. Required CI also runs full app exports and the EAS
consumer tests.

## Legacy YAML command-line parser

Both toolchains scope `js-yaml@3.15.2` to the published `argparse@2.0.1` release.
This removes its only `sprintf-js` dependency (GHSA-hp3w-g68c-fv3c), without
changing the YAML loader, Expo SDK, Jest or EAS versions. Mobile's legacy YAML
consumer is Istanbul's configuration loader; EAS's consumers are its two Expo
plugins' Oclif 2 YAML table output. Their library APIs remain unchanged.
The sprintf advisory concerns attacker-controlled numeric precision throwing an
uncaught `RangeError`; removing its dependency eliminates that implementation.

Argparse 2 includes legacy aliases, but those aliases do not preserve the YAML
command's version output. `patch-legacy-yaml-cli.cjs` adapts only that command's
caller to the documented argparse 2 API, including an explicit version action.
The adapter verifies installed versions and hashes the entire original/adapted
CLI source, is idempotent, and fails on drift. It changes neither parser nor
YAML-loading code. Both normal postinstall and the release jobs' explicit EAS
compatibility step apply it. Remove it when the parent adopts argparse 2 or
newer. Argparse 3 removed the legacy API and is outside this narrow migration.
Help layout and invalid-option wording follow argparse 2; version output,
supported flags, parsed data and success/error exit codes are preserved.

The shared behavioral suite runs the real legacy YAML command under
`--throw-deprecation`: help, both version flags, stdin parsing, the hidden JSON
flag, malformed YAML and invalid options. Separate tests exercise the real
Istanbul configuration loader and both Oclif consumers' YAML table output.

## Remaining upstream alerts (2026-10-17)

`braces@3.0.3` (GHSA-vfj7-8cjw-p6xm) and `node-forge@1.4.0`
(GHSA-86w9-cpqp-85rv) remain in each lockfile. Neither has a published fix.
Do not dismiss their four alerts based on toolchain placement alone.

Braces is used through micromatch for source globs in build/test/release tools;
its character limit does not prevent deeply nested patterns exhausting the
stack. Keep project patterns in reviewed source, run PR checks in bounded jobs
without release credentials, and preserve protected-source release checks.
Track [braces issue 70](https://github.com/micromatch/braces/issues/70).

Forge accepts extra nested DigestAlgorithm elements during RSA PKCS#1 v1.5
signature verification, enabling forgery with low-exponent keys. It parses
signing credentials and verifies signatures in Expo signing helpers.
Matching private-key checks and local signing constrain the observed
call paths, but are not a replacement for a fixed verifier. Keep signing input
and release credentials restricted to approved protected-source workflows.
Track [forge issue 1149](https://github.com/digitalbazaar/forge/issues/1149)
and [unmerged fix 1152](https://github.com/digitalbazaar/forge/pull/1152).
The current EAS and Expo releases still select these packages. Avoid crypto
forks, downgrades or overrides that merely rename vulnerable code.

The observed paths are Node toolchain dependencies; no direct application
import of these packages was found in this assessment. This does not prove
their absence from the transitive Metro graph or shipped APK. An APK's native
verifier and runtime acceptance remain separate. Export source-map checks can
additionally enforce that these tooling packages stay outside shipped bundles.
