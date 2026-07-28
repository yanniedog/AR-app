# projectmem - AR-app

_Last updated: 2026-07-28_

## Project purpose
AR-app is the installable Australian Rates mobile client. It presents Australian
consumer banking rates from daily CDR payloads, works offline from a local cache,
and owns Android preview APK build and release automation. The upstream AR-local
repository owns payload publication, ingest, the Pi, and the web dashboard.

## Recent issues
- [DONE] #0018 Home waiting-for-ingest IndeterminateProgressBar/LoadingRows animation appears static during filter prep [mobile/src/components/feedback.tsx] -> Home sync stays responsive: yield before heavy parse, honest progress phases (finalize/install), native waiting animations; tabs/Settings remain usable during sync [mobile/src/lib/yieldToUi.ts] (fixed)
  - Partial attempt: Root cause: fetchManifest emits parse@100% for manifest.json then resolveFinalizedManifest/cache work leaves that snapshot visible while JSON.parse of multi-MB payloads freezes the JS thread (tabs/Settings unresponsive); IndeterminateProgressBar uses Reanimated that stalls when JS is blocked [mobile/src/data/payload.ts]
- [DONE] #0017 Sync progress bar sits at 100% during parse/inflate of large payloads and after manifest parse while cache re-read continues without progress updates [mobile/src/data/downloadProgress.ts] -> Home navigation stays responsive during sync via yields before heavy parse and deferred post-refresh work [mobile/src/lib/yieldToUi.ts] (fixed)
- [DONE] #0016 Home tab sync/waiting freezes JS thread so tabs and Settings cannot be opened; sync progress falsely hits 100% on parse json manifest.json; waiting animation appears static [mobile/app/(tabs)/index.tsx] -> Sync progress stays accurate through finalize/parse/install with phaseComplete and native soft-motion [mobile/src/data/downloadProgress.ts] (fixed)
- [DONE] #0015 App updates download only while user is in Settings and stop when backgrounded/screen off; need automatic background APK download then install-from-cache on upgrade prompt [mobile/src/lib/appUpdate.ts] -> App updates now auto-download in the background via DownloadManager and Upgrade installs the cached APK; verified with typecheck + focused Jest suites [mobile/src/lib/appUpdateDownload.ts] (fixed)
- [DONE] #0014 APK publishing increments Android versionCode/build_number but can reuse the same expo.version and app-v tag, so separate APK releases are not uniquely iterated in the visible version. [mobile/scripts/bump-android-version-code.mjs] -> APK release automation now advances the visible patch version from the rolling manifest, preserves higher intentional version floors, increments Android versionCode, and serializes GHA/EAS publishers. PR #28 exact head passed app-ci. [mobile/scripts/bump-android-version-code.mjs] (fixed)
- [DONE] #0013 PR #26 review found some standard-only consumers still bypass the fail-closed suitability gate or omit the gate revision from memo dependencies (Trends history and shared search/subscription filtering). [mobile/app/(tabs)/trends.tsx] -> All shared standard-only filtering paths now honor the rebuilt suitability gate, and React consumers rerender on gate revisions; commit 6de65bc adds regression tests. [mobile/src/data/selectors.ts] (fixed)
- [DONE] #0012 PR #26 review found suitability gate change detection relied on mutable Set reference identity, so same-reference content changes could leave subscribers stale. [mobile/src/data/suitabilityGate.ts:22] -> Suitability gate now compares against an internal Set snapshot, preserves its identity contract, and notifies listeners after same-reference mutations; commit 72e6c00 verified by all 552 tests. [mobile/src/data/suitabilityGate.ts] (fixed)
  - Partial attempt: Content comparison plus Set cloning passed the targeted regression and typecheck, but full Jest exposed two established identity-contract assertions in suitabilityIndex.test.ts.
- [DONE] #0011 The release version bump script could not write app.json in the linked C:\tmp worktree (EPERM). [C:\tmp\ar-app-response-release\mobile\app.json] -> The clean app-fix branch now includes the explicit v1.0.43 release metadata commit. [C:\tmp\ar-app-response-release\mobile\app.json] (fixed)
- [DONE] #0010 Cherry-pick into clean linked worktree could not create the Git sequencer directory because sandboxed Git metadata access was denied. [.git/worktrees/ar-app-response-release/sequencer] -> The clean release worktree now contains only the two app-fix commits on origin/main. [C:\tmp\ar-app-response-release] (fixed)
- [DONE] #0009 Git staging failed because .git/index.lock could not be created (permission denied). [.git/index.lock] -> Scoped single-command staging succeeded and commit 7bc838b was created; no stale lock existed. [.git/index] (fixed)
- [DONE] #0008 APK workflow publishes releases but then fails because README fallback uses GITHUB_TOKEN while Actions PR creation is disabled. [.github/workflows/mobile-android-apk.yml] -> README publication recovered through PR #27; main now shows v1.0.43/build 156, and [skip ci] prevented a duplicate APK build. [README.md] (fixed)
- [DONE] #0007 Aligned Response lender cards visually show all three section values, but their explicit accessibility label announces only the active section. [mobile/src/components/passthrough/PassThroughDashboard.tsx] -> Response lender cards now announce Home loans, Savings, and Term deposits values and timing through a tested full accessibility label. [mobile/src/components/passthrough/PassThroughDashboard.tsx] (fixed)
  - Partial attempt: Expanded each lender card's accessibility label to announce Home loans, Savings, and Term deposits values and timing, including no-series states. [mobile/src/components/passthrough/PassThroughDashboard.tsx]
