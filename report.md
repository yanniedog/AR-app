# App explorer: 1.0.348 (404)

**Real-use session ATTENTION vs 1.0.347: 0 broken, 13 friction, 0 slower**

- Friction: No reaction for 3.5 s after "scroll rates 1"
- Friction: No reaction for 3.1 s after "scroll rates 2"
- Friction: No reaction for 3.3 s after "scroll lenders"
- Friction: No reaction for 4.8 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.5 s after "open filters"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.3 s after "open rba"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode full | 81 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 12
Baseline 1.0.347
**Audit live: outcome completed | 1121 s | audit log 865454 bytes (audit-log.txt) https://paste.c-net.org/ce4f48df-b9fa-db64-0f0b-7388ee60635a | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3393 | +352 | 688/937 | 89 | 493 | 1 errors; start 3249ms; boot js-start 430213, layout-mounted 430468, cache-read 430603, hydrated 430790, splash-hide 430790, manifest 432045, resolved 432334, core-fetched 437942, core-saved 439031, rows-prepared 439377, search-index-idle 439377, leading-requested 439377, details-start 439816, leading-scoped 440176, pricing-ready 445851, last-gate 446240, details-fetched 453065, detail-filters-idle 459602, last-pricing 459602, suitability-built 461463, post-refresh-wait 461940, leading-page 463755, last-rows 472670, rates-ready 472910, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 205, pricing-scope-ms 13987, filter-runs 3, filter-rows 38576, filter-yields 11, filter-ms 334, sort-runs 5, sort-rows 1182, sort-yields 5, sort-ms 67 |
| 2 | scroll rates 1 | 712 | +16 | 33/44 | 97 | 564 |  |
| 3 | scroll rates 2 | 756 | +59 | 19/30 | 69 | 716 |  |
| 4 | scroll rates back | 680 | +2 |  |  | 576 |  |
| 5 | open product | 5811 | +225 | 38/49 | 113 | 603 |  |
| 6 | scroll product | 710 | -42 | 14/27 | 65 | 642 |  |
| 7 | back to rates | 30 | +5 | 13/21 | 61 | 636 |  |
| 8 | open lenders | 23 | -1 | 21/24 | 200 | 651 |  |
| 9 | scroll lenders | 804 | +45 | 18/20 | 150 | 653 |  |
| 10 | back from lenders | 25 | -1 | 8/9 | 101 | 660 |  |
| 11 | switch to savings | 25 | +1 | 54/74 | 109 | 686 |  |
| 12 | switch to home loans | 24 | +1 | 19/30 | 65 | 708 |  |
| 13 | open filters | 26 | +3 | 22/27 | 150 | 723 |  |
| 14 | close filters | 22 | 0 | 7/8 | 125 | 718 |  |
| 15 | open market | 23 | 0 | 16/31 | 65 | 721 |  |
| 16 | open rba | 23 | -3 | 43/57 | 61 | 719 |  |
| 17 | scroll rba | 699 | -40 | 26/40 | 85 | 719 |  |
| 18 | back from rba | 23 | -2 | 10/20 | 53 | 723 |  |
| 19 | scroll market | 721 | +4 | 25/39 | 85 | 722 |  |
| 20 | open saved | 21 | -1 | 11/20 | 81 | 728 |  |
| 21 | return to rates | 25 | +2 | 15/26 | 69 | 733 |  |
| 22 | cold start | 10036 | -209 | 25/30 | 400 | 585 | 3 errors; start 4581ms; boot js-start 668233, layout-mounted 668450, hydrated 668490, cache-read 669810, core-ready 670562, rows-prepared 670678, search-index-idle 670678, detail-filters-idle 670678, leading-requested 670678, last-pricing 670678, splash-hide 670680, manifest 672513, leading-scoped 673050, leading-page 673050, resolved 673184, pricing-ready 674179, last-rows 674179, rates-ready 674358, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 20, pricing-scope-ms 1599, filter-runs 1, filter-rows 6878, filter-yields 4, filter-ms 97, sort-runs 1, sort-rows 1182, sort-yields 1, sort-ms 14 |
| 23 | /browse | 40 |  | 2/2 | 17 | 429 |  |
| 24 | /watchlist | 24 |  | 3/3 | 48 | 430 |  |
| 25 | /market | 36 |  | 14/21 | 61 | 513 |  |
| 26 | /tools | 28 |  | 15/18 | 150 | 577 |  |
| 27 | /trends | 29 |  |  |  | 618 |  |
| 28 | /search | 29 |  | 34/49 | 101 | 627 |  |
| 29 | /banks | 33 |  | 32/43 | 109 | 637 |  |
| 30 | /bank-rates | 29 |  | 17/27 | 85 | 649 |  |
| 31 | /categories | 33 |  | 33/47 | 101 | 663 |  |
| 32 | /catalogue | 38 |  | 32/43 | 101 | 686 |  |
| 33 | /compare | 28 |  | 10/14 | 109 | 674 |  |
| 34 | /matches | 32 |  | 32/44 | 89 | 683 |  |
| 35 | /calculator | 44 |  | 17/24 | 81 | 673 |  |
| 36 | /projections | 24 |  | 23/34 | 101 | 673 |  |
| 37 | /profile | 28 |  | 16/25 | 73 | 678 |  |
| 38 | /research | 32 |  | 17/27 | 85 | 687 |  |
| 39 | /rba | 31 |  | 16/26 | 109 | 706 |  |
| 40 | /rba-response | 28 |  | 20/31 | 61 | 705 |  |
| 41 | /settings | 28 |  | 16/27 | 69 | 703 |  |
| 42 | /about | 27 |  | 12/22 | 77 | 703 |  |
| 43 | /terms | 23 |  | 11/24 | 69 | 704 |  |
| 44 | /privacy | 27 |  |  |  | 703 |  |
| 45 | /third-party-notices | 29 |  | 15/25 | 81 | 707 |  |
| 46 | /node | 28 |  | 32/45 | 85 | 728 |  |
| 47 | /passthrough | 31 |  | 33/46 | 101 | 707 |  |
| 48 | /calculation-receipt | 33 |  | 11/23 | 69 | 701 |  |
| 49 | /rate-receipt | 29 |  | 7/9 | 81 | 701 |  |
| 50 | warm resume | 319 |  | 4/5 | 129 | 701 |  |
| 51 | cold relaunch | 9947 |  | 23/29 | 450 | 576 | 3 errors; start 4278ms; boot js-start 897616, layout-mounted 897832, hydrated 897875, cache-read 899181, core-ready 899895, rows-prepared 900031, search-index-idle 900031, detail-filters-idle 900031, leading-requested 900031, last-pricing 900031, splash-hide 900032, manifest 901961, leading-scoped 902399, leading-page 902399, resolved 902771, pricing-ready 903488, last-rows 903488, rates-ready 903670, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 19, pricing-scope-ms 1535, filter-runs 1, filter-rows 6878, filter-yields 4, filter-ms 100, sort-runs 1, sort-rows 1182, sort-yields 1, sort-ms 15 |
| 52 | about | 31 | -5 | 14/21 | 73 | 605 |  |
| 53 | audit screen | 21 | 0 | 117/203 | 61 | 584 |  |
| 54 | audit 0 min | 0 | 0 | 7/7 | 150 | 615 |  |
| 55 | audit 1 min | 0 |  | 1036/1182 | 113 | 1005 | 80 errors |
| 56 | audit 3 min | 0 |  | 560/608 | 125 | 1015 | 80 errors |
| 57 | audit 5 min | 0 |  | 909/1031 | 105 | 1096 | 80 errors |
| 58 | audit 6 min | 0 |  | 729/842 | 105 | 1116 | 80 errors |
| 59 | audit 8 min | 0 |  | 448/511 | 117 | 1190 | 80 errors |
| 60 | audit 9 min | 0 |  | 262/280 | 117 | 1196 | 80 errors |
| 61 | audit 11 min | 0 |  | 932/1078 | 109 | 1333 | 80 errors |
| 62 | audit 12 min | 0 |  | 747/859 | 105 | 1376 | 80 errors |
| 63 | audit 14 min | 0 |  | 523/586 | 117 | 1237 | 80 errors |
| 64 | audit 15 min | 0 |  | 159/189 | 34 | 1252 |  |
| 65 | audit 17 min | 0 |  | 170/201 | 48 | 1289 |  |
| 66 | audit 18 min | 0 |  | 20/27 | 85 | 1347 |  |
| 67 | audit finished | 0 | 0 | 110/190 | 69 | 1340 |  |
| 68 | audit result 1 | 0 | 0 |  |  | 1314 |  |
| 69 | audit result 2 | 0 | 0 |  |  | 1311 |  |
| 70 | audit result 3 | 0 | 0 |  |  | 1311 |  |
| 71 | audit result 4 | 0 | 0 |  |  | 1314 |  |
| 72 | audit result 5 | 0 | 0 |  |  | 1312 |  |
| 73 | audit result 6 | 0 | 0 |  |  | 1315 |  |
| 74 | audit result 7 | 0 | 0 |  |  | 1313 |  |
| 75 | audit result 8 | 0 | 0 |  |  | 1313 |  |
| 76 | audit result 9 | 0 | 0 |  |  | 1315 |  |
| 77 | audit result 10 | 0 | 0 |  |  | 1313 |  |
| 78 | audit result 11 | 0 | 0 |  |  | 1317 |  |
| 79 | audit result 12 | 0 | 0 |  |  | 1314 |  |
| 80 | about for debug log | 3533 | +3508 | 21/32 | 69 | 1355 |  |
| 81 | debug log screen | 0 | 0 | 102/195 | 65 | 1362 |  |

