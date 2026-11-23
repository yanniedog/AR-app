# App explorer: 1.0.358 (414)

**Real-use session FAIL vs 1.0.358: 1 broken, 14 friction, 12 slower**

- Broken: 96% dropped frames on "open filters"
- Friction: No reaction for 4.1 s after "scroll rates 1"
- Friction: No reaction for 3.1 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.1 s after "open lenders"
- Friction: No reaction for 3.2 s after "scroll lenders"
- Friction: No reaction for 4.8 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.0 s after "open market"
- Friction: No reaction for 3.0 s after "open rba"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.2 s after "scroll rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Slower: Dropped frames 55% to 74% on "open app"
- Slower: "open app" content 25.1 s to 41.0 s
- Slower: "open app" reaction 25.1 s to 41.0 s
- Slower: Dropped frames 56% to 74% on "scroll rates 1"
- Slower: Dropped frames 49% to 72% on "scroll rates 2"
- Slower: Dropped frames 53% to 71% on "open product"
- Slower: Dropped frames 43% to 77% on "scroll product"
- Slower: Dropped frames 51% to 67% on "open rba"
- Slower: Dropped frames 46% to 69% on "scroll rba"
- Slower: Dropped frames 39% to 74% on "scroll market"
- Slower: Dropped frames 44% to 64% on "open saved"
- Slower: Dropped frames 44% to 61% on "return to rates"

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode full | 79 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 11
Baseline 1.0.358
**Audit live: outcome completed | 960 s | audit log 858306 bytes (audit-log.txt) https://paste.c-net.org/05453c0d-c739-afc4-2e5d-41d2ac6b999e | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2974 | -24442 | 730/993 | 85 | 512 | 1 errors; start 2934ms |
| 2 | scroll rates 1 | 774 | +51 | 43/58 | 77 | 597 | boot js-start 435778, layout-mounted 436416, cache-read 436577, hydrated 436757, splash-hide 436757, manifest 437953, resolved 439184, core-fetched 444534, core-saved 445491, rows-prepared 445899, search-index-idle 445899, leading-requested 445899, details-start 446459, leading-scoped 446931, pricing-ready 448016, last-gate 448680, details-fetched 457389, detail-filters-idle 466012, last-pricing 466012, suitability-built 467571, post-refresh-wait 469145, leading-page 471228, last-rows 480420, rates-ready 480590, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 193, pricing-scope-ms 14402, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 3, filter-rows 38533, filter-yields 10, filter-ms 295, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 82 |
| 3 | scroll rates 2 | 690 | -9 | 23/32 | 81 | 660 |  |
| 4 | scroll rates back | 685 | +10 |  |  | 538 |  |
| 5 | open product | 5330 | +2412 | 36/51 | 101 | 657 |  |
| 6 | scroll product | 699 | +11 | 37/48 | 101 | 676 |  |
| 7 | back to rates | 25 | +2 | 14/22 | 77 | 661 |  |
| 8 | open lenders | 22 | +2 | 21/23 | 200 | 654 |  |
| 9 | scroll lenders | 737 | -41 | 23/25 | 129 | 652 |  |
| 10 | back from lenders | 24 | +4 | 9/9 | 200 | 653 |  |
| 11 | switch to savings | 22 | +2 | 63/83 | 85 | 669 |  |
| 12 | switch to home loans | 24 | +3 | 16/30 | 61 | 684 |  |
| 13 | open filters | 22 | +1 | 24/25 | 117 | 689 |  |
| 14 | close filters | 22 | +2 | 9/10 | 150 | 681 |  |
| 15 | open market | 22 | +3 | 19/30 | 69 | 679 |  |
| 16 | open rba | 23 | +2 | 24/36 | 77 | 679 |  |
| 17 | scroll rba | 692 | -24 | 29/42 | 81 | 679 |  |
| 18 | back from rba | 26 | +7 | 10/19 | 65 | 680 |  |
| 19 | scroll market | 746 | +61 | 29/39 | 85 | 680 |  |
| 20 | open saved | 22 | +4 | 14/22 | 73 | 685 |  |
| 21 | return to rates | 24 | +5 | 20/33 | 77 | 686 |  |
| 22 | cold start | 10983 | +2020 | 38/47 | 105 | 582 | 1 errors; start 4321ms; boot js-start 674735, layout-mounted 674921, hydrated 675043, cache-read 676235, core-ready 676985, rows-prepared 677092, search-index-idle 677092, detail-filters-idle 677092, leading-requested 677092, last-pricing 677092, splash-hide 677094, manifest 679463, leading-scoped 679764, leading-page 679764, pricing-ready 680509, last-rows 680509, rates-ready 680735, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 13, pricing-scope-ms 1173, filter-runs 1, filter-rows 6861, filter-yields 5, filter-ms 145, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 16 |
| 23 | /browse | 4514 |  | 2/2 | 32 | 432 |  |
| 24 | /watchlist | 24 |  | 4/5 | 53 | 440 |  |
| 25 | /market | 28 |  | 13/21 | 65 | 531 |  |
| 26 | /tools | 38 |  | 17/22 | 101 | 595 |  |
| 27 | /trends | 26 |  |  |  | 610 |  |
| 28 | /search | 26 |  | 42/54 | 133 | 614 |  |
| 29 | /banks | 24 |  | 33/42 | 113 | 628 |  |
| 30 | /bank-rates | 26 |  | 17/29 | 81 | 638 |  |
| 31 | /categories | 24 |  | 39/47 | 89 | 651 |  |
| 32 | /catalogue | 25 |  | 30/42 | 101 | 678 |  |
| 33 | /compare | 26 |  | 13/17 | 125 | 659 |  |
| 34 | /matches | 27 |  | 33/47 | 89 | 670 |  |
| 35 | /calculator | 34 |  | 15/22 | 77 | 658 |  |
| 36 | /projections | 26 |  | 25/35 | 97 | 659 |  |
| 37 | /profile | 25 |  | 17/24 | 81 | 664 |  |
| 38 | /research | 26 |  | 18/27 | 77 | 676 |  |
| 39 | /rba | 23 |  | 12/24 | 73 | 694 |  |
| 40 | /rba-response | 26 |  | 16/28 | 77 | 689 |  |
| 41 | /settings | 27 |  | 12/22 | 101 | 699 |  |
| 42 | /about | 23 |  | 12/22 | 69 | 702 |  |
| 43 | /terms | 23 |  | 16/23 | 77 | 704 |  |
| 44 | /privacy | 23 |  |  |  | 705 |  |
| 45 | /third-party-notices | 26 |  | 14/26 | 61 | 709 |  |
| 46 | /node | 28 |  | 27/43 | 105 | 731 |  |
| 47 | /passthrough | 29 |  | 31/45 | 97 | 719 |  |
| 48 | /calculation-receipt | 33 |  | 18/25 | 93 | 713 |  |
| 49 | /rate-receipt | 29 |  | 7/10 | 89 | 715 |  |
| 50 | warm resume | 135 |  | 4/4 | 200 | 714 |  |
| 51 | cold relaunch | 10648 |  | 27/38 | 150 | 576 | 3 errors; start 4323ms; boot js-start 908361, layout-mounted 908552, hydrated 908626, cache-read 909905, core-ready 910652, rows-prepared 910784, search-index-idle 910784, detail-filters-idle 910784, leading-requested 910784, last-pricing 910784, splash-hide 910785, manifest 912383, leading-scoped 913003, leading-page 913003, pricing-ready 913616, last-rows 913616, rates-ready 913891, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 13, pricing-scope-ms 1295, filter-runs 1, filter-rows 6861, filter-yields 6, filter-ms 183, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 15 |
| 52 | about | 28 | +3 | 13/20 | 300 | 398 |  |
| 53 | audit screen | 20 | 0 | 123/204 | 69 | 609 |  |
| 54 | audit 0 min | 0 |  | 34/37 | 77 | 860 | 19 errors |
| 55 | audit 2 min | 0 | 0 | 1287/1475 | 113 | 1054 | 80 errors |
| 56 | audit 4 min | 0 | 0 | 971/1107 | 105 | 1068 | 80 errors |
| 57 | audit 5 min | 0 | 0 | 956/1113 | 113 | 1119 | 80 errors |
| 58 | audit 7 min | 0 | 0 | 517/585 | 121 | 1158 | 80 errors |
| 59 | audit 8 min | 0 | 0 | 758/904 | 109 | 1261 | 80 errors |
| 60 | audit 10 min | 0 | 0 | 855/987 | 113 | 1320 | 80 errors |
| 61 | audit 11 min | 0 |  | 299/334 | 109 | 1325 | 80 errors |
| 62 | audit 13 min | 0 | 0 | 151/172 | 34 | 1349 |  |
| 63 | audit 15 min | 0 |  | 140/163 | 48 | 1354 |  |
| 64 | audit 16 min | 0 |  | 28/39 | 93 | 1407 |  |
| 65 | audit finished | 0 | 0 | 92/161 | 69 | 1375 |  |
| 66 | audit result 1 | 0 | 0 |  |  | 1366 |  |
| 67 | audit result 2 | 0 | 0 |  |  | 1366 |  |
| 68 | audit result 3 | 0 | 0 |  |  | 1369 |  |
| 69 | audit result 4 | 0 | 0 |  |  | 1367 |  |
| 70 | audit result 5 | 0 | 0 |  |  | 1370 |  |
| 71 | audit result 6 | 0 | 0 |  |  | 1369 |  |
| 72 | audit result 7 | 0 | 0 |  |  | 1368 |  |
| 73 | audit result 8 | 0 | 0 |  |  | 1371 |  |
| 74 | audit result 9 | 0 | 0 |  |  | 1369 |  |
| 75 | audit result 10 | 0 | 0 |  |  | 1373 |  |
| 76 | audit result 11 | 0 | 0 |  |  | 1371 |  |
| 77 | audit result 12 | 0 | 0 |  |  | 1370 |  |
| 78 | about for debug log | 4445 | +1219 | 20/34 | 65 | 1246 |  |
| 79 | debug log screen | 0 | 0 | 104/200 | 65 | 1237 |  |

