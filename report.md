# App explorer: 1.0.339 (395)

**Real-use session ATTENTION vs 1.0.338: 0 broken, 9 friction, 0 slower**

- Friction: No reaction for 3.3 s after "scroll rates 1"
- Friction: No reaction for 3.3 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.0 s after "scroll lenders"
- Friction: No reaction for 3.6 s after "switch to savings"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.2 s after "scroll rba"
- Friction: "Bond data unavailable" shown on "scroll rba"
- Friction: "No saved rates" shown on "open saved"

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode audit | 44 steps | crashes 1 | step failures 2 | settle timeouts 0 | steps with JS/native errors 5
Baseline 1.0.338
**Audit live: outcome app crashed | 144 s | audit log not uploaded | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2597 | -520 | 361/635 | 69 | 561 | 1 errors; start 2553ms; boot js-start 391966, layout-mounted 392267, cache-read 392514, hydrated 392944, splash-hide 392944, manifest 393959, resolved 394271, core-fetched 397600, core-saved 397986, rows-prepared 398177, search-index-idle 398177, details-start 398448, pricing-ready 400010, details-fetched 406141, detail-filters-idle 409198, suitability-built 409721, core-ready 414611, rates-ready 417430 |
| 2 | scroll rates 1 | 699 | -10 | 32/62 | 61 | 677 |  |
| 3 | scroll rates 2 | 3447 | +2726 | 28/53 | 61 | 522 |  |
| 4 | scroll rates back | 678 | -11 |  |  | 520 |  |
| 5 | open product | 2796 | -2879 | 26/48 | 69 | 676 |  |
| 6 | scroll product | 733 | +21 | 25/64 | 65 | 696 |  |
| 7 | back to rates | 20 | -6 | 10/24 | 65 | 657 |  |
| 8 | open lenders | 20 | -2 | 20/26 | 150 | 664 |  |
| 9 | scroll lenders | 723 | +26 | 20/23 | 117 | 662 |  |
| 10 | back from lenders | 19 | -3 | 7/9 | 200 | 663 |  |
| 11 | switch to savings | 19 | -3 | 32/63 | 61 | 676 |  |
| 12 | switch to home loans | 19 | -3 | 14/34 | 57 | 689 |  |
| 13 | open filters | 21 | -3 | 25/28 | 150 | 691 |  |
| 14 | close filters | 19 | -2 | 9/11 | 97 | 687 |  |
| 15 | open market | 29 | +7 | 15/35 | 61 | 689 |  |
| 16 | open rba | 19 | -3 | 28/52 | 48 | 690 |  |
| 17 | scroll rba | 720 | -32 | 23/56 | 61 | 688 |  |
| 18 | back from rba | 26 | +4 | 9/21 | 48 | 689 |  |
| 19 | scroll market | 685 | +4 | 20/44 | 57 | 688 |  |
| 20 | open saved | 18 | -2 | 14/27 | 61 | 694 |  |
| 21 | return to rates | 18 | -4 | 15/34 | 57 | 696 |  |
| 22 | cold start | 8641 | -1286 | 26/42 | 101 | 597 | 1 errors; start 3284ms; boot js-start 606991, layout-mounted 607166, hydrated 607166, cache-read 608257, core-ready 608733, rows-prepared 608813, search-index-idle 608813, detail-filters-idle 608813, splash-hide 608813, manifest 610183, resolved 610957, pricing-ready 611583, rates-ready 611756 |
| 23 | about | 28 | +2 | 10/21 | 65 | 464 |  |
| 24 | audit screen | 17 | -3 | 89/232 | 48 | 605 |  |
| 25 | audit 0 min | 0 | 0 | 480/607 | 93 | 829 | 80 errors |
| 26 | audit crashed | 0 | 0 |  |  |  | CRASH; app process died during audit; 40 errors |
| 27 | relaunch after audit crash | 10340 | +2651 | 26/34 | 250 | 535 | 1 errors; boot js-start 746583, layout-mounted 746740, cache-read 747816, core-ready 748324, rows-prepared 748338, search-index-idle 748338, detail-filters-idle 748338, manifest 749134, hydrated 749469, splash-hide 749469, resolved 749900, pricing-ready 751340, rates-ready 751913 |
| 28 | about | 29 | +3 | 7/23 | 48 | 406 |  |
| 29 | audit screen | 18 | -2 | 83/235 | 48 | 484 |  |
| 30 | audit finished | 0 | 0 |  |  | 477 | no uploaded log URL (app crashed) |
| 31 | audit result 1 | 0 | 0 |  |  | 477 |  |
| 32 | audit result 2 | 0 | 0 |  |  | 478 |  |
| 33 | audit result 3 | 0 | 0 |  |  | 477 |  |
| 34 | audit result 4 | 0 | 0 |  |  | 478 |  |
| 35 | audit result 5 | 0 | 0 |  |  | 477 |  |
| 36 | audit result 6 | 0 | 0 |  |  | 478 |  |
| 37 | audit result 7 | 0 | 0 |  |  | 478 |  |
| 38 | audit result 8 | 0 | 0 |  |  | 477 |  |
| 39 | audit result 9 | 0 | 0 |  |  | 478 |  |
| 40 | audit result 10 | 0 | 0 |  |  | 478 |  |
| 41 | audit result 11 | 0 | 0 |  |  | 479 |  |
| 42 | audit result 12 | 0 | 0 |  |  | 478 |  |
| 43 | about for debug log | 26 | -5 | 9/26 | 53 | 485 |  |
| 44 | debug log screen | 0 | 0 | 74/217 | 48 | 493 |  |

