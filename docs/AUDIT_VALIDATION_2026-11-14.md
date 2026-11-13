# Audit measurement validation — 14 November 2026

Input: audit `audit-f63bbcf8998f77f9`, Android/Hermes 1.0.274 (330), completed 13 November 2026 at 20:30:28.916 UTC. The supplied compressed report decoded to 10,778,311 bytes; its SHA-256 matched `7a9dc069be9dfe45a82b2e5e4c7eea5f5d87994d22c23e5a6a68d5634791bc2e`.

## Findings and acceptance boundaries

| Evidence | Finding | Required interpretation or repair |
| --- | --- | --- |
| 60 failed checks; no recorded runtime exceptions | 58 latency/frame-gap failures and two 10-second readiness timeouts | Keep strict thresholds. Do not turn slow functional success into a performance pass. Fresh device measurements are required to establish improved latency. |
| Both `not-found.home` attempts committed 20 rows but observed zero physically visible rows | A frozen screen can miss a blur render, exhausting native measurement retries without a changed revision on return | Restart physical measurement on native focus. Actual cell/viewport bounds remain necessary; focus is not visibility proof. |
| Terminal wall-clock duration exceeded timestamp span by 3,739 ms | Report aggregation occurred between recording the finish timestamp and duration | Capture terminal timing together before aggregation, including partial reports. |
| Round-trip responsiveness collection used inconsistent timing windows | Forward collection could miss delayed callbacks; Back observations included excluded settling work; combined p95 used the maximum directional percentile | Collect delayed observations against frozen action endpoints, exclude settling in both directions, and compute percentiles from pooled samples. A simulated settling stall must not hide or inflate measured action work. |
| Action-duration analysis marked 40 route journeys as missing samples | Route journeys collect forward/Back timing, not semantic-action duration | Keep action and route populations separate; retain genuinely missing eligible measurements. |
| Check pass rate 6.6% (183/2,758) | Dominated by intentionally unverified destinations, not a coherent quality grade | Present as check results with counts and scope. Foreground task outcomes and responsiveness instead of implying overall app quality. |
| Functional success 98.9% (360/364) alongside 60 timing failures | Functional completion is not responsive completion | Expose timely-ready, timing-failure, warning, functional-failure and indeterminate populations. |
| Model/layout checks 22/22; visible-content checks 2/2 | Narrow instrumentation coverage cannot establish visual quality | Use precise rendering-check labels and denominators. Human usability, visual design and pixel correctness remain unmeasured. |
| A generic ready data probe can become 1/1 model evidence | The collector invents a count comparison where no counts were observed | Preserve missing model measurements as unavailable; readiness is a separate fact. |
| Successful later visits can replace adverse model/layout/logo observations | A perfect aggregate can hide an earlier defect | Retain adverse observations separately from the representative successful visit. |
| Rates visibility absent from the independent physical-list contract; pending lists omitted | Terminal Rates visibility failures can disappear from display results | Include the current Rates surface and distinguish transient preparation from terminal required-target failures. |
| 2,373 unverified links in local mode | All handlers were resolved; no HTTP requests were selected | These are unknown destinations, not broken URLs. Keep the zero-network contract and explicit verification gap. Preserve closed status enums in public diagnostics so consumers can reconstruct classification. |
| One bank-response coverage gap | The source contains filtered history, missing history/baselines, history gaps and unverified events | Keep these categories explicit. A source projection must match the exact audit decision and window end, not only its run date. |
| Known historical source gaps while catalogue coverage reports pass | Source incompleteness is incorrectly presented as healthy | Warn on recorded source gaps without pretending they are app-processing failures. |
| Newly mounted cards repeatedly hash the same catalogue capability | Per-hook memoization does not survive remounts | Reuse bounded hashes keyed by canonical content. Recompute canonical content on every admission so nested mutations and replacement editions invalidate correctly. |

## Validation approach

Independent recomputation of the supplied report matched all 27 numeric ratios and seven retained timing distributions (p50/p90/p95/p99). Correct arithmetic did not establish construct validity: the population, evidence and presentation defects above required separate inspection.

The history now records per-metric method versions in schema 3. Existing schema 1/2 values migrate without recalculation, and chart lines break across changed population/evidence methods. Rendering summaries retain separate absent and unavailable measurement counts. Their small current-result summaries do not construct the full observation/contributor table during metric selection.

Review regressions also exercise the production readiness registry through compact serialization and display evaluation: optional pending logo/layout probes retain their effective optionality, and an absent expected count cannot be invented from an actual count. Completed, partial and admission-rejected reports record rendering collector provenance; recovering a legacy raw report cannot relabel its saved rendering aggregates or replace an existing historical value with a different measurement method.

Focused regressions exercise frozen native focus, timing boundaries, semantic-action populations, missing model counts, failed-then-successful visits, required-target timeouts, bank window identity, public diagnostic privacy, metric presentation/history compatibility and catalogue mutation detection. Hosted `mobile-ci` supplies the full suite, native compile, export, schema, copy and pinned-history checks.

No physical Android device was attached during implementation. Unit and integration tests establish the repaired code paths, not that all 58 recorded latency failures have disappeared on the user's phone. A comparable post-release local audit must verify runtime timing and both recovery journeys. Live-source destination verification is a separate audit mode; absent HTTP evidence remains unknown. Source-history gaps require real producer evidence and must not be fabricated or interpolated by the app.
