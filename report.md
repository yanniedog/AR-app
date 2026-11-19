# App explorer: 1.0.313 (369)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode full | 62 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 14
Baseline 1.0.313
**Audit live: outcome completed | 1051 s | audit log 860458 bytes (audit-log.txt) https://paste.rs/rJQRi | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 27776 | -5714 | 36/45 | 300 | 628 | 4 errors; start 3451ms |
| 2 | /browse | 5127 | +337 | 11/11 | 69 | 514 |  |
| 3 | /watchlist | 106 | +12 | 4/5 | 48 | 566 |  |
| 4 | /market | 2488 | -2373 | 14/20 | 65 | 621 |  |
| 5 | /tools | 49 | +19 | 16/20 | 250 | 632 |  |
| 6 | /trends | 40 | +2 | 23/35 | 101 | 640 |  |
| 7 | /search | 37 | +7 | 30/38 | 150 | 502 |  |
| 8 | /banks | 38 | +10 | 36/42 | 117 | 506 |  |
| 9 | /bank-rates | 36 | +1 | 21/26 | 85 | 503 |  |
| 10 | /categories | 32 | +3 | 35/41 | 101 | 530 |  |
| 11 | /catalogue | 36 | +10 | 35/41 | 113 | 547 |  |
| 12 | /compare | 46 | +17 | 10/13 | 150 | 531 |  |
| 13 | /matches | 37 | +10 | 33/48 | 93 | 523 |  |
| 14 | /calculator | 32 | +1 | 16/21 | 101 | 524 |  |
| 15 | /projections | 37 | +12 | 23/33 | 121 | 528 |  |
| 16 | /profile | 33 | +2 | 16/24 | 65 | 531 |  |
| 17 | /research | 34 | +5 | 22/29 | 85 | 540 |  |
| 18 | /rba | 36 | -2422 | 14/22 | 85 | 546 |  |
| 19 | /rba-response | 40 | +11 | 17/29 | 85 | 549 |  |
| 20 | /settings | 34 | +6 | 16/20 | 109 | 555 |  |
| 21 | /about | 37 | +6 | 16/24 | 73 | 554 |  |
| 22 | /terms | 42 | +15 | 15/21 | 77 | 555 |  |
| 23 | /privacy | 40 | +13 |  |  | 555 |  |
| 24 | /third-party-notices | 42 | +13 | 13/21 | 69 | 558 |  |
| 25 | /node | 38 | +14 | 36/42 | 101 | 591 |  |
| 26 | /passthrough | 41 | +6 | 29/41 | 109 | 570 |  |
| 27 | /calculation-receipt | 38 | +10 | 15/25 | 81 | 562 |  |
| 28 | /rate-receipt | 43 | +11 | 6/9 | 89 | 563 |  |
| 29 | warm resume | 390 | -16 | 2/3 | 38 | 562 |  |
| 30 | cold relaunch | 9789 | +143 | 25/30 | 400 | 506 | 1 errors; start 4218ms |
| 31 | about | 61 | +21 | 16/22 | 81 | 401 |  |
| 32 | audit screen | 28 | +5 | 117/194 | 73 | 392 |  |
| 33 | audit 0 min | 0 | 0 | 51/54 | 133 | 619 | 19 errors |
| 34 | audit 2 min | 0 |  | 1174/1291 | 129 | 843 | 80 errors |
| 35 | audit 3 min | 0 |  | 501/559 | 125 | 849 | 80 errors |
| 36 | audit 4 min | 0 |  | 470/531 | 109 | 925 | 80 errors |
| 37 | audit 6 min | 0 |  | 923/1012 | 121 | 1027 | 80 errors |
| 38 | audit 7 min | 0 |  | 342/370 | 121 | 942 | 80 errors |
| 39 | audit 9 min | 0 |  | 515/576 | 125 | 971 | 80 errors |
| 40 | audit 10 min | 0 |  | 501/565 | 117 | 1107 | 80 errors |
| 41 | audit 11 min | 0 |  | 264/294 | 101 | 1022 | 80 errors |
| 42 | audit 12 min | 0 |  | 626/679 | 129 | 1134 | 80 errors |
| 43 | audit 13 min | 0 |  | 206/227 | 133 | 1037 | 80 errors |
| 44 | audit 14 min | 0 |  | 53/63 | 44 | 1048 | 19 errors |
| 45 | audit 15 min | 0 |  | 49/57 | 36 | 1056 |  |
| 46 | audit 16 min | 0 |  | 54/62 | 36 | 1070 |  |
| 47 | audit 17 min | 0 |  | 88/104 | 89 | 1172 |  |
| 48 | audit finished | 0 | 0 | 85/130 | 81 | 1138 |  |
| 49 | audit result 1 | 0 | 0 |  |  | 1139 |  |
| 50 | audit result 2 | 0 | 0 |  |  | 1136 |  |
| 51 | audit result 3 | 0 | 0 |  |  | 1136 |  |
| 52 | audit result 4 | 0 | 0 |  |  | 1139 |  |
| 53 | audit result 5 | 0 | 0 |  |  | 1137 |  |
| 54 | audit result 6 | 0 | 0 |  |  | 1140 |  |
| 55 | audit result 7 | 0 | 0 |  |  | 1138 |  |
| 56 | audit result 8 | 0 | 0 |  |  | 1138 |  |
| 57 | audit result 9 | 0 | 0 |  |  | 1141 |  |
| 58 | audit result 10 | 0 | 0 |  |  | 1139 |  |
| 59 | audit result 11 | 0 | 0 |  |  | 1139 |  |
| 60 | audit result 12 | 0 | 0 |  |  | 1142 |  |
| 61 | about for debug log | 6418 | +6385 | 28/44 | 65 | 1145 |  |
| 62 | debug log screen | 0 | 0 | 108/192 | 65 | 1152 |  |