## Fatal lines
```
26 E/AndroidRuntime(12083): Caused by: java.lang.IllegalStateException: The specified child already has a parent. You must call removeView() on the child's parent first.
26 E/AndroidRuntime(12083): FATAL EXCEPTION: main
26 E/AndroidRuntime(12083): java.lang.IllegalStateException: addViewAt: failed to insert view [30054] into parent [30062] at index 0
```

## Errors

### 1 open app
```
11-21 07:34:34.797 E/australianrates( 9804): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-21 07:38:10.760 E/australianrates(12083): Not starting debugger since process cannot load the jdwp agent.
```

### 25 audit 0 min
```
11-21 07:39:17.781 E/ReactNativeJS(12083): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq3k75p-75cfae3e983a3c34","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":3723.9,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":269.8,"liveStage:dates-index:fetched:ms":216.8,"liveStage:revision:verified:ms":42.7,"liveStage:Core asset:downloaded:ms":136.8,"liveStage:Core asset:hash-verified:ms":3.6,"liveStage:Core asset:native-inflated-and-text-decoded:ms":135.8,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0.1,"liveStage:Core asset:decoded:ms":251.9,"liveStage:core:history-sealed:ms":0,"liveStage:core:normalized:ms":486.7,"liveStage:Details asset:downloaded:ms":766.5,"liveStage:Details asset:hash-verified:ms":22.6,"liveSta…
11-21 07:39:17.783 E/unknown:ReactNative(12083): ?anon_0_@1:3680632
11-21 07:39:17.783 E/unknown:ReactNative(12083): ?anon_0_@1:3686437
11-21 07:39:17.783 E/unknown:ReactNative(12083): SyntheticError@1:162956
11-21 07:39:17.783 E/unknown:ReactNative(12083): Wrapper@1:163471
11-21 07:39:17.783 E/unknown:ReactNative(12083): _callSuper@1:148344
11-21 07:39:17.783 E/unknown:ReactNative(12083): _construct@1:163819
11-21 07:39:17.783 E/unknown:ReactNative(12083): _next@1:594807
```

