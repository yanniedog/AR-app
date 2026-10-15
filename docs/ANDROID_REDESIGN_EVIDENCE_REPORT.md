# Android redesign evidence status report

**Snapshot: 16 October 2026 (Australia/Hobart), after the finalized e23 Live audit.
Final acceptance is pending.** Phases 1–5 have merged. Latest reviewed Phase 5
source `e23a389a05e56a058878b7372c0bf990e21c2ab2` passed full local canonical
checks and the bounded Saved/sheet repairs below. Its actual squash merge is
`3d8e417`; captures retain their original e23 identity. Protected main/P5 was
ordinary-merged into Phase 6 at `1f6499c86db01169f005e73e3aff7fa03ad5baf7`,
preserving all seven local follow-up commits. Integrated Phase 6 checks, final
native evidence and public-release verification remain pending. The e23 audit
has zero 10-second overruns but retains failures and incomplete journey coverage;
it does not establish complete acceptance. New P6 review repairs for constrained
primary metrics and fixed Rates controls still need native validation. Neither
source/harness integration nor bounded observations establish the full matrix
or native P95. The later P6 repair source is
`ea50f04672c6293d0ecee119a82dae497198b1f5`; its full canonical run failed
because one fixed-header test selector was stale. The corrected real-input
focused suite passes; the test-only follow-up/full rerun and actual P6 native
validation remain pending at this cut-off.

This report accompanies [the contract](ANDROID_REDESIGN_CONTRACT.md) and
[acceptance requirements](ANDROID_REDESIGN_ACCEPTANCE.md). The contract file
is included by protected-main integration. Evidence IDs below are logical paths
relative to the retained external review bundle, not files bundled with the
app. Original captures, failed attempts and hashes remain unchanged. This
report is not a completed acceptance JSON or checker PASS.

## Source and verification status