## Fatal lines
```
1 W/ReactNativeJS( 4570): [AR warn] store: ensureHistoryBanks compact asset failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
1 W/ReactNativeJS( 4570): [AR warn] store: ensureBankInsights failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
1 W/ReactNativeJS( 4570): [AR warn] degrade: store.ensureFailed fn=ensureBankInsights error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
```

## Errors

### 1 cold start
```
11-19 21:29:50.911 E/australianrates( 4570): Not starting debugger since process cannot load the jdwp agent.
11-19 21:30:19.485 W/ReactNativeJS( 4570): [AR warn] store: ensureHistoryBanks compact asset failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
11-19 21:30:19.879 W/ReactNativeJS( 4570): [AR warn] store: ensureBankInsights failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
11-19 21:30:19.880 W/ReactNativeJS( 4570): [AR warn] degrade: store.ensureFailed fn=ensureBankInsights error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
```

### 30 cold relaunch
```
11-19 21:34:20.589 E/australianrates( 9211): Not starting debugger since process cannot load the jdwp agent.
```

### 33 audit 0 min
```
11-19 21:35:29.446 E/ReactNativeJS( 9211): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwo2jwtj-e2ae3292d8174d9e","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":4702.1,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":244.5,"liveStage:dates-index:fetched:ms":151.2,"liveStage:revision:verified:ms":55.3,"liveStage:Core asset:downloaded:ms":179.9,"liveStage:Core asset:hash-verified:ms":13.7,"liveStage:Core asset:native-inflated-and-text-decoded:ms":181.7,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0.1,"liveStage:Core asset:decoded:ms":280.3,"liveStage:core:history-sealed:ms":3.6,"liveStage:core:normalized:ms":712.7,"liveStage:Details asset:downloaded:ms":1025.2,"liveStage:Details asset:hash-verified:ms":29.9,"l…
11-19 21:35:29.449 E/unknown:ReactNative( 9211): ?anon_0_@1:3673412
11-19 21:35:29.449 E/unknown:ReactNative( 9211): ?anon_0_@1:3679212
11-19 21:35:29.449 E/unknown:ReactNative( 9211): SyntheticError@1:162884
11-19 21:35:29.449 E/unknown:ReactNative( 9211): Wrapper@1:163399
11-19 21:35:29.449 E/unknown:ReactNative( 9211): _callSuper@1:148272
11-19 21:35:29.449 E/unknown:ReactNative( 9211): _construct@1:163747
11-19 21:35:29.449 E/unknown:ReactNative( 9211): _next@1:594741
```

