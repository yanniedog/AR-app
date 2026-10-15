# Android redesign acceptance and release closeout

This checklist implements Phase 6 of the 14 October 2026 six-phase front-end
plan. Its target is **Rates / Saved / Market**, zero mandatory setup, zero
normal-use directories and zero explanatory application prose. The historical
Rate Ledger plan does not override this target.

Phase 6 stays a **draft PR until Phases 1–5 are complete**. Keep the draft open
while earlier phases merge so queue-drain automation does not publish an
intermediate redesign APK. Do not change release automation, reviewer policy,
Qwen configuration or producer/Pi services to implement this checklist.

## Closeout sequence

1. Freeze the capability, route and copy-source inventories; baseline/pilot
   friction ledgers; before/after native screenshots and recordings. Review the
   remaining differences against the current six-phase plan.
2. Run `cd mobile && npm run ci` on the final source. Record the exact source
   SHA, complete output and required `mobile-ci` / `bot-feedback-gate` results.
   Read all review threads, post the feedback plan, disposition and resolve all
   substantive findings, then re-check the current head. Use the repository
   squash/delete-branch merge wrapper.
3. Collect genuine isolated Android evidence against a build of that source.
   Record raw Android environment readback, aapt package/ABI badging, a fresh
   installation, installed-package readback and the pulled installed APK.
   Hash both original and pulled APK files; preserve existing emulator sessions
   and persisted AVD state. Never represent a browser preview as Android proof.
4. Exercise every required journey and case below. Capture the useful content,
   controls, transitions, state restoration, financial facts and accessible
   output. A fast blank surface, redirected obsolete audit surface or skipped
   journey cannot pass.
5. Run the evidence verifier. Have the reviewer inspect the actual captures,
   raw traces and the emulator operator's usability assessment. When
   representative participants are available, report their separate human
   study; otherwise explicitly report it as not run without claiming human
   validation. A complete JSON record alone cannot establish
   interaction quality, human usability or the truth of an assessor's claims.
6. Once publication is authorised, verify the public universal/ARM APK pair,
   rolling manifests, SHA-256, bytes, signing identity, version/build, ABI and
   release source with the APK identity tools and public readback. Fresh-install the
   downloaded exact bytes and repeat native acceptance. Record each APK's own
   acceptance file; an x86_64 universal-APK emulator run cannot establish ARM
   runtime acceptance. Keep physical haptics/device acceptance separately
   labelled if not run. Do not infer public delivery from merge or local build.

### Source identity before and after publication

Pre-merge captures retain their actual commit and APK hash, plus the Metro
JavaScript commit when using a development client. A recorded `mobile/` Git
tree comparison may document source equivalence after squash; it does not
establish identical binaries or public acceptance. Retain the resolved build
version/configuration too: release automation updates version metadata before
prebuild.

After publication, keep each APK's acceptance record externally alongside its
captures, using a retained copy of the rolling public manifest's `source_sha`,
its immutable APK URL and independently verified artifact identity. The release
does not publish an immutable versioned manifest. Never relabel earlier captures with the merged
commit or replace their APK hashes. Repeat native acceptance on the downloaded
bytes as required above; an untested ARM runtime remains outstanding.

## Portable evidence check

No new dependencies, Android commands, network requests, uploads or file writes
are performed by the checker. Tests run in the existing Node script toolchain:

```sh
cd mobile
node --test scripts/android-native-input-latency.test.mjs scripts/verify-android-redesign-evidence.test.mjs
node scripts/verify-android-redesign-evidence.mjs /path/to/evidence.json --source-sha SOURCE_SHA --apk-sha256 APK_SHA256 --package-name PACKAGE --version-name VERSION --version-code BUILD --abis arm64-v8a,x86_64 --baseline-source-sha BASELINE_SOURCE_SHA --baseline-apk-sha256 BASELINE_APK_SHA256 --baseline-package-name PACKAGE --baseline-version-name BASELINE_VERSION --baseline-version-code BASELINE_BUILD --baseline-abis arm64-v8a,x86_64
```

