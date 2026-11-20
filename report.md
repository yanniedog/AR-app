# App explorer: 1.0.321 (377)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode full | 52 steps | crashes 1 | step failures 2 | settle timeouts 0 | steps with JS/native errors 5
Baseline 1.0.320
**Audit live: outcome app crashed | 136 s | audit log not uploaded | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 16838 | -17516 | 35/49 | 200 | 669 | 4 errors; start 1164ms |
| 2 | /browse | 26 | -44 |  |  | 582 |  |
| 3 | /watchlist | 2335 | +2252 | 3/4 | 53 | 451 |  |
| 4 | /market | 27 | -39 | 9/20 | 53 | 463 |  |
| 5 | /tools | 24 | -34 | 13/22 | 65 | 464 |  |
| 6 | /trends | 22 | -28 | 26/40 | 89 | 462 |  |
| 7 | /search | 27 | -1 | 33/44 | 117 | 494 |  |
| 8 | /banks | 32 | -1 | 33/47 | 85 | 493 |  |
| 9 | /bank-rates | 27 | -80 | 18/30 | 73 | 489 |  |
| 10 | /categories | 29 | -2 | 33/47 | 85 | 530 |  |
| 11 | /catalogue | 39 | +2 | 32/46 | 89 | 528 |  |
| 12 | /compare | 26 | -11 | 12/15 | 109 | 536 |  |
| 13 | /matches | 30 | +2 | 32/51 | 85 | 526 |  |
| 14 | /calculator | 24 | -1 | 13/21 | 65 | 515 |  |
| 15 | /projections | 3024 | +2995 | 22/34 | 81 | 537 |  |
| 16 | /profile | 27 | 0 | 12/24 | 65 | 526 |  |
| 17 | /research | 28 | +1 | 16/29 | 61 | 535 |  |
| 18 | /rba | 34 | +6 | 11/26 | 53 | 550 |  |
| 19 | /rba-response | 25 | -7 | 17/29 | 61 | 546 |  |
| 20 | /settings | 26 | +2 | 25/44 | 57 | 554 |  |
| 21 | /about | 28 | +3 | 12/24 | 61 | 551 |  |
| 22 | /terms | 28 | +1 | 13/25 | 57 | 554 |  |
| 23 | /privacy | 24 | 0 |  |  | 554 |  |
| 24 | /third-party-notices | 22 | -8 | 11/25 | 53 | 562 |  |
| 25 | /node | 23 | -10 | 33/49 | 73 | 607 |  |
| 26 | /passthrough | 40 | +7 | 31/52 | 73 | 595 |  |
| 27 | /calculation-receipt | 24 | -5 | 15/25 | 65 | 577 |  |
| 28 | /rate-receipt | 24 | 0 | 6/9 | 73 | 579 |  |
| 29 | warm resume | 754 | -109 | 3/4 | 250 | 577 | start 314ms |
| 30 | cold relaunch | 8223 | -1877 | 28/39 | 113 | 512 | 1 errors; start 3349ms |
| 31 | about | 25 |  | 9/24 | 77 | 403 |  |
| 32 | audit screen | 20 |  | 99/228 | 57 | 392 |  |
| 33 | audit 0 min | 0 |  | 47/57 | 125 | 625 | 19 errors |
| 34 | audit crashed | 0 |  |  |  |  | CRASH; app process died during audit; 49 errors |
| 35 | relaunch after audit crash | 6255 |  | 17/30 | 400 | 522 | 1 errors |
| 36 | about | 28 |  | 12/23 | 81 | 382 |  |
| 37 | audit screen | 20 |  | 101/224 | 57 | 463 |  |
| 38 | audit finished | 0 |  |  |  | 455 | no uploaded log URL (app crashed) |
| 39 | audit result 1 | 0 |  |  |  | 456 |  |
| 40 | audit result 2 | 0 |  |  |  | 456 |  |
| 41 | audit result 3 | 0 |  |  |  | 455 |  |
| 42 | audit result 4 | 0 |  |  |  | 456 |  |
| 43 | audit result 5 | 0 |  |  |  | 456 |  |
| 44 | audit result 6 | 0 |  |  |  | 457 |  |
| 45 | audit result 7 | 0 |  |  |  | 456 |  |
| 46 | audit result 8 | 0 |  |  |  | 457 |  |
| 47 | audit result 9 | 0 |  |  |  | 457 |  |
| 48 | audit result 10 | 0 |  |  |  | 456 |  |
| 49 | audit result 11 | 0 |  |  |  | 457 |  |
| 50 | audit result 12 | 0 |  |  |  | 457 |  |
| 51 | about for debug log | 25 |  | 15/23 | 65 | 496 |  |
| 52 | debug log screen | 0 |  | 91/194 | 53 | 484 |  |

