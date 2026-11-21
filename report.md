# App explorer: 1.0.340 (396)

**Real-use session ATTENTION vs 1.0.339: 0 broken, 8 friction, 1 slower**

- Friction: No reaction for 3.1 s after "scroll rates 1"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.5 s after "switch to savings"
- Friction: No reaction for 3.0 s after "open rba"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.0 s after "scroll rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: "No saved rates" shown on "open saved"
- Slower: Dropped frames 42% to 58% on "back to rates"

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode audit | 49 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 10
Baseline 1.0.339
**Audit live: outcome completed | 824 s | audit log 830414 bytes (audit-log.txt) https://paste.c-net.org/0c4759b3-60ef-a8d6-133f-6e1932572cf3 | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 31472 |  | 426/739 | 73 | 604 | 1 errors; start 2683ms; boot js-start 390346, layout-mounted 391128, cache-read 391322, hydrated 391500, splash-hide 391500, manifest 392384, resolved 392941, core-fetched 396466, core-saved 397182, rows-prepared 397514, search-index-idle 397514, details-start 397805, pricing-ready 399710, details-fetched 404895, detail-filters-idle 410070, suitability-built 410874, core-ready 416833, rates-ready 419573 |
| 2 | scroll rates 1 | 3221 |  | 33/60 | 85 | 567 |  |
| 3 | scroll rates 2 | 731 |  | 17/31 | 65 | 566 |  |
| 4 | scroll rates back | 686 |  |  |  | 551 |  |
| 5 | open product | 2776 |  | 35/61 | 81 | 630 |  |
| 6 | scroll product | 723 |  | 27/61 | 69 | 658 |  |
| 7 | back to rates | 23 |  | 14/24 | 65 | 632 |  |
| 8 | open lenders | 22 |  | 20/25 | 250 | 625 |  |
| 9 | scroll lenders | 679 |  | 16/22 | 113 | 623 |  |
| 10 | back from lenders | 21 |  | 5/7 | 89 | 626 |  |
| 11 | switch to savings | 23 |  | 29/51 | 77 | 635 |  |
| 12 | switch to home loans | 23 |  | 15/31 | 48 | 651 |  |
| 13 | open filters | 21 |  | 21/28 | 121 | 656 |  |
| 14 | close filters | 21 |  | 8/9 | 150 | 655 |  |
| 15 | open market | 21 |  | 15/33 | 48 | 661 |  |
| 16 | open rba | 22 |  | 32/56 | 53 | 661 |  |
| 17 | scroll rba | 707 |  | 22/46 | 65 | 660 |  |
| 18 | back from rba | 21 |  | 8/21 | 46 | 662 |  |
| 19 | scroll market | 690 |  | 22/42 | 69 | 661 |  |
| 20 | open saved | 22 |  | 12/20 | 81 | 667 |  |
| 21 | return to rates | 21 |  | 13/29 | 61 | 672 |  |
| 22 | cold start | 8542 | -5122 | 29/39 | 93 | 598 | 1 errors; start 3156ms; boot js-start 617684, layout-mounted 617846, hydrated 617964, cache-read 619004, core-ready 619517, rows-prepared 619617, search-index-idle 619617, detail-filters-idle 619617, splash-hide 619618, manifest 621029, resolved 621765, pricing-ready 622428, rates-ready 622611 |
| 23 | about | 33 |  | 10/21 | 69 | 462 |  |
| 24 | audit screen | 20 |  | 94/222 | 53 | 630 |  |
| 25 | audit 1 min | 0 |  | 947/1165 | 97 | 932 | 80 errors |
| 26 | audit 3 min | 0 |  | 910/1124 | 101 | 1144 | 80 errors |
| 27 | audit 4 min | 0 |  | 178/221 | 85 | 1175 | 80 errors |
| 28 | audit 5 min | 0 |  | 1176/1394 | 101 | 1142 | 80 errors |
| 29 | audit 7 min | 0 |  | 921/1163 | 93 | 1329 | 80 errors |
| 30 | audit 8 min | 0 |  | 902/1081 | 101 | 1390 | 80 errors |
| 31 | audit 10 min | 0 |  | 79/94 | 81 | 1212 | 80 errors |
| 32 | audit 11 min | 0 |  | 147/184 | 34 | 1222 | 38 errors |
| 33 | audit 12 min | 0 |  | 156/200 | 44 | 1240 |  |
| 34 | audit 13 min | 0 |  | 19/30 | 85 | 1401 |  |
| 35 | audit finished | 0 |  | 85/193 | 61 | 1246 |  |
| 36 | audit result 1 | 0 |  |  |  | 1226 |  |
| 37 | audit result 2 | 0 |  |  |  | 1229 |  |
| 38 | audit result 3 | 0 |  |  |  | 1227 |  |
| 39 | audit result 4 | 0 |  |  |  | 1230 |  |
| 40 | audit result 5 | 0 |  |  |  | 1229 |  |
| 41 | audit result 6 | 0 |  |  |  | 1227 |  |
| 42 | audit result 7 | 0 |  |  |  | 1230 |  |
| 43 | audit result 8 | 0 |  |  |  | 1228 |  |
| 44 | audit result 9 | 0 |  |  |  | 1230 |  |
| 45 | audit result 10 | 0 |  |  |  | 1231 |  |
| 46 | audit result 11 | 0 |  |  |  | 1230 |  |
| 47 | audit result 12 | 0 |  |  |  | 1232 |  |
| 48 | about for debug log | 3063 |  | 18/32 | 65 | 1270 |  |
| 49 | debug log screen | 0 |  | 84/214 | 53 | 1284 |  |