- [DONE] #0006 Overlapping 32px SVG hit circles can select the wrong dense response point, and 18-character labels can fail to identify the lender uniquely. [mobile/src/components/passthrough/ResponseScatter.tsx] -> Dense response clusters now select the nearest lender and cycle repeated taps, while the selected lender is shown in a full untruncated callout. [mobile/src/components/passthrough/ResponseScatter.tsx] (fixed)
  - Partial attempt: Replaced per-point overlapping hit circles with chart-level nearest-point selection that cycles dense candidates, and moved the full selected provider name into an untruncated live callout. [mobile/src/components/passthrough/ResponseScatter.tsx]
- [DONE] #0005 Reactive suitability dependencies trigger new exhaustive-deps warnings because the memo bodies do not explicitly read the revision token. [mobile/app/(tabs)/index.tsx] -> Gate-backed memos now explicitly consume the suitability revision without adding lint warnings. [mobile/app/(tabs)/index.tsx] (fixed)
  - Partial attempt: Made each gate-backed memo explicitly consume the revision token so exhaustive-deps recognizes the intentional invalidation dependency. [mobile/app/(tabs)/index.tsx]
- [OPEN] #0004 Required mobile CI cannot complete in the managed sandbox because Expo Doctor requires outbound Expo API access and the escalation was rejected. [mobile/package.json#scripts.ci] (open)
  - Failed attempt: Ran npm run ci; Expo Doctor stopped at 16/18 checks because its config-schema and React Native Directory validations could not reach the Expo API (EACCES), and network escalation was rejected. [mobile/package.json#scripts.doctor]
  - Partial attempt: Completed the safer local CI stages individually: typecheck, lint (0 errors), 8 script tests, all 550 Jest tests, and Android/iOS/web export passed; only Expo Doctor's two online checks remain blocked. [mobile/package.json#scripts.ci]
- [DONE] #0003 Installing the post-ingest suitability gate does not notify React/Zustand consumers, leaving the initially rendered section on stale all-product derivations until navigation changes state. [mobile/src/data/suitabilityGate.ts] -> Post-ingest suitability gate changes now invalidate mounted product derivations and Browse caches immediately, so standard-only filtering no longer waits for a section switch. [mobile/src/data/suitabilityGate.ts] (fixed)
  - Partial attempt: Added a reactive suitability-gate revision and subscribed every mounted surface that caches or directly renders gate-backed product derivations, including Browse, Home, Banks, Trends, and onboarding. [mobile/src/data/suitabilityGate.ts]
- [DONE] #0002 Response bank cards promote the selected category above the others, preventing Home loans, Savings, and TD from forming equal aligned columns. [mobile/src/components/passthrough/PassThroughDashboard.tsx] -> Every lender card now uses equal, consistently ordered Home loans, Savings, and Term deposits columns. [mobile/src/components/passthrough/PassThroughDashboard.tsx] (fixed)
  - Partial attempt: Replaced the selected-first stacked bank metrics with fixed SECTION_ORDER columns, equal flex widths, shared heights, and a subtle selected-category highlight. [mobile/src/components/passthrough/PassThroughDashboard.tsx]
- [DONE] #0001 Response chart points are visual-only, so tapping a plotted lender cannot reveal its bank name. [mobile/src/components/passthrough/ResponseScatter.tsx] -> Response scatter points now expose a 32px touch target and select/toggle the lender label when tapped. [mobile/src/components/passthrough/ResponseScatter.tsx] (fixed)
  - Partial attempt: Added 32px SVG touch targets and provider-selection callback so tapping a response point toggles its lender label; verification pending. [mobile/src/components/passthrough/ResponseScatter.tsx]

## Decisions
- Use Expo SDK 54, React Native, TypeScript, and Expo Router for the installable mobile app; keep route code under mobile/app. [mobile/]
- Use a Zustand store with AsyncStorage persistence; bootstrap from a validated local cache or bundled sample, then refresh from the AR-local daily release payload. [mobile/src/data/]
- Keep ingest, Pi, dashboard, and payload publication in yanniedog/AR-local; AR-app owns only the installable client and APK release automation. [README.md]
- Suitability filtering remains an O(1) module-level gate, but gate replacements publish a revision through useSyncExternalStore so mounted memoized product surfaces invalidate immediately after ingest. [mobile/src/data/suitabilityGate.ts]
- Version v1.0.43 was included directly in the isolated app-fix PR because the unrelated open PR #25 prevents queue-drain auto-bumping; this avoided merging unrelated work and avoided a later double bump. [mobile/app.json]
- Use Expo SDK 54, React Native, TypeScript, and Expo Router for the installable mobile app; keep route code under mobile/app. [mobile/]
- APK updates auto-download via Android DownloadManager (@kesha-antonov/react-native-background-downloader) so transfers continue with screen off / app backgrounded; Upgrade prompt installs the cached APK [mobile/src/lib/appUpdateDownload.ts]

## Notes
- Node.js 24 is the supported local and Codex Cloud runtime; validate mobile changes with cd mobile && npm run ci. [mobile/package.json]
- Background APK updates need a native rebuild (EAS/dev client) after adding @kesha-antonov/react-native-background-downloader config plugin; Expo Go cannot run the DownloadManager module [mobile/app.json]

## Key files
- `Node.js`
- `.git/index.lock`
- `index.lock`
- `app.json`
- `v1.0.43`
- `suitabilityIndex.test.ts`
- `chore/readme-apk-qr-v1.0.43`
- `expo.version`
- `manifest.json`
- `JSON.parse`

## Open questions
- None logged yet.
