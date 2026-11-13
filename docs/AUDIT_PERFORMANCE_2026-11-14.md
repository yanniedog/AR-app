# Audit performance investigation — 14 November 2026

## Supplied baseline

Source: https://paste.c-net.org/57982893-c01c-9f3e-27cd-39e439eabeec

The gzip envelope decoded to 8,626,256 UTF-8 bytes. Its SHA-256 matched
`cdf1498303723327624e22d3fb6011ad14c933ba0b78122b72222f1806991da0`.
The report identifies Android/Hermes, app 1.0.267 build 323, and local audit mode.

| Recorded measure | Baseline |
| --- | ---: |
| Failed checks (all timing failures) | 30 |
| Diagnostic active duration | 415,860.4 ms |
| Completion timestamp interval | 413,741 ms |
| Summary check completion | 99.2% |
| Stored / planned performance checks | 2,756 / 2,756 |
| Health checks | 26 |
| Slowest user-visible check | 1,159.2 ms |
| Maximum JS event-loop lag | 467.3 ms |
| Maximum JS animation gap | 443.7 ms |
| Unverified external destinations | 2,369 |
| Target probe defects | 8 |

The duration and completion timestamp interval are distinct recorded fields,
not interchangeable estimates. Check completion is not verified coverage:
collection and retained details were complete, while coverage was incomplete.

The 366 journey durations sum to 335,610.3 ms; their recorded background-settle
intervals sum to 251,807.3 ms. Network-check durations sum to 55,074.7 ms but
include concurrent/cached link work and must not be called elapsed link time.
The 650 ms readiness stability window and 10-second foreground step deadline
remain requirements; decreasing either would not demonstrate an app improvement.

## Failure paths and evidence boundaries

Timing failures concentrate in Savings/Term-deposit category navigation,
mortgage scope changes, lender opening, and returning to the audit. The largest
lag was recorded during the cold lender journey. These are actual JS stalls,
even when the destination eventually renders and the action completes.

Two projection probes report an incomplete existing scenario. Six economic
probes report unavailable observations while their real empty state renders.
The local audit prohibits network transport; it cannot establish remote HTTP
reachability for the 2,369 links or download missing economic data. Keep these
unknowns visible rather than converting them into passing coverage.

Source-history evidence includes missing source dates and unknown historical
detail evidence even though the loaded-catalogue health checks pass. Loaded
coverage, source coverage, chart evidence, and observed pixels are different
measurements and must retain their separate denominators.

## Repairs and deterministic evidence

- Pricing reuse accounts for each shared source array once, while retaining the
  six-entry and 50,000-row-slot bounds. A 16,728-row publication regression keeps
  three completed requests warm with zero new worker starts; the original code
  evicts a request and fails the same regression.
- Completed filter options survive route remounts. Source rows, detail identity,
  section, suitability revision and mandatory eligibility revision still
  invalidate reuse. The original implementation restarts the preparation worker.
- Save labels with an explicit displayed-rate override skip the unused source
  peer index. The regression reduces traversal of 16,728 source rows to zero,
  with the same saved-tier label and target identity. This applies to override
  consumers; it is not a claim that every Rates row uses this path.
- Route journeys no longer append 350 ms after completing their 650 ms stable
  observation. In-page UI settlement precedes the quiet check so unchanged time
  can be credited and changes during settlement are validated afterward.
- Readiness waits listen to their selected surfaces and real pause changes. A
  regression issues 100 unrelated probe updates and 100 unchanged pause/progress
  events with zero additional snapshots. A target change still restarts the full
  stability window; registration and capture changes still wake the wait.
- External-link progress emits once per batch start and durable batch completion.
  Each individual check, storage count and watchdog record is retained.

## Detailed metric reporting

The history expands from six to 45 metrics, with grouped controls and one mounted
chart. All 45 have versioned methods and evidence records in the full local
report and shared diagnosis. The selected current-run chart exposes metric
evidence on demand. Historical aggregate-only points do not claim to retain a
full check report.

Evidence includes numerator, denominator, measurement and sample units, eligible,
observed, missing and excluded counts, and references to contributing checks.
Timing distributions report nearest-rank p50/p90/p95/p99, median absolute
deviation, interquartile range, worst observations and measured first/repeat
strata. Per-check maxima are explicitly distinct from individual callback
samples. Task outcomes separate success, failure and indeterminate evidence.

Shared reports use one deidentified observation table rather than copying the
same raw contributors into every metric. Saved analysis objects cannot override
the canonical checks. The aggregate history path stays lightweight; it does not
construct detailed evidence tables just to plot a trend.

These are descriptive measurements of deterministic checks and correlated
callbacks. Confidence intervals, human SUS/SEQ scores, native-frame metrics and
standards certification require evidence this audit does not collect. Formulas,
scope and limits are documented in [Audit history metrics](AUDIT_HISTORY_METRICS.md).

## Original-report replay

A bounded desktop Node/Jest replay used the supplied report's public diagnostic
log: 2,756 performance checks and 26 deidentified health checks. It produced all
45 metric evidence records and 14,057 shared observations. All values matched
the lightweight history derivation; contributor references, nearest-rank
percentiles, median absolute deviation, interquartile range and worst-observation
references were independently checked against their contributing measurements.

The public log lacks canonical health inventory metadata. The replay therefore
keeps 17 metrics unknown and observes 28; it does not reconstruct health evidence.
Legacy check completion retains its reported 99.2%, with an explicitly unknown
denominator. Back timing uses 40 measured returns with zero missing return
samples; 326 other or unexecuted journeys are excluded. Semantic actions do not
become missing Back measurements. Regression cases retain missing attempted
returns in the eligible population.

The rebuilt deidentified envelope contains one observation table and a reference
from the full diagnostic log. Its compressed representation was 592,918 bytes
against the 2 MiB limit, and its decoded JSON was 8,475,467 bytes against the
32 MiB limit. Detailed analysis alone occupied 1,880,043 bytes. These are desktop
replay and payload-size checks, not Android latency or fresh device-audit evidence.

## Acceptance

The combined focused run passed 14 suites / 235 tests. A final follow-up of the
four metric/history/storage suites passed 55 tests after adding the incomplete
health-domain denominator regression. Typecheck, ESLint (no errors), the
diagnostic-schema guard and full UI-copy guard (zero violations) passed locally.
The full repository lint retains existing warnings outside the changed paths.

Use focused regression tests for the changed execution, cache, identity, and
metric-history paths, plus typecheck, lint, diagnostic-schema and UI-copy guards.
GitHub `mobile-ci` owns the full CI pipeline. The repository's review gates,
automatic squash merge, and Android release workflow remain required.

Algorithmic operation counts and deterministic scheduling tests establish the
removed work. They do not establish new Android latency percentiles. A new audit
on the same physical device and comparable data is required to measure changes
to the six baseline headline metrics. No Android device was attached during the
initial local investigation.