Use the actual ABI list reported by the specific APK, not the example list.
Supply trusted identity flags from independently verified build/publication
metadata, not by reading them back from the evidence JSON. Exit 0 means that
the **record is complete**, required recorded outcomes pass, artifact bytes
match their hashes, and actual aapt/installed-package logs match that trusted
identity for **both** final and baseline APKs. The native-input CSV/query and
declared cohorts are checked as described below; this is not trace authentication.
Exit 1 means incomplete or inconsistent evidence. Missing, skipped,
unavailable, failed and non-rendered results must stay honest and fail complete
acceptance; do not edit them into passes.

The checker cannot authenticate captures or people, read screenshots, judge
animation quality, verify public URLs, or prove that statements in logs and
reports are true. Script-test fixtures are explicitly synthetic and are never
release evidence. Retain original captures and raw measurements for review.

## Evidence JSON contract (schemaVersion 1)

Keep the record and referenced files together. `artifacts` is an array of
`{id, kind, path, bytes, sha256}`; kinds are `apk`, `screenshot`, `recording`,
`log`, `report`, `trace` and `query`. Paths are relative to the record directory; traversal,
absolute paths and symlinks escaping it fail. Files must exist and match their
SHA-256/size. They must be nonempty except a native `stderrRef`-only `log`:
a successful analyzer's original empty diagnostics file uses `bytes: 0` and
the exact SHA-256 of empty bytes. It cannot also satisfy any other evidence
role; never add text to raw diagnostics to satisfy the checker. A capture may
document multiple journeys, but each
referencing entry must identify the relevant segment in its report/log.

The record contains:

| Field | Required content |
| --- | --- |
| `schemaVersion`, `capturedAt` | `1`, ISO capture date/time |
| `identity` | `sourceSha`, `apkSha256`, `packageName`, `versionName`, numeric `versionCode`, `apkAbis`, `installMode: "fresh"`, artifact IDs `apkRef`, `installedApkRef`, `badgingRef`, `installedReadbackRef` |
| `environment` | `kind: "android-emulator"`, numeric `apiLevel`, `deviceAbi`, `readbackRef` |
| `design` | Ordered `primaryTabs: ["Rates", "Saved", "Market"]`, `accountItems: ["Profile", "Settings", "About"]`, `setupQuestions: 0`, `normalUseDirectories: 0`, `maximumSheetDepth: 1`, `copyGuard`, `nativeReview` |
| `journeys` | One entry for every journey below |
| `invariants` | One entry for every invariant below |
| `cases` | One entry for every Android case below |
| `audit` | `stepLimitMs: 10000`, `inventoryRef`, finalized `expectedStepIds`, actual `steps` |
| `frontendTiming` | `result`, `captureRefs`, `method: "android-frame-trace"`, `frameCount`, `droppedFrameCount`, `nativeInput` below; `inputLatencyAggregation: "maximum-final-cohort-p95"` and `inputLatencyP95Ms` equal the largest final cohort P95, never a pooled percentile |
| `usabilityScope` | `"emulator-operator"`; this required technical assessment does not claim representative human validation |
| `usability` | `result`, `captureRefs`, `humanValidationClaimed: false`, `coreTasksCompleted: true`, `criticalFinancialMisunderstandings: 0`, `coreJourneyRegressions: 0` |
| `humanStudy` (optional) | `status: "not-run"` with `humanValidationClaimed: false`, or `status: "completed"` with report references and the completed-study results below |

Every outcome entry uses `result: "pass"` and `captureRefs: [artifact IDs]`
only after genuine verification. `copyGuard` requires its command log;
`nativeReview` and journeys require screenshot, recording and log references;
invariants require report and screenshot references; cases require screenshot
and Android log references. Usability requires a recorded emulator-operator
assessment report, not an emulator-script success flag. Its financial
interpretation and effort findings describe what that operator observed; they
do not establish how representative users understand the app.

