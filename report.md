# App explorer: 1.0.352 (408)

**Real-use session ATTENTION vs 1.0.351: 0 broken, 9 friction, 0 slower**

- Friction: No reaction for 3.3 s after "scroll rates 1"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.3 s after "scroll lenders"
- Friction: No reaction for 3.7 s after "switch to savings"
- Friction: No reaction for 3.0 s after "open market"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: "No saved rates" shown on "open saved"

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode full | 80 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 12
Baseline 1.0.351
**Audit live: outcome completed | 954 s | audit log 853374 bytes (audit-log.txt) https://paste.c-net.org/8f77fa33-27fb-c30d-33be-fb667de4b102 | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2780 |  | 519/799 | 77 | 505 | 1 errors; start 2729ms |
| 2 | scroll rates 1 | 700 |  | 33/57 | 65 | 484 | boot js-start 404499, layout-mounted 405078, cache-read 405479, hydrated 405621, splash-hide 405621, manifest 406500, resolved 407055, core-fetched 410974, core-saved 411784, rows-prepared 412159, search-index-idle 412159, leading-requested 412159, details-start 412550, leading-scoped 412794, pricing-ready 417326, last-gate 418106, details-fetched 422113, detail-filters-idle 428220, last-pricing 428220, suitability-built 429370, post-refresh-wait 430140, leading-page 431261, last-rows 438103, rates-ready 438373, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 162, pricing-scope-ms 13796, leading-short 1, leading-short-rows 0, leading-scope-rows 113, leading-visible-rows 0, leading-nonstd-rows 10, filter-runs 3, filter-rows 38576, filter-yields 8, filter-ms 642, sort-runs 5, sort-rows 1182, sort-yields 5, sort-ms 133 |
| 3 | scroll rates 2 | 718 |  | 23/39 | 73 | 718 |  |
| 4 | scroll rates back | 673 |  |  |  | 561 |  |
| 5 | open product | 5062 |  | 36/59 | 85 | 651 |  |
| 6 | scroll product | 698 |  | 28/58 | 69 | 671 |  |
| 7 | back to rates | 21 |  | 13/25 | 77 | 639 |  |
| 8 | open lenders | 21 |  | 21/24 | 200 | 642 |  |
| 9 | scroll lenders | 716 |  | 24/27 | 150 | 640 |  |
| 10 | back from lenders | 20 |  | 8/9 | 150 | 641 |  |
| 11 | switch to savings | 21 |  | 32/52 | 77 | 649 |  |
| 12 | switch to home loans | 21 |  | 15/29 | 61 | 662 |  |
| 13 | open filters | 22 |  | 24/28 | 117 | 664 |  |
| 14 | close filters | 19 |  | 8/9 | 150 | 667 |  |
| 15 | open market | 20 |  | 17/30 | 77 | 667 |  |
| 16 | open rba | 20 |  | 28/51 | 53 | 666 |  |
| 17 | scroll rba | 689 |  | 25/46 | 65 | 665 |  |
| 18 | back from rba | 29 |  | 9/21 | 48 | 665 |  |
| 19 | scroll market | 690 |  | 24/41 | 81 | 665 |  |
| 20 | open saved | 19 |  | 10/18 | 81 | 669 |  |
| 21 | return to rates | 21 |  | 18/35 | 57 | 672 |  |
| 22 | cold start | 9836 | -6756 | 28/37 | 400 | 588 | 1 errors; start 4196ms; boot js-start 626464, layout-mounted 626755, hydrated 626894, cache-read 627942, core-ready 628521, rows-prepared 628608, search-index-idle 628608, detail-filters-idle 628608, leading-requested 628608, last-pricing 628608, splash-hide 628609, manifest 630010, leading-scoped 630769, leading-page 630769, pricing-ready 631404, last-rows 631404, resolved 631427, rates-ready 632165, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 20, pricing-scope-ms 1743, filter-runs 2, filter-rows 13756, filter-yields 4, filter-cancels 1, filter-ms 215, sort-runs 1, sort-rows 1182, sort-yields 1, sort-ms 14 |
| 23 | /browse | 2240 | +2191 | 1/2 | 32 | 441 |  |
| 24 | /watchlist | 33 | -27 | 2/3 | 32 | 523 |  |
| 25 | /market | 39 | -39 | 13/22 | 53 | 599 |  |
| 26 | /tools | 4388 | +4312 | 17/22 | 65 | 606 |  |
| 27 | /trends | 27 | +2 | 22/38 | 101 | 601 |  |
| 28 | /search | 23 | -7 | 31/41 | 121 | 618 |  |
| 29 | /banks | 34 | +1 | 33/46 | 101 | 628 |  |
| 30 | /bank-rates | 23 | -7 | 16/25 | 85 | 639 |  |
| 31 | /categories | 30 | -1 | 36/48 | 101 | 657 |  |
| 32 | /catalogue | 23 | -11 | 31/44 | 97 | 684 |  |
| 33 | /compare | 33 | +9 | 13/17 | 105 | 677 |  |
| 34 | /matches | 23 | -1 | 27/49 | 77 | 685 |  |
| 35 | /calculator | 23 | -2 | 13/22 | 65 | 682 |  |
| 36 | /projections | 28 | +5 | 19/30 | 85 | 681 |  |
| 37 | /profile | 28 | +6 | 14/24 | 61 | 689 |  |
| 38 | /research | 24 | -5 | 18/29 | 77 | 700 |  |
| 39 | /rba | 29 | +7 | 11/24 | 73 | 707 |  |
| 40 | /rba-response | 27 | +2 | 18/31 | 61 | 711 |  |
| 41 | /settings | 27 | +5 | 17/27 | 65 | 721 |  |
| 42 | /about | 32 | +10 | 10/23 | 69 | 724 |  |
| 43 | /terms | 36 | +12 | 10/23 | 77 | 726 |  |
| 44 | /privacy | 26 | -1 |  |  | 726 |  |
| 45 | /third-party-notices | 30 | +6 | 13/24 | 69 | 731 |  |
| 46 | /node | 28 | +1 | 29/48 | 93 | 756 |  |
| 47 | /passthrough | 33 | +5 | 28/47 | 85 | 740 |  |
| 48 | /calculation-receipt | 27 | +2 | 14/25 | 65 | 736 |  |
| 49 | /rate-receipt | 32 | +6 | 5/9 | 73 | 737 |  |
| 50 | warm resume | 185 | -550 | 4/5 | 250 | 736 |  |
| 51 | cold relaunch | 9519 | +550 | 28/39 | 150 | 577 | 3 errors; start 4128ms; boot js-start 857422, layout-mounted 857588, hydrated 857679, cache-read 858797, core-ready 859387, rows-prepared 859484, search-index-idle 859484, detail-filters-idle 859484, leading-requested 859484, last-pricing 859484, splash-hide 859485, leading-scoped 861475, leading-page 861475, manifest 861778, pricing-ready 862122, last-rows 862122, resolved 862190, rates-ready 862964, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 23, pricing-scope-ms 2060, filter-runs 2, filter-rows 13756, filter-yields 6, filter-cancels 1, filter-ms 284, sort-runs 1, sort-rows 1182, sort-yields 1, sort-ms 14 |
| 52 | about | 31 |  | 11/20 | 300 | 408 |  |
| 53 | audit screen | 18 |  | 104/218 | 57 | 605 |  |
| 54 | audit 0 min | 0 |  | 475/569 | 101 | 747 | 80 errors |
| 55 | audit 2 min | 0 |  | 719/862 | 101 | 973 | 80 errors |
| 56 | audit 3 min | 0 |  | 631/749 | 101 | 1035 | 80 errors |
| 57 | audit 4 min | 0 |  | 367/439 | 97 | 1165 | 80 errors |
| 58 | audit 6 min | 0 |  | 1261/1474 | 101 | 1154 | 80 errors |
| 59 | audit 8 min | 0 |  | 654/799 | 97 | 1274 | 80 errors |
| 60 | audit 9 min | 0 |  | 218/269 | 85 | 1196 | 80 errors |
| 61 | audit 10 min | 0 |  | 966/1153 | 105 | 1253 | 80 errors |
| 62 | audit 12 min | 0 |  | 143/188 | 34 | 1249 | 80 errors |
| 63 | audit 13 min | 0 |  | 101/138 | 34 | 1270 |  |
| 64 | audit 14 min | 0 |  | 139/173 | 44 | 1297 |  |
| 65 | audit 16 min | 0 |  | 29/34 | 69 | 1374 |  |
| 66 | audit finished | 0 |  | 85/180 | 65 | 1348 |  |
| 67 | audit result 1 | 0 |  |  |  | 1345 |  |
| 68 | audit result 2 | 0 |  |  |  | 1346 |  |
| 69 | audit result 3 | 0 |  |  |  | 1343 |  |
| 70 | audit result 4 | 0 |  |  |  | 1346 |  |
| 71 | audit result 5 | 0 |  |  |  | 1344 |  |
| 72 | audit result 6 | 0 |  |  |  | 1344 |  |
| 73 | audit result 7 | 0 |  |  |  | 1347 |  |
| 74 | audit result 8 | 0 |  |  |  | 1345 |  |
| 75 | audit result 9 | 0 |  |  |  | 1348 |  |
| 76 | audit result 10 | 0 |  |  |  | 1346 |  |
| 77 | audit result 11 | 0 |  |  |  | 1345 |  |
| 78 | audit result 12 | 0 |  |  |  | 1348 |  |
| 79 | about for debug log | 3150 |  | 15/27 | 61 | 1389 |  |
| 80 | debug log screen | 0 |  | 94/207 | 57 | 1396 |  |

