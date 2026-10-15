# Android redesign evidence status report

**Snapshot: 16 October 2026 (Australia/Hobart). Final acceptance is pending.** Phases 1–4 have
merged. Phase 5 has passed exact-source canonical checks and produced a
premerge emulator release artifact; its latest native observations expose
remaining bubble-position and footer font-shrink defects. Phase 6 is a separate
draft, awaiting source integration, final native evidence and public-release
verification. The later host/footer repair batch is committed at
`5ccd8b839bd22e2159b7769aa788b437f4ee688f`; its full checks and native review
are pending, so it is not accepted.

This report accompanies [the contract](ANDROID_REDESIGN_CONTRACT.md) and
[acceptance requirements](ANDROID_REDESIGN_ACCEPTANCE.md). The contract file
arrives with protected-main integration. Evidence IDs below are logical paths
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
| Phase 5 — validation and dense rows, PR [405](https://github.com/yanniedog/AR-app/pull/405) | Draft/premerge; latest reviewed canonical/native source `753f0f500be43cacac3e4d1b39450707779ca24d`; native hold | Six centered rows, matching loading geometry and actual Settings font growth/shrink without a blank are observed. Bubble gap and clipped footer labels remain native failures. Later repairs are not yet accepted. |
| Phase 6 — acceptance harness/launch assets/installer, PR [397](https://github.com/yanniedog/AR-app/pull/397) | Draft; local follow-up work includes installer commit `13d0d4a`; no final-source acceptance | Integrate actual protected main after Phase 5. Nine installer tests and four reviewed Chrome images establish bounded template checks, not public or Android acceptance. |
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

The latest reviewed exact-`753f0f5` canonical receipt [C6] records completion on
16 October at 00:11:14 Australia/Hobart (15 October 13:11:14 UTC), exit 0,
mobile tree `11f409b27b89034e40655935a6d266aa251f0a87`: 372 Jest suites /
4,236 tests and 384 script tests passed. Doctor 18/18, types, lint (0 errors /
9 existing warnings), copy guard (0 violations), prepared pins, both history
benchmarks, all three exports, compiled-link/audit-awake and size checks passed.
The receipt binds the original complete result/stdout/stderr hashes. It does
not cover the subsequent host/footer repair batch, integrated Phase 6 or public
delivery. Host verification elapsed time is not application latency.

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

The later 753 release-validation artifact [C7–C8] is independently identified:

| Identity | 753 premerge validation artifact |
| --- | --- |
| Source / mobile tree | `753f0f500be43cacac3e4d1b39450707779ca24d` / `11f409b27b89034e40655935a6d266aa251f0a87` |
| APK bytes / SHA-256 | 32,844,346 / `a0bf14cdc5bd96e7995f7e23aaf927f4f38ad0cbeae5e0a8a1d42cd0161057ab` |
| Package / version / build / ABI | `com.eyex.australianrates` / 1.0.238 / 192 / x86_64 |
| Build / signing scope | Release variant, workflow run `38739602437`; certificate `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; production signing identity not verified |
| Installed-stage binding | Matching installed APK bytes/hash on task AOSP `emulator-5582`, 15 October 13:21:38 UTC; not final public-byte acceptance |

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

Two actual 753 native defects remain: the bubble bright region at y779–894
against row-main top984 leaves approximately 30dp gap, and footer labels remain
font2-sized/clipped after returning to confirmed font1 while row text shrinks.
The subsequent host/bubble and footer repairs are in progress; focused source
checks do not establish their native result. The curated journal is finalized
as `partial-failed-native-layout`, with no complete friction census, whole-matrix
pass or native timing percentile.

The preserved b945 matched ledger [J1–J2] covers the twelve agreed journeys
and 96 comparison cells against the original baseline: arrival, family,
product, save, search, filter, quick sort, Compare, contextual Calculate entry,
Market, product Back and tab/state restoration. It retains separate Filter
Cancel and advanced Sort selection/Cancel/Back observations. Calculate is exact
selected-tier entry with blank fields, not a completed financial outcome.
Those records keep their original source; they do not automatically cover
the 1f dense rows, subsequent `9420975` refinements or 753/host/footer work.

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

## Remaining acceptance checklist

| Required closeout | Current state / evidence to retain |
| --- | --- |
| Final source and inventory | Pending: finish the host/bubble and footer repair batch following actual 753 failures, obtain its native clearance, finish Phase 5 review, then integrate actual protected main into the existing Phase 6 branch without rewriting pushed history. Reconcile capability/route/copy/friction inventories. |
| Exact-head verification | Pending for integrated final head: complete canonical output, required remote gates and all substantive feedback dispositions/resolutions. 753 canonical 372 suites / 4,236 Jest tests and 384 script tests remain exact-753 proof. |
| Native matrix and invariants | Pending final-source rechecks: 360/411dp and normal/large fonts; light/dark, reduced motion, keyboard, gesture/button Back, rapid/interrupted interactions, loading/empty/cached/offline/error and permission states. Preserve exact tier/metrics/unknowns/fees/source dates, 48dp visible targets, no horizontal scroll, state restoration, privacy and no explanatory prose. |
| Dense-row/word-bubble/font rechecks | 753 establishes six centered rows, matching one-line loading and a native Settings font roundtrip without blank/query/Saved loss. Bubble position and footer-label shrink failed. Pending: actual repaired APK at required corners, final metric/tier semantics, hold suppression/dismissal/Back/focus, direct checkbox and Save/History. Earlier blank failures remain retained, not reclassified. |
| TalkBack | Pending final-row generated announcements/traversal/actions, with actual service/TTS identity. Earlier focused Save/Remove/History observations are scoped to their source. XML is supporting semantics, not a generated utterance or physical audio proof. Ordinary UIAutomator capture is not used during continuous TalkBack traversal. |
| Finalized real-readiness audit | Pending: final APK/source/dataset/session, full planned inventory once, durable END/stored evidence, all required useful rendered endpoints within 10,000ms. Retain failures/skips/unavailable, including unresolved external-source conditions; no budget or coverage exemptions. |
| Paired native P95 | Not run; no accepted pair or prospective registration. After both known public APKs/common actual dataset, freeze 40 linked Save/Unsave taps (separate DOWN-feedback and UP-activation) and 40 alternating swipes (deterministic first original MOVE after settled DOWN). Preserve all attempts, missing/ambiguous/drop observations, exact native ns joins and separate semantic endpoints. At least 30 unique qualifying gestures per cohort, no pooling, later-MOVE substitution, cherry picking or retries; unavailable required evidence remains a gap. |
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
| N1 | `journeys/phase5-1f88577-release-360-font1-dark-dense-arrival/dense-arrival.png` | 191,902 | `32c21f38ec0d37a160bd7afbfdf52fcdb8532154a03a1131360a53773a4efd9e` |
| N2 | `journeys/phase5-1f88577-release-360-font2-reduced-dense-arrival/dense-font2-settled.png` | 209,265 | `5a97b5cf2a27176d98176ae7290865e88f5bd49a2efa13ae56b707576e5207e3` |
| N3 | `journeys/phase5-1f88577-release-360-font2-reduced-dense-arrival/events.jsonl` | 1,545 | `5bad4dfb7800115b40717415ccd1a106a160e48aa9bcaf7317772992a0d21d30` |
| N4 | `journeys/phase5-1f88577-release-360-font1-dark-native-selection/filter-bubble.png` | 199,514 | `628f1c8685eaf160cbdeaaed8e256caa5c7a23479981429f9b7bbc8f2cc56f8d` |
| N5 | `journeys/phase5-1f88577-release-360-font1-dark-compare-checkbox-dock/comparison-open.png` | 172,944 | `30935885e6acc76064d9a102e594e9025ebdeca1316a77afe419485c89b17b19` |
| N6 | `journeys/phase5-1f88577-release-360-font1-dark-compare-checkbox-dock/summary.json` | 944 | `97a130fb974ab4d5ff13d2bdd1625212298e3c573227b7cc88a825869b4227f8` |
| N7 | `journeys/phase5-1f88577-release-360-font1-dark-compare-checkbox-dock/events.jsonl` | 4,601 | `4a0b1bcd3340cb28918704558635012d2405247ddeb132b517568dbcac4a30ef` |
| N8 | `journeys/phase5-1f88577-release-360-font1-dark-cold-recovery-query/summary.json` | 690 | `862306f8bc054844ff82b4d8c95d525c82edc71abbb8700a795ddce7a4cb2e1e` |
| N9 | `phase5-preparation/phase5-753f0f5-native-repair-observation.json` | 7,557 | `30783a3c9b015f71c7e02a998bc4867c120e95789fe9726867bea1623e798823` |
| J1 | `phase5-preparation/phase5-matched-friction-ledger-draft.md` | 8,043 | `eb391b916715b2aee572193903f46872c3ed099f1ee353e9062327d19e50d146` |
| J2 | `baseline-supplemental-canonical-map-final.json` | 86,085 | `222f1b7e4a43e9499eaaf80884167305cf82ee9c14aea0b63f92b1764f462dcc` |
| A1 | `phase5-5496c48-final-audit-comparison.json` | 275,851 | `e28d4f09b033fe5ece6fc663a727102e519f5695d53c41abc35fcc501e616a61` |
| A2 | `phase5-5496c48-live-audit-snapshots/20261015T111237919Z/logs/ar-performance-audit-latest.json` | 2,907,122 | `6e890ef9c74cdd67c58d953cb0bcea255ec9d7641434834c2486350de9c09cf6` |
| A3 | `phase5-5496c48-live-audit-snapshots/20261015T111237919Z/logs/ar-local.log` | 2,085,440 | `f12e9caf247a0607e13bcbd71ca879d502d542f9f7fbc05659403d28ddaeaf91` |
| A4 | `phase5-5496c48-network-policy-and-helper-offline-review.json` | 5,414 | `6df66b09c22c511382035e9be1924f572cc3d5a8e27c2f19f04381f981eb629d` |
| D1 | `phase6-preparation/common-publication-2026-10-15-r000001-derived/recovery-receipt.json` | 5,191 | `b7c476c35d83f32126cc834cf8da1e50873817511f464019b6d0f1368f615594` |
| I1 | `phase6-preparation/installer-preview-20261016/preview-receipt.json` | 2,178 | `57d886bdee396d33f1f19aaea69cd7f8a1836d6f7a47b73edd19ce4d938ef677` |
| I2 | `phase6-preparation/installer-preview-20261016/chrome-visual-review.json` | 1,425 | `f1c42d7b8945139ae0635439801bf3ecdeb886b5252a24912bb4f50ff2609b99` |

Report scope: source/evidence reconciliation and explicitly bounded historical
native/browser observations only. No complete native, timing, public-delivery,
human-study or physical-device acceptance is declared by this file.