### 34 audit 2 min
```
11-19 21:35:40.078 E/ReactNativeJS( 9211): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwo2jwtj-e2ae3292d8174d9e","check":{"id":"journey-rates-cold","label":"Rates (cold)","kind":"journey","status":"fail","durationMs":8937.2,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":8188,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates","journeyLabel":"Rates","iteration":"cold","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":8188,"firstReadyFrameObserved":true,"firstReadyFrameMs":7894.582478000026,"backgroundSettleMs":470.4,"destinationReadinessMs":7894.6,"backgroundTasks":"Product details, Search index availability","backMs":36.5,"firstBackMs":36.5,"firstBackDestination":"/performance-audit","originR…
11-19 21:35:40.081 E/unknown:ReactNative( 9211): ?anon_0_@1:3673412
11-19 21:35:40.081 E/unknown:ReactNative( 9211): ?anon_0_@1:3679212
11-19 21:35:40.081 E/unknown:ReactNative( 9211): SyntheticError@1:162884
11-19 21:35:40.081 E/unknown:ReactNative( 9211): Wrapper@1:163399
11-19 21:35:40.081 E/unknown:ReactNative( 9211): _callSuper@1:148272
11-19 21:35:40.081 E/unknown:ReactNative( 9211): _construct@1:163747
11-19 21:35:40.081 E/unknown:ReactNative( 9211): _next@1:594741
```

### 35 audit 3 min
```
11-19 21:37:41.906 E/ReactNativeJS( 9211): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwo2jwtj-e2ae3292d8174d9e","check":{"id":"deep-first-pass.route.rates-mortgage-scope.search.mortgage.scope.apply.0","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.0 (first-pass)","kind":"journey","status":"fail","durationMs":8447.4,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.0","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.0","iteration":"cold","passId":"first-pass","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.0","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":19,"actionRevisionAfter":20,"renderRevisionBefore":"state-8","renderRevisionAfter":"state-14","actionMs":257.2,"preActionWaitMs":0.9,"preActionQuietWindowReused":true…
11-19 21:37:41.908 E/unknown:ReactNative( 9211): ?anon_0_@1:3673412
11-19 21:37:41.908 E/unknown:ReactNative( 9211): ?anon_0_@1:3679212
11-19 21:37:41.908 E/unknown:ReactNative( 9211): SyntheticError@1:162884
11-19 21:37:41.908 E/unknown:ReactNative( 9211): Wrapper@1:163399
11-19 21:37:41.908 E/unknown:ReactNative( 9211): _callSuper@1:148272
11-19 21:37:41.908 E/unknown:ReactNative( 9211): _construct@1:163747
11-19 21:37:41.908 E/unknown:ReactNative( 9211): _next@1:594741
```

