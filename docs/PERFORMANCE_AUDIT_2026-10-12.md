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
  Manual link inventory preparation also yields within bounded slices, checks
  cancellation and its ten-second budget, and reuses URL parsing within the run
  while rebuilding current source membership. Rejected links remain included.
  Final log serialization and flushing remain inside the timed audit; a timeout
  fails the run before completion can be published. Sharing starts afterward.
- Data-quality checks and approved-link validation/installed-handler checks
  preload from data already on the device. Foreground work waits for idle and
  runs small slices every five seconds. A native background task can resume
  persisted metadata/link work with the screen off or another app open, subject
  to Android/iOS scheduling. It shares the existing six-hour worker cadence,
  starts no extra refresh, and performs no HTTP reachability requests.
- Cached results require matching inputs, publication and app build and expire
  after six hours. Resumable public inputs last seven days so a delayed native
  wake can make progress. Link checkpoints are compact and bounded below 900 KiB.
  Link discovery also yields: each slice allows at most 16 new URL validations,
  256 raw candidates or 20 ms. Repeated raw URLs are skipped before parsing.
  Partial discovery and storage-capped inventories are labeled separately;
  remaining links are checked by the manual audit.
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

Ordinary PAYG employment requirements no longer classify a mortgage as staff-only.
The saved suitability index is rebuilt after this change. Structured STAFF codes,
named employer cohorts and other eligibility restrictions remain enforced.

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

Standard suitability with no profile restrictions initially left 1,591 products
across 94 banks. Investigating a fully excluded bank found that generic PAYG
employment text incorrectly hid 11 UBank mortgage products (61 rate rows).
The correction leaves 1,602 products across 95 banks. Comparing all 16,691 rows
before and after found no other classification changes; UBank's eight bonus
savings rows remain excluded by the conditional-rate policy. Other suitability
exclusions are reported separately from missing identities.
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
also passed. The foreground-inventory follow-up passed the complete canonical
command with 292 Jest suites / 3,319 tests, all-platform exports and size guards.
Hosted checks validate the final committed revision.

## Cold Android worker release follow-up

Native acceptance of v1.0.226 / build 287 reproduced a cold-process failure
with the screen asleep. Expo attempted both `ar-rates-passive-quality` and
`ar-rates-daily-refresh`, but its manifest-selected
`expo.modules.adapters.react.apploader.RNHeadlessAppLoader` was absent under
that name in the release DEX. The worker failed before JavaScript could run.
This differs from the already-verified idle foreground preload.

The existing `expo-build-properties` prebuild plugin now preserves only that
class and its public `android.content.Context` constructor. Release code and
resource shrinking remain enabled. APK validation and publication inspect DEX
class definitions and encoded constructor signatures; a manifest or reflection
string alone does not count as a retained loader. The guard rejects the actual
published v1.0.226 APK and has regressions for secondary DEX files, renamed or
missing definitions, inaccessible/wrong constructors and malformed input.
An independently compiled R8 fixture fails this guard without the keep rule
and passes with the exact configured rule and public Context constructor.

A replacement release still requires a cold-process, screen-off worker test
against its signed APK. A passing build-time class check alone does not prove
JavaScript task execution or OS scheduling guarantees.

The same native session exposed two report defects during a local, deliberately
offline audit. A settled details cache miss kept its product readiness probe
pending, and a fatal stop discarded previously available data and catalogue
evidence. Product readiness now reports terminal missing, stale or mismatched
details after the exact publication-scoped request settles. Partial reports
retain detached initial data and bank/category coverage, keep observed display
failures, and leave unvisited display checks unverified against the full plan.
The settings restoration and rollback time limits remain unchanged; host CPU
contention during that run prevents a device-performance conclusion.

## Quiet-host native follow-up

The subsequent offline emulator run completed its first preference restoration
and repeat navigation pass, then stopped while rebuilding the external-link
inventory. Cached policy work still yielded every 256 raw candidates, causing
hundreds of native scheduling delays for repeated source URLs. The collector
now scans up to 4,096 cheap candidates per slice while keeping its 8 ms active
slice, 16-new-validation and 10-second total limits. It still re-enumerates all
sources, including in-place edits, removals and labels. Reports record slice,
candidate and policy-work counts so scheduling overhead can be distinguished.

