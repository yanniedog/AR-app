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