A human study is separately optional. Omission is reported as `not-run`;
an explicit `not-run` object must include `humanValidationClaimed: false` and
must not contain completed-study results or participant counts. Neither case
blocks complete technical acceptance when the operator assessment and all
other required evidence pass. A `completed` study requires `result: "pass"`,
`captureRefs` containing its anonymised report, `participantCount` from 5–8,
`unassistedCoreTasks: true`, `criticalFinancialMisunderstandings: 0` and
`coreJourneyRegressions: 0`. These remain recorded claims for reviewer
inspection. Do not collect participant identities in the manifest or publish
private financial/tester information.

### Journeys and effort budgets

Required IDs are `launch-rates`, `change-product-type`, `open-product`,
`save-rate`, `search`, `filter`, `sort`, `compare-two`, `calculate-from-rate`,
`market-arrival`, `return-from-product` and `switch-tabs`.

Each records `id`, `trigger`, `endState`, `result`, `captureRefs`, `durationMs`
and integer counts for `taps`, `routeChanges`, `mandatoryChoices`, `typedFields`,
`repeatedFields`, `scrollDetours`, `mistakes` and `recoverySteps`. `baseline`
contains those same counts, a baseline-report `ref`, and `alreadyMinimal`.
Count **every meaningful selection**, including both compare selections,
selection-mode activation, Apply and Compare; distinguish route changes from
interactions. Baseline/pilot triggers and successful end states must match.
No count may regress; at least one must improve unless the baseline is already
at its usable minimum. Human review must check discovery and comprehension
rather than inferring them from the counts. Record task-time distributions in
the report; a whole journey's `durationMs` is not an audit-step timeout.

Additional fields and budgets:

| Journey | Required recorded facts |
| --- | --- |
| `launch-rates` | `taps`, `mandatoryChoices`, `typedFields` all 0; full results or truthful availability state on launch |
| `change-product-type`, `open-product`, `save-rate`, `calculate-from-rate` | Exactly 1 contextual tap |
| `search` | `launchTaps: 0`, `submitTaps: 0` |
| `filter` | `openTaps: 1`, `sheetDepth: 1`, `applyCommits: 1`, `cancelRestoredState: true` |
| `sort` | `mode: "quickPreset"`, `quickPresetVisible: true`, `taps: 1`, `openTaps: 0`, `sheetDepth: 0`, `applyCommits: 1`; separate `advancedOptions` verification below |
| `compare-two` | `selectedRates: 2`, at most 4 total taps |
| `market-arrival` | `directoryTaps: 0`; dated useful market content on arrival |
| `return-from-product`, `switch-tabs` | `statePreserved: true`; prove query/type/filter/sort/list position and correct stack |

The `sort` baseline/pilot journey measures the visible **Bank A–Z / current
rate** shortcut in the Rates controls. Its single tap commits through the
canonical sort owner without opening a sheet. Match the baseline trigger,
selected sort and successful end state; record any scrolling or recovery in
the normal effort counts. A two-tap options-sheet path cannot substitute for
the measured one-tap baseline, even when both paths reach the same ordering.

The same `sort` entry must contain an `advancedOptions` object. This is separate
secondary verification, with its own `result`, `trigger`, `endState` and
`captureRefs` containing screenshot, recording, Android log and review report
artifacts. Record `taps: 2`, `openTaps: 1`, `selectionTaps: 1`, `applyTaps: 0`,
`sheetDepth: 1`, `applyCommits: 1` and `closesAfterSelection: true`: opening Sort
then selecting an option commits once and closes the sheet. There is no extra
Apply-button tap. Require `cancelRestoredState: true` and
`backRestoredState: true` from separate explicit Cancel and native Back trials
before any option is selected. Their referenced report/log segments must show
the unchanged query, product type, filters, selected sort and list position.
Count the two successful selection-path taps separately from these cancellation
trials; retain the full recorded interactions for all three trials. Verify
both paths use the same state owner. These secondary checks do not alter the
common-path baseline or relax any other journey, invariant or matrix budget.

