# App explorer: 1.0.327 (383)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode full | 62 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 13
Baseline 1.0.326
**Audit live: outcome completed | 1070 s | audit log 862390 bytes (audit-log.txt) https://paste.c-net.org/7b98c78a-d2ac-d951-369b-d71b4499f6d0 | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 17893 | -160 | 31/39 | 300 | 644 | 4 errors; start 1805ms |
| 2 | /browse | 38 | +11 | 9/12 | 150 | 528 |  |
| 3 | /watchlist | 39 | -2260 | 1/3 | 53 | 559 |  |
| 4 | /market | 2299 | +2266 | 14/21 | 57 | 449 |  |
| 5 | /tools | 37 | +8 | 16/21 | 150 | 455 |  |
| 6 | /trends | 35 | +4 | 20/29 | 150 | 463 |  |
| 7 | /search | 38 | +11 | 32/39 | 150 | 499 |  |
| 8 | /banks | 46 | +18 | 35/42 | 117 | 503 |  |
| 9 | /bank-rates | 48 | +22 | 14/23 | 97 | 500 |  |
| 10 | /categories | 32 | +7 | 36/44 | 109 | 524 |  |
| 11 | /catalogue | 39 | +10 | 33/41 | 105 | 543 |  |
| 12 | /compare | 32 | +4 | 10/14 | 150 | 526 |  |
| 13 | /matches | 34 | +6 | 35/42 | 101 | 538 |  |
| 14 | /calculator | 47 | +21 | 17/21 | 81 | 517 |  |
| 15 | /projections | 35 | +8 | 24/31 | 117 | 522 |  |
| 16 | /profile | 33 | +7 | 17/23 | 89 | 526 |  |
| 17 | /research | 40 | +17 | 19/28 | 85 | 539 |  |
| 18 | /rba | 36 | +6 | 13/25 | 65 | 552 |  |
| 19 | /rba-response | 37 | +13 | 22/33 | 77 | 555 |  |
| 20 | /settings | 32 | +6 | 16/25 | 93 | 565 |  |
| 21 | /about | 33 | +7 | 14/23 | 81 | 571 |  |
| 22 | /terms | 37 | +13 | 14/22 | 89 | 573 |  |
| 23 | /privacy | 35 | +10 |  |  | 572 |  |
| 24 | /third-party-notices | 39 | +11 | 15/20 | 85 | 582 |  |
| 25 | /node | 36 | +8 | 34/44 | 105 | 625 |  |
| 26 | /passthrough | 37 | +15 | 24/34 | 117 | 594 |  |
| 27 | /calculation-receipt | 35 | +10 | 17/23 | 93 | 593 |  |
| 28 | /rate-receipt | 40 | +15 | 6/9 | 73 | 591 |  |
| 29 | warm resume | 925 | +48 | 4/5 | 125 | 590 | start 526ms |
| 30 | cold relaunch | 10468 | +2151 | 28/30 | 600 | 501 | 3 errors; start 4486ms |
| 31 | about | 43 | +17 | 12/19 | 300 | 363 |  |
| 32 | audit screen | 28 | +5 | 122/192 | 81 | 379 |  |
| 33 | audit 0 min | 0 | 0 | 4/7 | 250 | 387 |  |
| 34 | audit 1 min | 0 |  | 955/1021 | 129 | 763 | 80 errors |
| 35 | audit 2 min | 0 |  | 173/186 | 125 | 876 | 80 errors |
| 36 | audit 3 min | 0 |  | 692/731 | 133 | 865 | 80 errors |
| 37 | audit 5 min | 0 |  | 456/493 | 121 | 859 | 80 errors |
| 38 | audit 6 min | 0 |  | 745/824 | 125 | 940 | 80 errors |
| 39 | audit 7 min | 0 |  | 426/456 | 150 | 903 | 80 errors |
| 40 | audit 8 min | 0 |  | 247/264 | 133 | 924 | 80 errors |
| 41 | audit 9 min | 0 |  | 898/962 | 129 | 1017 | 80 errors |
| 42 | audit 10 min | 0 |  | 67/74 | 109 | 1025 | 19 errors |
| 43 | audit 12 min | 0 |  | 877/949 | 133 | 1109 | 80 errors |
| 44 | audit 13 min | 0 |  | 316/360 | 125 | 1020 | 80 errors |
| 45 | audit 15 min | 0 |  | 165/181 | 40 | 1041 |  |
| 46 | audit 16 min | 0 |  | 116/126 | 46 | 1055 |  |
| 47 | audit 17 min | 0 |  | 60/70 | 93 | 1095 |  |
| 48 | audit finished | 0 | 0 | 105/154 | 81 | 1146 |  |
| 49 | audit result 1 | 0 | 0 |  |  | 1139 |  |
| 50 | audit result 2 | 0 | 0 |  |  | 1136 |  |
| 51 | audit result 3 | 0 | 0 |  |  | 1136 |  |
| 52 | audit result 4 | 0 | 0 |  |  | 1139 |  |
| 53 | audit result 5 | 0 | 0 |  |  | 1137 |  |
| 54 | audit result 6 | 0 | 0 |  |  | 1141 |  |
| 55 | audit result 7 | 0 | 0 |  |  | 1142 |  |
| 56 | audit result 8 | 0 | 0 |  |  | 1140 |  |
| 57 | audit result 9 | 0 | 0 |  |  | 1143 |  |
| 58 | audit result 10 | 0 | 0 |  |  | 1140 |  |
| 59 | audit result 11 | 0 | 0 |  |  | 1140 |  |
| 60 | audit result 12 | 0 | 0 |  |  | 1143 |  |
| 61 | about for debug log | 5620 | +5588 | 26/40 | 81 | 1188 |  |
| 62 | debug log screen | 0 | 0 | 117/192 | 73 | 1120 |  |

