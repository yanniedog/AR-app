# #0013 PR #26 review found some standard-only consumers still bypass the fail-closed suitability gate or omit the gate revision from memo dependencies (Trends history and shared search/subscription filtering).

- 2026-07-23T10:52:32Z `issue`: PR #26 review found some standard-only consumers still bypass the fail-closed suitability gate or omit the gate revision from memo dependencies (Trends history and shared search/subscription filtering). [mobile/app/(tabs)/trends.tsx]
- 2026-07-23T10:58:23Z `attempt`: Routed filterRows and history fallbacks through the shared suitability gate, subscribed Search/Trends/product-history consumers to gate revisions, and added fail-closed regression coverage; 62 suites / 554 tests, typecheck, and targeted lint passed. (worked)
- 2026-07-23T10:58:49Z `fix`: All shared standard-only filtering paths now honor the rebuilt suitability gate, and React consumers rerender on gate revisions; commit 6de65bc adds regression tests. [mobile/src/data/selectors.ts]
