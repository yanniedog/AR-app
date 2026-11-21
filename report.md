# App explorer: 1.0.342 (398)

**Real-use session FAIL vs 1.0.340: 1 broken, 13 friction, 0 slower**

- Broken: 95% dropped frames on "scroll lenders"
- Friction: No reaction for 4.1 s after "scroll rates 1"
- Friction: No reaction for 3.4 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.3 s after "scroll lenders"
- Friction: No reaction for 4.8 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.4 s after "open filters"
- Friction: No reaction for 3.1 s after "open market"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode full | 82 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 13
Baseline 1.0.340
**Audit live: outcome completed | 1096 s | audit log 848110 bytes (audit-log.txt) https://paste.c-net.org/e583c442-1f22-b9f5-88b0-af96c2d40578 | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3201 |  | 769/1029 | 85 | 485 | 1 errors; start 3150ms |
| 2 | scroll rates 1 | 692 |  | 36/59 | 85 | 478 | boot js-start 433301, layout-mounted 433939, cache-read 434058, hydrated 434287, splash-hide 434287, manifest 435434, resolved 435902, core-fetched 441458, core-saved 442624, rows-prepared 443233, search-index-idle 443233, details-start 444173, pricing-ready 451037, last-gate 451267, details-fetched 454582, detail-filters-idle 463970, last-pricing 463970, suitability-built 465284, post-refresh-wait 466296, last-rows 478991, rates-ready 479234 |
| 3 | scroll rates 2 | 716 |  | 26/34 | 89 | 632 |  |
| 4 | scroll rates back | 678 |  |  |  | 539 |  |
| 5 | open product | 5740 |  | 39/57 | 89 | 630 |  |
| 6 | scroll product | 701 |  | 32/52 | 81 | 646 |  |
| 7 | back to rates | 31 |  | 14/21 | 85 | 623 |  |
| 8 | open lenders | 23 |  | 20/24 | 200 | 615 |  |
| 9 | scroll lenders | 776 |  | 19/20 | 150 | 613 |  |
| 10 | back from lenders | 22 |  | 8/9 | 150 | 615 |  |
| 11 | switch to savings | 25 |  | 62/87 | 81 | 629 |  |
| 12 | switch to home loans | 23 |  | 17/29 | 65 | 643 |  |
| 13 | open filters | 22 |  | 18/27 | 117 | 649 |  |
| 14 | close filters | 23 |  | 5/8 | 200 | 641 |  |
| 15 | open market | 22 |  | 15/30 | 61 | 642 |  |
| 16 | open rba | 26 |  | 19/29 | 65 | 640 |  |
| 17 | scroll rba | 695 |  | 25/40 | 81 | 639 |  |
| 18 | back from rba | 26 |  | 12/16 | 81 | 642 |  |
| 19 | scroll market | 712 |  | 27/40 | 77 | 641 |  |
| 20 | open saved | 23 |  | 15/24 | 65 | 646 |  |
| 21 | return to rates | 23 |  | 18/32 | 85 | 648 |  |
| 22 | cold start | 10006 | -9375 | 31/37 | 117 | 585 | 3 errors; start 4236ms; boot js-start 673961, layout-mounted 674151, hydrated 674284, cache-read 675494, core-ready 676238, rows-prepared 676353, search-index-idle 676353, detail-filters-idle 676353, last-pricing 676353, splash-hide 676355, manifest 678441, resolved 679236, pricing-ready 680069, last-rows 680069, rates-ready 680353 |
| 23 | /browse | 31 | -82 | 2/2 | 32 | 626 |  |
| 24 | /watchlist | 25 | -80 | 3/3 | 109 | 436 |  |
| 25 | /market | 23 | -4794 | 14/19 | 61 | 504 |  |
| 26 | /tools | 31 | -24 | 12/20 | 250 | 566 |  |
| 27 | /trends | 28 | -17 |  |  | 655 |  |
| 28 | /search | 41 | -79 | 44/60 | 105 | 619 |  |
| 29 | /banks | 25 | -18 | 36/46 | 101 | 628 |  |
| 30 | /bank-rates | 25 | -35 | 16/25 | 81 | 638 |  |
| 31 | /categories | 25 | -3 | 37/48 | 105 | 650 |  |
| 32 | /catalogue | 26 | -3 | 33/43 | 105 | 678 |  |
| 33 | /compare | 27 | -14 | 11/14 | 129 | 662 |  |
| 34 | /matches | 26 | -2 | 38/46 | 93 | 672 |  |
| 35 | /calculator | 31 | +1 | 15/23 | 85 | 657 |  |
| 36 | /projections | 27 | 0 | 19/29 | 85 | 656 |  |
| 37 | /profile | 27 | 0 | 17/24 | 61 | 662 |  |
| 38 | /research | 27 | -4 | 19/28 | 73 | 670 |  |
| 39 | /rba | 24 | -4 | 16/26 | 77 | 702 |  |
| 40 | /rba-response | 27 | 0 | 19/32 | 69 | 682 |  |
| 41 | /settings | 31 | +3 | 14/22 | 81 | 688 |  |
| 42 | /about | 24 | -1 | 16/25 | 77 | 687 |  |
| 43 | /terms | 30 | +5 | 12/22 | 61 | 689 |  |
| 44 | /privacy | 31 | 0 |  |  | 688 |  |
| 45 | /third-party-notices | 31 | -1 | 15/25 | 73 | 691 |  |
| 46 | /node | 29 | +6 | 36/48 | 89 | 717 |  |
| 47 | /passthrough | 34 | +4 | 37/46 | 93 | 701 |  |
| 48 | /calculation-receipt | 34 | 0 | 15/23 | 77 | 687 |  |
| 49 | /rate-receipt | 29 | 0 | 9/10 | 81 | 688 |  |
| 50 | warm resume | 334 | -352 | 2/2 | 48 | 687 |  |
| 51 | cold relaunch | 10229 | +333 | 29/39 | 117 | 576 | 1 errors; start 4257ms; boot js-start 903725, layout-mounted 903916, hydrated 904051, cache-read 905281, core-ready 906030, rows-prepared 906161, search-index-idle 906161, detail-filters-idle 906161, last-pricing 906161, splash-hide 906162, manifest 908392, resolved 909229, pricing-ready 910078, last-rows 910078, rates-ready 910357 |
| 52 | about | 29 |  | 12/18 | 250 | 408 |  |
| 53 | audit screen | 22 |  | 116/203 | 61 | 608 |  |
| 54 | audit 0 min | 0 |  | 30/33 | 48 | 733 |  |
| 55 | audit 2 min | 0 |  | 1077/1220 | 113 | 945 | 80 errors |
| 56 | audit 4 min | 0 |  | 825/921 | 113 | 1110 | 80 errors |
| 57 | audit 5 min | 0 |  | 430/500 | 105 | 1126 | 80 errors |
| 58 | audit 7 min | 0 |  | 819/911 | 109 | 1155 | 80 errors |
| 59 | audit 8 min | 0 |  | 414/463 | 117 | 1124 | 80 errors |
| 60 | audit 9 min | 0 |  | 758/847 | 113 | 1273 | 80 errors |
| 61 | audit 11 min | 0 |  | 414/483 | 109 | 1212 | 80 errors |
| 62 | audit 12 min | 0 |  | 806/929 | 101 | 1317 | 80 errors |
| 63 | audit 13 min | 0 |  | 437/487 | 121 | 1306 | 80 errors |
| 64 | audit 14 min | 0 |  | 122/143 | 36 | 1320 | 38 errors |
| 65 | audit 15 min | 0 |  | 96/120 | 34 | 1338 |  |
| 66 | audit 17 min | 0 |  | 147/176 | 42 | 1234 |  |
| 67 | audit 18 min | 0 |  | 56/69 | 85 | 1360 |  |
| 68 | audit finished | 0 |  | 80/135 | 73 | 1368 |  |
| 69 | audit result 1 | 0 |  |  |  | 1360 |  |
| 70 | audit result 2 | 0 |  |  |  | 1357 |  |
| 71 | audit result 3 | 0 |  |  |  | 1360 |  |
| 72 | audit result 4 | 0 |  |  |  | 1359 |  |
| 73 | audit result 5 | 0 |  |  |  | 1361 |  |
| 74 | audit result 6 | 0 |  |  |  | 1363 |  |
| 75 | audit result 7 | 0 |  |  |  | 1361 |  |
| 76 | audit result 8 | 0 |  |  |  | 1364 |  |
| 77 | audit result 9 | 0 |  |  |  | 1363 |  |
| 78 | audit result 10 | 0 |  |  |  | 1364 |  |
| 79 | audit result 11 | 0 |  |  |  | 1366 |  |
| 80 | audit result 12 | 0 |  |  |  | 1363 |  |
| 81 | about for debug log | 3892 |  | 19/32 | 57 | 1229 |  |
| 82 | debug log screen | 0 |  | 108/198 | 65 | 1219 |  |