## Errors

### 1 open app
```
11-23 17:20:47.807 E/australianrates(10779): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-23 17:24:47.941 E/australianrates(13039): Not starting debugger since process cannot load the jdwp agent.
```

### 51 cold relaunch
```
11-23 17:28:41.388 E/australianrates(16057): Not starting debugger since process cannot load the jdwp agent.
11-23 17:28:45.609 E/SurfaceSyncGroup(16057): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-23 17:28:45.609 E/SurfaceSyncGroup(16057): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 54 audit 0 min
```
11-23 17:29:52.384 E/ReactNativeJS(16057): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtjjeri-aa36bc7b99983ed4","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":6489.6,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":448.1,"liveStage:dates-index:fetched:ms":420.9,"liveStage:revision:verified:ms":235.8,"liveStage:Core asset:downloaded:ms":635.9,"liveStage:Core asset:hash-verified:ms":6.7,"liveStage:Core asset:native-inflated-and-text-decoded:ms":197.4,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":210.6,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":647.1,"liveStage:Details asset:downloaded:ms":1741.5,"liveStage:Details asset:hash-verified:ms":14.1,"liveS…
11-23 17:29:52.386 E/unknown:ReactNative(16057): ?anon_0_@1:3693349
11-23 17:29:52.386 E/unknown:ReactNative(16057): ?anon_0_@1:3699149
11-23 17:29:52.386 E/unknown:ReactNative(16057): SyntheticError@1:163016
11-23 17:29:52.386 E/unknown:ReactNative(16057): Wrapper@1:163531
11-23 17:29:52.386 E/unknown:ReactNative(16057): _callSuper@1:148404
11-23 17:29:52.386 E/unknown:ReactNative(16057): _construct@1:163879
11-23 17:29:52.386 E/unknown:ReactNative(16057): _next@1:594867
```

### 55 audit 2 min
```
11-23 17:29:53.237 E/ReactNativeJS(16057): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtjjeri-aa36bc7b99983ed4","check":{"id":"maximum-coverage-profile","label":"Maximum safe audit coverage preparation","kind":"data","status":"fail","durationMs":795,"metrics":{"profile":"maximum-safe-coverage-v1","maximumSafeFeaturesEnabled":true,"enabledSections":"Mortgage,Savings,TD","includeNonStandard":true,"deepSearchEnabled":true,"historyExplorerEnabled":true,"depositRankMetric":"max","mortgageRateMetric":"comparison","requiredAssets":8,"availableAssets":8,"localCacheOnly":false,"bankInsightsPreparationAttempted":true,"bankInsightsCacheOnly":false,"executionAttempted":true,"measurementAvailable":true,"nonTimingFailure":false,"eventLoopSamples":7,"eventLoopMeasurementAvailable":true,"eventLoopP95Ms":398.3,"maxEventLoopLagMs":398.3,"stallsOver100Ms":2,"frameSamples":12,"frameMeasurementAvailable":true,"frameP95Ms":415.3,"maxFrameGapMs":415.3,"framesOver50Ms":4}}}
11-23 17:29:53.238 E/unknown:ReactNative(16057): ?anon_0_@1:3693349
11-23 17:29:53.238 E/unknown:ReactNative(16057): ?anon_0_@1:3699149
11-23 17:29:53.238 E/unknown:ReactNative(16057): SyntheticError@1:163016
11-23 17:29:53.238 E/unknown:ReactNative(16057): Wrapper@1:163531
11-23 17:29:53.238 E/unknown:ReactNative(16057): _callSuper@1:148404
11-23 17:29:53.238 E/unknown:ReactNative(16057): _construct@1:163879
11-23 17:29:53.238 E/unknown:ReactNative(16057): _next@1:594867
```

### 56 audit 4 min
```
11-23 17:32:30.462 E/ReactNativeJS(16057): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtjjeri-aa36bc7b99983ed4","check":{"id":"deep-first-pass.route.rates-mortgage-scope.search.mortgage.scope.clear","label":"route.rates-mortgage-scope: search.mortgage.scope.clear (first-pass)","kind":"journey","status":"fail","durationMs":9078.4,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.clear","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.clear","iteration":"cold","passId":"first-pass","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.clear","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":21,"actionRevisionAfter":22,"renderRevisionBefore":"state-21","renderRevisionAfter":"state-27","actionMs":156.6,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActi…
11-23 17:32:30.463 E/unknown:ReactNative(16057): ?anon_0_@1:3693349
11-23 17:32:30.463 E/unknown:ReactNative(16057): ?anon_0_@1:3699149
11-23 17:32:30.463 E/unknown:ReactNative(16057): SyntheticError@1:163016
11-23 17:32:30.463 E/unknown:ReactNative(16057): Wrapper@1:163531
11-23 17:32:30.463 E/unknown:ReactNative(16057): _callSuper@1:148404
11-23 17:32:30.463 E/unknown:ReactNative(16057): _construct@1:163879
11-23 17:32:30.463 E/unknown:ReactNative(16057): _next@1:594867
```

### 57 audit 5 min
```
11-23 17:33:59.624 E/ReactNativeJS(16057): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtjjeri-aa36bc7b99983ed4","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":1716,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-24:b2751ce01c21…:state-8","renderRevisionAfter":"2026-11-24:b2751ce01c21…:state-9","actionResultEvidence":"{\"applied\":\"…
11-23 17:34:03.946 E/unknown:ReactNative(16057): ?anon_0_@1:3693349
11-23 17:34:03.946 E/unknown:ReactNative(16057): ?anon_0_@1:3699149
11-23 17:34:03.946 E/unknown:ReactNative(16057): SyntheticError@1:163016
11-23 17:34:03.946 E/unknown:ReactNative(16057): Wrapper@1:163531
11-23 17:34:03.946 E/unknown:ReactNative(16057): _callSuper@1:148404
11-23 17:34:03.946 E/unknown:ReactNative(16057): _construct@1:163879
11-23 17:34:03.946 E/unknown:ReactNative(16057): _next@1:594867
```

### 58 audit 7 min
```
11-23 17:35:50.407 E/ReactNativeJS(16057): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtjjeri-aa36bc7b99983ed4","check":{"id":"deep-first-pass.redirect.tab-trends.redirect.tab-trends.verify","label":"redirect.tab-trends: redirect.tab-trends.verify (first-pass)","kind":"journey","status":"fail","durationMs":1630,"metrics":{"journeyId":"redirect.tab-trends.redirect.tab-trends.verify","journeyLabel":"redirect.tab-trends: redirect.tab-trends.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.tab-trends","semanticActionId":"redirect.tab-trends.verify","depth":1,"plannedExpectedPath":"/research","expectedPath":"/research","expectedSurface":"outlook.dashboard","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":411.6,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":562.7,"forwardWorkMs":562.7,"navi…
11-23 17:35:50.409 E/unknown:ReactNative(16057): ?anon_0_@1:3693349
11-23 17:35:50.409 E/unknown:ReactNative(16057): ?anon_0_@1:3699149
11-23 17:35:50.409 E/unknown:ReactNative(16057): SyntheticError@1:163016
11-23 17:35:50.409 E/unknown:ReactNative(16057): Wrapper@1:163531
11-23 17:35:50.409 E/unknown:ReactNative(16057): _callSuper@1:148404
11-23 17:35:50.409 E/unknown:ReactNative(16057): _construct@1:163879
11-23 17:35:50.409 E/unknown:ReactNative(16057): _next@1:594867
```

### 59 audit 8 min
```
11-23 17:37:14.907 E/ReactNativeJS(16057): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtjjeri-aa36bc7b99983ed4","check":{"id":"deep-repeat.route.bank-rates.bank-rates.open","label":"route.bank-rates: bank-rates.open (repeat)","kind":"journey","status":"fail","durationMs":1473.4,"metrics":{"journeyId":"route.bank-rates.bank-rates.open","journeyLabel":"route.bank-rates: bank-rates.open","iteration":"warm","passId":"repeat","scenarioId":"route.bank-rates","semanticActionId":"bank-rates.open","depth":0,"plannedExpectedPath":"/bank-rates","expectedPath":"/bank-rates","expectedSurface":"bank-rates.dashboard","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":46.8,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":766.3,"forwardWorkMs":766.3,"navigationCommitMs":0,"firstReadyFrameMs":766.3,"firstReadyFrameObserved":true…
11-23 17:37:14.908 E/unknown:ReactNative(16057): ?anon_0_@1:3693349
11-23 17:37:14.908 E/unknown:ReactNative(16057): ?anon_0_@1:3699149
11-23 17:37:14.908 E/unknown:ReactNative(16057): SyntheticError@1:163016
11-23 17:37:14.908 E/unknown:ReactNative(16057): Wrapper@1:163531
11-23 17:37:14.908 E/unknown:ReactNative(16057): _callSuper@1:148404
11-23 17:37:14.908 E/unknown:ReactNative(16057): _construct@1:163879
11-23 17:37:14.908 E/unknown:ReactNative(16057): _next@1:594867
```

### 60 audit 10 min
```
11-23 17:38:42.217 E/ReactNativeJS(16057): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtjjeri-aa36bc7b99983ed4","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1676.7,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Up%7Cup-essentials%7CTRANS_AND_SAVINGS_ACCOUNTS%7CUp%20Essentials%20Saver","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"renderRevisionBefore":"202…
11-23 17:38:42.218 E/unknown:ReactNative(16057): ?anon_0_@1:3693349
11-23 17:38:42.218 E/unknown:ReactNative(16057): ?anon_0_@1:3699149
11-23 17:38:42.218 E/unknown:ReactNative(16057): SyntheticError@1:163016
11-23 17:38:42.218 E/unknown:ReactNative(16057): Wrapper@1:163531
11-23 17:38:42.218 E/unknown:ReactNative(16057): _callSuper@1:148404
11-23 17:38:42.218 E/unknown:ReactNative(16057): _construct@1:163879
11-23 17:38:42.218 E/unknown:ReactNative(16057): _next@1:594867
```

### 61 audit 11 min
```
11-23 17:40:14.974 E/ReactNativeJS(16057): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtjjeri-aa36bc7b99983ed4","check":{"id":"deep-repeat.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (repeat)","kind":"journey","status":"fail","durationMs":2477.4,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":99.1,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1069,"forwardWorkMs":1069,"navigationCommitMs":1068.6,"firstReadyFrameMs":0.4,"firstReady…
11-23 17:40:14.975 E/unknown:ReactNative(16057): ?anon_0_@1:3693349
11-23 17:40:14.975 E/unknown:ReactNative(16057): ?anon_0_@1:3699149
11-23 17:40:14.975 E/unknown:ReactNative(16057): SyntheticError@1:163016
11-23 17:40:14.975 E/unknown:ReactNative(16057): Wrapper@1:163531
11-23 17:40:14.975 E/unknown:ReactNative(16057): _callSuper@1:148404
11-23 17:40:14.975 E/unknown:ReactNative(16057): _construct@1:163879
11-23 17:40:14.975 E/unknown:ReactNative(16057): _next@1:594867
```
