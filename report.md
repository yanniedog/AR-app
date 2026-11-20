# App explorer: 1.0.322 (378)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode full | 62 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 14
Baseline 1.0.321
**Audit live: outcome completed | 1053 s | audit log 858586 bytes (audit-log.txt) https://paste.c-net.org/87c2d5de-9090-c0b6-1c73-a68b024c7997 | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 20522 | -2045 | 41/56 | 300 | 526 | 1 errors; start 1714ms |
| 2 | /browse | 50 | -20 | 3/3 | 81 | 574 |  |
| 3 | /watchlist | 40 | -19 | 3/3 | 32 | 401 |  |
| 4 | /market | 2300 | -2654 | 13/22 | 65 | 403 |  |
| 5 | /tools | 37 | +7 | 15/21 | 150 | 396 |  |
| 6 | /trends | 36 | +8 | 23/33 | 133 | 406 |  |
| 7 | /search | 39 | +16 | 27/33 | 150 | 455 |  |
| 8 | /banks | 40 | +11 | 31/39 | 121 | 497 |  |
| 9 | /bank-rates | 34 | -2 | 17/25 | 81 | 504 |  |
| 10 | /categories | 37 | +2 | 35/45 | 97 | 565 |  |
| 11 | /catalogue | 39 | -21 | 34/41 | 113 | 594 |  |
| 12 | /compare | 42 | +6 | 11/14 | 121 | 608 |  |
| 13 | /matches | 31 | +4 | 37/46 | 93 | 598 |  |
| 14 | /calculator | 33 | +1 | 14/22 | 81 | 589 |  |
| 15 | /projections | 36 | +10 | 26/35 | 105 | 598 |  |
| 16 | /profile | 37 | +10 | 16/22 | 85 | 605 |  |
| 17 | /research | 33 | +9 | 21/29 | 93 | 621 |  |
| 18 | /rba | 36 | +10 | 17/23 | 65 | 571 |  |
| 19 | /rba-response | 32 | +8 | 19/28 | 93 | 566 |  |
| 20 | /settings | 32 | +7 | 26/38 | 97 | 573 |  |
| 21 | /about | 30 | +3 | 15/22 | 93 | 573 |  |
| 22 | /terms | 43 | +17 | 14/19 | 93 | 574 |  |
| 23 | /privacy | 31 | +3 |  |  | 573 |  |
| 24 | /third-party-notices | 35 | +7 | 15/23 | 89 | 576 |  |
| 25 | /node | 36 | +8 | 34/42 | 117 | 601 |  |
| 26 | /passthrough | 37 | -1 | 33/47 | 109 | 574 |  |
| 27 | /calculation-receipt | 30 | +1 | 19/25 | 69 | 572 |  |
| 28 | /rate-receipt | 37 | +9 | 8/9 | 93 | 570 |  |
| 29 | warm resume | 1040 | +778 | 5/5 | 350 | 569 |  |
| 30 | cold relaunch | 9867 | +1306 | 31/40 | 150 | 505 | 2 errors; start 4318ms |
| 31 | about | 41 |  | 12/20 | 200 | 376 |  |
| 32 | audit screen | 27 |  | 125/195 | 73 | 382 |  |
| 33 | audit 0 min | 0 |  | 57/59 | 125 | 618 | 19 errors |
| 34 | audit 1 min | 0 |  | 994/1101 | 129 | 836 | 80 errors |
| 35 | audit 3 min | 0 |  | 169/182 | 150 | 883 | 80 errors |
| 36 | audit 4 min | 0 |  | 513/554 | 150 | 905 | 80 errors |
| 37 | audit 5 min | 0 |  | 834/919 | 129 | 850 | 80 errors |
| 38 | audit 7 min | 0 |  | 900/996 | 129 | 975 | 80 errors |
| 39 | audit 8 min | 0 |  | 326/360 | 129 | 1016 | 80 errors |
| 40 | audit 9 min | 0 |  | 470/529 | 129 | 946 | 80 errors |
| 41 | audit 10 min | 0 |  | 534/581 | 121 | 1026 | 80 errors |
| 42 | audit 12 min | 0 |  | 751/845 | 121 | 1082 | 80 errors |
| 43 | audit 13 min | 0 |  | 328/358 | 129 | 1126 | 80 errors |
| 44 | audit 14 min | 0 |  | 60/62 | 38 | 1123 | 38 errors |
| 45 | audit 15 min | 0 |  | 63/70 | 46 | 1135 |  |
| 46 | audit 16 min | 0 |  | 58/65 | 34 | 1149 |  |
| 47 | audit 17 min | 0 |  | 85/98 | 89 | 1053 |  |
| 48 | audit finished | 0 |  | 104/150 | 89 | 1058 |  |
| 49 | audit result 1 | 0 |  |  |  | 1053 |  |
| 50 | audit result 2 | 0 |  |  |  | 1054 |  |
| 51 | audit result 3 | 0 |  |  |  | 1052 |  |
| 52 | audit result 4 | 0 |  |  |  | 1055 |  |
| 53 | audit result 5 | 0 |  |  |  | 1053 |  |
| 54 | audit result 6 | 0 |  |  |  | 1053 |  |
| 55 | audit result 7 | 0 |  |  |  | 1056 |  |
| 56 | audit result 8 | 0 |  |  |  | 1054 |  |
| 57 | audit result 9 | 0 |  |  |  | 1054 |  |
| 58 | audit result 10 | 0 |  |  |  | 1057 |  |
| 59 | audit result 11 | 0 |  |  |  | 1055 |  |
| 60 | audit result 12 | 0 |  |  |  | 1058 |  |
| 61 | about for debug log | 3242 |  | 24/32 | 81 | 1072 |  |
| 62 | debug log screen | 0 |  | 107/184 | 65 | 1084 |  |