Projection navigation now waits for input storage before applying the scenario
that creates its chart. Closed optional Outlook panels unregister their probes;
opening them again requires fresh measured evidence. The RBA action opens and
checks its own chart, so ready market history cannot conceal an unmeasured RBA
plot. These fixes preserve strict chart counts, layout and accessible summaries.

Inspection of the installed Expo SDK also confirmed that a cold headless host
does not mount Router screens. The production entry now imports lightweight
task definitions before Router. Each callback loads only its own runtime when
invoked; a passive-only wake never imports or hydrates the app store. Tests
execute this entry without a React mount and invoke the real passive callback
against persisted compact metadata with no store import or network request.
The replacement signed APK still requires native cold-worker acceptance.

## Android background timer follow-up

The signed v1.0.227 / build 288 APK retained the headless loader and delivered
both callbacks in a cold process while the device was asleep. Its debug log
then recorded refresh durations of 107,544 ms and 132,690 ms: completion waited
until the app was opened. Waking the screen while remaining in Home did not
complete the work. These results establish a callback execution problem beyond
entry registration; they are not evidence of successful background preloading.

The installed SDK 54 TaskService does not register pending events with React
Native's HeadlessJsTaskContext. JavaTimerManager therefore keeps timers paused
without an Activity. This matches [Expo's timer fix](https://github.com/expo/expo/pull/43821).
The pinned compatibility backport now holds one native timer lease per app
while its events remain pending, including overlapping passive and daily jobs.
It releases the lease after the last event or failed cold load. The JS handler
stays pending because an immediately resolved handler would release the lease
prematurely, as described in [Expo issue 51304](https://github.com/expo/expo/issues/51304).

The patch rejects changed SDK versions or source hashes, is installed by the
existing portable npm postinstall path, and compiles in required hosted CI
against the installed React Native/Expo dependencies. Android autolinking builds
this patched package and its required app-loader project dependency from source
instead of consuming their prebuilt AARs.
Scheduling intervals,
audit time limits, network policy and foreground checks are unchanged. A signed
replacement APK must still demonstrate both a cold screen-off completion and
a later background completion after foreground reuse.

The local v1.0.227 foreground audit completed both whole-app passes without an
explicit readiness error, but its external-link inventory still stopped the run
at the 10-second limit. Its retained partial report incorrectly failed the
product-history display group: three ordinary repeat product entries sampled an
optional chart while pending, with 15/15 points and an accessible summary already
present. Both explicit history actions later completed with measured 15/15
points. Readiness evidence now records when the current action promotes a chart
to required, and aggregation excludes incidental optional loading states from
completed chart checks. Required pending charts, settled missing points and
missing accessible summaries still fail, and optional loading alone provides no
rendering proof. The initial catalogue's unknown search-index coverage is
retained honestly: it was captured before maximum-profile cache preparation,
which subsequently made all seven requested assets available. These findings do
not establish complete foreground coverage or performance on another phone.

The final inventory now uses a private reusable cursor and purpose-specific
lookup maps, and amortizes clock reads over cheap duplicate references. Each
collection still re-enumerates current sources, preserving mutations, removed
links, first labels and rejected URLs. On Android Hermes with the published
53,771-reference input, the cached scan fell from 96 slices / 798 ms to 16 slices
/ 125 ms, with exact ordered parity for 2,348 destinations. A separate native
run with an extra 180 ms delay at every checkpoint completed in 3,385 ms. The
8 ms cooperative CPU target, 16 new validations per slice and 10-second total
limit remain unchanged. Failure reports now retain inventory CPU, yield and
progress evidence. These isolated measurements do not replace the signed APK's
complete foreground acceptance run.

A deterministic concurrency regression also reproduced passive work returning
success without progress when a simultaneous daily refresh installed a busy
store getter during the initial storage read. Native slices now resume only
their validated compact checkpoints in that case; idle foreground work still
defers. The test advances eight metadata checks and a saved link while proving
that busy live core, manifest and details are never read and no network request
is made.

## Published v1.0.228 native acceptance and checkpoint follow-up

Both public build 289 APKs identify source
`0cbdb0dbcdfca6c4cd4695aa565dd3689cd062ed`. The universal APK is 88,498,981
bytes with SHA-256
`5110d605d4eaef2a1c98cc211e979c4c0309b8295fcf57cfee1a0194651b119a`;
the ARM APK is 46,773,937 bytes with SHA-256
`ea4b77fea670df32a728a866347f21d2319a03f2d757d38c24d7a70fbf1970ad`.
Public hashes, package identity, signature, ABIs, reflective loader and timer
compatibility markers were verified.

The installed universal APK completed cold background work while the emulator
was asleep without an Activity. The asleep window was 04:31:42–04:33:07 UTC;
saved-check timestamps fall within 04:32:16–04:32:47. The native timer lease
closed and WorkManager reported success. After foreground reuse, another asleep
window at 04:34:37–04:35:08 completed successfully; its lease ran from
04:34:41.959 to 04:34:43.866. These observations establish cold and warm
screen-off execution and persisted progress on this emulator.

The private offline foreground run `pa-mv4re6t8-gc96ezyp` completed both UI
passes and its final inventory: 53,808 references, 2,352 destinations, 37 slices,
698.3 ms. It stopped at link 64 after 437 stored checks. The preloaded link
evaluation itself took 12 ms; the next durable checkpoint exceeded the unchanged
10-second inactivity limit. No check longer than 10 seconds was reported as a
non-failure. The physical log was below its 2 MiB cap, so rollover is not an
established cause. The subsequent rollback timed out with its eventual result
unconfirmed in that report. This run does not establish complete foreground
acceptance or performance on a physical phone.

Controlled I/O reproduced a separate durability race: an automatic flush could
take a queued batch after an earlier write completed, while a concurrent strict
flush returned on the now-empty queue before the new physical write finished.
Flush waiters now recheck the active writer and retain its failure for strict
callers. Fatal reports capture bounded, in-memory write-stage diagnostics before
recovery can change them. Restoration outcomes remain observable after a timeout
and drain; only the actual settled result establishes success, and a late error
remains attached to the report with its recovery journal. These corrections
still require signed-APK acceptance and do not yet explain or resolve the
v1.0.228 checkpoint stall.

An isolated SDK 54 / React Native 0.81.5 release Hermes harness then replayed
2,350 durable checkpoints from the run's 64-message corpus, starting with an
898,958-byte log and a populated bounded memory ring. The original logger took
56.959 seconds when awaited directly and 198.508 seconds with the runner's
50 ms polling loop. Both completed without an append failure. Once the log
reached capacity, retaining almost 2 MiB caused 446 full-file rewrites and
1,876,083,571 bytes of UTF-8 encoding in each baseline replay. This demonstrates
independent polling and rollover costs, not the earlier full-app failure below
the cap.

The corrected logger retains about 1.5 MiB on rollover, within the same 2 MiB
hard cap, preserving complete UTF-8 lines and the newest batch when it fits.
Its exact-source replay completed 2,350 checks in 4.886 seconds, with 2,348
appends, 2 rewrites, no append failures, 3.44 ms p95 and 97.16 ms maximum flush
time. Encoded bytes fell to 13,045,254; Hermes allocation growth fell from
2,046,503,648 to 74,964,880 bytes, and collection count from 10,539 to 32. The
runner now awaits actual settlement through its foreground-aware deadline
helper, which keeps cancellation and pause handling without delaying every fast
write until a poll. Its independent 10-second budget also applies to restoration
checkpoints after global inactivity monitoring enters finalization. Controlled
regressions cover fast settlement without timer advancement, blocked and late
writes, pause/cancel, repeated UTF-8 rollovers, concurrent strict-flush failures,
and successful or failed rollback results arriving after a timeout.
