# App explorer: 1.0.338 (394)

**Real-use session ATTENTION vs 1.0.337: 0 broken, 14 friction, 2 slower**

- Friction: No reaction for 4.0 s after "scroll rates 1"
- Friction: No reaction for 3.9 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.2 s after "open lenders"
- Friction: No reaction for 3.5 s after "scroll lenders"
- Friction: No reaction for 5.1 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.8 s after "open filters"
- Friction: No reaction for 3.2 s after "open market"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.2 s after "scroll rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: No reaction for 3.3 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Slower: Dropped frames 71% to 86% on "open rba"
- Slower: "open rba" content 0.0 s to 2.6 s

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode audit | 44 steps | crashes 1 | step failures 2 | settle timeouts 0 | steps with JS/native errors 4
Baseline 1.0.337
**Audit live: outcome app crashed | 118 s | audit log not uploaded | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3668 | +142 | 789/987 | 93 | 530 | 1 errors; start 3320ms |
| 2 | scroll rates 1 | 729 | -11 | 39/53 | 89 | 595 | boot js-start 437047, layout-mounted 437311, cache-read 437518, hydrated 437721, splash-hide 437721, manifest 438959, resolved 439446, core-fetched 446549, core-saved 447666, rows-prepared 448278, search-index-idle 448278, details-start 448718, pricing-ready 454649, details-fetched 459124, detail-filters-idle 467380, suitability-built 469349, core-ready 479864, rates-ready 483607 |
| 3 | scroll rates 2 | 716 | -54 | 32/43 | 85 | 672 |  |
| 4 | scroll rates back | 684 | -18 |  |  | 536 |  |
| 5 | open product | 5521 | -733 | 37/56 | 97 | 656 |  |
| 6 | scroll product | 705 | -49 | 32/51 | 93 | 668 |  |
| 7 | back to rates | 30 | -4 | 15/24 | 77 | 651 |  |
| 8 | open lenders | 29 | -1 | 20/23 | 350 | 646 |  |
| 9 | scroll lenders | 836 | +72 | 20/22 | 150 | 643 |  |
| 10 | back from lenders | 27 | -4 | 6/8 | 121 | 643 |  |
| 11 | switch to savings | 28 | -1 | 66/82 | 89 | 659 |  |
| 12 | switch to home loans | 31 | +2 | 16/26 | 73 | 674 |  |
| 13 | open filters | 29 | -2 | 22/24 | 101 | 679 |  |
| 14 | close filters | 27 | -2 | 10/10 | 200 | 681 |  |
| 15 | open market | 28 | -3 | 20/30 | 81 | 680 |  |
| 16 | open rba | 2738 | +2708 | 49/57 | 69 | 670 |  |
| 17 | scroll rba | 705 | -8 | 32/43 | 97 | 672 |  |
| 18 | back from rba | 27 | -5 | 11/18 | 69 | 673 |  |
| 19 | scroll market | 758 | +57 | 25/38 | 85 | 673 |  |
| 20 | open saved | 25 | -4 | 15/22 | 73 | 681 |  |
| 21 | return to rates | 26 | -2 | 18/26 | 73 | 680 |  |
| 22 | cold start | 9956 | -1166 | 32/37 | 150 | 586 | 1 errors; start 4240ms; boot js-start 685229, layout-mounted 685425, hydrated 685547, cache-read 686847, core-ready 687495, rows-prepared 687637, search-index-idle 687637, detail-filters-idle 687637, splash-hide 687638, manifest 689746, resolved 690510, pricing-ready 691356, rates-ready 691603 |
| 23 | about | 40 | -1 | 12/20 | 250 | 616 |  |
| 24 | audit screen | 26 | -2 | 123/189 | 73 | 608 |  |
| 25 | audit 0 min | 0 | 0 | 15/18 | 150 | 584 |  |
| 26 | audit crashed | 0 | 0 |  |  |  | CRASH; app process died during audit; 43 errors |
| 27 | relaunch after audit crash | 9516 | -629 | 24/30 | 400 | 495 | 1 errors; boot js-start 803153, layout-mounted 803357, cache-read 804764, core-ready 805431, rows-prepared 805467, search-index-idle 805467, detail-filters-idle 805467, manifest 806449, hydrated 806846, splash-hide 806846, resolved 807050, pricing-ready 810097, rates-ready 810483 |
| 28 | about | 34 | -7 | 11/18 | 250 | 389 |  |
| 29 | audit screen | 27 | -1 | 118/202 | 69 | 476 |  |
| 30 | audit finished | 0 | 0 |  |  | 469 | no uploaded log URL (app crashed) |
| 31 | audit result 1 | 0 | 0 |  |  | 469 |  |
| 32 | audit result 2 | 0 | 0 |  |  | 470 |  |
| 33 | audit result 3 | 0 | 0 |  |  | 469 |  |
| 34 | audit result 4 | 0 | 0 |  |  | 470 |  |
| 35 | audit result 5 | 0 | 0 |  |  | 470 |  |
| 36 | audit result 6 | 0 | 0 |  |  | 470 |  |
| 37 | audit result 7 | 0 | 0 |  |  | 471 |  |
| 38 | audit result 8 | 0 | 0 |  |  | 470 |  |
| 39 | audit result 9 | 0 | 0 |  |  | 470 |  |
| 40 | audit result 10 | 0 | 0 |  |  | 471 |  |
| 41 | audit result 11 | 0 | 0 |  |  | 470 |  |
| 42 | audit result 12 | 0 | 0 |  |  | 472 |  |
| 43 | about for debug log | 45 | +8 | 14/21 | 61 | 502 |  |
| 44 | debug log screen | 0 | 0 | 103/188 | 69 | 487 |  |