## Errors

### 1 open app
```
11-21 18:08:43.857 E/australianrates(10490): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-21 18:12:43.345 E/australianrates(12820): Not starting debugger since process cannot load the jdwp agent.
11-21 18:12:47.798 E/SurfaceSyncGroup(12820): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-21 18:12:47.798 E/SurfaceSyncGroup(12820): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 51 cold relaunch
```
11-21 18:16:32.953 E/australianrates(15823): Not starting debugger since process cannot load the jdwp agent.
11-21 18:16:37.150 E/SurfaceSyncGroup(15823): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-21 18:16:37.150 E/SurfaceSyncGroup(15823): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 55 audit 1 min
```
11-21 18:17:50.379 E/ReactNativeJS(15823): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqqd8ld-70c79f69a4a7d180","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":5288.5,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":179,"liveStage:dates-index:fetched:ms":119.3,"liveStage:revision:verified:ms":102.1,"liveStage:Core asset:downloaded:ms":237.5,"liveStage:Core asset:hash-verified:ms":7.5,"liveStage:Core asset:native-inflated-and-text-decoded:ms":165.9,"liveStage:Core asset:inflated:ms":0.2,"liveStage:Core asset:text-decoded:ms":0.1,"liveStage:Core asset:decoded:ms":271.8,"liveStage:core:history-sealed:ms":0,"liveStage:core:normalized:ms":598.6,"liveStage:Details asset:downloaded:ms":1579.8,"liveStage:Details asset:hash-verified:ms":27.5,"liveS…
11-21 18:17:50.381 E/unknown:ReactNative(15823): ?anon_0_@1:3690723
11-21 18:17:50.381 E/unknown:ReactNative(15823): ?anon_0_@1:3696523
11-21 18:17:50.381 E/unknown:ReactNative(15823): SyntheticError@1:162984
11-21 18:17:50.381 E/unknown:ReactNative(15823): Wrapper@1:163499
11-21 18:17:50.381 E/unknown:ReactNative(15823): _callSuper@1:148372
11-21 18:17:50.381 E/unknown:ReactNative(15823): _construct@1:163847
11-21 18:17:50.381 E/unknown:ReactNative(15823): _next@1:594835
```

