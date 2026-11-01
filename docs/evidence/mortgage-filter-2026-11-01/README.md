# Reproduce the local data-pipeline benchmark

The published October 31 core/details assets were acquired through the app's
existing public data service and checked against the manifest byte lengths and
SHA-256 hashes. Full payloads are deliberately not committed here. The baseline
uses production source `7ffb7daf`; `verified.json` records the measured fixed
source-file hashes. `baseline.json` predates the additional canonical-oracle
comparison and repeated-selection instrumentation.

From the repository root, save the immutable public manifest from
`https://ar-app-data.jkokavec.workers.dev/v1/release/app-payload-2026-10-31-r000001/manifest.json`
as `tmp/live-manifest.json`. Its SHA-256 must be
`32bf72292d94d037648cef48b4925fceac437d228742cb00bb76c8f8cb398d5f`.
Then run `node
docs/evidence/mortgage-filter-2026-11-01/download-live-data.cjs`. The script uses
the immutable asset URLs in that manifest and writes hash-verified decoded
`tmp/live-core.json` and `tmp/live-details.json`. Use the recorded manifest
edition for matched reproduction; a newer live publication is a different
dataset.

Copy `benchmark.ts` from this directory to
`mobile/__tests__/liveMortgageLatency.local.test.ts`. From `mobile`, run:

```powershell
$env:MORTGAGE_BENCHMARK_OUTPUT='live-latency-reproduction.json'
node node_modules/jest/bin/jest.js __tests__/liveMortgageLatency.local.test.ts --runInBand --cacheDirectory ../tmp/jest-cache --silent=false
```

Remove that temporary test afterward. It is a local opt-in measurement, not a
network-dependent CI test. Run without concurrent builds or tests. The receipt
contains the source hashes and exact measurement boundary. Do not present it as
a device, browser-frame or installed-APK benchmark.