## Errors

### 1 open app
```
11-21 08:30:59.615 E/australianrates(10206): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-21 08:34:47.745 E/australianrates(12527): Not starting debugger since process cannot load the jdwp agent.
```

### 25 audit 1 min
```
11-21 08:35:50.556 E/ReactNativeJS(12527): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5l0wa-24124910952c9074","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":3632.9,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":167.5,"liveStage:dates-index:fetched:ms":150.8,"liveStage:revision:verified:ms":57.4,"liveStage:Core asset:downloaded:ms":121.9,"liveStage:Core asset:hash-verified:ms":3.3,"liveStage:Core asset:native-inflated-and-text-decoded:ms":150.1,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":213.3,"liveStage:core:history-sealed:ms":0,"liveStage:core:normalized:ms":524.5,"liveStage:Details asset:downloaded:ms":793.1,"liveStage:Details asset:hash-verified:ms":28.6,"liveSta…
11-21 08:35:50.558 E/unknown:ReactNative(12527): ?anon_0_@1:3680632
11-21 08:35:50.558 E/unknown:ReactNative(12527): ?anon_0_@1:3686437
11-21 08:35:50.558 E/unknown:ReactNative(12527): SyntheticError@1:162956
11-21 08:35:50.558 E/unknown:ReactNative(12527): Wrapper@1:163471
11-21 08:35:50.558 E/unknown:ReactNative(12527): _callSuper@1:148344
11-21 08:35:50.558 E/unknown:ReactNative(12527): _construct@1:163819
11-21 08:35:50.558 E/unknown:ReactNative(12527): _next@1:594807
```

### 26 audit 3 min
```
11-21 08:37:22.907 E/ReactNativeJS(12527): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5l0wa-24124910952c9074","check":{"id":"deep-first-pass.route.rates.search.open","label":"route.rates: search.open (first-pass)","kind":"journey","status":"fail","durationMs":1700.2,"metrics":{"journeyId":"route.rates.search.open","journeyLabel":"route.rates: search.open","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.open","depth":0,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":55.2,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":989.4,"forwardWorkMs":989.4,"navigationCommitMs":719.4,"firstReadyFrameMs":270,"firstReadyFrameObserved":true,"readinessMs":270,"backgroundSettleMs":653.8,…
11-21 08:37:22.908 E/unknown:ReactNative(12527): ?anon_0_@1:3680632
11-21 08:37:22.908 E/unknown:ReactNative(12527): ?anon_0_@1:3686437
11-21 08:37:22.908 E/unknown:ReactNative(12527): SyntheticError@1:162956
11-21 08:37:22.908 E/unknown:ReactNative(12527): Wrapper@1:163471
11-21 08:37:22.908 E/unknown:ReactNative(12527): _callSuper@1:148344
11-21 08:37:22.908 E/unknown:ReactNative(12527): _construct@1:163819
11-21 08:37:22.908 E/unknown:ReactNative(12527): _next@1:594807
```

