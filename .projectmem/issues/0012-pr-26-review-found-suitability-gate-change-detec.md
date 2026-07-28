# #0012 PR #26 review found suitability gate change detection relied on mutable Set reference identity, so same-reference content changes could leave subscribers stale.

- 2026-07-23T10:43:27Z `issue`: PR #26 review found suitability gate change detection relied on mutable Set reference identity, so same-reference content changes could leave subscribers stale. [mobile/src/data/suitabilityGate.ts:22]
- 2026-07-23T10:45:21Z `attempt`: Content comparison plus Set cloning passed the targeted regression and typecheck, but full Jest exposed two established identity-contract assertions in suitabilityIndex.test.ts. (partial)
- 2026-07-23T10:46:24Z `attempt`: Preserved the established Set identity contract while comparing against an internal content snapshot; 62 suites / 552 tests, typecheck, and lint (0 errors) passed. (worked)
- 2026-07-23T10:47:01Z `fix`: Suitability gate now compares against an internal Set snapshot, preserves its identity contract, and notifies listeners after same-reference mutations; commit 72e6c00 verified by all 552 tests. [mobile/src/data/suitabilityGate.ts]