### 56 audit 3 min
```
11-21 18:19:40.016 E/ReactNativeJS(15823): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqqd8ld-70c79f69a4a7d180","check":{"id":"deep-first-pass.route.rates.search.query.clear","label":"route.rates: search.query.clear (first-pass)","kind":"journey","status":"fail","durationMs":1485.7,"metrics":{"journeyId":"route.rates.search.query.clear","journeyLabel":"route.rates: search.query.clear","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.query.clear","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":1,"actionRevisionAfter":2,"renderRevisionBefore":"state-15","renderRevisionAfter":"state-18","actionMs":26.4,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks"…
11-21 18:19:40.017 E/unknown:ReactNative(15823): ?anon_0_@1:3690723
11-21 18:19:40.017 E/unknown:ReactNative(15823): ?anon_0_@1:3696523
11-21 18:19:40.017 E/unknown:ReactNative(15823): SyntheticError@1:162984
11-21 18:19:40.017 E/unknown:ReactNative(15823): Wrapper@1:163499
11-21 18:19:40.017 E/unknown:ReactNative(15823): _callSuper@1:148372
11-21 18:19:40.017 E/unknown:ReactNative(15823): _construct@1:163847
11-21 18:19:40.017 E/unknown:ReactNative(15823): _next@1:594835
```

