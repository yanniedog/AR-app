# Build 359 audit repair

## Baseline

The supplied export at https://paste.rs/Dr4VF resolves to an `ar-audit-gzip-v1`
envelope. Decoded SHA-256 is
`5322d7e6aa8f998402737b02c3b1853e16eaef7f44ea171c5a3ca527c1dd25ef`;
decoded length is 12,002,994 bytes. It describes Android Hermes 1.0.303/build
359, maximum-safe Local audit, completed 2026-11-17T20:18:07.239Z.

| Evidence | Baseline |
| --- | ---: |
| Duration | 477,046 ms |
| Failed checks / timing failures | 72 / 66 |
| Slowest forward work | 6,259.9 ms |
| Maximum JS lag / animation gap | 690.8 / 719.8 ms |
| JS stall / slow-frame samples | 14.2% / 34.8% |
| Native frame jank | 4.6% |
| Journey coverage | 97.3% |
| Unverified links | 2,463 |
| Failed destination-policy checks | 6 |
| Retained target samples | 4,096; capacity reached |
| Health pass / data completeness pass | 85.2% / 62.5% |
| Logo surface pass | 50% |

Collection completed; coverage did not. Functional success (99.2%) does not
establish timely execution. AFFS and two component scores are unknown because
evidence is incomplete. Human validation was not performed.

## Causal repair groups

- Rates: the published-only Mortgage path copied the 24,868-row book twice.
  Redundant retained arrays prevented reuse within the existing 50,000-row cache
  budget. Reuse immutable source rows and preserve cancellation and invalidation.
- Sorting: asynchronous checkpoints created promise continuations every 32 merge
  operations even when the slice budget had not expired. Await only actual yields.
- Section model: the audit's real full-book synchronous selector benchmark itself
  reported 503.9 ms JS lag and a 524 ms animation gap. Keep its work and measured
  phase durations, and execute equivalent cancellable cooperative selectors.
- Market response: overview data preparation was mistaken for terminal destination
  unavailability. Navigate to the response destination and measure its own readiness.
- Targets: remount-instance keys exhausted evidence capacity. Aggregate only
  equivalent semantic control/state/role/platform/geometry observations. Keep
  distinct failing geometry, observation counts and honest overflow. Changed
  target-dependent score methods must retain their version boundary in history.
- Logos: existing PR #504 implements downloaded producer artwork and monograms;
  it was blocked by stale generated history artifacts. Repair that PR separately.
- Historical quarantine counts: a fully superseded fallback contributed 58
  exclusions despite owning no accepted observations, doubling the current
  source's 58 to 116. Exclude noncontributing sources and count one immutable
  source only once when its accepted dates are split into masks. Preserve the
  actual Savings/term-deposit quarantine safeguard.

These groups affect shared causes behind duration, latency, pass rate, coverage,
friction and fluidity metrics. A passing unit test is not device timing proof.

## Source and external evidence boundaries

The Nov 18 r000001 details asset was read back with compressed SHA-256
`d1791443629298fb601f841a7bb02f382b8d21094cba069c54efce3202edc9a5`
and contains 3,596 detail products, matching the audit.

The six policy failures are published `qrco.de` shortlinks. They redirect to
signed, expiring documents on a shared CDN, rather than approved lender hosts.
Do not approve an entire shortener/CDN or strip authorization parameters to
manufacture a canonical document. Keep refusals unless authoritative equivalent
stable destinations are established. Local mode intentionally does not attempt
HTTP; zero HTTP verification is not a transport regression. Live mode must retain
its actual attempted, successful, failed and unattempted populations.

AR-local owns source recovery separately. Six dates (May 14, June 26 and October
7–10, 2026) have no retained captures; current CDR responses cannot reconstruct
their past state. Unknown historical details, absent product facts, quarantined
tiers and bank-response baseline/history gaps require individual provenance.
Neither interpolation nor treating missing facts as zero is an accepted repair.

## Acceptance

Run focused parity, cancellation, cache invalidation, readiness, target capture,
serialization/recovery and metric-history tests; typecheck, diagnostic-schema and
zero-violation UI-copy checks. Required hosted gates remain `mobile-ci` and
`bot-feedback-gate` with substantive review disposition.

Repeat comparable physical-device Local and Live audits after release. The current
machine exposes an Android emulator, not a physical device. App-owned journeys
must meet existing timing thresholds; intentional settling, total duration and
interaction work remain distinct. Source gaps and external refusals must retain
their individual unresolved status. Merge, public APK identity and physical-device
performance are separate acceptance claims.