### 36 audit 4 min
```
11-19 21:38:48.655 E/ReactNativeJS( 9211): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwo2jwtj-e2ae3292d8174d9e","check":{"id":"deep-first-pass.route.lender.lender.chart.section.next","label":"route.lender: lender.chart.section.next (first-pass)","kind":"journey","status":"fail","durationMs":10503.6,"metrics":{"journeyId":"route.lender.lender.chart.section.next","journeyLabel":"route.lender: lender.chart.section.next","iteration":"cold","passId":"first-pass","scenarioId":"route.lender","semanticActionId":"lender.chart.section.next","depth":1,"plannedExpectedPath":"/bank/Police%20Credit%20Union%20Ltd","expectedPath":"/bank/Police%20Credit%20Union%20Ltd","expectedSurface":"lender.details","actionSource":"lender.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":0,"actionRevisionAfter":1,"renderRevisionBefore":"Police Credit Union Ltd:54:1:7:rich:26:e499a7ca566d…:Police Credit Union Ltd:Mortgage:2026-11-20:192:1:7:rich:26:e499a7ca566d…:Police Credit Union …
11-19 21:38:48.657 E/unknown:ReactNative( 9211): ?anon_0_@1:3673412
11-19 21:38:48.657 E/unknown:ReactNative( 9211): ?anon_0_@1:3679212
11-19 21:38:48.657 E/unknown:ReactNative( 9211): SyntheticError@1:162884
11-19 21:38:48.657 E/unknown:ReactNative( 9211): Wrapper@1:163399
11-19 21:38:48.657 E/unknown:ReactNative( 9211): _callSuper@1:148272
11-19 21:38:48.657 E/unknown:ReactNative( 9211): _construct@1:163747
11-19 21:38:48.657 E/unknown:ReactNative( 9211): _next@1:594741
```

### 37 audit 6 min
```
11-19 21:40:01.925 E/ReactNativeJS( 9211): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwo2jwtj-e2ae3292d8174d9e","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":2986.3,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-20:e72a7e1c5e58…:state-8","renderRevisionAfter":"2026-11-20:e72a7e1c5e58…:state-9","actionResultEvidence":"{\"applied\":…
11-19 21:40:01.928 E/unknown:ReactNative( 9211): ?anon_0_@1:3673412
11-19 21:40:01.928 E/unknown:ReactNative( 9211): ?anon_0_@1:3679212
11-19 21:40:01.928 E/unknown:ReactNative( 9211): SyntheticError@1:162884
11-19 21:40:01.928 E/unknown:ReactNative( 9211): Wrapper@1:163399
11-19 21:40:01.928 E/unknown:ReactNative( 9211): _callSuper@1:148272
11-19 21:40:01.928 E/unknown:ReactNative( 9211): _construct@1:163747
11-19 21:40:01.928 E/unknown:ReactNative( 9211): _next@1:594741
```

### 38 audit 7 min
```
11-19 21:41:58.606 E/ReactNativeJS( 9211): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwo2jwtj-e2ae3292d8174d9e","check":{"id":"deep-first-pass.redirect.projections.redirect.projections.verify","label":"redirect.projections: redirect.projections.verify (first-pass)","kind":"journey","status":"fail","durationMs":1853.2,"metrics":{"journeyId":"redirect.projections.redirect.projections.verify","journeyLabel":"redirect.projections: redirect.projections.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.projections","semanticActionId":"redirect.projections.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"projections.inputs","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":651.7,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":404,"forwardWork…
11-19 21:41:58.608 E/unknown:ReactNative( 9211): ?anon_0_@1:3673412
11-19 21:41:58.608 E/unknown:ReactNative( 9211): ?anon_0_@1:3679212
11-19 21:41:58.608 E/unknown:ReactNative( 9211): SyntheticError@1:162884
11-19 21:41:58.608 E/unknown:ReactNative( 9211): Wrapper@1:163399
11-19 21:41:58.608 E/unknown:ReactNative( 9211): _callSuper@1:148272
11-19 21:41:58.608 E/unknown:ReactNative( 9211): _construct@1:163747
11-19 21:41:58.608 E/unknown:ReactNative( 9211): _next@1:594741
```