### Financial, privacy and interaction invariants

Required IDs are `exact-rate-tier`, `visible-variant-distinction`,
`financial-facts`, `unknown-facts`, `privacy-consent`, `canonical-state-owner`,
`legacy-links`, `real-audit-readiness`, `filter-cancel`,
`section-filter-isolation`, `saved-input-reuse`, `error-input-retention`,
`stable-layout`, `touch-targets-48dp`, `contrast`, `talkback`, `reduced-motion`,
`no-prose-rendered` and `no-prose-accessible`.

Financial facts include comparison/advertised/ongoing/conditional rate meaning,
LVR/balance/term bands, eligibility, bonus conditions, fees, observed dates and
calculation assumptions. Preserve zero versus unknown, partial/sample/cache
status and stale data. Saving/notification/compare must retain the exact tier.
Privacy evidence verifies the actual consent choice, data, destination and
visibility. No prose includes dialogs, errors, tooltips, remote descriptions
and accessible output; required document text has a narrowly reviewed source
boundary, not a whole-screen exemption.

### Android matrix

Required case IDs are `small-normal`, `small-large`, `normal-normal`,
`normal-large`, `dark`, `reduced-motion`, `keyboard`, `back-button`,
`back-gesture`, `online`, `cached`, `offline`, `loading`, `empty`, `error`,
`permission-denied`, `permission-granted`, `rapid-taps` and `interrupted`.

Each case records measured `environment: {widthDp, fontScale, theme,
reducedMotion}` plus the result and capture references. Small width is
350–370dp; normal width is 400–420dp. Normal font is 1.0; large font is at
least 2.0. Cases may share sessions, but capture/log segments must demonstrate
their actual state. Cover core journeys on both widths and fonts, not merely
a launch screenshot. Dark/reduced-motion cases must record their true setting.
The checker verifies required records, not complete perceptual coverage; the
reviewer owns that matrix inspection.

### Audit and front-end timing are separate

Each audit step is `{id, result, durationMs, rendered, ref}`. Every finalized
expected step must occur exactly once, pass, render real content or the verified
empty state, and finish in **at most 10,000ms**. Raising a stall timeout must
not raise this limit. Incomplete inventory, phantom readiness, duplicates and
skipped/unavailable checks cannot be relabelled healthy.

Native front-end response/frame evidence comes from actual Android input/frame
traces and a reviewed summary, recorded in `frontendTiming`. Preserve raw
frames, latency measurement method, device conditions and pilot tuning results.
A 60-second calculation journey can be valid; a 10,001ms audit step fails.
Neither a fast audit step nor JSON `result: "pass"` proves smooth animation.

### Direct native input evidence

`frontendTiming.nativeInput` strengthens the existing schemaVersion 1 contract.
Scalar-only records are incomplete. No new minimum regression percentage is
introduced: retain the reviewed performance budget and frame/drop assessment.
The scalar remains a compatibility summary of the **maximum final cohort P95**;
review baseline and final per-cohort values rather than pooling actions.

Required fields are `schemaVersion: 1`,
`associationMethod: "native-frame-info-id"`,
`metric: "original-input-to-first-uniquely-attributable-native-presented-frame"`,
`percentileRule: "nearest-rank"`, `minimumUniqueGestures: 30`,
`moveRepresentative: "first-original-move"`, `scope: "release-paired"`,
`semanticReadinessSeparate: true`, `registeredAt`, `planRef` and `cohorts`.