## Errors

### 1 open app
```
11-21 10:47:08.692 E/australianrates(10303): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-21 10:51:10.505 E/australianrates(12555): Not starting debugger since process cannot load the jdwp agent.
11-21 10:51:14.510 E/SurfaceSyncGroup(12555): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-21 10:51:14.510 E/SurfaceSyncGroup(12555): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 51 cold relaunch
```
11-21 10:55:00.105 E/australianrates(15477): Not starting debugger since process cannot load the jdwp agent.
```

### 55 audit 2 min
```
11-21 10:56:16.087 E/ReactNativeJS(15477): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqaley3-caf6a98a0c25596d","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":5246,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":210.9,"liveStage:dates-index:fetched:ms":164.1,"liveStage:revision:verified:ms":57,"liveStage:Core asset:downloaded:ms":246.1,"liveStage:Core asset:hash-verified:ms":12.1,"liveStage:Core asset:native-inflated-and-text-decoded:ms":168,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":224.5,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":654.6,"liveStage:Details asset:downloaded:ms":1529.1,"liveStage:Details asset:hash-verified:ms":30.2,"liveStage:D…
11-21 10:56:16.090 E/unknown:ReactNative(15477): ?anon_0_@1:3688455
11-21 10:56:16.090 E/unknown:ReactNative(15477): ?anon_0_@1:3694255
11-21 10:56:16.090 E/unknown:ReactNative(15477): SyntheticError@1:162956
11-21 10:56:16.090 E/unknown:ReactNative(15477): Wrapper@1:163471
11-21 10:56:16.090 E/unknown:ReactNative(15477): _callSuper@1:148344
11-21 10:56:16.090 E/unknown:ReactNative(15477): _construct@1:163819
11-21 10:56:16.090 E/unknown:ReactNative(15477): _next@1:594807
```

### 56 audit 4 min
```
11-21 10:58:18.575 E/ReactNativeJS(15477): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqaley3-caf6a98a0c25596d","check":{"id":"deep-first-pass.route.rates.search.filters.open","label":"route.rates: search.filters.open (first-pass)","kind":"journey","status":"fail","durationMs":6343,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRevisionAfter":4,"renderRevisionBefore":"state-23","renderRevisionAfter":"state-26","actionMs":0.2,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtrack…
11-21 10:58:18.576 E/unknown:ReactNative(15477): ?anon_0_@1:3688455
11-21 10:58:18.576 E/unknown:ReactNative(15477): ?anon_0_@1:3694255
11-21 10:58:18.576 E/unknown:ReactNative(15477): SyntheticError@1:162956
11-21 10:58:18.576 E/unknown:ReactNative(15477): Wrapper@1:163471
11-21 10:58:18.576 E/unknown:ReactNative(15477): _callSuper@1:148344
11-21 10:58:18.576 E/unknown:ReactNative(15477): _construct@1:163819
11-21 10:58:18.576 E/unknown:ReactNative(15477): _next@1:594807
```

### 57 audit 5 min
```
11-21 11:00:41.517 E/ReactNativeJS(15477): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqaley3-caf6a98a0c25596d","check":{"id":"deep-first-pass.route.lender.lender.move.first","label":"route.lender: lender.move.first (first-pass)","kind":"journey","status":"fail","durationMs":10006.5,"metrics":{"journeyId":"route.lender.lender.move.first","journeyLabel":"route.lender: lender.move.first","iteration":"cold","passId":"first-pass","scenarioId":"route.lender","semanticActionId":"lender.move.first","depth":2,"plannedExpectedPath":"/bank/Judo%20Bank","expectedPath":"/bank/Judo%20Bank","expectedSurface":"lender.details","actionSource":"lender.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRevisionAfter":4,"renderRevisionBefore":"Judo Bank:8:1:7:rich:27:9d0f4b5c4416…:Judo Bank:Savings:2026-11-21:193:1:7:rich:27:9d0f4b5c4416…:Judo Bank:Savings:2026-11-21:193:Savings:90D:2026-11-21:91:idle:moves-on-demand","renderRevisionAfter":"Judo Bank:8:1:7:rich:2…
11-21 11:00:41.518 E/unknown:ReactNative(15477): ?anon_0_@1:3688455
11-21 11:00:41.518 E/unknown:ReactNative(15477): ?anon_0_@1:3694255
11-21 11:00:41.518 E/unknown:ReactNative(15477): SyntheticError@1:162956
11-21 11:00:41.518 E/unknown:ReactNative(15477): Wrapper@1:163471
11-21 11:00:41.518 E/unknown:ReactNative(15477): _callSuper@1:148344
11-21 11:00:41.518 E/unknown:ReactNative(15477): _construct@1:163819
11-21 11:00:41.518 E/unknown:ReactNative(15477): _next@1:594807
```

### 58 audit 7 min
```
11-21 11:01:23.594 E/ReactNativeJS(15477): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqaley3-caf6a98a0c25596d","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":1626.4,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-21:22f3e7dd04ce…:state-7","renderRevisionAfter":"2026-11-21:22f3e7dd04ce…:state-8","actionResultEvidence":"{\"applied\":…
11-21 11:01:23.595 E/unknown:ReactNative(15477): ?anon_0_@1:3688455
11-21 11:01:23.595 E/unknown:ReactNative(15477): ?anon_0_@1:3694255
11-21 11:01:23.595 E/unknown:ReactNative(15477): SyntheticError@1:162956
11-21 11:01:23.595 E/unknown:ReactNative(15477): Wrapper@1:163471
11-21 11:01:23.595 E/unknown:ReactNative(15477): _callSuper@1:148344
11-21 11:01:23.595 E/unknown:ReactNative(15477): _construct@1:163819
11-21 11:01:23.595 E/unknown:ReactNative(15477): _next@1:594807
```

### 59 audit 8 min
```
11-21 11:03:13.009 E/ReactNativeJS(15477): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqaley3-caf6a98a0c25596d","check":{"id":"deep-first-pass.redirect.banks.redirect.banks.verify","label":"redirect.banks: redirect.banks.verify (first-pass)","kind":"journey","status":"fail","durationMs":2927.3,"metrics":{"journeyId":"redirect.banks.redirect.banks.verify","journeyLabel":"redirect.banks: redirect.banks.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.banks","semanticActionId":"redirect.banks.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":58.1,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":2118,"forwardWorkMs":2118,"navigationCommitMs":1842.3,"firstReadyFrameMs":275.7,"firstRead…
11-21 11:03:13.010 E/unknown:ReactNative(15477): ?anon_0_@1:3688455
11-21 11:03:13.010 E/unknown:ReactNative(15477): ?anon_0_@1:3694255
11-21 11:03:13.010 E/unknown:ReactNative(15477): SyntheticError@1:162956
11-21 11:03:13.010 E/unknown:ReactNative(15477): Wrapper@1:163471
11-21 11:03:13.010 E/unknown:ReactNative(15477): _callSuper@1:148344
11-21 11:03:13.010 E/unknown:ReactNative(15477): _construct@1:163819
11-21 11:03:13.010 E/unknown:ReactNative(15477): _next@1:594807
```

### 60 audit 9 min
```
11-21 11:03:54.460 E/ReactNativeJS(15477): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqaley3-caf6a98a0c25596d","check":{"id":"deep-repeat.route.rates.search.filters.open","label":"route.rates: search.filters.open (repeat)","kind":"journey","status":"fail","durationMs":5594,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":26,"actionRevisionAfter":27,"renderRevisionBefore":"state-24","renderRevisionAfter":"state-27","actionMs":0.2,"preActionWaitMs":0.8,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repe…
11-21 11:03:54.462 E/unknown:ReactNative(15477): ?anon_0_@1:3688455
11-21 11:03:54.462 E/unknown:ReactNative(15477): ?anon_0_@1:3694255
11-21 11:03:54.462 E/unknown:ReactNative(15477): SyntheticError@1:162956
11-21 11:03:54.462 E/unknown:ReactNative(15477): Wrapper@1:163471
11-21 11:03:54.462 E/unknown:ReactNative(15477): _callSuper@1:148344
11-21 11:03:54.462 E/unknown:ReactNative(15477): _construct@1:163819
11-21 11:03:54.462 E/unknown:ReactNative(15477): _next@1:594807
```

### 61 audit 11 min
```
11-21 11:05:48.949 E/ReactNativeJS(15477): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqaley3-caf6a98a0c25596d","check":{"id":"deep-repeat.route.lender.lender.chart.section.next","label":"route.lender: lender.chart.section.next (repeat)","kind":"journey","status":"fail","durationMs":10476.2,"metrics":{"journeyId":"route.lender.lender.chart.section.next","journeyLabel":"route.lender: lender.chart.section.next","iteration":"warm","passId":"repeat","scenarioId":"route.lender","semanticActionId":"lender.chart.section.next","depth":1,"plannedExpectedPath":"/bank/Judo%20Bank","expectedPath":"/bank/Judo%20Bank","expectedSurface":"lender.details","actionSource":"lender.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":4,"actionRevisionAfter":5,"renderRevisionBefore":"Judo Bank:24:1:9:rich:77:9d0f4b5c4416…:Judo Bank:Mortgage:2026-11-21:193:1:9:rich:77:9d0f4b5c4416…:Judo Bank:Mortgage:2026-11-21:193:Mortgage:30D:2026-11-21:31:idle:moves-on-demand","renderRevisi…
11-21 11:05:48.951 E/unknown:ReactNative(15477): ?anon_0_@1:3688455
11-21 11:05:48.951 E/unknown:ReactNative(15477): ?anon_0_@1:3694255
11-21 11:05:48.951 E/unknown:ReactNative(15477): SyntheticError@1:162956
11-21 11:05:48.951 E/unknown:ReactNative(15477): Wrapper@1:163471
11-21 11:05:48.951 E/unknown:ReactNative(15477): _callSuper@1:148344
11-21 11:05:48.951 E/unknown:ReactNative(15477): _construct@1:163819
11-21 11:05:48.951 E/unknown:ReactNative(15477): _next@1:594807
```

### 62 audit 12 min
```
11-21 11:06:41.031 E/ReactNativeJS(15477): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqaley3-caf6a98a0c25596d","check":{"id":"deep-repeat.sample.catalogue.4.product.open","label":"sample.catalogue.4: product.open (repeat)","kind":"journey","status":"fail","durationMs":1926.8,"metrics":{"journeyId":"sample.catalogue.4.product.open","journeyLabel":"sample.catalogue.4: product.open","iteration":"warm","passId":"repeat","scenarioId":"sample.catalogue.4","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Greater%20Bank%7C3005%7CTERM_DEPOSITS%7CTerm%20Investment%20-%20Interest%206%20Monthly","expectedPath":"/product/Greater%20Bank%7C3005%7CTERM_DEPOSITS%7CTerm%20Investment%20-%20Interest%206%20Monthly","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":593.7,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"…
11-21 11:06:41.032 E/unknown:ReactNative(15477): ?anon_0_@1:3688455
11-21 11:06:41.032 E/unknown:ReactNative(15477): ?anon_0_@1:3694255
11-21 11:06:41.032 E/unknown:ReactNative(15477): SyntheticError@1:162956
11-21 11:06:41.032 E/unknown:ReactNative(15477): Wrapper@1:163471
11-21 11:06:41.032 E/unknown:ReactNative(15477): _callSuper@1:148344
11-21 11:06:41.032 E/unknown:ReactNative(15477): _construct@1:163819
11-21 11:06:41.032 E/unknown:ReactNative(15477): _next@1:594807
```

### 63 audit 13 min
```
11-21 11:08:41.856 E/ReactNativeJS(15477): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqaley3-caf6a98a0c25596d","check":{"id":"deep-repeat.route.not-found.not-found.home","label":"route.not-found: not-found.home (repeat)","kind":"journey","status":"fail","durationMs":10275.8,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"warm","passId":"repeat","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":1,"actionRevisionAfter":2,"renderRevisionBefore":"not-found-v1","actionMs":106.9,"preActionWaitMs":0.5,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetou…
11-21 11:08:41.859 E/unknown:ReactNative(15477): ?anon_0_@1:3688455
11-21 11:08:41.859 E/unknown:ReactNative(15477): ?anon_0_@1:3694255
11-21 11:08:41.859 E/unknown:ReactNative(15477): SyntheticError@1:162956
11-21 11:08:41.859 E/unknown:ReactNative(15477): Wrapper@1:163471
11-21 11:08:41.859 E/unknown:ReactNative(15477): _callSuper@1:148344
11-21 11:08:41.859 E/unknown:ReactNative(15477): _construct@1:163819
11-21 11:08:41.859 E/unknown:ReactNative(15477): _next@1:594807
```

### 64 audit 14 min
```
11-21 11:09:35.948 E/ReactNativeJS(15477): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqaley3-caf6a98a0c25596d","check":{"id":"external-link-156","kind":"network","status":"fail","durationMs":1163.3355430001393,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"pass","browserHandler":"pass","httpReachability":"fail","statusCode":404,"handlerAttempted":true,"httpAttempted":true,"httpSelected":true,"handlerResolution":"pass","host":"www.bankaust.com.au","destinationPath":"/clean-energy-home-loan-key-information"},"error":"HTTP 404: the destination is missing or unavailable.","canonicalMetrics":true}}
11-21 11:09:35.950 E/unknown:ReactNative(15477): ?anon_0_@1:3688455
11-21 11:09:35.950 E/unknown:ReactNative(15477): ?anon_0_@1:3697816
11-21 11:09:35.950 E/unknown:ReactNative(15477): SyntheticError@1:162956
11-21 11:09:35.950 E/unknown:ReactNative(15477): Wrapper@1:163471
11-21 11:09:35.950 E/unknown:ReactNative(15477): _callSuper@1:148344
11-21 11:09:35.950 E/unknown:ReactNative(15477): _construct@1:163819
11-21 11:09:35.950 E/unknown:ReactNative(15477): _next@1:594807
```
