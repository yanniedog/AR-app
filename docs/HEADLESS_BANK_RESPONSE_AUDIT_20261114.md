# Headless Bank response evidence repair

Shipping `919036cf` adds the Bank response coverage check. Its headless CLI
omitted the snapshot input, so every CLI audit returned that check unavailable,
including a real retained payload with verified Bank history and RBA assets.
The producer correctly refuses an app qualification containing unavailable checks.

The CLI now normalizes those already-verified assets with the shipping readers
and calls the same `bankResponseAuditSnapshot` used on-device, using the actual
normalized core, integrity/quarantine context, details and default preferences.
The existing logger in `bankInsightsQuery` loads only at its error-reporting
call, avoiding native secure-storage initialization during pure Node imports.
No logger, normalizer, projection, selector or business observation is stubbed.

Missing/invalid inputs stay unavailable, mismatched observation dates fail,
and missing historical evidence remains unknown with a warning. The result
does not claim rendered coverage, personal-profile acceptance or device testing.
No producer qualification rule changes.

Local checks: 68 CLI script tests and 126 relevant Jest tests passed; typecheck
passed, and UI-copy verification reported zero violations. The new regression
fixture is a documented subset of real retained
November 13 CDR products with unchanged Bank history/RBA bodies and original
asset hashes. Negative controls cover missing, invalid, mismatched and tampered
evidence. Full retained-payload audit produced 18 pass/warn checks: Bank response
checked 280 rows, with all 280 moves/timings unknown, 219 missing baselines,
54 filtered histories and seven missing histories. These counts describe that
retained capture, not a fresh or complete provider ingest.

Release closeout must still establish exact-head CI, review disposition,
automatic merge and the resulting green APK release. Capture fresh revision
tests and audit receipts against that released commit, preserving the earlier
failed `919036cf` qualification. A later real Pi-canary payload needs a separate
fresh audit; recheck current shipping source/release when sealing its binding.