## Fatal lines
```
1 W/ReactNativeJS(10411): [AR warn] store: ensureHistoryBanks compact asset failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
1 W/ReactNativeJS(10411): [AR warn] store: ensureBankInsights failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
1 W/ReactNativeJS(10411): [AR warn] degrade: store.ensureFailed fn=ensureBankInsights error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
34 E/AndroidRuntime(13522): Caused by: java.lang.IllegalStateException: The specified child already has a parent. You must call removeView() on the child's parent first.
34 E/AndroidRuntime(13522): FATAL EXCEPTION: main
34 E/AndroidRuntime(13522): java.lang.IllegalStateException: addViewAt: failed to insert view [29522] into parent [29530] at index 0
```

## Errors

### 1 cold start
```
11-20 10:36:35.298 E/australianrates(10411): Not starting debugger since process cannot load the jdwp agent.
11-20 10:36:47.889 W/ReactNativeJS(10411): [AR warn] store: ensureHistoryBanks compact asset failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
11-20 10:36:48.219 W/ReactNativeJS(10411): [AR warn] store: ensureBankInsights failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
11-20 10:36:48.221 W/ReactNativeJS(10411): [AR warn] degrade: store.ensureFailed fn=ensureBankInsights error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
```

### 30 cold relaunch
```
11-20 10:40:31.234 E/australianrates(13522): Not starting debugger since process cannot load the jdwp agent.
```

### 33 audit 0 min
```
11-20 10:41:33.115 E/ReactNativeJS(13522): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwoumtqn-755bcad8b49b2679","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":3777.7,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":159.3,"liveStage:dates-index:fetched:ms":218.9,"liveStage:revision:verified:ms":57.1,"liveStage:Core asset:downloaded:ms":133.5,"liveStage:Core asset:hash-verified:ms":7.1,"liveStage:Core asset:native-inflated-and-text-decoded:ms":134.2,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":191,"liveStage:core:history-sealed:ms":1.1,"liveStage:core:normalized:ms":501.7,"liveStage:Details asset:downloaded:ms":743.1,"liveStage:Details asset:hash-verified:ms":21.5,"liveStage…
11-20 10:41:33.116 E/unknown:ReactNative(13522): ?anon_0_@1:3673473
11-20 10:41:33.116 E/unknown:ReactNative(13522): ?anon_0_@1:3679273
11-20 10:41:33.116 E/unknown:ReactNative(13522): SyntheticError@1:162884
11-20 10:41:33.116 E/unknown:ReactNative(13522): Wrapper@1:163399
11-20 10:41:33.116 E/unknown:ReactNative(13522): _callSuper@1:148272
11-20 10:41:33.116 E/unknown:ReactNative(13522): _construct@1:163747
11-20 10:41:33.116 E/unknown:ReactNative(13522): _next@1:594741
```

