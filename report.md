# App explorer: 1.0.338 (394)

**Real-use session ATTENTION vs 1.0.338: 0 broken, 13 friction, 0 slower**

- Friction: No reaction for 4.3 s after "scroll rates 1"
- Friction: No reaction for 3.2 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll lenders"
- Friction: No reaction for 5.2 s after "switch to savings"
- Friction: No reaction for 3.0 s after "switch to home loans"
- Friction: No reaction for 3.5 s after "open filters"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.2 s after "open rba"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.2 s after "scroll rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: "No saved rates" shown on "open saved"

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode full | 73 steps | crashes 1 | step failures 2 | settle timeouts 0 | steps with JS/native errors 5
Baseline 1.0.338
**Audit live: outcome app crashed | 113 s | audit log not uploaded | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3117 |  | 664/892 | 85 | 501 | 1 errors; start 3063ms |
| 2 | scroll rates 1 | 709 |  | 44/65 | 81 | 559 | boot js-start 434599, layout-mounted 435040, cache-read 435191, hydrated 435352, splash-hide 435352, manifest 436369, resolved 436816, core-fetched 442233, core-saved 443215, rows-prepared 443724, search-index-idle 443724, details-start 444508, pricing-ready 446265, details-fetched 454347, detail-filters-idle 463000, suitability-built 464497, core-ready 472842, rates-ready 477950 |
| 3 | scroll rates 2 | 721 |  | 22/30 | 150 | 762 |  |
| 4 | scroll rates back | 689 |  |  |  | 538 |  |
| 5 | open product | 5675 |  | 40/59 | 85 | 688 |  |
| 6 | scroll product | 712 |  | 32/53 | 81 | 702 |  |
| 7 | back to rates | 26 |  | 12/22 | 69 | 670 |  |
| 8 | open lenders | 22 |  | 19/24 | 200 | 674 |  |
| 9 | scroll lenders | 697 |  | 18/19 | 133 | 660 |  |
| 10 | back from lenders | 22 |  | 7/8 | 125 | 660 |  |
| 11 | switch to savings | 22 |  | 71/102 | 81 | 671 |  |
| 12 | switch to home loans | 22 |  | 16/28 | 57 | 684 |  |
| 13 | open filters | 24 |  | 23/27 | 121 | 691 |  |
| 14 | close filters | 21 |  | 8/9 | 150 | 681 |  |
| 15 | open market | 22 |  | 19/29 | 69 | 682 |  |
| 16 | open rba | 22 |  | 40/54 | 57 | 682 |  |
| 17 | scroll rba | 752 |  | 26/41 | 81 | 680 |  |
| 18 | back from rba | 22 |  | 11/19 | 77 | 683 |  |
| 19 | scroll market | 681 |  | 25/39 | 89 | 683 |  |
| 20 | open saved | 20 |  | 16/24 | 73 | 688 |  |
| 21 | return to rates | 22 |  | 29/48 | 69 | 689 |  |
| 22 | cold start | 9927 | -2357 | 33/38 | 101 | 583 | 3 errors; start 4324ms; boot js-start 669333, layout-mounted 669525, hydrated 669651, cache-read 670871, core-ready 671621, rows-prepared 671756, search-index-idle 671756, detail-filters-idle 671756, splash-hide 671758, manifest 673739, resolved 674626, pricing-ready 675467, rates-ready 675728 |
| 23 | /browse | 41 | -2578 | 2/2 | 32 | 625 |  |
| 24 | /watchlist | 25 | -30 | 3/4 | 46 | 433 |  |
| 25 | /market | 27 | -2358 | 15/22 | 61 | 514 |  |
| 26 | /tools | 27 | -48 | 13/20 | 300 | 573 |  |
| 27 | /trends | 24 | -9 |  |  | 660 |  |
| 28 | /search | 26 | +1 | 37/59 | 117 | 631 |  |
| 29 | /banks | 25 | -2 | 30/39 | 109 | 637 |  |
| 30 | /bank-rates | 30 | 0 | 15/27 | 121 | 646 |  |
| 31 | /categories | 26 | 0 | 35/48 | 97 | 663 |  |
| 32 | /catalogue | 25 | -5 | 36/42 | 101 | 677 |  |
| 33 | /compare | 27 | 0 | 12/15 | 121 | 671 |  |
| 34 | /matches | 24 | -2 | 34/43 | 93 | 689 |  |
| 35 | /calculator | 39 | +3 | 16/21 | 81 | 672 |  |
| 36 | /projections | 33 | +3 | 24/32 | 89 | 674 |  |
| 37 | /profile | 30 | +2 | 15/26 | 73 | 679 |  |
| 38 | /research | 36 | +7 | 18/27 | 81 | 687 |  |
| 39 | /rba | 28 | -6 | 17/26 | 101 | 699 |  |
| 40 | /rba-response | 34 | +2 | 18/31 | 73 | 695 |  |
| 41 | /settings | 28 | -1 | 18/26 | 93 | 703 |  |
| 42 | /about | 30 | -1 | 15/24 | 85 | 702 |  |
| 43 | /terms | 29 | +3 | 14/23 | 65 | 703 |  |
| 44 | /privacy | 32 | +6 |  |  | 702 |  |
| 45 | /third-party-notices | 29 | -4 | 12/22 | 77 | 706 |  |
| 46 | /node | 35 | +12 | 32/47 | 89 | 727 |  |
| 47 | /passthrough | 27 | -2 | 28/49 | 89 | 714 |  |
| 48 | /calculation-receipt | 33 | +4 | 16/27 | 77 | 701 |  |
| 49 | /rate-receipt | 26 | +1 | 6/9 | 73 | 701 |  |
| 50 | warm resume | 951 | +642 | 4/4 | 200 | 700 | start 431ms |
| 51 | cold relaunch | 9786 | +1431 | 28/34 | 250 | 578 | 3 errors; start 4307ms; boot js-start 897404, layout-mounted 897595, hydrated 897694, cache-read 898999, core-ready 899720, rows-prepared 899846, search-index-idle 899846, detail-filters-idle 899846, splash-hide 899847, manifest 901335, resolved 902431, pricing-ready 903420, rates-ready 903692 |
| 52 | about | 39 |  | 13/19 | 300 | 400 |  |
| 53 | audit screen | 21 |  | 115/202 | 65 | 606 |  |
| 54 | audit 0 min | 0 |  | 30/33 | 65 | 729 |  |
| 55 | audit crashed | 0 |  |  |  |  | CRASH; app process died during audit; 43 errors |
| 56 | relaunch after audit crash | 7689 |  | 23/32 | 450 | 505 | 1 errors; boot js-start 1010444, layout-mounted 1010629, cache-read 1011933, core-ready 1012706, rows-prepared 1012734, search-index-idle 1012734, detail-filters-idle 1012734, manifest 1013595, resolved 1013845, hydrated 1014173, splash-hide 1014173, pricing-ready 1017160, rates-ready 1017700 |
| 57 | about | 26 |  | 13/21 | 69 | 397 |  |
| 58 | audit screen | 20 |  | 110/213 | 65 | 486 |  |
| 59 | audit finished | 0 |  |  |  | 476 | no uploaded log URL (app crashed) |
| 60 | audit result 1 | 0 |  |  |  | 477 |  |
| 61 | audit result 2 | 0 |  |  |  | 476 |  |
| 62 | audit result 3 | 0 |  |  |  | 477 |  |
| 63 | audit result 4 | 0 |  |  |  | 476 |  |
| 64 | audit result 5 | 0 |  |  |  | 476 |  |
| 65 | audit result 6 | 0 |  |  |  | 477 |  |
| 66 | audit result 7 | 0 |  |  |  | 477 |  |
| 67 | audit result 8 | 0 |  |  |  | 478 |  |
| 68 | audit result 9 | 0 |  |  |  | 477 |  |
| 69 | audit result 10 | 0 |  |  |  | 477 |  |
| 70 | audit result 11 | 0 |  |  |  | 478 |  |
| 71 | audit result 12 | 0 |  |  |  | 477 |  |
| 72 | about for debug log | 31 |  | 14/22 | 65 | 469 |  |
| 73 | debug log screen | 0 |  | 109/203 | 65 | 476 |  |