### 39 audit 9 min
```
11-19 21:42:46.296 E/ReactNativeJS( 9211): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwo2jwtj-e2ae3292d8174d9e","check":{"id":"deep-repeat.route.rates-sheets.search.section.next","label":"route.rates-sheets: search.section.next (repeat)","kind":"journey","status":"fail","durationMs":8534.5,"metrics":{"journeyId":"route.rates-sheets.search.section.next","journeyLabel":"route.rates-sheets: search.section.next","iteration":"warm","passId":"repeat","scenarioId":"route.rates-sheets","semanticActionId":"search.section.next","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":40,"actionRevisionAfter":41,"renderRevisionBefore":"state-25","renderRevisionAfter":"state-31","actionMs":190.8,"preActionWaitMs":1.6,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"val…
11-19 21:42:46.298 E/unknown:ReactNative( 9211): ?anon_0_@1:3673412
11-19 21:42:46.298 E/unknown:ReactNative( 9211): ?anon_0_@1:3679212
11-19 21:42:46.298 E/unknown:ReactNative( 9211): SyntheticError@1:162884
11-19 21:42:46.298 E/unknown:ReactNative( 9211): Wrapper@1:163399
11-19 21:42:46.298 E/unknown:ReactNative( 9211): _callSuper@1:148272
11-19 21:42:46.298 E/unknown:ReactNative( 9211): _construct@1:163747
11-19 21:42:46.298 E/unknown:ReactNative( 9211): _next@1:594741
```

### 40 audit 10 min
```
11-19 21:44:05.023 E/ReactNativeJS( 9211): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwo2jwtj-e2ae3292d8174d9e","check":{"id":"deep-repeat.route.lender.lender.chart.section.next","label":"route.lender: lender.chart.section.next (repeat)","kind":"journey","status":"fail","durationMs":11081.4,"metrics":{"journeyId":"route.lender.lender.chart.section.next","journeyLabel":"route.lender: lender.chart.section.next","iteration":"warm","passId":"repeat","scenarioId":"route.lender","semanticActionId":"lender.chart.section.next","depth":1,"plannedExpectedPath":"/bank/Police%20Credit%20Union%20Ltd","expectedPath":"/bank/Police%20Credit%20Union%20Ltd","expectedSurface":"lender.details","actionSource":"lender.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":4,"actionRevisionAfter":5,"renderRevisionBefore":"Police Credit Union Ltd:54:1:9:rich:76:e499a7ca566d…:Police Credit Union Ltd:Mortgage:2026-11-20:192:1:9:rich:76:e499a7ca566d…:Police Credit Union Ltd:Mortgage…
11-19 21:44:05.024 E/unknown:ReactNative( 9211): ?anon_0_@1:3673412
11-19 21:44:05.024 E/unknown:ReactNative( 9211): ?anon_0_@1:3679212
11-19 21:44:05.024 E/unknown:ReactNative( 9211): SyntheticError@1:162884
11-19 21:44:05.024 E/unknown:ReactNative( 9211): Wrapper@1:163399
11-19 21:44:05.024 E/unknown:ReactNative( 9211): _callSuper@1:148272
11-19 21:44:05.024 E/unknown:ReactNative( 9211): _construct@1:163747
11-19 21:44:05.024 E/unknown:ReactNative( 9211): _next@1:594741
```

### 41 audit 11 min
```
11-19 21:45:38.505 E/ReactNativeJS( 9211): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwo2jwtj-e2ae3292d8174d9e","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1689.1,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Police%20Credit%20Union%20Ltd%7CI21_TERM_DEPOSIT%7CTERM_DEPOSITS%7CMARION%20TERM%20DEPOSIT","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"renderRev…
11-19 21:45:38.517 E/unknown:ReactNative( 9211): ?anon_0_@1:3673412
11-19 21:45:38.517 E/unknown:ReactNative( 9211): ?anon_0_@1:3679212
11-19 21:45:38.517 E/unknown:ReactNative( 9211): SyntheticError@1:162884
11-19 21:45:38.517 E/unknown:ReactNative( 9211): Wrapper@1:163399
11-19 21:45:38.517 E/unknown:ReactNative( 9211): _callSuper@1:148272
11-19 21:45:38.517 E/unknown:ReactNative( 9211): _construct@1:163747
11-19 21:45:38.517 E/unknown:ReactNative( 9211): _next@1:594741
```