## Errors

### 1 open app
```
11-22 03:33:30.757 E/australianrates(10592): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-22 03:37:13.514 E/australianrates(12874): Not starting debugger since process cannot load the jdwp agent.
```

### 51 cold relaunch
```
11-22 03:41:04.301 E/australianrates(15842): Not starting debugger since process cannot load the jdwp agent.
11-22 03:41:08.186 E/SurfaceSyncGroup(15842): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-22 03:41:08.191 E/SurfaceSyncGroup(15842): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 54 audit 0 min
```
11-22 03:42:09.751 E/ReactNativeJS(15842): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwraj6d5-985ecfcb6c875a48","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":4380,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":252.2,"liveStage:dates-index:fetched:ms":213.6,"liveStage:revision:verified:ms":71.6,"liveStage:Core asset:downloaded:ms":186.4,"liveStage:Core asset:hash-verified:ms":7.9,"liveStage:Core asset:native-inflated-and-text-decoded:ms":137.9,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":219,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":500.9,"liveStage:Details asset:downloaded:ms":1224,"liveStage:Details asset:hash-verified:ms":35.2,"liveStage:…
11-22 03:42:09.774 E/unknown:ReactNative(15842): ?anon_0_@1:3691375
11-22 03:42:09.774 E/unknown:ReactNative(15842): ?anon_0_@1:3697175
11-22 03:42:09.774 E/unknown:ReactNative(15842): SyntheticError@1:162984
11-22 03:42:09.774 E/unknown:ReactNative(15842): Wrapper@1:163499
11-22 03:42:09.774 E/unknown:ReactNative(15842): _callSuper@1:148372
11-22 03:42:09.774 E/unknown:ReactNative(15842): _construct@1:163847
11-22 03:42:09.774 E/unknown:ReactNative(15842): _next@1:594835
```

### 55 audit 2 min
```
11-22 03:42:58.657 E/ReactNativeJS(15842): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwraj6d5-985ecfcb6c875a48","check":{"id":"journey-compare-cold","label":"Product comparison (cold)","kind":"journey","status":"fail","durationMs":1717.1,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":907.9,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"compare","journeyLabel":"Product comparison","iteration":"cold","expectedPath":"/compare","expectedSurface":"compare.table","navigationKind":"stack","forwardMs":907.9,"firstReadyFrameObserved":true,"firstReadyFrameMs":357.6385660000378,"backgroundSettleMs":599.7,"destinationReadinessMs":357.6,"backMs":36.9,"firstBackMs":36.9,"firstBackDestination":"/performance-audit","originReadinessMs":0.3,"backDestination":"/performance-audit","backChangedPath":tru…
11-22 03:42:58.659 E/unknown:ReactNative(15842): ?anon_0_@1:3691375
11-22 03:42:58.659 E/unknown:ReactNative(15842): ?anon_0_@1:3697175
11-22 03:42:58.659 E/unknown:ReactNative(15842): SyntheticError@1:162984
11-22 03:42:58.659 E/unknown:ReactNative(15842): Wrapper@1:163499
11-22 03:42:58.659 E/unknown:ReactNative(15842): _callSuper@1:148372
11-22 03:42:58.659 E/unknown:ReactNative(15842): _construct@1:163847
11-22 03:42:58.659 E/unknown:ReactNative(15842): _next@1:594835
```

### 56 audit 3 min
```
11-22 03:44:12.352 E/ReactNativeJS(15842): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwraj6d5-985ecfcb6c875a48","check":{"id":"deep-first-pass.route.rates-sheets.search.section.next","label":"route.rates-sheets: search.section.next (first-pass)","kind":"journey","status":"fail","durationMs":1243.5,"metrics":{"journeyId":"route.rates-sheets.search.section.next","journeyLabel":"route.rates-sheets: search.section.next","iteration":"cold","passId":"first-pass","scenarioId":"route.rates-sheets","semanticActionId":"search.section.next","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":18,"actionRevisionAfter":19,"renderRevisionBefore":"state-26","renderRevisionAfter":"state-29","actionMs":310.8,"preActionWaitMs":1.2,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"ret…
11-22 03:44:12.354 E/unknown:ReactNative(15842): ?anon_0_@1:3691375
11-22 03:44:12.354 E/unknown:ReactNative(15842): ?anon_0_@1:3697175
11-22 03:44:12.354 E/unknown:ReactNative(15842): SyntheticError@1:162984
11-22 03:44:12.354 E/unknown:ReactNative(15842): Wrapper@1:163499
11-22 03:44:12.354 E/unknown:ReactNative(15842): _callSuper@1:148372
11-22 03:44:12.354 E/unknown:ReactNative(15842): _construct@1:163847
11-22 03:44:12.354 E/unknown:ReactNative(15842): _next@1:594835
```

### 57 audit 4 min
```
11-22 03:45:53.882 E/ReactNativeJS(15842): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwraj6d5-985ecfcb6c875a48","check":{"id":"deep-first-pass.route.lender.lender.move.first","label":"route.lender: lender.move.first (first-pass)","kind":"journey","status":"fail","durationMs":10025.8,"metrics":{"journeyId":"route.lender.lender.move.first","journeyLabel":"route.lender: lender.move.first","iteration":"cold","passId":"first-pass","scenarioId":"route.lender","semanticActionId":"lender.move.first","depth":2,"plannedExpectedPath":"/bank/Rabobank","expectedPath":"/bank/Rabobank","expectedSurface":"lender.details","actionSource":"lender.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRevisionAfter":4,"renderRevisionBefore":"Rabobank:733:1:7:rich:26:9c369287e53a…:Rabobank:TD:2026-11-22:194:1:7:rich:26:9c369287e53a…:Rabobank:TD:2026-11-22:194:TD:90D:2026-11-22:91:idle:moves-on-demand","renderRevisionAfter":"Rabobank:733:1:7:rich:26:9c369287e53a…:Rabob…
11-22 03:45:53.883 E/unknown:ReactNative(15842): ?anon_0_@1:3691375
11-22 03:45:53.883 E/unknown:ReactNative(15842): ?anon_0_@1:3697175
11-22 03:45:53.883 E/unknown:ReactNative(15842): SyntheticError@1:162984
11-22 03:45:53.883 E/unknown:ReactNative(15842): Wrapper@1:163499
11-22 03:45:53.883 E/unknown:ReactNative(15842): _callSuper@1:148372
11-22 03:45:53.883 E/unknown:ReactNative(15842): _construct@1:163847
11-22 03:45:53.883 E/unknown:ReactNative(15842): _next@1:594835
```

### 58 audit 6 min
```
11-22 03:46:34.048 E/ReactNativeJS(15842): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwraj6d5-985ecfcb6c875a48","check":{"id":"deep-first-pass.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (first-pass)","kind":"journey","status":"fail","durationMs":1410.3,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Rabobank%7C5715ac80-c738-4b37-9ad1-3735853107aa%7CTRANS_AND_SAVINGS_ACCOUNTS%7CHigh%20Interest%20Savings%20Account%20(Trust)","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevision…
11-22 03:46:34.050 E/unknown:ReactNative(15842): ?anon_0_@1:3691375
11-22 03:46:34.050 E/unknown:ReactNative(15842): ?anon_0_@1:3697175
11-22 03:46:34.050 E/unknown:ReactNative(15842): SyntheticError@1:162984
11-22 03:46:34.050 E/unknown:ReactNative(15842): Wrapper@1:163499
11-22 03:46:34.050 E/unknown:ReactNative(15842): _callSuper@1:148372
11-22 03:46:34.050 E/unknown:ReactNative(15842): _construct@1:163847
11-22 03:46:34.050 E/unknown:ReactNative(15842): _next@1:594835
```

### 59 audit 8 min
```
11-22 03:49:03.048 E/ReactNativeJS(15842): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwraj6d5-985ecfcb6c875a48","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.mortgage.scope.apply.1","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.1 (repeat)","kind":"journey","status":"fail","durationMs":7239.4,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.1","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.1","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.1","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":42,"actionRevisionAfter":43,"renderRevisionBefore":"state-14","renderRevisionAfter":"state-20","actionMs":111.7,"preActionWaitMs":1.1,"preActionQuietWindowReused":true,"preAction…
11-22 03:49:03.049 E/unknown:ReactNative(15842): ?anon_0_@1:3691375
11-22 03:49:03.049 E/unknown:ReactNative(15842): ?anon_0_@1:3697175
11-22 03:49:03.049 E/unknown:ReactNative(15842): SyntheticError@1:162984
11-22 03:49:03.049 E/unknown:ReactNative(15842): Wrapper@1:163499
11-22 03:49:03.049 E/unknown:ReactNative(15842): _callSuper@1:148372
11-22 03:49:03.049 E/unknown:ReactNative(15842): _construct@1:163847
11-22 03:49:03.049 E/unknown:ReactNative(15842): _next@1:594835
```

### 60 audit 9 min
```
11-22 03:50:37.486 E/ReactNativeJS(15842): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwraj6d5-985ecfcb6c875a48","check":{"id":"deep-repeat.sample.catalogue.2.product.lender.open","label":"sample.catalogue.2: product.lender.open (repeat)","kind":"journey","status":"fail","durationMs":1445.9,"metrics":{"journeyId":"sample.catalogue.2.product.lender.open","journeyLabel":"sample.catalogue.2: product.lender.open","iteration":"warm","passId":"repeat","scenarioId":"sample.catalogue.2","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/RSL%20Money","expectedPath":"/bank/RSL%20Money","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":20,"actionRevisionAfter":21,"actionResultEvidence":"{\"expectedPath\":\"/bank/RSL%20Money\"}","actionMs":359.8,"preActionWaitMs":2.1,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActio…
11-22 03:50:37.487 E/unknown:ReactNative(15842): ?anon_0_@1:3691375
11-22 03:50:37.487 E/unknown:ReactNative(15842): ?anon_0_@1:3697175
11-22 03:50:37.487 E/unknown:ReactNative(15842): SyntheticError@1:162984
11-22 03:50:37.487 E/unknown:ReactNative(15842): Wrapper@1:163499
11-22 03:50:37.487 E/unknown:ReactNative(15842): _callSuper@1:148372
11-22 03:50:37.487 E/unknown:ReactNative(15842): _construct@1:163847
11-22 03:50:37.487 E/unknown:ReactNative(15842): _next@1:594835
```

### 61 audit 10 min
```
11-22 03:51:19.702 E/ReactNativeJS(15842): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwraj6d5-985ecfcb6c875a48","check":{"id":"deep-repeat.route.projections.projections.open","label":"route.projections: projections.open (repeat)","kind":"journey","status":"fail","durationMs":1118.4,"metrics":{"journeyId":"route.projections.projections.open","journeyLabel":"route.projections: projections.open","iteration":"warm","passId":"repeat","scenarioId":"route.projections","semanticActionId":"projections.open","depth":0,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"projections.inputs","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":270.6,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":88.4,"forwardWorkMs":88.4,"navigationCommitMs":0,"firstReadyFrameMs":88.3,"firstReadyFrameObserved…
11-22 03:51:19.704 E/unknown:ReactNative(15842): ?anon_0_@1:3691375
11-22 03:51:19.704 E/unknown:ReactNative(15842): ?anon_0_@1:3697175
11-22 03:51:19.704 E/unknown:ReactNative(15842): SyntheticError@1:162984
11-22 03:51:19.704 E/unknown:ReactNative(15842): Wrapper@1:163499
11-22 03:51:19.704 E/unknown:ReactNative(15842): _callSuper@1:148372
11-22 03:51:19.704 E/unknown:ReactNative(15842): _construct@1:163847
11-22 03:51:19.704 E/unknown:ReactNative(15842): _next@1:594835
```

### 62 audit 12 min
```
11-22 03:52:57.306 E/ReactNativeJS(15842): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwraj6d5-985ecfcb6c875a48","check":{"id":"external-link-15","kind":"network","status":"fail","durationMs":1984.9214589998592,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"pass","browserHandler":"pass","httpReachability":"fail","statusCode":404,"handlerAttempted":true,"httpAttempted":true,"httpSelected":true,"handlerResolution":"pass","host":"www.rslmoney.com.au","destinationPath":"/products/rsl-term-deposit%E2%80%8B"},"error":"HTTP 404: the destination is missing or unavailable.","canonicalMetrics":true}}
11-22 03:52:57.308 E/unknown:ReactNative(15842): ?anon_0_@1:3691375
11-22 03:52:57.308 E/unknown:ReactNative(15842): ?anon_0_@1:3700736
11-22 03:52:57.308 E/unknown:ReactNative(15842): SyntheticError@1:162984
11-22 03:52:57.308 E/unknown:ReactNative(15842): Wrapper@1:163499
11-22 03:52:57.308 E/unknown:ReactNative(15842): _callSuper@1:148372
11-22 03:52:57.308 E/unknown:ReactNative(15842): _construct@1:163847
11-22 03:52:57.308 E/unknown:ReactNative(15842): _next@1:594835
```
