# #0016 Home tab sync/waiting freezes JS thread so tabs and Settings cannot be opened; sync progress falsely hits 100% on parse json manifest.json; waiting animation appears static

- 2026-07-28T02:44:07Z `issue`: Home tab sync/waiting freezes JS thread so tabs and Settings cannot be opened; sync progress falsely hits 100% on parse json manifest.json; waiting animation appears static [mobile/app/(tabs)/index.tsx]
- 2026-07-28T03:13:56Z `attempt`: Shipped in PR #42: yieldToUi/parseJsonHeavy, honest progress phases, native waiting animations [mobile/src/lib/yieldToUi.ts] (worked)
- 2026-07-28T03:13:56Z `fix`: Sync progress stays accurate through finalize/parse/install with phaseComplete and native soft-motion [mobile/src/data/downloadProgress.ts]
