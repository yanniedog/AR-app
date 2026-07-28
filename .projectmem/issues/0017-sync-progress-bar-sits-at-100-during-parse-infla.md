# #0017 Sync progress bar sits at 100% during parse/inflate of large payloads and after manifest parse while cache re-read continues without progress updates

- 2026-07-28T02:44:07Z `issue`: Sync progress bar sits at 100% during parse/inflate of large payloads and after manifest parse while cache re-read continues without progress updates [mobile/src/data/downloadProgress.ts]
- 2026-07-28T03:13:56Z `fix`: Home navigation stays responsive during sync via yields before heavy parse and deferred post-refresh work [mobile/src/lib/yieldToUi.ts]
- 2026-07-28T03:13:56Z `attempt`: Shipped in PR #42: finalize/install phases, phaseComplete soft creep, no false 100% on manifest parse [mobile/src/data/downloadProgress.ts] (worked)
