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
   raw traces and study report. A complete JSON record alone cannot establish
   interaction quality, human usability or the truth of an assessor's claims.
6. Once publication is authorised, verify the public universal/ARM APK pair,
   rolling manifests, SHA-256, bytes, signing identity, version/build, ABI and
   release source with the existing public-delivery tooling. Fresh-install the
   downloaded exact bytes and repeat native acceptance. Record each APK's own
   acceptance file; an x86_64 universal-APK emulator run cannot establish ARM
   runtime acceptance. Keep physical haptics/device acceptance separately
   labelled if not run. Do not infer public delivery from merge or local build.

## Portable evidence check

No new dependencies, Android commands, network requests, uploads or file writes
are performed by the checker. Tests run in the existing Node script toolchain:

```sh
cd mobile
node --test scripts/verify-android-redesign-evidence.test.mjs
node scripts/verify-android-redesign-evidence.mjs /path/to/evidence.json --source-sha SOURCE_SHA --apk-sha256 APK_SHA256 --package-name PACKAGE --version-name VERSION --version-code BUILD --abis arm64-v8a,x86_64
```

Use the actual ABI list reported by the specific APK, not the example list.
Supply trusted identity flags from independently verified build/publication
metadata, not by reading them back from the evidence JSON. Exit 0 means that
the **record is complete**, required recorded outcomes pass, artifact bytes
match their hashes, and actual aapt/installed-package logs match that trusted
identity. Exit 1 means incomplete or inconsistent evidence. Missing, skipped,
unavailable, failed and non-rendered results must stay honest and fail complete
acceptance; do not edit them into passes.

The checker cannot authenticate captures or people, read screenshots, judge
animation quality, verify public URLs, or prove that statements in logs and
reports are true. Script-test fixtures are explicitly synthetic and are never
release evidence. Retain original captures and raw measurements for review.

## Evidence JSON contract (schemaVersion 1)

Keep the record and referenced files together. `artifacts` is an array of
`{id, kind, path, bytes, sha256}`; kinds are `apk`, `screenshot`, `recording`,
`log` and `report`. Paths are relative to the record directory; traversal,
absolute paths and symlinks escaping it fail. Files must exist, be nonempty and
match their SHA-256/size. A capture may document multiple journeys, but each
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
| `frontendTiming` | `result`, `captureRefs`, `method: "android-frame-trace"`, `frameCount`, `droppedFrameCount`, measured `inputLatencyP95Ms` |
| `usability` | `result`, `captureRefs`, `participantCount` from 5–8, `unassistedCoreTasks: true`, `criticalFinancialMisunderstandings: 0`, `coreJourneyRegressions: 0` |

Every outcome entry uses `result: "pass"` and `captureRefs: [artifact IDs]`
only after genuine verification. `copyGuard` requires its command log;
`nativeReview` and journeys require screenshot, recording and log references;
invariants require report and screenshot references; cases require screenshot
and Android log references. Usability requires its anonymised assessor report,
not an emulator-script success flag. Do not collect participant identities in
the manifest or publish private financial/tester information.

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
| `filter`, `sort` | `openTaps: 1`, `sheetDepth: 1`, `applyCommits: 1`, `cancelRestoredState: true` |
| `compare-two` | `selectedRates: 2`, at most 4 total taps |
| `market-arrival` | `directoryTaps: 0`; dated useful market content on arrival |
| `return-from-product`, `switch-tabs` | `statePreserved: true`; prove query/type/filter/sort/list position and correct stack |

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

## Final evidence ledger

Report these states independently: local script checks; canonical local CI;
exact-head GitHub gates; merged source; build identity; emulator acceptance;
human study; public APK/manifest verification; exact published-byte reinstall;
physical device/haptics. Keep incomplete states explicit. The draft harness
alone completes none of the redesign's native, human or release gates.
