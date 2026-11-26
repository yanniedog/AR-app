# Patched dependency export compatibility

## Android native stack header

The mobile postinstall guards header rebuilds during Android screen removal in
`react-native-screens@4.16.0`. Android can retain a disappearing toolbar child
after removing it from the toolbar's child array. The adapter finishes that
toolbar's transition before reattaching the child and preserves ownership by
any other parent. Review this adapter when changing the pinned screens version.
The related upstream report is [react-native-screens #3777](https://github.com/software-mansion/react-native-screens/pull/3777).

The app installs the published `decode-uri-component@0.5.0` release, which fixes
GHSA-vcc3-ghjq-m6fr. `query-string@7.1.3` still calls its decoder as a CommonJS
function. The mobile postinstall script changes only that caller's require to
select the patched decoder's default export. Jest transforms the ESM decoder;
Metro's normal module transformation handles it in release bundles. Node's
CommonJS `require(ESM)` support needs Node 20.19 or newer; this repository already
requires Node 24, and its CI and EAS build profiles pin Node 24, so install scripts
and release tooling satisfy that requirement.

The isolated EAS CLI installs the published `ts-deepmerge@8.0.0` release, which
fixes GHSA-87mf-gv2c-c62c. The EAS 27.11.0 project generator, like 27.9.0, still imports the
legacy callable default export. The EAS compatibility command changes only
that caller to use the patched library's named `merge` export. It also accepts
the previously reviewed 23.2.0, 24.7.0, 24.12.0 and 24.14.0 callers.

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

## Pinned advisory overrides (2026-10-24)

Mobile pins `fast-uri@3.1.9` and `undici@6.29.1` via npm overrides so the
Dependabot patches from #440–#442 cannot regress. The isolated EAS toolchain
pins `fast-uri@3.1.9` the same way. These clear GHSA-w74x-v6f9-j3xg,
GHSA-xhq7-xmqj-769h, GHSA-wjr9-j795-jxcr, GHSA-333x-w4r6-6crp,
GHSA-xjj6-f33q-929c, and GHSA-4qv8-2p9j-2685 once Dependabot re-scans
`main`.

## Forge in release tooling

The mobile and isolated EAS lockfiles resolve `node-forge@1.4.3`. Both
resolutions are outside the affected range (`<=1.4.0`) in
[GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
Dependabot alert state follows its scan of `main`.

Expo signing helpers parse credentials and verify signatures through Forge.
Keep signing input and release credentials restricted to approved workflows on
protected source. The lockfile check covers the dependency version. Shipped
bundle inspection and APK runtime acceptance require their own evidence.
