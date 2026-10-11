# Audit timing, passive checks and catalogue coverage

The supplied v1.0.225 / build 286 report took 22 minutes 5 seconds. Repeated
25-second waits came from an ordinary rate summary being treated as a chart,
closed optional Outlook charts, ineligible product samples, and unchanged
saved-list fixtures. Its complete report contains 2,732 checks and 109 failures.

## Behaviour

- The default stall timeout is 10 seconds. Every measured check also has its
  own non-renewable 10-second foreground budget, including its sub-operations.
  A late synchronous result fails after control returns to JavaScript. Pending
  native mutations must settle before rollback; otherwise the recovery journal
  is retained and another run is blocked until app recovery.
- ETA updates throughout setup, execution and finalization. Link checks and
  screen interactions have separate estimates; leaving the app pauses the
  foreground estimate and measurement.
- Data-quality checks and approved-link validation/installed-handler checks
  preload from data already on the device. Foreground work waits for idle and
  runs small slices every five seconds. A native background task can resume
  persisted metadata/link work with the screen off or another app open, subject
  to Android/iOS scheduling. It shares the existing six-hour worker cadence,
  starts no extra refresh, and performs no HTTP reachability requests.
- Cached results require matching inputs, publication and app build and expire
  after six hours. Resumable public inputs last seven days so a delayed native
  wake can make progress. Link checkpoints are compact and bounded below 900 KiB.
  Freshness and all rendered/interaction evidence are checked in the manual run.
- Products, banks and tiers are sampled using a recorded random session seed.
  Samples span every populated category and prefer different banks. Repeat
  passes use the same sample. Mandatory profile eligibility remains enforced.
- Coverage reconciles every loaded rate identity with Search and Banks model
  identities. Expandable category/bank tables show published and eligible
  totals, exclusions, missing details/index entries and source limitations.
  Detail-only products and branded banks without rate rows appear separately.
  Full catalogue reconciliation is distinct from sampled visual coverage.

## Repaired report failures

Today rate-summary layout evidence is no longer chart evidence. Optional closed
Outlook charts are not required at route entry. Empty-state evidence stays with
the list visit that produced it. Eligible randomized tiers are shared by the
legacy and deep journeys; cross-bank comparison clears the search provider
filter first. Unavailable products terminate with explicit evidence instead of
waiting for a row that cannot render. An already-correct saved pair is verified
as an idempotent result. The log I/O benchmark reads a bounded 16 KiB sample;
complete export remains a separate operation.

The URL policy now recognizes the lender domains and tenant-scoped document CDN
paths present in the report. Known lender HTTP/trailing-dot source URLs are
normalized to approved HTTPS destinations. Unknown hosts, credentials and
unapproved CDN tenants remain rejected; policy acceptance does not prove HTTP
reachability.

## Current publication evidence

The app delivery service's 2026-10-12 core and details compressed bytes were
verified against manifest SHA-256 values:

- Core: `49848188f59dd27782520e4561d5af15a620a700ac1fabe81a81797dead6a8ff`
- Details: `1868c060baa1bdcf6aec6ba7f3d2261809e68c6b266566b78906b3c934df4254`

There are 16,691 rate rows, 2,814 distinct rate-bearing products and 102 provider
identities. Details contain 2,954 products: all rate-bearing products plus 140
detail-only records. Exact eligible identity reconciliation found no missing
Search/Banks model entries. Full-catalogue opt-in still excludes 1,104 deposit
token-rate tiers, leaving 2,570 products across all 102 providers before user
profile restrictions. The downloaded evidence did not include the search index,
so its identity coverage remains unknown in that independent measurement.

Standard suitability with no profile restrictions leaves 1,591 products across
94 banks. Those exclusions are reported separately from missing identities.
Five hundred reproducible random seeds reached all 102 bank identities.
All 2,348 published link requests pass the updated URL policy; their HTTP
reachability was not certified by this policy-only check.

The optimized coverage builder took 29–51 ms on the Windows desktop at low load against
that publication; this is not an Android performance result. Chrome verified
passive preloading before manual audit start. No physical Android device was
attached, so native timing, installation and screen-off execution remain
unverified. Producer-wide identity coverage is also unverified because the
producer does not supply an exhaustive source identity inventory.

## Verification

`cd mobile && npm run ci` passed: 18 Expo Doctor checks, typecheck, lint,
history benchmarks, 229 script tests, 290 Jest suites / 3,302 tests, all-platform
exports and artifact size guards. Windows used Git Bash for the workflow shell
fixture. Later cache/live-source integration refinements passed five focused
suites / 29 tests, typecheck and scoped lint. Root PR automation verification
also passed. Hosted checks validate the final committed revision.
