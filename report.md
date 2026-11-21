# App explorer: 1.0.337 (393)

**Real-use session FAIL vs 1.0.336: 1 broken, 15 friction, 5 slower**

- Broken: 96% dropped frames on "open filters"
- Friction: No reaction for 3.4 s after "scroll rates 1"
- Friction: No reaction for 3.8 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 3.0 s after "open lenders"
- Friction: No reaction for 3.3 s after "scroll lenders"
- Friction: No reaction for 5.5 s after "switch to savings"
- Friction: No reaction for 3.2 s after "switch to home loans"
- Friction: No reaction for 3.7 s after "open filters"
- Friction: No reaction for 3.3 s after "open market"
- Friction: No reaction for 3.2 s after "open rba"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.0 s after "scroll rba"
- Friction: "Refresh failed" shown on "scroll rba"
- Friction: No reaction for 3.3 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Slower: Dropped frames 71% to 89% on "scroll rates 1"
- Slower: Dropped frames 57% to 75% on "open product"
- Slower: Dropped frames 58% to 77% on "scroll product"
- Slower: Dropped frames 74% to 90% on "back to rates"
- Slower: Dropped frames 71% to 86% on "open lenders"

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode full | 73 steps | crashes 1 | step failures 2 | settle timeouts 0 | steps with JS/native errors 6
Baseline 1.0.336
**Audit live: outcome app crashed | 165 s | audit log not uploaded | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3526 | +479 | 854/1036 | 97 | 503 | 1 errors; start 3435ms |
| 2 | scroll rates 1 | 740 | +44 | 31/35 | 89 | 741 | boot js-start 456411, layout-mounted 456766, cache-read 456930, hydrated 457174, splash-hide 457174, manifest 458795, resolved 459266, core-fetched 465614, core-saved 466622, rows-prepared 466986, search-index-idle 466986, details-start 467353, pricing-ready 469348, details-fetched 481709, detail-filters-idle 490576, suitability-built 492202, details-saved 507707, rates-ready 508484 |
| 3 | scroll rates 2 | 770 | +67 | 33/45 | 101 | 398 |  |
| 4 | scroll rates back | 702 | +24 |  |  | 444 |  |
| 5 | open product | 6254 | +740 | 38/51 | 109 | 567 |  |
| 6 | scroll product | 754 | +23 | 37/48 | 97 | 570 |  |
| 7 | back to rates | 34 | +9 | 18/20 | 129 | 555 |  |
| 8 | open lenders | 30 | +6 | 19/22 | 300 | 560 |  |
| 9 | scroll lenders | 764 | +76 | 14/18 | 150 | 558 |  |
| 10 | back from lenders | 31 | +9 | 9/9 | 150 | 558 |  |
| 11 | switch to savings | 29 | +7 | 74/87 | 101 | 569 |  |
| 12 | switch to home loans | 29 | +6 | 18/27 | 65 | 585 |  |
| 13 | open filters | 31 | +8 | 24/25 | 150 | 586 |  |
| 14 | close filters | 29 | +7 | 8/9 | 250 | 585 |  |
| 15 | open market | 31 | +7 | 20/28 | 61 | 588 |  |
| 16 | open rba | 30 | +3 | 34/48 | 81 | 587 |  |
| 17 | scroll rba | 713 | -2 | 15/23 | 73 | 586 |  |
| 18 | back from rba | 32 | +4 | 12/16 | 81 | 587 |  |
| 19 | scroll market | 701 | +13 | 22/31 | 89 | 586 |  |
| 20 | open saved | 29 | +6 | 17/23 | 89 | 590 |  |
| 21 | return to rates | 28 | +5 | 20/31 | 81 | 592 |  |
| 22 | cold start | 11122 | +932 | 37/40 | 113 | 583 | 1 errors; start 4388ms; boot js-start 710365, layout-mounted 710587, hydrated 710726, cache-read 712090, core-ready 712830, rows-prepared 712978, search-index-idle 712978, detail-filters-idle 712978, splash-hide 712980, manifest 715444, resolved 716342, pricing-ready 717299, rates-ready 717584 |
| 23 | /browse | 35 |  | 2/2 | 32 | 425 |  |
| 24 | /watchlist | 34 |  | 2/3 | 32 | 424 |  |
| 25 | /market | 56 |  | 17/23 | 73 | 513 |  |
| 26 | /tools | 36 |  | 17/21 | 133 | 580 |  |
| 27 | /trends | 32 |  |  |  | 611 |  |
| 28 | /search | 94 |  | 43/60 | 121 | 619 |  |
| 29 | /banks | 32 |  | 35/40 | 125 | 631 |  |
| 30 | /bank-rates | 33 |  | 21/27 | 89 | 644 |  |
| 31 | /categories | 32 |  | 38/46 | 113 | 657 |  |
| 32 | /catalogue | 45 |  | 27/37 | 117 | 662 |  |
| 33 | /compare | 35 |  | 12/14 | 109 | 655 |  |
| 34 | /matches | 39 |  | 35/44 | 101 | 679 |  |
| 35 | /calculator | 50 |  | 17/22 | 77 | 663 |  |
| 36 | /projections | 34 |  | 29/34 | 117 | 667 |  |
| 37 | /profile | 41 |  | 18/23 | 69 | 672 |  |
| 38 | /research | 37 |  | 21/28 | 101 | 680 |  |
| 39 | /rba | 2685 |  | 14/25 | 77 | 709 |  |
| 40 | /rba-response | 41 |  | 19/28 | 85 | 690 |  |
| 41 | /settings | 35 |  | 15/21 | 101 | 698 |  |
| 42 | /about | 41 |  | 19/25 | 85 | 696 |  |
| 43 | /terms | 37 |  | 15/21 | 81 | 697 |  |
| 44 | /privacy | 39 |  |  |  | 697 |  |
| 45 | /third-party-notices | 39 |  | 18/24 | 81 | 701 |  |
| 46 | /node | 36 |  | 41/45 | 105 | 737 |  |
| 47 | /passthrough | 43 |  | 28/39 | 117 | 720 |  |
| 48 | /calculation-receipt | 33 |  | 14/21 | 89 | 697 |  |
| 49 | /rate-receipt | 39 |  | 7/9 | 89 | 698 |  |
| 50 | warm resume | 951 |  | 4/5 | 150 | 697 | start 454ms |
| 51 | cold relaunch | 10757 |  | 25/31 | 350 | 577 | 3 errors; start 4707ms; boot js-start 955251, layout-mounted 955464, hydrated 955621, cache-read 956951, core-ready 957665, rows-prepared 957815, search-index-idle 957815, detail-filters-idle 957815, splash-hide 957817, manifest 959575, resolved 960827, pricing-ready 961788, rates-ready 962077 |
| 52 | about | 47 | +10 | 13/19 | 250 | 604 |  |
| 53 | audit screen | 29 | +7 | 129/190 | 81 | 572 |  |
| 54 | audit 0 min | 0 | 0 | 422/458 | 133 | 1009 | 80 errors |
| 55 | audit crashed | 0 |  |  |  |  | CRASH; app process died during audit; 44 errors |
| 56 | relaunch after audit crash | 10145 |  | 22/27 | 700 | 490 | 12 errors; boot js-start 1118625, layout-mounted 1118856, cache-read 1120437, core-ready 1121333, rows-prepared 1121357, search-index-idle 1121357, detail-filters-idle 1121357, manifest 1122641, resolved 1123173, hydrated 1123292, splash-hide 1123292, pricing-ready 1126876, rates-ready 1127732 |
| 57 | about | 41 | +4 | 13/20 | 250 | 385 |  |
| 58 | audit screen | 28 | +6 | 125/193 | 73 | 472 |  |
| 59 | audit finished | 0 | 0 |  |  | 464 | no uploaded log URL (app crashed) |
| 60 | audit result 1 | 0 | 0 |  |  | 464 |  |
| 61 | audit result 2 | 0 | 0 |  |  | 465 |  |
| 62 | audit result 3 | 0 | 0 |  |  | 464 |  |
| 63 | audit result 4 | 0 | 0 |  |  | 465 |  |
| 64 | audit result 5 | 0 | 0 |  |  | 464 |  |
| 65 | audit result 6 | 0 | 0 |  |  | 466 |  |
| 66 | audit result 7 | 0 | 0 |  |  | 466 |  |
| 67 | audit result 8 | 0 | 0 |  |  | 465 |  |
| 68 | audit result 9 | 0 | 0 |  |  | 465 |  |
| 69 | audit result 10 | 0 | 0 |  |  | 466 |  |
| 70 | audit result 11 | 0 | 0 |  |  | 465 |  |
| 71 | audit result 12 | 0 | 0 |  |  | 465 |  |
| 72 | about for debug log | 37 | -3507 | 15/21 | 73 | 475 |  |
| 73 | debug log screen | 0 | 0 | 114/182 | 73 | 482 |  |