### 26 audit crashed
```
11-21 07:40:08.224 E/ReactNativeJS(12083): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq3k75p-75cfae3e983a3c34","check":{"id":"journey-rates-warm","label":"Rates (warm)","kind":"journey","status":"fail","durationMs":1696.3,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":930.6,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates","journeyLabel":"Rates","iteration":"warm","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":930.6,"firstReadyFrameObserved":true,"firstReadyFrameMs":209.1200710000703,"backgroundSettleMs":577.8,"destinationReadinessMs":209.1,"backgroundTasks":"Product details, Search index availability","backMs":34.4,"firstBackMs":34.4,"firstBackDestination":"/performance-audit","origin…
11-21 07:40:10.759 E/ReactNativeJS(12083): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq3k75p-75cfae3e983a3c34","check":{"id":"journey-market-warm","label":"Market (warm)","kind":"journey","status":"fail","durationMs":1866,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":386.9,"minimumJustifiedActions":2,"observedActions":3,"retries":0,"validationFailures":0,"backtracks":1,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"market","journeyLabel":"Market","iteration":"warm","expectedPath":"/market","expectedSurface":"market.overview","navigationKind":"tab","forwardMs":386.9,"firstReadyFrameObserved":true,"firstReadyFrameMs":328.4962550000055,"backgroundSettleMs":694.3,"destinationReadinessMs":328.5,"backgroundTasks":"RBA calendar, Bank response analysis","backMs":515.4,"firstBackMs":473.9,"firstBackDestination":"/browse","originReadinessMs":0.2,"backDestination":"/performance-audit","b…
11-21 07:40:15.145 E/ReactNativeJS(12083): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq3k75p-75cfae3e983a3c34","check":{"id":"journey-rates-mortgage-warm","label":"Rates: Home loans (warm)","kind":"journey","status":"fail","durationMs":1768.6,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1015.3,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-mortgage","journeyLabel":"Rates: Home loans","iteration":"warm","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1015.3,"firstReadyFrameObserved":true,"firstReadyFrameMs":167.3526670000283,"backgroundSettleMs":553.5,"destinationReadinessMs":167.4,"backgroundTasks":"Product details, Search index availability","backMs":30.3,"firstBackMs":30.3,"firstB…
11-21 07:40:17.444 E/ReactNativeJS(12083): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq3k75p-75cfae3e983a3c34","check":{"id":"journey-rates-savings-warm","label":"Rates: Savings accounts (warm)","kind":"journey","status":"fail","durationMs":1618.1,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":844.8,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-savings","journeyLabel":"Rates: Savings accounts","iteration":"warm","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":844.8,"firstReadyFrameObserved":true,"firstReadyFrameMs":214.23162299999967,"backgroundSettleMs":565.3,"destinationReadinessMs":214.2,"backgroundTasks":"Product details, Search index availability","backMs":35.3,"firstBackMs":35.…
11-21 07:40:19.863 E/ReactNativeJS(12083): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq3k75p-75cfae3e983a3c34","check":{"id":"journey-rates-td-warm","label":"Rates: Term deposits (warm)","kind":"journey","status":"fail","durationMs":1734.7,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":997.7,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-td","journeyLabel":"Rates: Term deposits","iteration":"warm","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":997.7,"firstReadyFrameObserved":true,"firstReadyFrameMs":135.26559800002724,"backgroundSettleMs":549,"destinationReadinessMs":135.3,"backgroundTasks":"Product details, Search index availability","backMs":35.4,"firstBackMs":35.4,"firstBackDestin…
11-21 07:40:23.439 E/ReactNativeJS(12083): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq3k75p-75cfae3e983a3c34","check":{"id":"journey-outlook-warm","label":"Outlook (warm)","kind":"journey","status":"fail","durationMs":1313.5,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":513.6,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"outlook","journeyLabel":"Outlook","iteration":"warm","expectedPath":"/research","expectedSurface":"outlook.dashboard","navigationKind":"stack","forwardMs":513.6,"firstReadyFrameObserved":true,"firstReadyFrameMs":199.51862500002608,"backgroundSettleMs":578.4,"destinationReadinessMs":199.5,"backgroundTasks":"RBA calendar, Bank response analysis, Bank history","backMs":50.7,"firstBackMs":50.7,"firstBackDestination":"/performance-audit","originReadinessMs":0.2,"back…
11-21 07:40:25.005 E/AndroidRuntime(12083): 	... 22 more
11-21 07:40:25.005 E/AndroidRuntime(12083): 	at B3.h.doFrame(SourceFile:1)
```

### 27 relaunch after audit crash
```
11-21 07:40:30.273 E/australianrates(13052): Not starting debugger since process cannot load the jdwp agent.
```