## Errors

### 1 cold start
```
11-20 10:58:44.509 E/australianrates(10476): Not starting debugger since process cannot load the jdwp agent.
```

### 30 cold relaunch
```
11-20 11:02:56.499 E/australianrates(13560): Not starting debugger since process cannot load the jdwp agent.
11-20 11:03:00.665 E/SurfaceSyncGroup(13560): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 33 audit 0 min
```
11-20 11:04:05.097 E/ReactNativeJS(13560): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwovfrbv-bd948ab7cd2aca61","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":4979.7,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":167.5,"liveStage:dates-index:fetched:ms":219.2,"liveStage:revision:verified:ms":58.2,"liveStage:Core asset:downloaded:ms":225.9,"liveStage:Core asset:hash-verified:ms":14.2,"liveStage:Core asset:native-inflated-and-text-decoded:ms":189,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":196.6,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":771.8,"liveStage:Details asset:downloaded:ms":1178.5,"liveStage:Details asset:hash-verified:ms":32,"liveStage…
11-20 11:04:05.099 E/unknown:ReactNative(13560): ?anon_0_@1:3673473
11-20 11:04:05.099 E/unknown:ReactNative(13560): ?anon_0_@1:3679273
11-20 11:04:05.099 E/unknown:ReactNative(13560): SyntheticError@1:162884
11-20 11:04:05.099 E/unknown:ReactNative(13560): Wrapper@1:163399
11-20 11:04:05.099 E/unknown:ReactNative(13560): _callSuper@1:148272
11-20 11:04:05.099 E/unknown:ReactNative(13560): _construct@1:163747
11-20 11:04:05.099 E/unknown:ReactNative(13560): _next@1:594741
```

### 34 audit 1 min
```
11-20 11:04:16.223 E/ReactNativeJS(13560): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwovfrbv-bd948ab7cd2aca61","check":{"id":"journey-rates-cold","label":"Rates (cold)","kind":"journey","status":"fail","durationMs":9055.8,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":8281.4,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates","journeyLabel":"Rates","iteration":"cold","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":8281.4,"firstReadyFrameObserved":true,"firstReadyFrameMs":8029.373673000024,"backgroundSettleMs":536,"destinationReadinessMs":8029.4,"backgroundTasks":"Product details, Search index availability","backMs":42.6,"firstBackMs":42.6,"firstBackDestination":"/performance-audit","origi…
11-20 11:04:16.226 E/unknown:ReactNative(13560): ?anon_0_@1:3673473
11-20 11:04:16.226 E/unknown:ReactNative(13560): ?anon_0_@1:3679273
11-20 11:04:16.226 E/unknown:ReactNative(13560): SyntheticError@1:162884
11-20 11:04:16.226 E/unknown:ReactNative(13560): Wrapper@1:163399
11-20 11:04:16.226 E/unknown:ReactNative(13560): _callSuper@1:148272
11-20 11:04:16.226 E/unknown:ReactNative(13560): _construct@1:163747
11-20 11:04:16.226 E/unknown:ReactNative(13560): _next@1:594741
```

### 35 audit 3 min
```
11-20 11:06:07.741 E/ReactNativeJS(13560): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwovfrbv-bd948ab7cd2aca61","check":{"id":"deep-first-pass.route.rates.search.compare.page.0","label":"route.rates: search.compare.page.0 (first-pass)","kind":"journey","status":"fail","durationMs":1986.5,"metrics":{"journeyId":"route.rates.search.compare.page.0","journeyLabel":"route.rates: search.compare.page.0","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.compare.page.0","depth":2,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":8,"actionRevisionAfter":9,"renderRevisionBefore":"state-39","renderRevisionAfter":"state-46","actionResultEvidence":"{\"selectionToken\":\"1#Northern Inland Credit Union Limited|NICUI2_STND|TERM_DEPOSITS|24 MONTHS Term Deposit with interest paid at maturity/annually\",\"resultInde…
11-20 11:06:07.746 E/unknown:ReactNative(13560): ?anon_0_@1:3673473
11-20 11:06:07.746 E/unknown:ReactNative(13560): ?anon_0_@1:3679273
11-20 11:06:07.746 E/unknown:ReactNative(13560): SyntheticError@1:162884
11-20 11:06:07.746 E/unknown:ReactNative(13560): Wrapper@1:163399
11-20 11:06:07.746 E/unknown:ReactNative(13560): _callSuper@1:148272
11-20 11:06:07.746 E/unknown:ReactNative(13560): _construct@1:163747
11-20 11:06:07.746 E/unknown:ReactNative(13560): _next@1:594741
```

### 36 audit 4 min
```
11-20 11:06:35.377 E/ReactNativeJS(13560): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwovfrbv-bd948ab7cd2aca61","check":{"id":"deep-first-pass.route.rates-mortgage-scope.search.mortgage.scope.apply.0","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.0 (first-pass)","kind":"journey","status":"fail","durationMs":8388.4,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.0","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.0","iteration":"cold","passId":"first-pass","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.0","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":19,"actionRevisionAfter":20,"renderRevisionBefore":"state-8","renderRevisionAfter":"state-14","actionMs":252.3,"preActionWaitMs":2.5,"preActionQuietWindowReused":true…
11-20 11:06:35.379 E/unknown:ReactNative(13560): ?anon_0_@1:3673473
11-20 11:06:35.379 E/unknown:ReactNative(13560): ?anon_0_@1:3679273
11-20 11:06:35.379 E/unknown:ReactNative(13560): SyntheticError@1:162884
11-20 11:06:35.379 E/unknown:ReactNative(13560): Wrapper@1:163399
11-20 11:06:35.379 E/unknown:ReactNative(13560): _callSuper@1:148272
11-20 11:06:35.379 E/unknown:ReactNative(13560): _construct@1:163747
11-20 11:06:35.379 E/unknown:ReactNative(13560): _next@1:594741
```

### 37 audit 5 min
```
11-20 11:07:45.668 E/ReactNativeJS(13560): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwovfrbv-bd948ab7cd2aca61","check":{"id":"deep-first-pass.route.lender.lender.chart.section.next","label":"route.lender: lender.chart.section.next (first-pass)","kind":"journey","status":"fail","durationMs":10612.6,"metrics":{"journeyId":"route.lender.lender.chart.section.next","journeyLabel":"route.lender: lender.chart.section.next","iteration":"cold","passId":"first-pass","scenarioId":"route.lender","semanticActionId":"lender.chart.section.next","depth":1,"plannedExpectedPath":"/bank/Northern%20Inland%20Credit%20Union%20Limited","expectedPath":"/bank/Northern%20Inland%20Credit%20Union%20Limited","expectedSurface":"lender.details","actionSource":"lender.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":0,"actionRevisionAfter":1,"renderRevisionBefore":"Northern Inland Credit Union Limited:13:1:7:rich:26:e499a7ca566d…:Northern Inland Credit Union Limited:Mortgage:2026-…
11-20 11:07:45.670 E/unknown:ReactNative(13560): ?anon_0_@1:3673473
11-20 11:07:45.670 E/unknown:ReactNative(13560): ?anon_0_@1:3679273
11-20 11:07:45.670 E/unknown:ReactNative(13560): SyntheticError@1:162884
11-20 11:07:45.670 E/unknown:ReactNative(13560): Wrapper@1:163399
11-20 11:07:45.670 E/unknown:ReactNative(13560): _callSuper@1:148272
11-20 11:07:45.670 E/unknown:ReactNative(13560): _construct@1:163747
11-20 11:07:45.670 E/unknown:ReactNative(13560): _next@1:594741
```

### 38 audit 7 min
```
11-20 11:09:03.232 E/ReactNativeJS(13560): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwovfrbv-bd948ab7cd2aca61","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":2431.6,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-20:e72a7e1c5e58…:state-8","renderRevisionAfter":"2026-11-20:e72a7e1c5e58…:state-9","actionResultEvidence":"{\"applied\":…
11-20 11:09:03.301 E/unknown:ReactNative(13560): ?anon_0_@1:3673473
11-20 11:09:03.301 E/unknown:ReactNative(13560): ?anon_0_@1:3679273
11-20 11:09:03.301 E/unknown:ReactNative(13560): SyntheticError@1:162884
11-20 11:09:03.301 E/unknown:ReactNative(13560): Wrapper@1:163399
11-20 11:09:03.301 E/unknown:ReactNative(13560): _callSuper@1:148272
11-20 11:09:03.301 E/unknown:ReactNative(13560): _construct@1:163747
11-20 11:09:03.301 E/unknown:ReactNative(13560): _next@1:594741
```

### 39 audit 8 min
```
11-20 11:10:53.218 E/ReactNativeJS(13560): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwovfrbv-bd948ab7cd2aca61","check":{"id":"deep-first-pass.redirect.changes.redirect.changes.verify","label":"redirect.changes: redirect.changes.verify (first-pass)","kind":"journey","status":"fail","durationMs":1676.6,"metrics":{"journeyId":"redirect.changes.redirect.changes.verify","journeyLabel":"redirect.changes: redirect.changes.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.changes","semanticActionId":"redirect.changes.verify","depth":1,"plannedExpectedPath":"/market","expectedPath":"/market","expectedSurface":"market.overview","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":48.9,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":970.6,"forwardWorkMs":970.6,"navigationCommitMs":439.1,"firstReadyFr…
11-20 11:10:53.223 E/unknown:ReactNative(13560): ?anon_0_@1:3673473
11-20 11:10:53.223 E/unknown:ReactNative(13560): ?anon_0_@1:3679273
11-20 11:10:53.223 E/unknown:ReactNative(13560): SyntheticError@1:162884
11-20 11:10:53.223 E/unknown:ReactNative(13560): Wrapper@1:163399
11-20 11:10:53.223 E/unknown:ReactNative(13560): _callSuper@1:148272
11-20 11:10:53.223 E/unknown:ReactNative(13560): _construct@1:163747
11-20 11:10:53.223 E/unknown:ReactNative(13560): _next@1:594741
```

### 40 audit 9 min
```
11-20 11:11:41.220 E/ReactNativeJS(13560): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwovfrbv-bd948ab7cd2aca61","check":{"id":"deep-repeat.route.rates-sheets.search.section.next","label":"route.rates-sheets: search.section.next (repeat)","kind":"journey","status":"fail","durationMs":8618.6,"metrics":{"journeyId":"route.rates-sheets.search.section.next","journeyLabel":"route.rates-sheets: search.section.next","iteration":"warm","passId":"repeat","scenarioId":"route.rates-sheets","semanticActionId":"search.section.next","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":40,"actionRevisionAfter":41,"renderRevisionBefore":"state-25","renderRevisionAfter":"state-31","actionMs":246.3,"preActionWaitMs":1.7,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"val…
11-20 11:11:41.222 E/unknown:ReactNative(13560): ?anon_0_@1:3673473
11-20 11:11:41.222 E/unknown:ReactNative(13560): ?anon_0_@1:3679273
11-20 11:11:41.222 E/unknown:ReactNative(13560): SyntheticError@1:162884
11-20 11:11:41.222 E/unknown:ReactNative(13560): Wrapper@1:163399
11-20 11:11:41.222 E/unknown:ReactNative(13560): _callSuper@1:148272
11-20 11:11:41.222 E/unknown:ReactNative(13560): _construct@1:163747
11-20 11:11:41.222 E/unknown:ReactNative(13560): _next@1:594741
```

### 41 audit 10 min
```
11-20 11:12:57.619 E/ReactNativeJS(13560): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwovfrbv-bd948ab7cd2aca61","check":{"id":"deep-repeat.route.lender.lender.chart.section.next","label":"route.lender: lender.chart.section.next (repeat)","kind":"journey","status":"fail","durationMs":10610.8,"metrics":{"journeyId":"route.lender.lender.chart.section.next","journeyLabel":"route.lender: lender.chart.section.next","iteration":"warm","passId":"repeat","scenarioId":"route.lender","semanticActionId":"lender.chart.section.next","depth":1,"plannedExpectedPath":"/bank/Northern%20Inland%20Credit%20Union%20Limited","expectedPath":"/bank/Northern%20Inland%20Credit%20Union%20Limited","expectedSurface":"lender.details","actionSource":"lender.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":4,"actionRevisionAfter":5,"renderRevisionBefore":"Northern Inland Credit Union Limited:13:1:9:rich:74:e499a7ca566d…:Northern Inland Credit Union Limited:Mortgage:2026-11-20:192:1:…
11-20 11:12:57.621 E/unknown:ReactNative(13560): ?anon_0_@1:3673473
11-20 11:12:57.621 E/unknown:ReactNative(13560): ?anon_0_@1:3679273
11-20 11:12:57.621 E/unknown:ReactNative(13560): SyntheticError@1:162884
11-20 11:12:57.621 E/unknown:ReactNative(13560): Wrapper@1:163399
11-20 11:12:57.621 E/unknown:ReactNative(13560): _callSuper@1:148272
11-20 11:12:57.621 E/unknown:ReactNative(13560): _construct@1:163747
11-20 11:12:57.621 E/unknown:ReactNative(13560): _next@1:594741
```

### 42 audit 12 min
```
11-20 11:14:25.995 E/ReactNativeJS(13560): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwovfrbv-bd948ab7cd2aca61","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1537.1,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Northern%20Inland%20Credit%20Union%20Limited%7CNICUI2_STND%7CTERM_DEPOSITS%7C24%20MONTHS%20Term%20Deposit%20with%20interest%20paid%20at%20maturity%2Fannually","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted"…
11-20 11:14:26.004 E/unknown:ReactNative(13560): ?anon_0_@1:3673473
11-20 11:14:26.004 E/unknown:ReactNative(13560): ?anon_0_@1:3679273
11-20 11:14:26.004 E/unknown:ReactNative(13560): SyntheticError@1:162884
11-20 11:14:26.004 E/unknown:ReactNative(13560): Wrapper@1:163399
11-20 11:14:26.004 E/unknown:ReactNative(13560): _callSuper@1:148272
11-20 11:14:26.004 E/unknown:ReactNative(13560): _construct@1:163747
11-20 11:14:26.004 E/unknown:ReactNative(13560): _next@1:594741
```

### 43 audit 13 min
```
11-20 11:15:55.286 E/ReactNativeJS(13560): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwovfrbv-bd948ab7cd2aca61","check":{"id":"deep-repeat.redirect.banks.redirect.banks.verify","label":"redirect.banks: redirect.banks.verify (repeat)","kind":"journey","status":"fail","durationMs":2722.9,"metrics":{"journeyId":"redirect.banks.redirect.banks.verify","journeyLabel":"redirect.banks: redirect.banks.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.banks","semanticActionId":"redirect.banks.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":133.9,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1918.8,"forwardWorkMs":1918.8,"navigationCommitMs":1670.4,"firstReadyFrameMs":248.3,"firstReadyFrameO…
11-20 11:15:55.288 E/unknown:ReactNative(13560): ?anon_0_@1:3673473
11-20 11:15:55.288 E/unknown:ReactNative(13560): ?anon_0_@1:3679273
11-20 11:15:55.288 E/unknown:ReactNative(13560): SyntheticError@1:162884
11-20 11:15:55.288 E/unknown:ReactNative(13560): Wrapper@1:163399
11-20 11:15:55.288 E/unknown:ReactNative(13560): _callSuper@1:148272
11-20 11:15:55.288 E/unknown:ReactNative(13560): _construct@1:163747
11-20 11:15:55.288 E/unknown:ReactNative(13560): _next@1:594741
```

### 44 audit 14 min
```
11-20 11:17:00.451 E/ReactNativeJS(13560): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwovfrbv-bd948ab7cd2aca61","check":{"id":"external-link-359","kind":"network","status":"fail","durationMs":1465.6367019999307,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"pass","browserHandler":"pass","httpReachability":"fail","statusCode":410,"handlerAttempted":true,"httpAttempted":true,"httpSelected":true,"handlerResolution":"pass","host":"connective.athena.com.au","destinationPath":"/product-factsheet-broker"},"error":"HTTP 410: the destination is missing or unavailable.","canonicalMetrics":true}}
11-20 11:17:00.452 E/unknown:ReactNative(13560): ?anon_0_@1:3673473
11-20 11:17:00.452 E/unknown:ReactNative(13560): ?anon_0_@1:3682834
11-20 11:17:00.452 E/unknown:ReactNative(13560): SyntheticError@1:162884
11-20 11:17:00.452 E/unknown:ReactNative(13560): Wrapper@1:163399
11-20 11:17:00.452 E/unknown:ReactNative(13560): _callSuper@1:148272
11-20 11:17:00.452 E/unknown:ReactNative(13560): _construct@1:163747
11-20 11:17:00.452 E/unknown:ReactNative(13560): _next@1:594741
```