### 27 audit 4 min
```
11-21 08:39:04.324 E/ReactNativeJS(12527): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5l0wa-24124910952c9074","check":{"id":"deep-first-pass.sample.catalogue.3.product.open","label":"sample.catalogue.3: product.open (first-pass)","kind":"journey","status":"fail","durationMs":2240.6,"metrics":{"journeyId":"sample.catalogue.3.product.open","journeyLabel":"sample.catalogue.3: product.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.3","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Royal%20Automobile%20Club%20of%20Queensland%20(RACQ)%7C7%7CTERM_DEPOSITS%7CTerm%20Deposit","expectedPath":"/product/Royal%20Automobile%20Club%20of%20Queensland%20(RACQ)%7C7%7CTERM_DEPOSITS%7CTerm%20Deposit","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":360.7,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"r…
11-21 08:39:04.330 E/unknown:ReactNative(12527): ?anon_0_@1:3680632
11-21 08:39:04.330 E/unknown:ReactNative(12527): ?anon_0_@1:3686437
11-21 08:39:04.330 E/unknown:ReactNative(12527): SyntheticError@1:162956
11-21 08:39:04.330 E/unknown:ReactNative(12527): Wrapper@1:163471
11-21 08:39:04.330 E/unknown:ReactNative(12527): _callSuper@1:148344
11-21 08:39:04.330 E/unknown:ReactNative(12527): _construct@1:163819
11-21 08:39:04.330 E/unknown:ReactNative(12527): _next@1:594807
```

### 28 audit 5 min
```
11-21 08:39:30.323 E/ReactNativeJS(12527): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5l0wa-24124910952c9074","check":{"id":"deep-first-pass.route.projections.projections.open","label":"route.projections: projections.open (first-pass)","kind":"journey","status":"fail","durationMs":980.9,"metrics":{"journeyId":"route.projections.projections.open","journeyLabel":"route.projections: projections.open","iteration":"cold","passId":"first-pass","scenarioId":"route.projections","semanticActionId":"projections.open","depth":0,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"projections.inputs","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":250.6,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":75,"forwardWorkMs":75,"navigationCommitMs":0,"firstReadyFrameMs":75,"firstReadyFrameObs…
11-21 08:39:30.324 E/unknown:ReactNative(12527): ?anon_0_@1:3680632
11-21 08:39:30.324 E/unknown:ReactNative(12527): ?anon_0_@1:3686437
11-21 08:39:30.324 E/unknown:ReactNative(12527): SyntheticError@1:162956
11-21 08:39:30.324 E/unknown:ReactNative(12527): Wrapper@1:163471
11-21 08:39:30.324 E/unknown:ReactNative(12527): _callSuper@1:148344
11-21 08:39:30.324 E/unknown:ReactNative(12527): _construct@1:163819
11-21 08:39:30.324 E/unknown:ReactNative(12527): _next@1:594807
```

