# Prepared historical bank rates

The publishing machine performs tier validation, product classification and feature evidence evaluation. The app consumes bounded rate-frequency cohorts and product-best spans, preserving the existing profile and summary semantics without scanning historical descriptors or evidence.

Regenerate the standalone Node compiler from `mobile/`:

```sh
node scripts/export-history-ready-compiler.cjs
node scripts/bundle-ready-bank-history.cjs
```

Verify reproducibility with `--check` on both commands. Node 24 and the repository's locked npm dependencies are required for regeneration. The resulting `compiler.cjs` runs without installed npm packages. Its manifest pins SHA-256, semantic revision and normalized source digests, including the consumer's filtering and aggregation code. Copy the compiler and manifest together to the producer. Consumer and publisher must agree on the exact compiler digest before enabling this optional namespace.

The compiler reads a schema-2 raw historical catalogue from stdin and emits compact JSON to stdout. `--validate` reads prepared JSON and succeeds only for bounded valid data carrying this compiler's own digest. The module also exports `compile(catalogue, compilerSha)` and `validateReady(value, expectedCompilerSha)`.

Schema 1 carries `semantic_revision`, `compiler_sha256`, the contiguous `run_dates` axis, original `sources` and `unavailable_dates`, `quarantined_tier_count`, `sections` and `products`. A section cohort is `[provider, dimensions, knownEvidence, broadlyAvailable, featureMask, events]`. Mortgage dimensions are purpose, rate type, repayment type and LVR tier; Savings has deposit kind; TD has interest payment. Null remains distinct from an empty string. Feature bits follow the shipping app's `PROFILE_FEATURE_OPTIONS` order.

An event is `[dateIndex, [[percentagePoints, frequencyDelta], ...]]`. Dates and rates are sorted and unique. Frequencies never become negative and terminate at zero, with the final event allowed at the position immediately after the date axis. Rate multiplicity is retained for exact bank and pooled count, minimum, maximum, mean and median. Nonzero intervals require original source coverage. Unknown evidence passes only the full-catalogue opt-in without feature requirements.

A product entry is `[productKey, [[startIndex, dayCount, bestPercentagePoints], ...]]`. Mortgage best values use the minimum; deposits use the maximum. Savings term-deposit quarantine applies to both cohorts and products. Product history retains percentage-point values until the existing projector converts them to fractional rates.

The decoded envelope is limited to 4 MiB. Count, day, change and cell limits are checked before adoption. Multiple prepared sources retain their own axes; the app selects disjoint accepted dates after comparing source receipts with the selected public revisions. Calendar gaps remain gaps. Current-day observations still pass through the existing live eligibility and suitability gates.