## Fatal lines
```
26 E/AndroidRuntime(12876): Caused by: java.lang.IllegalStateException: The specified child already has a parent. You must call removeView() on the child's parent first.
26 E/AndroidRuntime(12876): FATAL EXCEPTION: main
26 E/AndroidRuntime(12876): java.lang.IllegalStateException: addViewAt: failed to insert view [14268] into parent [14276] at index 0
```

## Errors

### 1 open app
```
11-21 06:30:04.602 E/australianrates(10577): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-21 06:34:14.364 E/australianrates(12876): Not starting debugger since process cannot load the jdwp agent.
```

### 26 audit crashed
```
11-21 06:35:31.937 E/ReactNativeJS(12876): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq1a3oy-54224650ee7e0c9c","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":4677.8,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":271.5,"liveStage:dates-index:fetched:ms":225.8,"liveStage:revision:verified:ms":80.5,"liveStage:Core asset:downloaded:ms":176,"liveStage:Core asset:hash-verified:ms":18.8,"liveStage:Core asset:native-inflated-and-text-decoded:ms":192.2,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":198.5,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":640.7,"liveStage:Details asset:downloaded:ms":1022.3,"liveStage:Details asset:hash-verified:ms":30.2,"liveSta…
11-21 06:35:32.612 E/ReactNativeJS(12876): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq1a3oy-54224650ee7e0c9c","check":{"id":"maximum-coverage-profile","label":"Maximum safe audit coverage preparation","kind":"data","status":"fail","durationMs":571.5,"metrics":{"profile":"maximum-safe-coverage-v1","maximumSafeFeaturesEnabled":true,"enabledSections":"Mortgage,Savings,TD","includeNonStandard":true,"deepSearchEnabled":true,"historyExplorerEnabled":true,"depositRankMetric":"max","mortgageRateMetric":"comparison","requiredAssets":8,"availableAssets":8,"localCacheOnly":false,"bankInsightsPreparationAttempted":true,"bankInsightsCacheOnly":false,"executionAttempted":true,"measurementAvailable":true,"nonTimingFailure":false,"eventLoopSamples":6,"eventLoopMeasurementAvailable":true,"eventLoopP95Ms":267.7,"maxEventLoopLagMs":267.7,"stallsOver100Ms":1,"frameSamples":12,"frameMeasurementAvailable":true,"frameP95Ms":284.8,"maxFrameGapMs":284.8,"framesOver50Ms":3}}}
11-21 06:35:43.483 E/ReactNativeJS(12876): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq1a3oy-54224650ee7e0c9c","check":{"id":"journey-rates-cold","label":"Rates (cold)","kind":"journey","status":"fail","durationMs":9444.1,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":8443.8,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates","journeyLabel":"Rates","iteration":"cold","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":8443.8,"firstReadyFrameObserved":true,"firstReadyFrameMs":8119.672836999991,"backgroundSettleMs":674.2,"destinationReadinessMs":8119.7,"backgroundTasks":"Product details, Search index availability","backMs":35.9,"firstBackMs":35.9,"firstBackDestination":"/performance-audit","ori…
11-21 06:35:46.994 E/ReactNativeJS(12876): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq1a3oy-54224650ee7e0c9c","check":{"id":"journey-market-cold","label":"Market (cold)","kind":"journey","status":"fail","durationMs":2731.7,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":888.6,"minimumJustifiedActions":2,"observedActions":3,"retries":0,"validationFailures":0,"backtracks":1,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"market","journeyLabel":"Market","iteration":"cold","expectedPath":"/market","expectedSurface":"market.overview","navigationKind":"tab","forwardMs":888.6,"firstReadyFrameObserved":true,"firstReadyFrameMs":734.353800999932,"backgroundSettleMs":502.3,"destinationReadinessMs":734.4,"backgroundTasks":"RBA calendar, Bank response analysis","backMs":828.7,"firstBackMs":785.7,"firstBackDestination":"/browse","originReadinessMs":0.5,"backDestination":"/performance-audit","…
11-21 06:35:52.337 E/ReactNativeJS(12876): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq1a3oy-54224650ee7e0c9c","check":{"id":"journey-rates-mortgage-cold","label":"Rates: Home loans (cold)","kind":"journey","status":"fail","durationMs":2391.6,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1317.9,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-mortgage","journeyLabel":"Rates: Home loans","iteration":"cold","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1317.9,"firstReadyFrameObserved":true,"firstReadyFrameMs":281.64667699998245,"backgroundSettleMs":814.6,"destinationReadinessMs":281.6,"backgroundTasks":"Product details, Search index availability","backMs":64.1,"firstBackMs":64.1,"first…
11-21 06:35:56.337 E/ReactNativeJS(12876): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq1a3oy-54224650ee7e0c9c","check":{"id":"journey-rates-savings-cold","label":"Rates: Savings accounts (cold)","kind":"journey","status":"fail","durationMs":3238.6,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":2503.7,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-savings","journeyLabel":"Rates: Savings accounts","iteration":"cold","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":2503.7,"firstReadyFrameObserved":true,"firstReadyFrameMs":1645.3937380000716,"backgroundSettleMs":498.7,"destinationReadinessMs":1645.4,"backgroundTasks":"Product details, Search index availability","backMs":47.4,"firstBackMs":…
11-21 06:36:00.019 E/ReactNativeJS(12876): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq1a3oy-54224650ee7e0c9c","check":{"id":"journey-rates-td-cold","label":"Rates: Term deposits (cold)","kind":"journey","status":"fail","durationMs":2956.2,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":2212.1,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-td","journeyLabel":"Rates: Term deposits","iteration":"cold","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":2212.1,"firstReadyFrameObserved":true,"firstReadyFrameMs":1779.592028999934,"backgroundSettleMs":548.9,"destinationReadinessMs":1779.6,"backgroundTasks":"Product details, Search index availability","backMs":34.8,"firstBackMs":34.8,"firstBackDe…
11-21 06:36:02.128 E/ReactNativeJS(12876): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq1a3oy-54224650ee7e0c9c","check":{"id":"journey-response-cold","label":"Bank response (cold)","kind":"journey","status":"fail","durationMs":1118,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":519.8,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"response","journeyLabel":"Bank response","iteration":"cold","expectedPath":"/rba-response","expectedSurface":"moves.response-chart","navigationKind":"stack","forwardMs":519.8,"firstReadyFrameObserved":true,"firstReadyFrameMs":0.8457580000394955,"backgroundSettleMs":284.8,"destinationReadinessMs":0.8,"backgroundTasks":"RBA calendar, Bank response analysis","backMs":40.2,"firstBackMs":40.2,"firstBackDestination":"/performance-audit","originReadinessMs":0.4,"b…
```

### 27 relaunch after audit crash
```
11-21 06:36:12.100 E/australianrates(13873): Not starting debugger since process cannot load the jdwp agent.
```
