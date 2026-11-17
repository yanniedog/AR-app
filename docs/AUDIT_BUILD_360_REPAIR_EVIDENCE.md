# Build 360 audit repairs

Source: https://paste.c-net.org/c61e924c-71e4-678b-629d-c09278ae3794

Audit `audit-de3306d1216db093`, app 1.0.304/build 360, finished 2026-11-17T21:46:24.177Z.
The gzip envelope decoded to 12,040,313 bytes; SHA-256 matched
`02ed996783a8baed58f4b2afe7d98b9a59e93700e688799113a66f4b2825fb62`.
The report remains local; no private journal or financial inputs are committed.

## Baseline

- 499,708.7 ms duration; 2,868 performance checks and 27 health checks.
- 73 failures: 67 timing failures and six destination-policy rejections.
- Maximum JS lag 866.2 ms; JS animation gap 738.1 ms.
- Cold Rates: 24,868 Mortgage source rows; scope preparation 5,001.4 ms;
  maximum pricing slice 110.6 ms.
- All planned checks retained, no unexpected skips. Coverage remains incomplete:
  21 pending probes, 2,463 HTTP-unverified destinations, bank-response gaps,
  and one dropped native frame callback among 11,539 captured frames.

## Changes

- Receipt cohort filtering and stable sorting run in cancellable cooperative
  slices for large books. One sorted cohort supplies both the median and the
  three exact comparable tiers; duplicate classification/sorting is removed.
- Reopened receipts reuse current comparison pricing only with matching scenario,
  profile, comparison inputs, filter state, catalogue and validity boundaries.
- Receipt loading and failed preparation have distinct UI states. A new request
  cannot display a previous request's prepared brief. Readiness requires current
  comparison preparation, with genuine preparation errors retained.
- Mortgage metadata preparation yields during source mapping and within large product
  tier loops, including exact-row condition-scope preparation. The envelope
  validation/index cache lasts for one preparation call; every row still proves
  its source identity. Individual envelope validation remains synchronous and
  fail closed; the change does not claim to eliminate every long slice.
- Passive URL lookup uses exact purpose/URL string identities in memory, avoiding
  thousands of cryptographic hashes when its lookup map is first populated.
  Stored cache format, freshness, publication and destination-policy checks stay intact.
- A preloaded link measures the current lookup, retaining the original passive
  observation as backgroundDurationMs and its age separately. The supplied
  external-link-33 result reused a 15,305 ms historical passive observation;
  that historical time must not become a current foreground step timeout.

## Validation and limits

Focused regression tests cover exact cohort output, immutable inputs,
cancellation, loading state, large-product yields, cached link evidence and
current/past duration separation. Canonical hosted CI and release status are
recorded on the associated PR.

No timeout, quiet window, source policy or native-frame completeness threshold
is relaxed. The six rejected URLs are de-identified by the supplied report;
no domain is added without attributable source evidence. Local audit does not
establish HTTP reachability. Missing history and native frame callback evidence
remain unknown. A fresh comparable physical-device audit is required to measure
performance improvement and establish native/user acceptance.