| Work | Recorded state | Outstanding boundary |
| --- | --- | --- |
| Phase 1 — contracts, PR [398](https://github.com/yanniedog/AR-app/pull/398) | Merged; recorded merge `3688a25a0c77c66f3b4e2e2209e8c669498ad966` | Preserve approved inventory/contract in final integration. |
| Phase 2 — native design pilot, PR [401](https://github.com/yanniedog/AR-app/pull/401) | Merged | Earlier native proof retains its own source; it is not final acceptance. |
| Phase 3 — app map, PR [403](https://github.com/yanniedog/AR-app/pull/403) | Merged; recorded merge prefix `33e35c2` | Preserve exact-row navigation and state ownership. |
| Phase 4 — copy/factual presentation, PR [404](https://github.com/yanniedog/AR-app/pull/404) | Merged | Final inventory/copy check still belongs to the integrated head. |
| Phase 5 — validation and dense rows, PR [405](https://github.com/yanniedog/AR-app/pull/405) | Merged as `3d8e417`; reviewed canonical/native source `e23a389a05e56a058878b7372c0bf990e21c2ab2` | Full local CI and bounded native Saved/sheet repairs pass. Finalized e23 audit: no hard overruns, but bottleneck status, 164 raw failures and journey completion false. Earlier BB1, 753 and 549 evidence retains its own identity. |
| Phase 6 — acceptance harness/launch assets/installer, PR [397](https://github.com/yanniedog/AR-app/pull/397) | Draft; protected-main/P5 integration at `1f6499c86db01169f005e73e3aff7fa03ad5baf7` preserves seven local follow-ups; later repair source `ea50f04672c6293d0ecee119a82dae497198b1f5` | Focused checks pass: 38 compact-row, 36 Search and 42 native-evidence/installer tests. Canonical ea50 failed one stale fixed-header fixture; exports/size did not run. Corrected real-input suite passes 3 tests; follow-up/full rerun and actual P6 native/public acceptance remain pending. |
| Representative-person study | Not run | Emulator-operator findings do not establish human usability validation. |
| Physical-device audio, haptics and ARM runtime | Not run for final redesign | x86_64 emulator observations do not cover these. |

The retained 1f canonical receipt [C1] records `cd mobile && npm run ci`, exit
0, mobile tree `11efbfbac87a80df658698369e0925322204bc2a`: 371 Jest suites /
4,157 tests, 378 script tests, Doctor 18/18, types, lint (0 errors / 9 existing
warnings), copy guard (0 violations), prepared pins, both history benchmarks,
Android/iOS/web exports, compiled-link/audit-awake checks and size guards pass.
The complete log/result hashes are recorded in that receipt. Host verification
elapsed time is not application latency.

The retained Phase 5 report snapshot [C2] records successful exact-1f
[mobile-ci](https://github.com/yanniedog/AR-app/actions/runs/38731154543),
[bot-feedback-gate](https://github.com/yanniedog/AR-app/actions/runs/38731154583)
and [artifact build](https://github.com/yanniedog/AR-app/actions/runs/38731154467).
Its post-wait review read found no substantive threads/reviews to disposition.
These historical observations do not cover the later `9420975` or `753f0f5` sources; required
checks and feedback closure must be current again before merge.

The later exact-`942097564bf3f68f5e7ddabefad2adb04aa27764` canonical run [C5]
completed on 15 October at 12:38:11 UTC:
371 Jest suites / 4,170 tests and 378 script tests passed, together with the same
doctor, type, lint, copy, pin, benchmark, export and compiled/size checks. Its
mobile tree is `9d74fc7a42c9c838190f83152cff55b25bc31147`; the retained
`phase5-9420975-canonical-verification-receipt.json` has SHA-256
`98f78cc6f1045b24c626089047cf477147c6048e1504319eebd1d3d20afae2a9`.
This is historical source-check evidence. Its later native font-transition
failure remains retained; the separate 753 observations below do not retag it.

The historical exact-`753f0f5` canonical receipt [C6] records completion on
16 October at 00:11:14 Australia/Hobart (15 October 13:11:14 UTC), exit 0,
mobile tree `11f409b27b89034e40655935a6d266aa251f0a87`: 372 Jest suites /
4,236 tests and 384 script tests passed. Doctor 18/18, types, lint (0 errors /
9 existing warnings), copy guard (0 violations), prepared pins, both history
benchmarks, all three exports, compiled-link/audit-awake and size checks passed.
The receipt binds the original complete result/stdout/stderr hashes. It does
not cover the subsequent host/footer repair batch, integrated Phase 6 or public
delivery. Host verification elapsed time is not application latency.

The historical exact-BB1 canonical receipt [C9] records completion on
16 October at 01:02:34 Australia/Hobart (15 October 14:02:34 UTC), exit 0,
mobile tree `adb01ca5ebd7b8abb33addf44d021a7b105e3cc0`: 373 Jest suites /
4,242 tests and 384 script tests passed. Doctor 18/18, types, lint (0 errors /
9 existing warnings), copy guard (0 violations), prepared pins, both history
benchmarks, all three exports, compiled-link/audit-awake and size checks passed.
Its complete result/stdout/stderr hashes remain in the receipt. This is local
exact-BB1 source verification, not integrated Phase 6 or public acceptance.

The latest reviewed exact-e23 receipt [C12] records completion on 15 October
at 14:57:29 UTC (16 October 01:57:29 Australia/Hobart), exit 0, mobile tree
`a05c7b56776d29f3ca323f11ffe8dd8e5d12576e`: 374 Jest suites / 4,259 tests
and 384 script tests passed. Doctor 18/18, types, lint (0 errors / 8 existing
warnings), copy guard (0 violations), prepared pins, both benchmarks, all three
exports, compiled-link/audit-awake and size checks passed. The retained receipt
binds complete result/stdout/stderr. These checks belong to e23, not the later
integrated Phase 6 head or public APKs; source squash/merge is not a new check.

## APK and runtime identities

| Identity | Retained baseline | Historical 1f premerge validation artifact |
| --- | --- | --- |
| Scope | Public v1.0.239 baseline; not a final redesign APK | x86_64 release validation build, not public/production-signing acceptance |
| Original source | `f756137cddcb9a0a360b13150424af6f2ccea9bc` | `1f885771aa50e88005926d637e03e3fc914712bf` |
| APK bytes | 88,565,841 | 32,839,422 |
| APK SHA-256 | `eb6c5bb4a9a25956f0f358cd6f5a11d2aba2987accd1d05f078c91c512c06e0e` | `0d0fc461b5d3285fbce20371b9edb3147b638a070ab053958206a225dd3f0cac` |
| Package | `com.eyex.australianrates` | `com.eyex.australianrates` |
| Actual version / build | 1.0.239 / 296 | 1.0.238 / 192 |
| ABI set | arm64-v8a, armeabi-v7a, x86, x86_64 | x86_64 |
| Signing digest | `5f9ab77ef2b0c68307d652abe28dfa96690851af1a28353bb84d277ef83682c1` | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; production identity not verified |
| Installed-stage binding | Earlier exploratory installation is not an accepted paired stage | [C3–C4]: pulled installed bytes/hash match on task AOSP Android 16 userdebug emulator `emulator-5582`, 15 October 12:13:32 UTC |

The 1f build is workflow run `38731154467`, artifact `11970177846`. Its archive
is 32,889,838 bytes, SHA-256
`ab64367cbae358d9cdbdb9f83ddf7ed9aff0da6dd46d8511fc6df7ff28b279c8`.
The archive digest and contained APK digest identify different bytes. Metadata
and installed-byte receipts [C3–C4] supersede the older download-pending wording
in [C2]; they do not turn the artifact into a public release or prove a fresh
final acceptance installation. Final resolved version/configuration, signing,
universal/ARM public APKs and their actual installed readbacks remain Pending.

The historical 753 release-validation artifact [C7–C8] is independently identified:

| Identity | 753 premerge validation artifact |
| --- | --- |
| Source / mobile tree | `753f0f500be43cacac3e4d1b39450707779ca24d` / `11f409b27b89034e40655935a6d266aa251f0a87` |
| APK bytes / SHA-256 | 32,844,346 / `a0bf14cdc5bd96e7995f7e23aaf927f4f38ad0cbeae5e0a8a1d42cd0161057ab` |
| Package / version / build / ABI | `com.eyex.australianrates` / 1.0.238 / 192 / x86_64 |
| Build / signing scope | Release variant, workflow run `38739602437`; certificate `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; production signing identity not verified |
| Installed-stage binding | Matching installed APK bytes/hash on task AOSP `emulator-5582`, 15 October 13:21:38 UTC; not final public-byte acceptance |

The historical BB1 repair-validation candidate below has its own identity
[C10–C11]; earlier artifacts are not retagged as this build:

| Identity | BB1 premerge validation artifact |
| --- | --- |
| Source / mobile tree | `bb1fb4300dbdc8cd58704d1eaee9b202b36bc0d6` / `adb01ca5ebd7b8abb33addf44d021a7b105e3cc0` |
| APK bytes / SHA-256 | 32,846,770 / `150d51ba0669c8f93e7be1af59fc6a8b77d3e35dd984db1414302f90c3d115be` |
| Package / version / build / ABI | `com.eyex.australianrates` / 1.0.238 / 192 / x86_64 |
| Build / signing scope | Release variant, workflow run `38748017079`; certificate `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; production signing identity not verified |
| Installed-stage binding | Pulled installed bytes/hash match on task AOSP `emulator-5582`, 15 October 14:21:12 UTC; retained cache/state, not fresh final public-byte acceptance |

The later e23 validation artifact [C13–C14] is independently bound:

| Identity | e23 Phase 5 validation artifact |
| --- | --- |
| Source / mobile tree | `e23a389a05e56a058878b7372c0bf990e21c2ab2` / `a05c7b56776d29f3ca323f11ffe8dd8e5d12576e` |
| APK bytes / SHA-256 | 32,847,074 / `dce9751e58ccf4c193cd15e3500ddd1f147412e4929f1ead90f248a719cd6153` |
| Package / version / build / ABI | `com.eyex.australianrates` / 1.0.238 / 192 / x86_64 |
| Build / signing scope | Release artifact, workflow `38756433801`, artifact `11984147401`; Android Debug certificate `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; not public release signing |
| Installed-stage binding | Matching pulled installed APK on task AOSP `emulator-5582`, 15 October 15:20:21 UTC; retained data, not fresh final public-byte acceptance |

Source-tree equivalence after squash cannot prove binary equivalence. Phase 6
also changes native launch artwork/configuration; earlier APKs cannot validate
those final native assets by JavaScript-source equivalence.

## Native observations and their limits

The root operator reviewed the actual 1f native PNGs and retained journals:

| Original observation | What is established | Remaining limitation |
| --- | --- | --- |
| 360dp, font 1, dark [N1] | Five complete single-line Savings rows; a sixth is clipped by the viewport. No horizontal scrolling seen. | Main content was top-aligned relative to logo/Save. This is historical 64dp layout evidence, before the later 56dp centering batch. |
| 360dp, font 2, dark/reduced motion [N2–N3] | Four complete Mortgage rows; selected comparison values and actual tier indices visible, without observed numeric clipping. Secondary metrics deliberately move to accessibility/detail. | UIAutomator could not obtain idle hierarchy; a separate settled PNG was reviewed. This is visual evidence, not a successful automated endpoint or final matrix pass. |
| Filter hold [N4] | A one-word “Filter” bubble appeared; release did not open the sheet or fire its action. | Bubble position required correction; new metric bubbles are not covered. Hold duration/operator time is not latency. |
| Direct checkboxes and Compare dock [N5–N7] | Compare mode → exact ri2 checkbox → exact ri4 checkbox → Compare: 4 taps, 2 selection decisions, 0 typing, 0 scrolling. Both 5.80% comparison / 5.89% advertised and 5.95% / 6.04% pairs were visible together. Native Back retained `Unloa`, four results and selections/position. | This is one operator-reviewed path on exact 1f, not a replacement for all matched journeys or final accessibility acceptance. |
| Font-change blank and cold recovery [N8] | A blank state after a live font change was observed; a separate cold launch recovered Rates, retained saved state, and `Unloa` returned four exact tiers. | Historical failure remains unchanged. Recovery/setup is excluded from matched friction; the separate successful 753 roundtrip below does not establish the earlier failure's cause. |

The curated 753 observation [N9] binds source/APK, installed readback, original
journal and actual reviewed PNGs. At 360dp/font 1/dark, six complete centered
single-line rows were visible and initial loading used approximately 56dp
one-line placeholders. Holding the comparison region showed exactly
“Comparison”; Back dismissed it without a route change or action.

The operator used the actual Android Settings font-size slider 1→2→1 without
force-stop. Row/family glyphs grew and shrank; `Unloa`, four results and the
exact first Saved star were retained without the earlier blank state. An
initial readback preceded asynchronous font application; the later 2.0 readback
and visibly enlarged glyphs establish growth. This is a bounded successful
roundtrip, not a complete matrix or timing result.

Two actual 753 native defects were retained: the bubble bright region at y779–894
against row-main top984 left approximately 30dp gap, and footer labels remained
font2-sized/clipped after returning to confirmed font1 while row text shrinks.
The intermediate host/footer repair source
`5ccd8b839bd22e2159b7769aa788b437f4ee688f` was followed by BB1's shared-text
repair. The separate BB1 result below supersedes the repair-pending status;
it does not alter the 753 observations. The 753 curated journal is finalized
as `partial-failed-native-layout`, with no complete friction census, whole-matrix
pass or native timing percentile.

### Historical bounded BB1 repair verification

The BB1 journal [N10–N11] is finalized with 63 sequential events, 13 retained
endpoints and an explicit root operator visual review. Its bounded result is
PASS for bubble placement/dismissal and real Settings font/state restoration,
not a whole-matrix or performance pass. The initial cold frame is explicitly
not an endpoint; the subsequent settled endpoint shows 6,187 results.

Actual Comparison and Advertised holds each show exactly one word. Both
bubble bottoms are y960 against row-main target top984 at density3, an 8dp gap.
Back dismisses without navigation; an outside tap over another row's Save
dismisses without saving that row. Long-press release does not open Product.

The operator used actual Android Settings slider steps 1→2→1.5→1, with recorded
2.0/1.5/1.0 readbacks and no force-stop. `Unloa`, four results and the exact
saved tier survive; the tier starts unsaved in synthetic setup and is saved
once at font2 before the shrink checks. Root reviewed actual PNG glyph growth
and shrink, including the intermediate 1.5 step; all three footer labels fit
after shrinking. No blank occurred on these resumes. Derived ink observations
[N12] corroborate relative glyph size only, not point sizes or input latency.

Focused Search reopens the native keyboard on resume; the recorded Back closes
it before the footer assessment. This behavior and the full original sequence
remain visible. Journal elapsed time includes operator/capture overhead, and
its setup/Settings interactions are not a replacement friction census or a P95
sample. Final 411dp/other matrix cases, TalkBack, strict-audit and integrated
Phase 6/public-byte proof remain separate outstanding requirements.

### Bounded e23 Saved and sheet verification

The curated e23 observation [N13] retains the actual 411dp/font1/light Saved,
Filter Apply and separate Cancel trials. Root reviewed three adjacent one-line
Saved rows showing comparison/advertised pairs 5.80/5.89, 5.95/6.04 and
6.10/6.19. Their main targets are 126px (48dp at 420dpi), at y552/700/848;
the 148px row stride includes the separator. This is source-bound native
geometry, not an inference from offscreen XML alone.

An exact Saved row opens Product. Holding the Alerts icon shows the single
word “Alerts”; release and Back retain Product without firing the action or
requesting permission. Saved→Product→Calculate preserves the exact selected
5.89% advertised rate. It now takes two taps rather than the previous direct
Saved calculation's one: a **+1 tap tradeoff**, not an effort improvement.
No calculation input or financial outcome is inferred. Genuine Back returns
Calculate→Product→Saved with all three rows and the Saved tab selected.

The separate Filter trial retains the fully visible Show 9 target
`[437,2147][1038,2273]`: 126px/48dp, above the native navbar starting y2274.
The original clipping is not waived by a tolerance or retry. Filter→Ongoing→Show
uses three taps; Apply yields AMP/nine results/Filter1. Separate Close/Cancel
retains that committed query/filter/result state. Excluded setup is recorded
separately. The Saved journal's earlier “sheet pending” summary is historical;
the later Filter trials supply the bounded sheet evidence. These observations
are not a replacement matched 12-journey census or a whole-matrix/P95 pass.

The preserved b945 matched ledger [J1–J2] covers the twelve agreed journeys
and 96 comparison cells against the original baseline: arrival, family,
product, save, search, filter, quick sort, Compare, contextual Calculate entry,
Market, product Back and tab/state restoration. It retains separate Filter
Cancel and advanced Sort selection/Cancel/Back observations. Calculate is exact
selected-tier entry with blank fields, not a completed financial outcome.
Those records keep their original source; they do not automatically cover
the 1f dense rows, subsequent `9420975` refinements or 753/BB1/e23 repair work.

Reconcile affected-flow rechecks against the twelve matched journeys and the
declared 360/411dp, normal/large-font and state matrix. A twelve-by-four full
Cartesian repetition is not asserted here. Every required contract case and
invariant still needs its own genuine evidence; one launch image cannot stand
for a corner, offscreen XML cannot prove visible facts, and helper success
cannot establish zero mistakes or comprehension.

## Finalized historical 549 Live audit

This is retained failed evidence, not a final-source acceptance audit. Source
`5496c48ebf5439c188e64b13ff0e6bc3d848c44c`, installed APK SHA-256
`7983af5f78be530cdad677518bdee149784e9676cb99546cbc9f396180c64ac8`
(32,829,582 bytes), session `pa-mv9fdit0-4e973937beb12fdc`. The finalized
comparison [A1] binds the original sidecar [A2], local log [A3] and independent
installed-source receipt. Exactly one matching END and complete-report-stored
record were retained (11:12:20.617 and 11:12:21.243 UTC). Report durability does
not establish healthy execution.

| Measure | Original result |
| --- | --- |
| Stored rows | 2,644 = 2,618 performance + 26 health |
| Mutually exclusive raw statuses | 243 pass / 2,221 warn / 158 fail / 12 skipped / 10 unavailable |
| Performance raw statuses | 236 pass / 2,220 warn / 150 fail / 12 skipped |
| Health raw statuses | 7 pass / 1 warn / 8 fail / 10 unavailable |
| Journey action completion | 338 of 350; 96.6%; complete false; all expected IDs stored without duplicate/missing/unexpected IDs |
| Summary coverage | 99.1%, distinct from journey completion |
| Reported unavailable | 22 includes 12 classified performance rows overlapping raw statuses; it is not 22 additional raw rows |
| Strict 10,000ms overruns | `manifest-network`: 10,052.5ms; `deep-repeat.sample.catalogue.2.product.open` (NAB): 10,006.8ms |
| Overall | Bottleneck; no healthy/final acceptance claim |

The NAB first pass was 9,013.2ms. Its repeat retained ready probe counts
(including a 172-tier model), yet did not complete within the deadline. The
model count is not 172 simultaneously rendered native rows. Deferring closed
tier construction is a later source repair; it has no fresh native deadline
pass in this record. No specific CPU/render cause is inferred from the audit.

Live-source validation failed at the manifest timeout; subsequent source-health
failures/unavailability stay as recorded. This does not prove the separately
rendered core vanished. External-source availability and application smoothness
remain distinct. JavaScript event-loop/frame-gap samples and operator journey
wallclock are not native input-to-present P95. The older AEA finalized report
and all partial snapshots remain separate, never relabelled as 549 or 1f.

The retained network-policy review [A4] also preserves `policyViolations: 1`
as a genuine failure, separate from 26 normal pre-transport denials. The
original aggregate evidence does not recover the offending final URL; no
allowlist relaxation or inferred safe destination is justified. Update-readiness
separately passed in 4,627.9ms with one fresh metadata call and actual result/
native-layout evidence, no APK download. That success does not erase the
whole-session policy failure.

## Finalized e23 Live audit

Root started session `pa-mv9oxrqq-74092b217d1a844f` at 15 October
15:25:44.498 UTC (16 October 02:25:44.498 Australia/Hobart), against the
Oct16 dataset and exact e23 validation artifact. The initial planned count of
351 was provisional: the finalized report contains 352 journey checks. The
retained start/control journal is
`journeys/phase5-e23a389-release-411-font1-light-full-live-audit/events.jsonl`.

The schema-7 original sidecar/log [A7–A8] retain the same e23 source/APK binding;
the independent analysis and targeted extraction are [A5–A6]. There is exactly
one matching END at 15:40:31.799 UTC and one complete-report-stored record at
15:40:32.000 UTC, with `completeReportStored: true`. The report itself finished
at 15:40:29.169 UTC. The original completed journey event used END time in its
`finishedAt` field; clarification [A9] preserves that original and distinguishes
the actual sidecar finish, END and stored timestamps. No outcome changes.
Durable completion is not healthy execution or acceptance.

| Measure | Original e23 result |
| --- | --- |
| Stored rows | 2,749 = 2,723 performance + 26 health |
| Performance raw statuses | 210 pass / 2,339 warn / 162 fail / 12 skipped |
| Health raw statuses | 21 pass / 2 warn / 2 fail / 1 unavailable |
| Mutually exclusive combined raw statuses | 231 pass / 2,341 warn / 164 fail / 12 skipped / 1 unavailable |
| Summary unavailable | 13 overlaps 12 classified performance rows plus 1 raw health unavailable; never add it again to raw totals |
| Inventory integrity | All 2,723 performance and 26 health expected IDs stored once; missing, duplicate and unexpected-ID arrays empty for both inventories |
| Journey coverage | 340 of 352 executed/completed; 12 justified skipped/unavailable, 0 unexpected skips; 96.6%; `complete: false` |
| Strict 10,000ms overruns | 0; slowest `manifest-network` 9,820.7ms |
| Overall | Bottleneck; complete acceptance remains unfulfilled |

Manifest/publication/hash validation passed, but `manifest-network` retains
`performanceStatus: fail`: event-loop P95 118.5ms/max lag 1,538.5ms and frame-gap
P95 127.7ms/max gap 1,563.5ms. Across measured journeys the largest event-loop
lag is 1,701ms and frame gap 1,725.1ms. These are JavaScript audit responsiveness
samples, not native input-to-present P95. Staying below 10 seconds does not
erase smoothness classifications, unavailable coverage or functional failures.

Two health failures remain: `display-chart` reports one missing/unavailable
chart at `rba.dashboard`, and `network-policy` reports one policy violation
(237 authorization attempts, 211 authorized/transport calls, 26 blocked).
The rejected destination is not identified by these aggregate counters; it is
not assumed safe. Asset availability is unavailable because three optional
assets were not observed; both required assets were available. Producer coverage
warns on seven partial providers (116 attempted/succeeded), and institution
artwork warns on four fallback observations. None is silently promoted to pass.
The chart/policy failures also occur in the retained 549 audit; their presence
here does not establish an introduced regression. The datasets differ, so this
report makes no broad performance-regression comparison or offending-URL cause
claim from aggregate counters.

Saved→Product and Product→Calculate genuinely complete in both audit passes.
Saved Product opening retains raw `fail` due to responsiveness, with
`nonTimingFailure: false`; calculation retains raw `warn`. Target/model/layout
readiness is recorded, but action completion does not overwrite the overall
status. Dedicated update-readiness passes in 4,496.5ms with one fresh metadata
call, actual post-result layout, and no APK download. Display-contract inventory
passes with 23 planned/observed surfaces and no missing/unexpected surface.

The earlier NAB 172-tier scenario is not exercised in this Oct16 run: its
`sample.catalogue.2` slot now opens a two-tier Horizon product. Therefore zero
overruns here is not native verification of the lazy NAB-tier repair. The
prior 549 and AEA failures remain unchanged and source-bound.

Root reviewed the final native PNG as an idle Audit page with controls enabled;
below-fold results were not visually reviewed in that PNG. Root restored the
animator scale to 1 afterward. This report records the actual scope, not a
whole-page visual pass. The new P6 primary-metric/fixed-toolbar repairs are
outside e23 and require new source-bound native validation.

## Phase 6 installer preview

Installer template work is committed locally at `13d0d4a`. The retained preview
receipt [I1] records `cd mobile && node --test scripts/app-release-utils.test.mjs`:
9 tests passed, 0 failed. Its earlier `uncommitted` and browser-review `Pending`
fields are historical preparation states, superseded by that commit and the
separate completed Chrome review [I2]; the original receipt remains unchanged.
The earlier report recorded remote draft `67ffd65` and four local follow-up
commits; that is historical branch-state evidence, not a fresh remote-head read.

The root operator reviewed four actual images in isolated external Chrome:
universal 360×800 normal text, keyboard focus, 200% root text, and ARM 411×891
normal text. The review records no horizontal overflow, loaded QR imagery and
at least 48px Download/Manifest controls. Visible application copy is limited to
Australian Rates, Download, Scan and Manifest; the only recorded console error
was the local favicon 404. Existing browser tabs were not touched.

These are generated examples using retained real v1.0.239 baseline URLs, not a
final redesign release. The local preview changes only the QR image source to
the generated sibling image. Browser review and synthetic template tests do not
verify production publication, final downloaded APKs, Android runtime, P95 or
the final launch artwork. No final public acceptance is assigned here.

## Current Phase 6 review repairs

Two valid late findings on merged Phase 5 are repaired in source
`ea50f04672c6293d0ecee119a82dae497198b1f5`, mobile tree
`75d8b19e0a2e8d8c1fc918fc89bcc27307232eb6`. The compact fallback prioritizes
the primary metric before tier/name at constrained 360dp/font2 geometry;
genuinely wider-than-rail glyphs remain an explicit bounded limitation, not an
unconditional fit claim. Rates controls are fixed above FlashList so query and
Filter do not require returning through a long result list. No e23 capture is
retagged as native proof of these source changes.

Retained focused results [C15–C18] pass: compact-row 38 tests, Search/state 36
tests, native-evidence/installer 42 script tests, and scoped lint. The lint
output is genuinely empty; its success is recorded by root, not inferred from
empty bytes. These checks validate source/test contracts, not native behavior.
The exact ea50 full canonical run
`isolated-phase6-ea50f04/20261016-024357-77075c7f` finished at 15 October
15:49:13.066 UTC, exit 1 after 316.032 seconds [C19–C22]. Jest recorded 374 suites:
373 passed, 1 failed; 4,267 tests: 4,266 passed, 1 failed. All 423 script tests,
Doctor 18/18, types, lint (0 errors/8 existing warnings), copy guard 0, prepared pins and
both benchmarks passed. Exports and size checks were **not run** after Jest
failed; this remains a failed canonical result.

The sole failure is `searchBarSessionInput.test.tsx:181`: it still searches
inside the result list for Bank after controls moved to a fixed sibling. Root
corrected the fixture to query the actual `rates-task-controls` owner. The real
SearchBar/session-input suite [C23] passes all 3 tests, preserving batched/paced
query, Clear mounting, and filter/sort/scroll assertions. Its 22.426-second host
test runtime is not native input latency. The test-only follow-up commit and
complete new canonical run remain pending at this cut-off. No application-source
change is assigned to that fixture repair. The retained first full run remains
FAIL. A new compatible P6 artifact and actual native checks of the changed
controls, primary metric and launch artwork remain pending. Later external
current-head canonical/native closeout receipts must supplement this frozen
cut-off; they cannot overwrite these failed originals.

Source/harness PR closure still requires current-head repository checks and
review clearance. Closing it is a repository milestone. It does not complete
native or public-byte acceptance, the full strict audit, paired P95, human
validation or physical-device proof. Each remains independently recorded.

## Common-publication preparation

Recovery [D1] verified public publication `app-payload-2026-10-15-r000001`,
revision 1. Its generation is
`sha256-1527df83eedaac6de0ca604a0f3df086f73e2d661d4be8acb8dedc09550931a2`.
Original encrypted HTTP envelopes were preserved. The app's canonical public
data service returned the plaintext payloads; no private device storage/key
was accessed. These are distinct wire and payload identities:

| Artifact / representation | Bytes | SHA-256 |
| --- | ---: | --- |
| Original HTTP manifest, ARE2 envelope | 3,518 | `76dc5fee5811d484448082fedf83049bff60ca1a364120fbef157ec80ae33a8d` |
| Original HTTP core, ARE2 envelope | 350,930 | `0d96f5d16c9e7b7ff1b62354c336122cb80668e7f4f704935ef070cffd53234b` |
| Decrypted manifest | 3,446 | `deb600540d14cab5ca73561fc5a7f6f80189f26b3a5865085fda17ee626ee8df` |
| Decrypted compressed core | 350,858 | `04e778a37cc1c3abd92c47c258226b77561a4170104217e3618311f96b037ff6` |
| Exact decoded core bytes | 11,055,511 | `73c33a5f9853d13f5017ecd8af5c1d15e1b55f1048bba7318fc3e027b74c0f9b` |
| Whole canonical decoded-model digest | — | `c64f57ca54a8cd5857243cfad817829bd1eb2b242b416f10af1196dc1650ccf4` |

The decoded core equals the retained task data backup's core bytes; the whole
manifest objects also match. The exact Mortgage target is
`Unloan|8250def8-24f4-411c-80a5-e71f54cf5823|RESIDENTIAL_MORTGAGES|Unloan Home Loan`,
ri2, comparison 5.80%, advertised 5.89%; row SHA-256
`a05383d3fb42b3905d4672a1a2b510c9cb4652f94f19bc29986d10df11ac4811`.

**Preparation only:** publication choice and both prospective installed-stage
whole-model proofs remain Pending. A 6,187 row count, matching displayed rate,
target hash or filename does not establish equal complete runtime data. Frozen
baseline/final public identities and actual common-publication/model/target
readbacks must precede prospective registration and either timed stage.

Current equivalence research does not provide an actual full-live-Core digest
readback for both installed stages. Cache-only bytes, a whole-model digest
computed offline, unchanged normalization source and an exact target-row match
cannot certify equality of the complete live models. That prerequisite remains
missing; no paired P95 workload is preregistered or accepted from these
inferences. The new audit's Oct16 data must not be silently equated with the
retained Oct15 publication above.

## Remaining acceptance checklist

| Required closeout | Current state / evidence to retain |
| --- | --- |
| Final source and inventory | P5 merged as `3d8e417`; ordinary protected-main integration into P6 completed at `1f6499c86db01169f005e73e3aff7fa03ad5baf7`, preserving seven local follow-ups. P6 primary-metric/fixed-toolbar repairs are committed at ea50; actual new native validation remains pending. Reconcile final inventories, including the +1 tap Saved calculation tradeoff. |
| Exact-head verification | e23 canonical passes on its own source. P6 ea50 full canonical failed: 373/374 suites and 4,266/4,267 Jest tests pass; 423 scripts and preceding local checks pass; exports/size not run. Corrected real-input suite passes 3 tests. Test-only follow-up, complete canonical rerun, required remote gates and review clearance remain pending. Earlier failed receipts are preserved. |
| Native matrix and invariants | Pending final-source rechecks: 360/411dp and normal/large fonts; light/dark, reduced motion, keyboard, gesture/button Back, rapid/interrupted interactions, loading/empty/cached/offline/error and permission states. Preserve exact tier/metrics/unknowns/fees/source dates, 48dp visible targets, no horizontal scroll, state restoration, privacy and no explanatory prose. |
| Dense-row/word-bubble/font rechecks | Historical 753 establishes six centered rows and matching one-line loading. BB1 at 360dp/dark establishes 8dp Comparison/Advertised bubble gaps, hold-release/Back/outside dismissal, and actual Settings 1→2→1.5→1 without blank/query/exact-Saved loss; glyphs/footer labels shrink correctly. Remaining corners, other metric/tier/status semantics, direct checkbox and Save/History coverage remain required. Earlier failures remain retained, not reclassified. |
| Saved/sheet rechecks | e23 at 411dp/font1/light establishes three one-line Saved rows, exact Saved→Product→Calculate/Back, one-word Alerts hold/Back, and a fully visible 48dp Show 9 footer above the native navbar. The Saved calculation path is +1 tap. These bounded trials do not close the full matrix or effort gate. |
| TalkBack | Pending final-row generated announcements/traversal/actions, with actual service/TTS identity. Earlier focused Save/Remove/History observations are scoped to their source. XML is supporting semantics, not a generated utterance or physical audio proof. Ordinary UIAutomator capture is not used during continuous TalkBack traversal. |
| Finalized real-readiness audit | e23 / Oct16 data / `pa-mv9oxrqq-74092b217d1a844f` finalized with all IDs stored, 0 hard overruns and journey340/352/completefalse; 164 raw failures, 12 skips and 1 raw health unavailable remain. Full healthy rendered acceptance is not established. Final P6 source still needs its own audit; no budget or coverage exemptions. |
| Paired native P95 | Not run; no accepted pair or prospective registration. Actual full-live-Core equivalence readback remains missing; cache/source/target inference is insufficient. After both known public APKs/common actual dataset, freeze 40 linked Save/Unsave taps (separate DOWN-feedback and UP-activation) and 40 alternating swipes (deterministic first original MOVE after settled DOWN). Preserve all attempts, missing/ambiguous/drop observations, exact native ns joins and separate semantic endpoints. At least 30 unique qualifying gestures per cohort, no pooling, later-MOVE substitution, cherry picking or retries; unavailable required evidence remains a gap. |
| Public artifact delivery | Pending: freeze both rolling manifests, verify their source/version/ABIs/signing/hash/size against actual immutable universal/ARM APK bytes, and read back the published install/QR links. No final public source/APK identity is assigned here. |
| Public-byte native acceptance | Pending: fresh installation/readback/pulled-byte proof and acceptance for each compatible final public APK/runtime. x86_64 does not establish ARM runtime. |
| Installer template | Local commit `13d0d4a`, 9 focused tests passed and 4 actual Chrome images reviewed. Final published universal/ARM page/QR/download/manifest verification remains pending. |
| People and physical scope | Representative-person study not run; physical audio/haptics/ARM-device acceptance not run. Report scope explicitly. |
| Final evidence verification/reviewer | Pending: portable artifact inventory, trusted independent identity inputs, real checker output, actual capture/trace/operator review and unresolved-gap disposition. Synthetic tests are excluded. |

## Retained evidence index

IDs identify originals in the external review bundle. SHA-256 values below
were read from retained receipts or computed from those unchanged files for
this report. This index is selective; each referenced journal/receipt retains
its complete underlying artifacts. It is not a fabricated acceptance inventory.

| ID | Logical external evidence ID | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| C1 | `phase5-1f88577-canonical-verification-receipt.json` | 1,760 | `6359d94bdb6f869579a7c573b32655814cd76f29dea9336c07ff51436931a37b` |
| C2 | `phase6-preparation/evidence-report-status-20261015T122438735Z/phase5-current-phase-report.snapshot.md` | 12,696 | `de9e71d74f4884d90b941eb9cffb8a985cdb85b82b3821343da5fe6e5dd3c366` |
| C3 | `phase5-1f88577-validation/metadata.json` | 580 | `98991c31214122a757ebe97356c695030350701bc7ac35092a4eadf480fbbcca` |
| C4 | `phase5-1f88577-validation/secondary-installed-receipt.json` | 346 | `4669930d53ae88a143ebb93fcde48ed9e22e2e6ff757f3abec254c8cc830fe50` |
| C5 | `phase5-9420975-canonical-verification-receipt.json` | 1,760 | `98f78cc6f1045b24c626089047cf477147c6048e1504319eebd1d3d20afae2a9` |
| C6 | `phase5-753f0f5-canonical-verification-receipt.json` | 1,760 | `60a7746510d77940709b67e7497c44709ec1ff71b0133d39632b8ebb9ac1df5d` |
| C7 | `phase5-753f0f5-validation/metadata.json` | 580 | `bada9fbc70f3ca04a278e1d6b7cc6b28ad32c34ef459da12e3015d6fa9821d9a` |
| C8 | `phase5-753f0f5-validation/secondary-installed-receipt.json` | 346 | `0064072ce7c23bd28626c65aa2bf44488edee1f1db1c0a3b18204a179913c6b1` |
| C9 | `phase5-bb1fb43-canonical-verification-receipt.json` | 1,760 | `ca7da0f8fa9312670204da92e1fad5a5de233bf1c579a79331b4da2fe5bc0b02` |
| C10 | `phase5-bb1fb43-validation/metadata.json` | 580 | `1b562236e4b8a522f0e6d4e7a8bd019b0728af3a69d0174614069ce08ab1570b` |
| C11 | `phase5-bb1fb43-validation/secondary-installed-receipt.json` | 418 | `24276726d65f1621f4fe2eb250ba4bae3b1ff9c24adf144d083ba6a90256621d` |
| C12 | `phase5-e23a389-canonical-verification-receipt.json` | 1,901 | `6946c780489dc368bf4af2cf5cc357d663a3bae29745433f77f0be3755eade13` |
| C13 | `phase5-e23a389-validation/local-identity-receipt.json` | 570 | `e25b47bafb7c61e3944bbda4fbb5faf758e906db9df966e6ce70d6a64c42ca7a` (recorded by N13) |
| C14 | `phase5-e23a389-validation/secondary-installed-receipt.json` | 276 | `af7088d356e77b1cc848c2fa1ca557bde6965d1f3b1d5150ac9ae230c6c2f5ef` (recorded by N13) |
| C15 | `phase6-preparation/compact-primary-priority-focused-20261015-3.log` | 4,118 | `613d709086c9dd843b7d752d08bbf6d429051a7d33d7b3ecf9f63c3cd7860927` |
| C16 | `phase6-preparation/p6-fixed-controls-focused.txt` | 4,096 | `fdee039fc7cffdbd61b0e00506854caca5b5b0d0d81990bc16232ff486513ff0` |
| C17 | `phase6-preparation/p6-native-evidence-installer-focused.txt` | 4,569 | `e70adceb32d32301bee8c8d533a7503a0cd2dc8e4805087bfeca2e9884e392a5` |
| C18 | `phase6-preparation/p6-review-repairs-scoped-lint.txt` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| C19 | `isolated-phase6-ea50f04/20261016-024357-77075c7f/result.json` | 881 | `3246d357c2f0dd815c4877c6a0335e3e0ee6f817d6198971a3c3a93756271dec` |
| C20 | `isolated-phase6-ea50f04/20261016-024357-77075c7f/stdout.log` | 42,237 | `a85d04c56d40dfc72515896168bc8aa066aa68697e97c1181cd531bc9c2b099a` |
| C21 | `isolated-phase6-ea50f04/20261016-024357-77075c7f/stderr.log` | 18,932 | `02ddcf4e9496a9004acc6b6f0cfe308dd13fedfca4f2dc274429c3afb9e829ae` |
| C22 | `phase6-ea50f04-canonical-verification-receipt.json` | 1,938 | `40055b4c8cfa0d01c6661bfc4d632bac4b9d0cc5ab18ef7ff5f2d12112f8eca5` |
| C23 | `phase6-preparation/p6-real-input-fixed-controls-focused.txt` | 683 | `aa013dd069bda32cdb44e4bf36621184c913c5595864f82601ebfe35b69aad46` |
| N1 | `journeys/phase5-1f88577-release-360-font1-dark-dense-arrival/dense-arrival.png` | 191,902 | `32c21f38ec0d37a160bd7afbfdf52fcdb8532154a03a1131360a53773a4efd9e` |
| N2 | `journeys/phase5-1f88577-release-360-font2-reduced-dense-arrival/dense-font2-settled.png` | 209,265 | `5a97b5cf2a27176d98176ae7290865e88f5bd49a2efa13ae56b707576e5207e3` |
| N3 | `journeys/phase5-1f88577-release-360-font2-reduced-dense-arrival/events.jsonl` | 1,545 | `5bad4dfb7800115b40717415ccd1a106a160e48aa9bcaf7317772992a0d21d30` |
| N4 | `journeys/phase5-1f88577-release-360-font1-dark-native-selection/filter-bubble.png` | 199,514 | `628f1c8685eaf160cbdeaaed8e256caa5c7a23479981429f9b7bbc8f2cc56f8d` |
| N5 | `journeys/phase5-1f88577-release-360-font1-dark-compare-checkbox-dock/comparison-open.png` | 172,944 | `30935885e6acc76064d9a102e594e9025ebdeca1316a77afe419485c89b17b19` |
| N6 | `journeys/phase5-1f88577-release-360-font1-dark-compare-checkbox-dock/summary.json` | 944 | `97a130fb974ab4d5ff13d2bdd1625212298e3c573227b7cc88a825869b4227f8` |
| N7 | `journeys/phase5-1f88577-release-360-font1-dark-compare-checkbox-dock/events.jsonl` | 4,601 | `4a0b1bcd3340cb28918704558635012d2405247ddeb132b517568dbcac4a30ef` |
| N8 | `journeys/phase5-1f88577-release-360-font1-dark-cold-recovery-query/summary.json` | 690 | `862306f8bc054844ff82b4d8c95d525c82edc71abbb8700a795ddce7a4cb2e1e` |
| N9 | `phase5-preparation/phase5-753f0f5-native-repair-observation.json` | 7,557 | `30783a3c9b015f71c7e02a998bc4867c120e95789fe9726867bea1623e798823` |
| N10 | `journeys/phase5-bb1fb43-release-360-font1-dark-bubble-and-font-repairs/events.jsonl` | 14,602 | `dce7da31b1c43732b029f9286a86175dd1f1f99afa0ed6bc22b3a313236e8bf4` |
| N11 | `journeys/phase5-bb1fb43-release-360-font1-dark-bubble-and-font-repairs/summary.json` | 579 | `af57ab8913382b83e1517bf9ce0ef86432582d790f8c8ae6540a4a20ca7534a6` |
| N12 | `journeys/phase5-bb1fb43-release-360-font1-dark-bubble-and-font-repairs/font-glyph-observation.json` | 1,270 | `8449c5ff1434ba7f88491f88de0be375521ee44942e70f7d08f86301435e6d79` |
| N13 | `phase5-preparation/phase5-e23a389-native-saved-sheet-observation.json` | 38,690 | `48963c78deaae66d05356c9bff4e2fb7cb13b02e682f87d81a59d95371c9cf20` |
| J1 | `phase5-preparation/phase5-matched-friction-ledger-draft.md` | 8,043 | `eb391b916715b2aee572193903f46872c3ed099f1ee353e9062327d19e50d146` |
| J2 | `baseline-supplemental-canonical-map-final.json` | 86,085 | `222f1b7e4a43e9499eaaf80884167305cf82ee9c14aea0b63f92b1764f462dcc` |
| A1 | `phase5-5496c48-final-audit-comparison.json` | 275,851 | `e28d4f09b033fe5ece6fc663a727102e519f5695d53c41abc35fcc501e616a61` |
| A2 | `phase5-5496c48-live-audit-snapshots/20261015T111237919Z/logs/ar-performance-audit-latest.json` | 2,907,122 | `6e890ef9c74cdd67c58d953cb0bcea255ec9d7641434834c2486350de9c09cf6` |
| A3 | `phase5-5496c48-live-audit-snapshots/20261015T111237919Z/logs/ar-local.log` | 2,085,440 | `f12e9caf247a0607e13bcbd71ca879d502d542f9f7fbc05659403d28ddaeaf91` |
| A4 | `phase5-5496c48-network-policy-and-helper-offline-review.json` | 5,414 | `6df66b09c22c511382035e9be1924f572cc3d5a8e27c2f19f04381f981eb629d` |
| A5 | `phase5-e23a389-live-audit-snapshots/20261015T154046271Z/finalized-audit-analysis.json` | 128,030 | `c8c486659200e315ca4caca8da2df7107815b97c6ebabc5f34eed6adc634f8ab` |
| A6 | `phase5-e23a389-live-audit-snapshots/20261015T154046271Z/targeted-findings.json` | 8,666 | `4887a97df22c85e69ce2d69a02aaecb5bf8567922f7e22a9bd590cfba9761b0d` |
| A7 | `phase5-e23a389-live-audit-snapshots/20261015T154046271Z/logs/ar-performance-audit-latest.json` | 3,126,800 | `27159cc203ba216769efbf50486eed34831dc324279bb4f518d74fb591616216` |
| A8 | `phase5-e23a389-live-audit-snapshots/20261015T154046271Z/logs/ar-local.log` | 1,676,429 | `15615e2fd8ea48949d48b1808f3b0dca537c98945b484040e6eb7813051d3b04` |
| A9 | `phase5-e23a389-live-audit-snapshots/20261015T154046271Z/native-journey-terminal-time-clarification.json` | 523 | `7431ea7cb55d54aaa0cb11cb866406b6473b621b3b50ef56df2fd5f82496b987` |
| D1 | `phase6-preparation/common-publication-2026-10-15-r000001-derived/recovery-receipt.json` | 5,191 | `b7c476c35d83f32126cc834cf8da1e50873817511f464019b6d0f1368f615594` |
| I1 | `phase6-preparation/installer-preview-20261016/preview-receipt.json` | 2,178 | `57d886bdee396d33f1f19aaea69cd7f8a1836d6f7a47b73edd19ce4d938ef677` |
| I2 | `phase6-preparation/installer-preview-20261016/chrome-visual-review.json` | 1,425 | `f1c42d7b8945139ae0635439801bf3ecdeb886b5252a24912bb4f50ff2609b99` |

Report scope: source/evidence reconciliation and explicitly bounded historical
native/browser observations only. No complete native, timing, public-delivery,
human-study or physical-device acceptance is declared by this file.