## Fatal lines
```
1 W/ReactNativeJS(11072): [AR warn] store: ensureHistoryBanks compact asset failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
1 W/ReactNativeJS(11072): [AR warn] store: ensureBankInsights failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
1 W/ReactNativeJS(11072): [AR warn] degrade: store.ensureFailed fn=ensureBankInsights error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
```

## Errors

### 1 cold start
```
11-20 14:28:33.495 E/australianrates(11072): Not starting debugger since process cannot load the jdwp agent.
11-20 14:28:51.375 W/ReactNativeJS(11072): [AR warn] store: ensureHistoryBanks compact asset failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
11-20 14:28:51.851 W/ReactNativeJS(11072): [AR warn] store: ensureBankInsights failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
11-20 14:28:51.852 W/ReactNativeJS(11072): [AR warn] degrade: store.ensureFailed fn=ensureBankInsights error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
```

### 30 cold relaunch
```
11-20 14:32:43.797 E/australianrates(14107): Not starting debugger since process cannot load the jdwp agent.
11-20 14:32:47.987 E/SurfaceSyncGroup(14107): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-20 14:32:47.990 E/SurfaceSyncGroup(14107): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 34 audit 1 min
```
11-20 14:34:01.947 E/ReactNativeJS(14107): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwp2xk6z-39346feff309e403","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":5303.9,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":217.8,"liveStage:dates-index:fetched:ms":167.5,"liveStage:revision:verified:ms":56.8,"liveStage:Core asset:downloaded:ms":207.3,"liveStage:Core asset:hash-verified:ms":18.9,"liveStage:Core asset:native-inflated-and-text-decoded:ms":202,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":253.4,"liveStage:core:history-sealed:ms":0.7,"liveStage:core:normalized:ms":695.9,"liveStage:Details asset:downloaded:ms":1344.6,"liveStage:Details asset:hash-verified:ms":38.4,"liveSta…
11-20 14:34:01.949 E/unknown:ReactNative(14107): ?anon_0_@1:3675038
11-20 14:34:01.949 E/unknown:ReactNative(14107): ?anon_0_@1:3680838
11-20 14:34:01.949 E/unknown:ReactNative(14107): SyntheticError@1:162884
11-20 14:34:01.949 E/unknown:ReactNative(14107): Wrapper@1:163399
11-20 14:34:01.949 E/unknown:ReactNative(14107): _callSuper@1:148272
11-20 14:34:01.949 E/unknown:ReactNative(14107): _construct@1:163747
11-20 14:34:01.949 E/unknown:ReactNative(14107): _next@1:594741
```

### 35 audit 2 min
```
11-20 14:35:44.689 E/ReactNativeJS(14107): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwp2xk6z-39346feff309e403","check":{"id":"journey-lender-warm","label":"Lender details (warm)","kind":"journey","status":"fail","durationMs":2162.7,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":691.4,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"lender","journeyLabel":"Lender details","iteration":"warm","expectedPath":"/bank/homeloans.com.au","expectedSurface":"lender.details","navigationKind":"stack","forwardMs":691.4,"firstReadyFrameObserved":true,"firstReadyFrameMs":61.57558699999936,"backgroundSettleMs":915.7,"destinationReadinessMs":61.6,"backgroundTasks":"Bank response analysis","backMs":264.6,"firstBackMs":264.6,"firstBackDestination":"/performance-audit","originReadinessMs":0.3,"backDestin…
11-20 14:35:44.691 E/unknown:ReactNative(14107): ?anon_0_@1:3675038
11-20 14:35:44.691 E/unknown:ReactNative(14107): ?anon_0_@1:3680838
11-20 14:35:44.691 E/unknown:ReactNative(14107): SyntheticError@1:162884
11-20 14:35:44.691 E/unknown:ReactNative(14107): Wrapper@1:163399
11-20 14:35:44.691 E/unknown:ReactNative(14107): _callSuper@1:148272
11-20 14:35:44.691 E/unknown:ReactNative(14107): _construct@1:163747
11-20 14:35:44.691 E/unknown:ReactNative(14107): _next@1:594741
```

### 36 audit 3 min
```
11-20 14:36:05.772 E/ReactNativeJS(14107): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwp2xk6z-39346feff309e403","check":{"id":"deep-first-pass.route.rates.search.filters.open","label":"route.rates: search.filters.open (first-pass)","kind":"journey","status":"fail","durationMs":6207.9,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRevisionAfter":4,"renderRevisionBefore":"state-24","renderRevisionAfter":"state-27","actionMs":0.3,"preActionWaitMs":9.5,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtra…
11-20 14:36:05.774 E/unknown:ReactNative(14107): ?anon_0_@1:3675038
11-20 14:36:05.774 E/unknown:ReactNative(14107): ?anon_0_@1:3680838
11-20 14:36:05.774 E/unknown:ReactNative(14107): SyntheticError@1:162884
11-20 14:36:05.774 E/unknown:ReactNative(14107): Wrapper@1:163399
11-20 14:36:05.774 E/unknown:ReactNative(14107): _callSuper@1:148272
11-20 14:36:05.774 E/unknown:ReactNative(14107): _construct@1:163747
11-20 14:36:05.774 E/unknown:ReactNative(14107): _next@1:594741
```

### 37 audit 5 min
```
11-20 14:37:53.505 E/ReactNativeJS(14107): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwp2xk6z-39346feff309e403","check":{"id":"deep-first-pass.route.lender.product.lender.open","label":"route.lender: product.lender.open (first-pass)","kind":"journey","status":"fail","durationMs":2111.3,"metrics":{"journeyId":"route.lender.product.lender.open","journeyLabel":"route.lender: product.lender.open","iteration":"cold","passId":"first-pass","scenarioId":"route.lender","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/homeloans.com.au","expectedPath":"/bank/homeloans.com.au","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":4,"actionRevisionAfter":5,"actionResultEvidence":"{\"expectedPath\":\"/bank/homeloans.com.au\"}","actionMs":718.5,"preActionWaitMs":1.3,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1…
11-20 14:37:53.515 E/unknown:ReactNative(14107): ?anon_0_@1:3675038
11-20 14:37:53.515 E/unknown:ReactNative(14107): ?anon_0_@1:3680838
11-20 14:37:53.515 E/unknown:ReactNative(14107): SyntheticError@1:162884
11-20 14:37:53.515 E/unknown:ReactNative(14107): Wrapper@1:163399
11-20 14:37:53.515 E/unknown:ReactNative(14107): _callSuper@1:148272
11-20 14:37:53.515 E/unknown:ReactNative(14107): _construct@1:163747
11-20 14:37:53.515 E/unknown:ReactNative(14107): _next@1:594741
```

### 38 audit 6 min
```
11-20 14:38:40.360 E/ReactNativeJS(14107): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwp2xk6z-39346feff309e403","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":1236.5,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-20:e72a7e1c5e58…:state-7","renderRevisionAfter":"2026-11-20:e72a7e1c5e58…:state-8","actionResultEvidence":"{\"applied\":…
11-20 14:38:40.362 E/unknown:ReactNative(14107): ?anon_0_@1:3675038
11-20 14:38:40.362 E/unknown:ReactNative(14107): ?anon_0_@1:3680838
11-20 14:38:40.362 E/unknown:ReactNative(14107): SyntheticError@1:162884
11-20 14:38:40.362 E/unknown:ReactNative(14107): Wrapper@1:163399
11-20 14:38:40.362 E/unknown:ReactNative(14107): _callSuper@1:148272
11-20 14:38:40.362 E/unknown:ReactNative(14107): _construct@1:163747
11-20 14:38:40.362 E/unknown:ReactNative(14107): _next@1:594741
```

### 39 audit 7 min
```
11-20 14:40:26.537 E/ReactNativeJS(14107): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwp2xk6z-39346feff309e403","check":{"id":"deep-first-pass.redirect.categories.redirect.categories.verify","label":"redirect.categories: redirect.categories.verify (first-pass)","kind":"journey","status":"fail","durationMs":3285.5,"metrics":{"journeyId":"redirect.categories.redirect.categories.verify","journeyLabel":"redirect.categories: redirect.categories.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.categories","semanticActionId":"redirect.categories.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":204.6,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":2387.6,"forwardWorkMs":2387.6,"navigati…
11-20 14:40:26.539 E/unknown:ReactNative(14107): ?anon_0_@1:3675038
11-20 14:40:26.539 E/unknown:ReactNative(14107): ?anon_0_@1:3680838
11-20 14:40:26.539 E/unknown:ReactNative(14107): SyntheticError@1:162884
11-20 14:40:26.539 E/unknown:ReactNative(14107): Wrapper@1:163399
11-20 14:40:26.539 E/unknown:ReactNative(14107): _callSuper@1:148272
11-20 14:40:26.539 E/unknown:ReactNative(14107): _construct@1:163747
11-20 14:40:26.539 E/unknown:ReactNative(14107): _next@1:594741
```

### 40 audit 8 min
```
11-20 14:41:12.085 E/ReactNativeJS(14107): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwp2xk6z-39346feff309e403","check":{"id":"deep-repeat.route.rates.search.filters.open","label":"route.rates: search.filters.open (repeat)","kind":"journey","status":"fail","durationMs":6011.9,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":26,"actionRevisionAfter":27,"renderRevisionBefore":"state-25","renderRevisionAfter":"state-28","actionMs":0.2,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"re…
11-20 14:41:12.086 E/unknown:ReactNative(14107): ?anon_0_@1:3675038
11-20 14:41:12.086 E/unknown:ReactNative(14107): ?anon_0_@1:3680838
11-20 14:41:12.086 E/unknown:ReactNative(14107): SyntheticError@1:162884
11-20 14:41:12.086 E/unknown:ReactNative(14107): Wrapper@1:163399
11-20 14:41:12.086 E/unknown:ReactNative(14107): _callSuper@1:148272
11-20 14:41:12.086 E/unknown:ReactNative(14107): _construct@1:163747
11-20 14:41:12.086 E/unknown:ReactNative(14107): _next@1:594741
```

### 41 audit 9 min
```
11-20 14:42:04.218 E/ReactNativeJS(14107): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwp2xk6z-39346feff309e403","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.mortgage.scope.apply.0","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.0 (repeat)","kind":"journey","status":"fail","durationMs":1988.5,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.0","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.0","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.0","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":43,"actionRevisionAfter":44,"renderRevisionBefore":"state-9","renderRevisionAfter":"state-15","actionMs":83.8,"preActionWaitMs":1,"preActionQuietWindowReused":true,"preActionQuie…
11-20 14:42:04.220 E/unknown:ReactNative(14107): ?anon_0_@1:3675038
11-20 14:42:04.220 E/unknown:ReactNative(14107): ?anon_0_@1:3680838
11-20 14:42:04.220 E/unknown:ReactNative(14107): SyntheticError@1:162884
11-20 14:42:04.220 E/unknown:ReactNative(14107): Wrapper@1:163399
11-20 14:42:04.220 E/unknown:ReactNative(14107): _callSuper@1:148272
11-20 14:42:04.220 E/unknown:ReactNative(14107): _construct@1:163747
11-20 14:42:04.220 E/unknown:ReactNative(14107): _next@1:594741
```

### 42 audit 10 min
```
11-20 14:43:40.001 E/ReactNativeJS(14107): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwp2xk6z-39346feff309e403","check":{"id":"deep-repeat.route.calculator.calculator.open","label":"route.calculator: calculator.open (repeat)","kind":"journey","status":"fail","durationMs":4231.4,"metrics":{"journeyId":"route.calculator.calculator.open","journeyLabel":"route.calculator: calculator.open","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.open","depth":0,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":365.1,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":44.5,"forwardWorkMs":44.5,"navigationCommitMs":0.1,"firstReadyFrameMs":44.4,"firstReadyFrameObserved":true,"…
11-20 14:43:40.003 E/unknown:ReactNative(14107): ?anon_0_@1:3675038
11-20 14:43:40.003 E/unknown:ReactNative(14107): ?anon_0_@1:3680838
11-20 14:43:40.003 E/unknown:ReactNative(14107): SyntheticError@1:162884
11-20 14:43:40.003 E/unknown:ReactNative(14107): Wrapper@1:163399
11-20 14:43:40.003 E/unknown:ReactNative(14107): _callSuper@1:148272
11-20 14:43:40.003 E/unknown:ReactNative(14107): _construct@1:163747
11-20 14:43:40.003 E/unknown:ReactNative(14107): _next@1:594741
```

### 43 audit 12 min
```
11-20 14:44:04.230 E/ReactNativeJS(14107): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwp2xk6z-39346feff309e403","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1752.7,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/homeloans.com.au%7CLRHL%7CRESIDENTIAL_MORTGAGES%7CLow%20Rate%20Home%20Loan","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"renderRevisionBefore":"20…
11-20 14:44:04.233 E/unknown:ReactNative(14107): ?anon_0_@1:3675038
11-20 14:44:04.233 E/unknown:ReactNative(14107): ?anon_0_@1:3680838
11-20 14:44:04.233 E/unknown:ReactNative(14107): SyntheticError@1:162884
11-20 14:44:04.233 E/unknown:ReactNative(14107): Wrapper@1:163399
11-20 14:44:04.233 E/unknown:ReactNative(14107): _callSuper@1:148272
11-20 14:44:04.233 E/unknown:ReactNative(14107): _construct@1:163747
11-20 14:44:04.233 E/unknown:ReactNative(14107): _next@1:594741
```

### 44 audit 13 min
```
11-20 14:45:56.260 E/ReactNativeJS(14107): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwp2xk6z-39346feff309e403","check":{"id":"deep-repeat.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (repeat)","kind":"journey","status":"fail","durationMs":4975.8,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":108.8,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1229.5,"forwardWorkMs":1229.5,"navigationCommitMs":1229,"firstReadyFrameMs":0.5,"firstRe…
11-20 14:45:56.262 E/unknown:ReactNative(14107): ?anon_0_@1:3675038
11-20 14:45:56.262 E/unknown:ReactNative(14107): ?anon_0_@1:3680838
11-20 14:45:56.262 E/unknown:ReactNative(14107): SyntheticError@1:162884
11-20 14:45:56.262 E/unknown:ReactNative(14107): Wrapper@1:163399
11-20 14:45:56.262 E/unknown:ReactNative(14107): _callSuper@1:148272
11-20 14:45:56.262 E/unknown:ReactNative(14107): _construct@1:163747
11-20 14:45:56.262 E/unknown:ReactNative(14107): _next@1:594741
```