## Fatal lines
```
55 E/AndroidRuntime(15908): Caused by: java.lang.IllegalStateException: The specified child already has a parent. You must call removeView() on the child's parent first.
55 E/AndroidRuntime(15908): FATAL EXCEPTION: main
55 E/AndroidRuntime(15908): java.lang.IllegalStateException: addViewAt: failed to insert view [14268] into parent [14276] at index 0
```

## Errors

### 1 open app
```
11-21 07:09:24.343 E/australianrates(10639): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-21 07:13:20.451 E/australianrates(12870): Not starting debugger since process cannot load the jdwp agent.
11-21 07:13:24.648 E/SurfaceSyncGroup(12870): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-21 07:13:24.648 E/SurfaceSyncGroup(12870): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 51 cold relaunch
```
11-21 07:17:08.893 E/australianrates(15908): Not starting debugger since process cannot load the jdwp agent.
11-21 07:17:12.749 E/SurfaceSyncGroup(15908): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-21 07:17:12.749 E/SurfaceSyncGroup(15908): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 55 audit crashed
```
11-21 07:18:23.325 E/ReactNativeJS(15908): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq2t8g4-66caaeeca5936316","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":4924.9,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":119.5,"liveStage:dates-index:fetched:ms":221.5,"liveStage:revision:verified:ms":52.6,"liveStage:Core asset:downloaded:ms":279.8,"liveStage:Core asset:hash-verified:ms":12.3,"liveStage:Core asset:native-inflated-and-text-decoded:ms":153.9,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":216.5,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":612.6,"liveStage:Details asset:downloaded:ms":1337.8,"liveStage:Details asset:hash-verified:ms":26.6,"liveS…
11-21 07:18:24.109 E/ReactNativeJS(15908): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq2t8g4-66caaeeca5936316","check":{"id":"maximum-coverage-profile","label":"Maximum safe audit coverage preparation","kind":"data","status":"fail","durationMs":736.3,"metrics":{"profile":"maximum-safe-coverage-v1","maximumSafeFeaturesEnabled":true,"enabledSections":"Mortgage,Savings,TD","includeNonStandard":true,"deepSearchEnabled":true,"historyExplorerEnabled":true,"depositRankMetric":"max","mortgageRateMetric":"comparison","requiredAssets":8,"availableAssets":8,"localCacheOnly":false,"bankInsightsPreparationAttempted":true,"bankInsightsCacheOnly":false,"executionAttempted":true,"measurementAvailable":true,"nonTimingFailure":false,"eventLoopSamples":6,"eventLoopMeasurementAvailable":true,"eventLoopP95Ms":370.2,"maxEventLoopLagMs":370.2,"stallsOver100Ms":1,"frameSamples":13,"frameMeasurementAvailable":true,"frameP95Ms":385.4,"maxFrameGapMs":385.4,"framesOver50Ms":3}}}
11-21 07:18:35.370 E/ReactNativeJS(15908): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq2t8g4-66caaeeca5936316","check":{"id":"journey-rates-cold","label":"Rates (cold)","kind":"journey","status":"fail","durationMs":9868.5,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":8995.5,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates","journeyLabel":"Rates","iteration":"cold","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":8995.5,"firstReadyFrameObserved":true,"firstReadyFrameMs":8748.820722999983,"backgroundSettleMs":639.8,"destinationReadinessMs":8748.8,"backgroundTasks":"Product details, Search index availability","backMs":65.4,"firstBackMs":65.4,"firstBackDestination":"/performance-audit","ori…
11-21 07:18:38.777 E/ReactNativeJS(15908): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq2t8g4-66caaeeca5936316","check":{"id":"journey-market-cold","label":"Market (cold)","kind":"journey","status":"fail","durationMs":2702.3,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":972.5,"minimumJustifiedActions":2,"observedActions":3,"retries":0,"validationFailures":0,"backtracks":1,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"market","journeyLabel":"Market","iteration":"cold","expectedPath":"/market","expectedSurface":"market.overview","navigationKind":"tab","forwardMs":972.5,"firstReadyFrameObserved":true,"firstReadyFrameMs":656.6840539999539,"backgroundSettleMs":678.8,"destinationReadinessMs":656.7,"backgroundTasks":"RBA calendar, Bank response analysis","backMs":855.3,"firstBackMs":800.2,"firstBackDestination":"/browse","originReadinessMs":0.3,"backDestination":"/performance-audit",…
11-21 07:18:40.944 E/ReactNativeJS(15908): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq2t8g4-66caaeeca5936316","check":{"id":"journey-bank-rates-cold","label":"Bank rates (cold)","kind":"journey","status":"fail","durationMs":1409.2,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":656.3,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"bank-rates","journeyLabel":"Bank rates","iteration":"cold","expectedPath":"/bank-rates","expectedSurface":"bank-rates.dashboard","navigationKind":"stack","forwardMs":656.3,"firstReadyFrameObserved":true,"firstReadyFrameMs":546.9597899999935,"backgroundSettleMs":550.9,"destinationReadinessMs":547,"backMs":36.7,"firstBackMs":36.7,"firstBackDestination":"/performance-audit","originReadinessMs":0.3,"backDestination":"/performance-audit","backChangedPath":true,…
11-21 07:18:43.999 E/ReactNativeJS(15908): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq2t8g4-66caaeeca5936316","check":{"id":"journey-rates-mortgage-cold","label":"Rates: Home loans (cold)","kind":"journey","status":"fail","durationMs":2314,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1428.1,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-mortgage","journeyLabel":"Rates: Home loans","iteration":"cold","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1428.1,"firstReadyFrameObserved":true,"firstReadyFrameMs":260.85946700000204,"backgroundSettleMs":568.8,"destinationReadinessMs":260.9,"backgroundTasks":"Product details, Search index availability","backMs":92,"firstBackMs":92,"firstBackDe…
11-21 07:18:47.397 E/ReactNativeJS(15908): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq2t8g4-66caaeeca5936316","check":{"id":"journey-rates-savings-cold","label":"Rates: Savings accounts (cold)","kind":"journey","status":"fail","durationMs":2645.3,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1854.7,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-savings","journeyLabel":"Rates: Savings accounts","iteration":"cold","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1854.7,"firstReadyFrameObserved":true,"firstReadyFrameMs":1400.6524780000327,"backgroundSettleMs":449.8,"destinationReadinessMs":1400.7,"backgroundTasks":"Product details, Search index availability","backMs":36.8,"firstBackMs":…
11-21 07:18:51.159 E/ReactNativeJS(15908): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq2t8g4-66caaeeca5936316","check":{"id":"journey-rates-td-cold","label":"Rates: Term deposits (cold)","kind":"journey","status":"fail","durationMs":2990.3,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":2286.8,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-td","journeyLabel":"Rates: Term deposits","iteration":"cold","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":2286.8,"firstReadyFrameObserved":true,"firstReadyFrameMs":1659.152376000071,"backgroundSettleMs":433.8,"destinationReadinessMs":1659.2,"backgroundTasks":"Product details, Search index availability","backMs":34,"firstBackMs":34,"firstBackDestin…
```

### 56 relaunch after audit crash
```
11-21 07:19:01.627 E/australianrates(16786): Not starting debugger since process cannot load the jdwp agent.
```