### 34 audit crashed
```
11-20 10:41:42.219 E/ReactNativeJS(13522): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwoumtqn-755bcad8b49b2679","check":{"id":"journey-rates-cold","label":"Rates (cold)","kind":"journey","status":"fail","durationMs":7554.8,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":6745.7,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates","journeyLabel":"Rates","iteration":"cold","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":6745.7,"firstReadyFrameObserved":true,"firstReadyFrameMs":6563.944329999969,"backgroundSettleMs":531.3,"destinationReadinessMs":6563.9,"backgroundTasks":"Product details, Search index availability","backMs":40.1,"firstBackMs":40.1,"firstBackDestination":"/performance-audit","ori…
11-20 10:41:44.900 E/ReactNativeJS(13522): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwoumtqn-755bcad8b49b2679","check":{"id":"journey-market-cold","label":"Market (cold)","kind":"journey","status":"fail","durationMs":2001.4,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":493.2,"minimumJustifiedActions":2,"observedActions":3,"retries":0,"validationFailures":0,"backtracks":1,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"market","journeyLabel":"Market","iteration":"cold","expectedPath":"/market","expectedSurface":"market.overview","navigationKind":"tab","forwardMs":493.2,"firstReadyFrameObserved":true,"firstReadyFrameMs":389.38457300001755,"backgroundSettleMs":563.5,"destinationReadinessMs":389.4,"backgroundTasks":"RBA calendar, Bank response analysis","backMs":620.3,"firstBackMs":579.1,"firstBackDestination":"/browse","originReadinessMs":0.3,"backDestination":"/performance-audit"…
11-20 10:41:49.598 E/ReactNativeJS(13522): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwoumtqn-755bcad8b49b2679","check":{"id":"journey-rates-mortgage-cold","label":"Rates: Home loans (cold)","kind":"journey","status":"fail","durationMs":1952.1,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1024.9,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-mortgage","journeyLabel":"Rates: Home loans","iteration":"cold","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1024.9,"firstReadyFrameObserved":true,"firstReadyFrameMs":182.67733900004532,"backgroundSettleMs":663.9,"destinationReadinessMs":182.7,"backgroundTasks":"Product details, Search index availability","backMs":52,"firstBackMs":52,"firstBack…
11-20 10:41:52.334 E/ReactNativeJS(13522): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwoumtqn-755bcad8b49b2679","check":{"id":"journey-rates-savings-cold","label":"Rates: Savings accounts (cold)","kind":"journey","status":"fail","durationMs":2071.1,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1212.2,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-savings","journeyLabel":"Rates: Savings accounts","iteration":"cold","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1212.2,"firstReadyFrameObserved":true,"firstReadyFrameMs":984.9645310000051,"backgroundSettleMs":623.7,"destinationReadinessMs":985,"backgroundTasks":"Product details, Search index availability","backMs":70.2,"firstBackMs":70.2…
11-20 10:41:55.361 E/ReactNativeJS(13522): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwoumtqn-755bcad8b49b2679","check":{"id":"journey-rates-td-cold","label":"Rates: Term deposits (cold)","kind":"journey","status":"fail","durationMs":2265,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1478.1,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-td","journeyLabel":"Rates: Term deposits","iteration":"cold","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1478.1,"firstReadyFrameObserved":true,"firstReadyFrameMs":1147.393461999949,"backgroundSettleMs":588.5,"destinationReadinessMs":1147.4,"backgroundTasks":"Product details, Search index availability","backMs":41.8,"firstBackMs":41.8,"firstBackDest…
11-20 10:42:00.172 E/ReactNativeJS(13522): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwoumtqn-755bcad8b49b2679","check":{"id":"journey-rba-cold","label":"RBA rates (cold)","kind":"journey","status":"fail","durationMs":565.9,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"minimumJustifiedActions":2,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":false,"journeyId":"rba","journeyLabel":"RBA rates","iteration":"cold","expectedPath":"/rba","expectedSurface":"rba.dashboard","navigationKind":"stack","firstReadyFrameObserved":false,"backChangedPath":false,"backReturnedToAudit":false,"returnNavigationKind":"none","runtimeErrors":0,"incidentalRuntimeErrors":0,"nonTimingFailure":false,"stepBudgetOmittedMs":0,"eventLoopSamples":10,"eventLoopMeasurementAvailable":true,"eventLoopP95Ms":59.3,"maxEventLoopLagMs":59.3,"stallsOver100Ms":0,"frameSamples":18,"fram…
11-20 10:42:02.198 E/ReactNativeJS(13522): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwoumtqn-755bcad8b49b2679","check":{"id":"journey-watchlist-cold","label":"Saved (cold)","kind":"journey","status":"fail","durationMs":1402.2,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":45.2,"minimumJustifiedActions":2,"observedActions":3,"retries":0,"validationFailures":0,"backtracks":1,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"watchlist","journeyLabel":"Saved","iteration":"cold","expectedPath":"/watchlist","expectedSurface":"saved.list","navigationKind":"tab","forwardMs":45.2,"firstReadyFrameObserved":true,"firstReadyFrameMs":0.17967699992004782,"backgroundSettleMs":692.6,"destinationReadinessMs":0.2,"backMs":491.6,"firstBackMs":453.5,"firstBackDestination":"/browse","originReadinessMs":0.3,"backDestination":"/performance-audit","backChangedPath":true,"backReturnedToAudit":true,"return…
11-20 10:42:07.546 E/ReactNativeJS(13522): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwoumtqn-755bcad8b49b2679","check":{"id":"journey-projections-cold","label":"Lifecycle projections (cold)","kind":"journey","status":"fail","durationMs":1250.2,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":474.5,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"projections","journeyLabel":"Lifecycle projections","iteration":"cold","expectedPath":"/calculator","expectedSurface":"projections.lifecycle-chart","navigationKind":"stack","forwardMs":474.5,"firstReadyFrameObserved":true,"firstReadyFrameMs":383.83674900000915,"backgroundSettleMs":582.3,"destinationReadinessMs":383.8,"backMs":34.1,"firstBackMs":34.1,"firstBackDestination":"/performance-audit","originReadinessMs":0.4,"backDestination":"/performa…
```

### 35 relaunch after audit crash
```
11-20 10:42:46.720 E/australianrates(14532): Not starting debugger since process cannot load the jdwp agent.
```