### 57 audit 5 min
```
11-21 18:21:22.552 E/ReactNativeJS(15823): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqqd8ld-70c79f69a4a7d180","check":{"id":"deep-first-pass.route.product.product.receipt.open","label":"route.product: product.receipt.open (first-pass)","kind":"journey","status":"fail","durationMs":1685.8,"metrics":{"journeyId":"route.product.product.receipt.open","journeyLabel":"route.product: product.receipt.open","iteration":"cold","passId":"first-pass","scenarioId":"route.product","semanticActionId":"product.receipt.open","depth":1,"plannedExpectedPath":"/rate-receipt","expectedPath":"/rate-receipt","expectedSurface":"receipt.evidence","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":2,"actionRevisionAfter":3,"actionMs":358.2,"preActionWaitMs":1.6,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scroll…
11-21 18:21:22.554 E/unknown:ReactNative(15823): ?anon_0_@1:3690723
11-21 18:21:22.554 E/unknown:ReactNative(15823): ?anon_0_@1:3696523
11-21 18:21:22.554 E/unknown:ReactNative(15823): SyntheticError@1:162984
11-21 18:21:22.554 E/unknown:ReactNative(15823): Wrapper@1:163499
11-21 18:21:22.554 E/unknown:ReactNative(15823): _callSuper@1:148372
11-21 18:21:22.554 E/unknown:ReactNative(15823): _construct@1:163847
11-21 18:21:22.554 E/unknown:ReactNative(15823): _next@1:594835
```

### 58 audit 6 min
```
11-21 18:22:59.188 E/ReactNativeJS(15823): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqqd8ld-70c79f69a4a7d180","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":4203.2,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-22:e8f2f86bb11d…:state-7","renderRevisionAfter":"2026-11-22:e8f2f86bb11d…:state-8","actionResultEvidence":"{\"applied\":…
11-21 18:22:59.190 E/unknown:ReactNative(15823): ?anon_0_@1:3690723
11-21 18:22:59.190 E/unknown:ReactNative(15823): ?anon_0_@1:3696523
11-21 18:22:59.190 E/unknown:ReactNative(15823): SyntheticError@1:162984
11-21 18:22:59.190 E/unknown:ReactNative(15823): Wrapper@1:163499
11-21 18:22:59.190 E/unknown:ReactNative(15823): _callSuper@1:148372
11-21 18:22:59.190 E/unknown:ReactNative(15823): _construct@1:163847
11-21 18:22:59.190 E/unknown:ReactNative(15823): _next@1:594835
```

### 59 audit 8 min
```
11-21 18:24:43.529 E/ReactNativeJS(15823): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqqd8ld-70c79f69a4a7d180","check":{"id":"deep-first-pass.redirect.categories.redirect.categories.verify","label":"redirect.categories: redirect.categories.verify (first-pass)","kind":"journey","status":"fail","durationMs":2965.2,"metrics":{"journeyId":"redirect.categories.redirect.categories.verify","journeyLabel":"redirect.categories: redirect.categories.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.categories","semanticActionId":"redirect.categories.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":138,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":2140.2,"forwardWorkMs":2140.2,"navigation…
11-21 18:24:43.532 E/unknown:ReactNative(15823): ?anon_0_@1:3690723
11-21 18:24:43.532 E/unknown:ReactNative(15823): ?anon_0_@1:3696523
11-21 18:24:43.532 E/unknown:ReactNative(15823): SyntheticError@1:162984
11-21 18:24:43.532 E/unknown:ReactNative(15823): Wrapper@1:163499
11-21 18:24:43.532 E/unknown:ReactNative(15823): _callSuper@1:148372
11-21 18:24:43.532 E/unknown:ReactNative(15823): _construct@1:163847
11-21 18:24:43.532 E/unknown:ReactNative(15823): _next@1:594835
```

### 60 audit 9 min
```
11-21 18:25:26.587 E/ReactNativeJS(15823): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqqd8ld-70c79f69a4a7d180","check":{"id":"deep-repeat.route.rates.search.filters.open","label":"route.rates: search.filters.open (repeat)","kind":"journey","status":"fail","durationMs":6108,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":26,"actionRevisionAfter":27,"renderRevisionBefore":"state-25","renderRevisionAfter":"state-28","actionMs":0.2,"preActionWaitMs":0.7,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repe…
11-21 18:25:26.589 E/unknown:ReactNative(15823): ?anon_0_@1:3690723
11-21 18:25:26.589 E/unknown:ReactNative(15823): ?anon_0_@1:3696523
11-21 18:25:26.589 E/unknown:ReactNative(15823): SyntheticError@1:162984
11-21 18:25:26.589 E/unknown:ReactNative(15823): Wrapper@1:163499
11-21 18:25:26.589 E/unknown:ReactNative(15823): _callSuper@1:148372
11-21 18:25:26.589 E/unknown:ReactNative(15823): _construct@1:163847
11-21 18:25:26.589 E/unknown:ReactNative(15823): _next@1:594835
```