Preregister the exact paired workload before either capture. `planRef` is a
hash-bound JSON report containing `schemaVersion: 1`, `registeredAt`, both
trusted APK/source `identity` objects, the measured paired `environment` fields
below, and the ordered cohort descriptors. Each descriptor has `id`,
`gestureSetId`, `journeyId`, `actionKind`, `trigger`, `endState` and
`expectedAttemptCount`. The record adds `baseline` and `final` capture stages
to each descriptor. Retain capture dates after preregistration and match the
actual attempt count to the planned count. Never revise a workload after
seeing a slower sample. Reviewer inspection establishes that preregistration
and the operator's account are truthful; an ordinary JSON timestamp cannot.

All three actions are required, as separate paired cohorts:

| Action | Independent sample |
| --- | --- |
| `down-feedback` | One DOWN event per tap gesture |
| `up-activation` | One UP event from that **same** tap gesture |
| `move-scroll` | The first MOVE by original event time per actual swipe |

Require at least **30 unique qualifying gestures in each baseline/final
cohort**. DOWN and UP share a `gestureSetId`, workload and trace/CSV: they
describe two phases of the same 30 or more taps, not 60 independent taps. Link
them by captured device/source/`down_time_nanos`. A swipe counts once, even
with many batched moves. Use its preregistered **first original MOVE**, never
the fastest move or earliest later move with a frame assignment. If that first
MOVE is unassigned, ambiguous, dropped or otherwise unsupported, the swipe is
unavailable. Keep subsequent events and their status in the CSV; they do not
replace that representative event. Unsupported required taps stay unavailable
and block complete timing acceptance, even when a legacy estimate exists.

Each stage records `status: "measured"`, `hostWorkload: "idle-verified"`,
`capturedAt`, fresh exact-APK `identity` with the same fields/references as the
top-level identity, `traceRef` (trace), `queryRef` (query), `csvRef` (report),
`configRef` (query), `analysisRef`, `stderrRef`, `environmentRef`, `workloadRef`
(logs), `datasetRef` (report), exact `analyzerVersion`, `environment`,
`attemptedGestureCount`, `operatorCorrections` and `summary`. Supply the
independently verified **baseline** identity using the additional CLI flags;
do not obtain those expectations solely from the acceptance record.

Measured environment fields are `deviceFingerprint`, `bootId`, `apiLevel: 36`,
`runtimeAbi`, `widthPx`, `heightPx`, `densityDpi`, `fontScale`, `refreshRateHz`,
actual `ramMiB`, `cpuCores`, `gpuMode`, `theme`, `reducedMotion`,
`appState` (`ready-cached` or `ready-online`) and `datasetSha256` matching the
retained dataset bytes. Pair every field except the boot ID; retain each boot
ID anyway. Match the analyzer version and capture configuration too. Evidence
captured during host CI or other competing workloads is exploration, not a
final percentile. Record guest display timing honestly; x86 emulator results
do not establish physical input latency, haptics or ARM runtime behavior.

Keep all attempted/received/unavailable/operator-excluded observations.
`operatorCorrections` entries are `{attemptId, gestureKey, reason, ref}` with
unique attempt IDs, a captured gesture key or `null` for a rejected input that
never arrived, and a log/report reference. Closed reasons are `wrong-target`,
`input-command-rejected`, `interrupted-capture`. These are operator errors,
not exclusions for a slow or dropped app response. Linked tap cohorts share
the correction attempt IDs/reasons and any known gesture key. Missing
uncorrected attempts or unavailable representative gestures block a measured
P95; none becomes zero. Partial corrected trials may have no received UP;
both raw observations and the explicit missing-event correction remain visible.

