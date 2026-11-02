# Authentic candidate consumer verification

The original producer archive `observed-population-candidate-20261103-r000001.zip` has SHA256 `ed218cc09de20ea09b5950c5d890d58093eb0c5949cf355003829f2533c07bd1`. Its five entries were extracted without edits and compared byte-hash for byte-hash with the archive. Raw payloads remain private local evidence; this directory contains the verification receipt only. `UNACCEPTED.json` is preserved unchanged, including its original failure report.

Consumer `8ddbeba5` reproduced `Invalid observed population assessment`. The original `coverage.observed_at` is `2026-11-02T14:00:00Z`, which is November 3 in `Australia/Hobart`. The correction compares the explicit-zone instant's Hobart civil day, retaining the timestamp and all manifest/core/details bytes unchanged.

`node mobile/scripts/verify-observed-candidate.cjs <extracted-directory>` now verifies the original manifest and asset digests, details coverage, exact published counts and Wise exclusion. Additional read-only calls to the actual `normalizeCoreWithIntegrity`, `displayEvidenceFacts`, `liveAssetStateForProviderCoverage` and `cachedAssetStateForProviderCoverage` verify unchanged input provenance, normalized counts and persistent partial/unknown status. Their results are in `consumer-fixture-verification.json`.

Regression tests cover the authentic instant, equivalent positive/negative offsets, microseconds, winter/summer midnight boundaries, both daylight-saving transitions, date-only legacy aliases, malformed timestamps and wrong observation days. The population suite also passes with the process timezone set to `Pacific/Honolulu`.

The regenerated history compiler pin is `30d3948e66de329434e2177a9eeb9afadb293499e1a5e2c1ada254b6fb4282b3`. This fixture has only core/details assets; no prepared-history artifact was accepted. Producers must use the current pin for any later candidate prepared-history artifact while preserving legacy channel bytes.

These are private consumer checks, not publication approval. Hosted route/cache isolation, full candidate asset adoption and Android/Hermes runtime acceptance remain unverified. No canonical feed, release, producer source, Pi state or fixture byte was changed.

Follow-up integration: `adoption-acceptance.json` records the completed dormant adoption implementation and its regression checks. The original fixture still passes listed-asset validation but fails final adoption because its manifest omits required `generated_at` and `schedule` fields. This supersedes any inference of installed-app readiness from the earlier byte-verification receipt. `hermes-compilation.json` records syntax compilation only; the installed compiler cannot execute scripts. Full details and exact producer/hosted requirements are in [candidate adoption](../../OBSERVED_POPULATION_ADOPTION.md).