## Fatal lines
```
55 E/AndroidRuntime(15924): Caused by: java.lang.IllegalStateException: The specified child already has a parent. You must call removeView() on the child's parent first.
55 E/AndroidRuntime(15924): FATAL EXCEPTION: main
55 E/AndroidRuntime(15924): java.lang.IllegalStateException: addViewAt: failed to insert view [30688] into parent [30696] at index 0
56 E/ReactNativeJS(16899): [AR error] perf-audit: interrupted state restoration failed: Error: Encrypted rate scenario restore did not persist: scenario changed before the write completed\n    at ?anon_0_ (address at index.android.bundle:1:2231454)\n    at next (native)\n    at asyncGeneratorStep (address at index.android.bundle:1:594527)\n    at _next (address at index.android.bundle:1:594785)\n    at tryCallOne (address at InternalBytecode.js:1:1180)\n    at anonymous (address at InternalBytecode.js:1:1874)\nRetry: Error: Encrypted rate scenario restore did not persist: scenario changed before the write completed\n    at ?anon_0_ (address at index.android.bundle:1:2231454)\n    at next (native)\n    at asyncGeneratorStep (address at index.android.bundle:1:594527)\n    at _next (address at index.android.bundle:1:594785)\n    at tryCallOne (address at InternalBytecode.js:1:1180)\n    at anonymous (address at InternalBytecode.js:1:1874)\nRetry: Error: Encrypted rate scenario restore did not persist: scenario changed before the write co…
56 E/unknown:ReactNative(16899): console.error: [AR error] perf-audit: interrupted state restoration failed: Error: Encrypted rate scenario restore did not persist: scenario changed before the write completed\n    at ?anon_0_ (address at index.android.bundle:1:2231454)\n    at next (native)\n    at asyncGeneratorStep (address at index.android.bundle:1:594527)\n    at _next (address at index.android.bundle:1:594785)\n    at tryCallOne (address at InternalBytecode.js:1:1180)\n    at anonymous (address at InternalBytecode.js:1:1874)\nRetry: Error: Encrypted rate scenario restore did not persist: scenario changed before the write completed\n    at ?anon_0_ (address at index.android.bundle:1:2231454)\n    at next (native)\n    at asyncGeneratorStep (address at index.android.bundle:1:594527)\n    at _next (address at index.android.bundle:1:594785)\n    at tryCallOne (address at InternalBytecode.js:1:1180)\n    at anonymous (address at InternalBytecode.js:1:1874)\nRetry: Error: Encrypted rate scenario restore did not persist: scenario changed before the write co…, stack:
```