`summary` contains `receivedInputCount`, `receivedGestureCount`,
`admittedGestureCount`, `unavailableGestureCount`,
`operatorExcludedGestureCount`, `unavailableObservationCount`,
`unclassifiedInputCount`, `percentileStatus`, exact decimal-string `p95Ns`, numeric `p95Ms` and
`sampleListSha256`. An unavailable percentile is `null`, not zero. The sample
hash covers the lexically ordered JSON array of
`[gestureKey, representativeInputId, latencyNs]` for admitted gestures. P95
is nearest rank `ceil(0.95*n)`, computed with integer nanoseconds; converted
milliseconds must agree. The checker recomputes all counts, samples and P95
from the retained CSV and keeps raw legacy speculative flags unchanged.
An unidentified input action remains in the raw observations and makes the
percentile unavailable; it cannot silently vanish from every action cohort.

The checked-in `mobile/scripts/android-native-input-latency.sql` joins original
motion proto event ID/time to the same app's RenderThread
`frameTimelineInfo` input-ID/vsync-ID, then the same receiving window's actual
surface-frame token, then its actual SurfaceFlinger display frame. Require one
original identity, receiving window, reader time, native candidate, app frame
and display frame. Duplicate critical identities do not inflate gestures;
reused IDs, different windows or multiple candidates remain ambiguous. Require
real InputReader evidence, completed non-dropped verified present states and
captured MONOTONIC clock conversion. Subtract original `event_time_nanos` from
`to_monotonic(display.ts + display.dur)`, **not** app/GPU completion or operator
wall-clock time. Preserve raw duplicate counts and legacy flags 0/1/null;
neither UI-thread overlap nor next-frame fallback enters the direct cohort.
See Android 16 [renderer ID publication](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-16.0.0_r4/libs/hwui/renderthread/CanvasContext.cpp),
[input assignment](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-16.0.0_r4/core/java/android/view/InputEventAssigner.java),
[presentation fence/clock source](https://android.googlesource.com/platform/frameworks/native/+/refs/tags/android-16.0.0_r1/services/surfaceflinger/FrameTimeline/FrameTimeline.cpp),
[FrameTimeline semantics](https://perfetto.dev/docs/data-sources/frametimeline) and the
[tested Perfetto 58.2 legacy analyzer](https://github.com/google/perfetto/blob/add693d8b338ba9599dbcbc3e300b1ab8c000897/src/trace_processor/perfetto_sql/stdlib/android/input.sql).

Render the exact query for the independently verified package, run the already
verified trace processor offline, and retain its clean CSV stdout and separate
stderr. These commands do not run Android or create acceptance records:

```sh
node scripts/android-native-input-latency.mjs --query PACKAGE > native-input.sql
trace_processor_shell query -f native-input.sql capture.pftrace > native-input.csv 2> native-input-stderr.log
node scripts/android-native-input-latency.mjs --summarize native-input.csv PACKAGE down-feedback
```

`analysisRef` contains a JSON command record with `schemaVersion: 1`, `exitCode: 0`,
`analyzerVersion`, `traceRef`, `queryRef`, `csvRef`, `configRef`, `stderrRef` and
the SHA-256 fields `traceSha256`, `querySha256`, `csvSha256`, `configSha256`.
Retain the actual invocation in its accompanying command log. The capture
config must include original input events, window dispatch, app gfx/view/input
atrace and actual FrameTimeline. The query must exactly match the rendered
checked-in SQL; parse errors, trace errors/data loss or mixed stdout cannot
silently remove observations. The checker hashes the raw trace and command
bindings but does not execute a downloaded analyzer, authenticate a trace, or
prove CSV provenance merely by hashing it. A reviewer can replay the retained
query against the raw trace. This metric measures a native presented response;
use the separate journey/audit evidence for useful semantic readiness.

## Final evidence ledger

Report these states independently: local script checks; canonical local CI;
exact-head GitHub gates; merged source; build identity; emulator acceptance and
operator assessment; optional human study (completed/not run); public
APK/manifest verification; exact published-byte reinstall;
physical device/haptics. Keep incomplete states explicit. The draft harness
alone completes none of the redesign's native or release gates and never
converts emulator work into human validation.