### 61 audit 11 min
```
11-21 18:26:39.468 E/ReactNativeJS(15823): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqqd8ld-70c79f69a4a7d180","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.mortgage.scope.clear","label":"route.rates-mortgage-scope: search.mortgage.scope.clear (repeat)","kind":"journey","status":"fail","durationMs":9591.1,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.clear","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.clear","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.clear","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":45,"actionRevisionAfter":46,"renderRevisionBefore":"state-21","renderRevisionAfter":"state-27","actionMs":158.7,"preActionWaitMs":1,"preActionQuietWindowReused":true,"preActionQuietWindowA…
11-21 18:26:39.470 E/unknown:ReactNative(15823): ?anon_0_@1:3690723
11-21 18:26:39.470 E/unknown:ReactNative(15823): ?anon_0_@1:3696523
11-21 18:26:39.470 E/unknown:ReactNative(15823): SyntheticError@1:162984
11-21 18:26:39.470 E/unknown:ReactNative(15823): Wrapper@1:163499
11-21 18:26:39.470 E/unknown:ReactNative(15823): _callSuper@1:148372
11-21 18:26:39.470 E/unknown:ReactNative(15823): _construct@1:163847
11-21 18:26:39.470 E/unknown:ReactNative(15823): _next@1:594835
```

### 62 audit 12 min
```
11-21 18:28:26.659 E/ReactNativeJS(15823): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqqd8ld-70c79f69a4a7d180","check":{"id":"deep-repeat.sample.catalogue.5.product.open","label":"sample.catalogue.5: product.open (repeat)","kind":"journey","status":"fail","durationMs":1582.4,"metrics":{"journeyId":"sample.catalogue.5.product.open","journeyLabel":"sample.catalogue.5: product.open","iteration":"warm","passId":"repeat","scenarioId":"sample.catalogue.5","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/TMCU%7CSELFMANAGED_SUPER_FUND%7CTERM_DEPOSITS%7CSELFMANAGED%20SUPER%20FUND","expectedPath":"/product/TMCU%7CSELFMANAGED_SUPER_FUND%7CTERM_DEPOSITS%7CSELFMANAGED%20SUPER%20FUND","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":346.3,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalI…
11-21 18:28:26.661 E/unknown:ReactNative(15823): ?anon_0_@1:3690723
11-21 18:28:26.661 E/unknown:ReactNative(15823): ?anon_0_@1:3696523
11-21 18:28:26.661 E/unknown:ReactNative(15823): SyntheticError@1:162984
11-21 18:28:26.661 E/unknown:ReactNative(15823): Wrapper@1:163499
11-21 18:28:26.661 E/unknown:ReactNative(15823): _callSuper@1:148372
11-21 18:28:26.661 E/unknown:ReactNative(15823): _construct@1:163847
11-21 18:28:26.661 E/unknown:ReactNative(15823): _next@1:594835
```

### 63 audit 14 min
```
11-21 18:30:18.440 E/ReactNativeJS(15823): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqqd8ld-70c79f69a4a7d180","check":{"id":"deep-repeat.route.not-found.not-found.home","label":"route.not-found: not-found.home (repeat)","kind":"journey","status":"fail","durationMs":9854.8,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"warm","passId":"repeat","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":1,"actionRevisionAfter":2,"renderRevisionBefore":"not-found-v1","actionMs":150.2,"preActionWaitMs":0.8,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetour…
11-21 18:30:18.441 E/unknown:ReactNative(15823): ?anon_0_@1:3690723
11-21 18:30:18.441 E/unknown:ReactNative(15823): ?anon_0_@1:3696523
11-21 18:30:18.441 E/unknown:ReactNative(15823): SyntheticError@1:162984
11-21 18:30:18.441 E/unknown:ReactNative(15823): Wrapper@1:163499
11-21 18:30:18.441 E/unknown:ReactNative(15823): _callSuper@1:148372
11-21 18:30:18.441 E/unknown:ReactNative(15823): _construct@1:163847
11-21 18:30:18.441 E/unknown:ReactNative(15823): _next@1:594835
```