## Errors

### 1 open app
```
11-21 05:37:09.714 E/australianrates(10644): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-21 05:41:25.266 E/australianrates(12947): Not starting debugger since process cannot load the jdwp agent.
```

### 51 cold relaunch
```
11-21 05:45:29.940 E/australianrates(15924): Not starting debugger since process cannot load the jdwp agent.
11-21 05:45:34.464 E/SurfaceSyncGroup(15924): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-21 05:45:34.464 E/SurfaceSyncGroup(15924): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 54 audit 0 min
```
11-21 05:46:42.686 E/ReactNativeJS(15924): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpzjg9v-aa2c638a8f9c64be","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":5414.3,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":294.5,"liveStage:dates-index:fetched:ms":200.2,"liveStage:revision:verified:ms":73.1,"liveStage:Core asset:downloaded:ms":270.1,"liveStage:Core asset:hash-verified:ms":5.7,"liveStage:Core asset:native-inflated-and-text-decoded:ms":198.6,"liveStage:Core asset:inflated:ms":0.2,"liveStage:Core asset:text-decoded:ms":0.1,"liveStage:Core asset:decoded:ms":435.7,"liveStage:core:history-sealed:ms":0.8,"liveStage:core:normalized:ms":668.2,"liveStage:Details asset:downloaded:ms":1189.5,"liveStage:Details asset:hash-verified:ms":19.1,"li…
11-21 05:46:42.688 E/unknown:ReactNative(15924): ?anon_0_@1:3680250
11-21 05:46:42.688 E/unknown:ReactNative(15924): ?anon_0_@1:3686050
11-21 05:46:42.688 E/unknown:ReactNative(15924): SyntheticError@1:162928
11-21 05:46:42.688 E/unknown:ReactNative(15924): Wrapper@1:163443
11-21 05:46:42.688 E/unknown:ReactNative(15924): _callSuper@1:148316
11-21 05:46:42.688 E/unknown:ReactNative(15924): _construct@1:163791
11-21 05:46:42.688 E/unknown:ReactNative(15924): _next@1:594785
```

### 55 audit crashed
```
11-21 05:47:37.206 E/ReactNativeJS(15924): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpzjg9v-aa2c638a8f9c64be","check":{"id":"journey-lender-cold","label":"Lender details (cold)","kind":"journey","status":"fail","durationMs":2389.6,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1168.5,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"lender","journeyLabel":"Lender details","iteration":"cold","expectedPath":"/bank/MoveBank","expectedSurface":"lender.details","navigationKind":"stack","forwardMs":1168.5,"firstReadyFrameObserved":true,"firstReadyFrameMs":271.1036829999648,"backgroundSettleMs":890.9,"destinationReadinessMs":271.1,"backgroundTasks":"Bank response analysis","backMs":92.8,"firstBackMs":92.8,"firstBackDestination":"/performance-audit","originReadinessMs":0.3,"backDestination":…
11-21 05:47:39.610 E/ReactNativeJS(15924): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpzjg9v-aa2c638a8f9c64be","check":{"id":"journey-compare-cold","label":"Product comparison (cold)","kind":"journey","status":"fail","durationMs":1538.6,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":768.6,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"compare","journeyLabel":"Product comparison","iteration":"cold","expectedPath":"/compare","expectedSurface":"compare.table","navigationKind":"stack","forwardMs":768.6,"firstReadyFrameObserved":true,"firstReadyFrameMs":501.90993000008166,"backgroundSettleMs":532.3,"destinationReadinessMs":501.9,"backMs":40.7,"firstBackMs":40.7,"firstBackDestination":"/performance-audit","originReadinessMs":0.3,"backDestination":"/performance-audit","backChangedPath":tr…
11-21 05:47:46.407 E/ReactNativeJS(15924): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpzjg9v-aa2c638a8f9c64be","check":{"id":"journey-rates-warm","label":"Rates (warm)","kind":"journey","status":"fail","durationMs":2459.6,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1481.7,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates","journeyLabel":"Rates","iteration":"warm","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1481.7,"firstReadyFrameObserved":true,"firstReadyFrameMs":352.6414419999346,"backgroundSettleMs":685.4,"destinationReadinessMs":352.6,"backgroundTasks":"Product details, Search index availability","backMs":122.9,"firstBackMs":122.9,"firstBackDestination":"/performance-audit","or…
11-21 05:47:49.786 E/ReactNativeJS(15924): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpzjg9v-aa2c638a8f9c64be","check":{"id":"journey-market-warm","label":"Market (warm)","kind":"journey","status":"fail","durationMs":2538.5,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":878.7,"minimumJustifiedActions":2,"observedActions":3,"retries":0,"validationFailures":0,"backtracks":1,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"market","journeyLabel":"Market","iteration":"warm","expectedPath":"/market","expectedSurface":"market.overview","navigationKind":"tab","forwardMs":878.7,"firstReadyFrameObserved":true,"firstReadyFrameMs":746.4110850000288,"backgroundSettleMs":751,"destinationReadinessMs":746.4,"backgroundTasks":"RBA calendar, Bank response analysis","backMs":702.4,"firstBackMs":643.7,"firstBackDestination":"/browse","originReadinessMs":0.4,"backDestination":"/performance-audit","b…
11-21 05:47:51.908 E/ReactNativeJS(15924): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpzjg9v-aa2c638a8f9c64be","check":{"id":"journey-bank-rates-warm","label":"Bank rates (warm)","kind":"journey","status":"fail","durationMs":1310.1,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":549.2,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"bank-rates","journeyLabel":"Bank rates","iteration":"warm","expectedPath":"/bank-rates","expectedSurface":"bank-rates.dashboard","navigationKind":"stack","forwardMs":549.2,"firstReadyFrameObserved":true,"firstReadyFrameMs":183.37242099992,"backgroundSettleMs":556.3,"destinationReadinessMs":183.4,"backMs":35.7,"firstBackMs":35.7,"firstBackDestination":"/performance-audit","originReadinessMs":0.4,"backDestination":"/performance-audit","backChangedPath":true,…
11-21 05:47:55.124 E/ReactNativeJS(15924): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpzjg9v-aa2c638a8f9c64be","check":{"id":"journey-rates-mortgage-warm","label":"Rates: Home loans (warm)","kind":"journey","status":"fail","durationMs":2508.2,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1412.7,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-mortgage","journeyLabel":"Rates: Home loans","iteration":"warm","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1412.7,"firstReadyFrameObserved":true,"firstReadyFrameMs":303.5834269998595,"backgroundSettleMs":832.8,"destinationReadinessMs":303.6,"backgroundTasks":"Product details, Search index availability","backMs":51.9,"firstBackMs":51.9,"firstB…
11-21 05:47:58.368 E/ReactNativeJS(15924): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpzjg9v-aa2c638a8f9c64be","check":{"id":"journey-rates-savings-warm","label":"Rates: Savings accounts (warm)","kind":"journey","status":"fail","durationMs":2433.3,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1468.2,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-savings","journeyLabel":"Rates: Savings accounts","iteration":"warm","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1468.2,"firstReadyFrameObserved":true,"firstReadyFrameMs":310.2177320001647,"backgroundSettleMs":629,"destinationReadinessMs":310.2,"backgroundTasks":"Product details, Search index availability","backMs":169.4,"firstBackMs":169…
11-21 05:48:01.537 E/ReactNativeJS(15924): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpzjg9v-aa2c638a8f9c64be","check":{"id":"journey-rates-td-warm","label":"Rates: Term deposits (warm)","kind":"journey","status":"fail","durationMs":2406,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1662.1,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-td","journeyLabel":"Rates: Term deposits","iteration":"warm","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1662.1,"firstReadyFrameObserved":true,"firstReadyFrameMs":349.7574189999141,"backgroundSettleMs":537.2,"destinationReadinessMs":349.8,"backgroundTasks":"Product details, Search index availability","backMs":46.5,"firstBackMs":46.5,"firstBackDesti…
```

### 56 relaunch after audit crash
```
11-21 05:48:13.457 E/australianrates(16899): Not starting debugger since process cannot load the jdwp agent.
11-21 05:48:18.867 E/ReactNativeJS(16899): [AR error] perf-audit: interrupted state restoration failed: Error: Encrypted rate scenario restore did not persist: scenario changed before the write completed\n    at ?anon_0_ (address at index.android.bundle:1:2231454)\n    at next (native)\n    at asyncGeneratorStep (address at index.android.bundle:1:594527)\n    at _next (address at index.android.bundle:1:594785)\n    at tryCallOne (address at InternalBytecode.js:1:1180)\n    at anonymous (address at InternalBytecode.js:1:1874)\nRetry: Error: Encrypted rate scenario restore did not persist: scenario changed before the write completed\n    at ?anon_0_ (address at index.android.bundle:1:2231454)\n    at next (native)\n    at asyncGeneratorStep (address at index.android.bundle:1:594527)\n    at _next (address at index.android.bundle:1:594785)\n    at tryCallOne (address at InternalBytecode.js:1:1180)\n    at anonymous (address at InternalBytecode.js:1:1874)\nRetry: Error: Encrypted rate scenario restore did not persist: scenario changed before the write co…
11-21 05:48:18.868 E/unknown:ReactNative(16899): SyntheticError@1:162928
11-21 05:48:18.868 E/unknown:ReactNative(16899): Wrapper@1:163443
11-21 05:48:18.868 E/unknown:ReactNative(16899): _callSuper@1:148316
11-21 05:48:18.868 E/unknown:ReactNative(16899): _construct@1:163791
11-21 05:48:18.868 E/unknown:ReactNative(16899): anonymous@1:1929317
11-21 05:48:18.868 E/unknown:ReactNative(16899): append@1:863282
```