### 29 audit 7 min
```
11-21 08:41:34.923 E/ReactNativeJS(12527): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5l0wa-24124910952c9074","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.open","label":"route.rates-mortgage-scope: search.open (repeat)","kind":"journey","status":"fail","durationMs":7349.4,"metrics":{"journeyId":"route.rates-mortgage-scope.search.open","journeyLabel":"route.rates-mortgage-scope: search.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.open","depth":0,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":94.4,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":6572.7,"forwardWorkMs":6572.7,"navigationCommitMs":227.7,"firstReadyFrameMs":6345,"firstRead…
11-21 08:41:34.924 E/unknown:ReactNative(12527): ?anon_0_@1:3680632
11-21 08:41:34.924 E/unknown:ReactNative(12527): ?anon_0_@1:3686437
11-21 08:41:34.924 E/unknown:ReactNative(12527): SyntheticError@1:162956
11-21 08:41:34.924 E/unknown:ReactNative(12527): Wrapper@1:163471
11-21 08:41:34.924 E/unknown:ReactNative(12527): _callSuper@1:148344
11-21 08:41:34.924 E/unknown:ReactNative(12527): _construct@1:163819
11-21 08:41:34.924 E/unknown:ReactNative(12527): _next@1:594807
```

### 30 audit 8 min
```
11-21 08:43:19.347 E/ReactNativeJS(12527): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5l0wa-24124910952c9074","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1440.4,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Up%7Cup-essentials%7CTRANS_AND_SAVINGS_ACCOUNTS%7CUp%20Essentials%20Saver","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"renderRevisionBefore":"202…
11-21 08:43:19.348 E/unknown:ReactNative(12527): ?anon_0_@1:3680632
11-21 08:43:19.348 E/unknown:ReactNative(12527): ?anon_0_@1:3686437
11-21 08:43:19.348 E/unknown:ReactNative(12527): SyntheticError@1:162956
11-21 08:43:19.348 E/unknown:ReactNative(12527): Wrapper@1:163471
11-21 08:43:19.348 E/unknown:ReactNative(12527): _callSuper@1:148344
11-21 08:43:19.348 E/unknown:ReactNative(12527): _construct@1:163819
11-21 08:43:19.348 E/unknown:ReactNative(12527): _next@1:594807
```

### 31 audit 10 min
```
11-21 08:44:53.241 E/ReactNativeJS(12527): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5l0wa-24124910952c9074","check":{"id":"external-link-21","kind":"network","status":"fail","durationMs":0.18212100001983345,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"fail","browserHandler":"unknown","httpReachability":"unknown","handlerAttempted":false,"httpAttempted":false,"httpSelected":true,"handlerResolution":"unresolved"},"error":"This website is not approved for this type of source.","canonicalMetrics":true}}
11-21 08:44:53.242 E/unknown:ReactNative(12527): ?anon_0_@1:3680632
11-21 08:44:53.242 E/unknown:ReactNative(12527): ?anon_0_@1:3689999
11-21 08:44:53.242 E/unknown:ReactNative(12527): SyntheticError@1:162956
11-21 08:44:53.242 E/unknown:ReactNative(12527): Wrapper@1:163471
11-21 08:44:53.242 E/unknown:ReactNative(12527): _callSuper@1:148344
11-21 08:44:53.242 E/unknown:ReactNative(12527): _construct@1:163819
11-21 08:44:53.242 E/unknown:ReactNative(12527): _next@1:594807
```

### 32 audit 11 min
```
11-21 08:45:48.791 E/ReactNativeJS(12527): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5l0wa-24124910952c9074","check":{"id":"external-link-598","kind":"network","status":"fail","durationMs":0.19538599997758865,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"fail","browserHandler":"unknown","httpReachability":"unknown","handlerAttempted":false,"httpAttempted":false,"httpSelected":true,"handlerResolution":"unresolved"},"error":"This website is not approved for this type of source.","canonicalMetrics":true}}
11-21 08:45:48.792 E/unknown:ReactNative(12527): ?anon_0_@1:3680632
11-21 08:45:48.792 E/unknown:ReactNative(12527): ?anon_0_@1:3689999
11-21 08:45:48.792 E/unknown:ReactNative(12527): SyntheticError@1:162956
11-21 08:45:48.792 E/unknown:ReactNative(12527): Wrapper@1:163471
11-21 08:45:48.792 E/unknown:ReactNative(12527): _callSuper@1:148344
11-21 08:45:48.792 E/unknown:ReactNative(12527): _construct@1:163819
11-21 08:45:48.792 E/unknown:ReactNative(12527): _next@1:594807
```
