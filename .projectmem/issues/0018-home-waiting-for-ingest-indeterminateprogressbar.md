# #0018 Home waiting-for-ingest IndeterminateProgressBar/LoadingRows animation appears static during filter prep

- 2026-07-28T02:44:07Z `issue`: Home waiting-for-ingest IndeterminateProgressBar/LoadingRows animation appears static during filter prep [mobile/src/components/feedback.tsx]
- 2026-07-28T02:46:30Z `attempt`: Root cause: fetchManifest emits parse@100% for manifest.json then resolveFinalizedManifest/cache work leaves that snapshot visible while JSON.parse of multi-MB payloads freezes the JS thread (tabs/Settings unresponsive); IndeterminateProgressBar uses Reanimated that stalls when JS is blocked [mobile/src/data/payload.ts] (partial)
- 2026-07-28T03:13:34Z `fix`: Home sync stays responsive: yield before heavy parse, honest progress phases (finalize/install), native waiting animations; tabs/Settings remain usable during sync [mobile/src/lib/yieldToUi.ts]