### 42 audit 12 min
```
11-19 21:46:15.740 E/ReactNativeJS( 9211): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwo2jwtj-e2ae3292d8174d9e","check":{"id":"deep-repeat.route.outlook.outlook.economy.lens.next","label":"route.outlook: outlook.economy.lens.next (repeat)","kind":"journey","status":"fail","durationMs":10014.6,"metrics":{"journeyId":"route.outlook.outlook.economy.lens.next","journeyLabel":"route.outlook: outlook.economy.lens.next","iteration":"warm","passId":"repeat","scenarioId":"route.outlook","semanticActionId":"outlook.economy.lens.next","depth":2,"plannedExpectedPath":"/research","expectedPath":"/research","expectedSurface":"outlook.economy","actionSource":"outlook.economy","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":2,"actionRevisionAfter":3,"renderRevisionBefore":"2026-11-20:false:unavailable","renderRevisionAfter":"2026-11-20:true:unavailable","actionMs":51.5,"preActionWaitMs":1.9,"preActionQuietWindowReused":false,"preActionQuietWindowAvoidedMs":0,"minimumJustifi…
11-19 21:46:15.743 E/unknown:ReactNative( 9211): ?anon_0_@1:3673412
11-19 21:46:15.743 E/unknown:ReactNative( 9211): ?anon_0_@1:3679212
11-19 21:46:15.743 E/unknown:ReactNative( 9211): SyntheticError@1:162884
11-19 21:46:15.743 E/unknown:ReactNative( 9211): Wrapper@1:163399
11-19 21:46:15.743 E/unknown:ReactNative( 9211): _callSuper@1:148272
11-19 21:46:15.743 E/unknown:ReactNative( 9211): _construct@1:163747
11-19 21:46:15.743 E/unknown:ReactNative( 9211): _next@1:594741
```

### 43 audit 13 min
```
11-19 21:47:26.259 E/ReactNativeJS( 9211): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwo2jwtj-e2ae3292d8174d9e","check":{"id":"deep-repeat.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (repeat)","kind":"journey","status":"fail","durationMs":3233.5,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":221.2,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1940.1,"forwardWorkMs":1940.1,"navigationCommitMs":1939.6,"firstReadyFrameMs":0.5,"first…
11-19 21:47:26.261 E/unknown:ReactNative( 9211): ?anon_0_@1:3673412
11-19 21:47:26.261 E/unknown:ReactNative( 9211): ?anon_0_@1:3679212
11-19 21:47:26.261 E/unknown:ReactNative( 9211): SyntheticError@1:162884
11-19 21:47:26.261 E/unknown:ReactNative( 9211): Wrapper@1:163399
11-19 21:47:26.261 E/unknown:ReactNative( 9211): _callSuper@1:148272
11-19 21:47:26.261 E/unknown:ReactNative( 9211): _construct@1:163747
11-19 21:47:26.261 E/unknown:ReactNative( 9211): _next@1:594741
```

### 44 audit 14 min
```
11-19 21:48:23.556 E/ReactNativeJS( 9211): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwo2jwtj-e2ae3292d8174d9e","check":{"id":"external-link-371","kind":"network","status":"fail","durationMs":711.0815590000711,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"pass","browserHandler":"pass","httpReachability":"fail","statusCode":404,"handlerAttempted":true,"httpAttempted":true,"httpSelected":true,"handlerResolution":"pass"},"error":"HTTP 404: the destination is missing or unavailable.","canonicalMetrics":true}}
11-19 21:48:23.558 E/unknown:ReactNative( 9211): ?anon_0_@1:3673412
11-19 21:48:23.558 E/unknown:ReactNative( 9211): ?anon_0_@1:3682702
11-19 21:48:23.558 E/unknown:ReactNative( 9211): SyntheticError@1:162884
11-19 21:48:23.558 E/unknown:ReactNative( 9211): Wrapper@1:163399
11-19 21:48:23.558 E/unknown:ReactNative( 9211): _callSuper@1:148272
11-19 21:48:23.558 E/unknown:ReactNative( 9211): _construct@1:163747
11-19 21:48:23.558 E/unknown:ReactNative( 9211): _next@1:594741
```
