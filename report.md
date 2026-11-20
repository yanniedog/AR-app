# App explorer: 1.0.330 (386)

**Real-use session ATTENTION vs 1.0.330: 0 broken, 13 friction, 16 slower**

- Friction: Nothing to read for 9.6 s on "open app"
- Friction: No reaction for 3.5 s after "scroll rates 1"
- Friction: No reaction for 3.3 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll lenders"
- Friction: No reaction for 4.8 s after "switch to savings"
- Friction: No reaction for 3.2 s after "switch to home loans"
- Friction: No reaction for 3.5 s after "open filters"
- Friction: No reaction for 3.1 s after "open market"
- Friction: "Refresh failed" shown on "open rba"
- Friction: "Bond data unavailable" shown on "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Slower: Dropped frames 47% to 74% on "open app"
- Slower: "open app" content 32.7 s to 61.0 s
- Slower: "open app" reaction 32.7 s to 51.4 s
- Slower: Dropped frames 45% to 64% on "scroll rates 1"
- Slower: Dropped frames 44% to 69% on "scroll rates 2"
- Slower: Dropped frames 38% to 63% on "open product"
- Slower: Dropped frames 32% to 57% on "scroll product"
- Slower: Dropped frames 38% to 70% on "back to rates"
- Slower: Dropped frames 43% to 76% on "switch to savings"
- Slower: Dropped frames 34% to 63% on "open market"
- Slower: Dropped frames 37% to 75% on "open rba"
- Slower: "open rba" content 0.0 s to 2.4 s
- Slower: Dropped frames 32% to 59% on "scroll rba"
- Slower: Dropped frames 27% to 65% on "back from rba"
- Slower: Dropped frames 44% to 63% on "scroll market"
- Slower: Dropped frames 35% to 53% on "return to rates"

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode full | 80 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 12
Baseline 1.0.330
**Audit live: outcome completed | 1010 s | audit log 838746 bytes (audit-log.txt) https://paste.c-net.org/5d169676-0cdc-2340-c7f8-a5a367d98ed1 | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 51509 | +16533 | 1223/1657 | 81 | 524 | 1 errors; start 3301ms |
| 2 | scroll rates 1 | 696 | -2553 | 32/50 | 77 | 577 | boot js-start 448171, layout-mounted 448744, cache-read 448880, hydrated 448989, splash-hide 449097, core-ready 507724, rates-ready 513269 |
| 3 | scroll rates 2 | 722 | +16 | 36/52 | 81 | 402 |  |
| 4 | scroll rates back | 681 | +11 |  |  | 406 |  |
| 5 | open product | 5479 | +2115 | 36/57 | 89 | 526 |  |
| 6 | scroll product | 737 | +48 | 31/54 | 85 | 562 |  |
| 7 | back to rates | 29 | +3 | 16/23 | 77 | 528 |  |
| 8 | open lenders | 24 | +8 | 21/23 | 250 | 537 |  |
| 9 | scroll lenders | 739 | -1 | 18/20 | 97 | 534 |  |
| 10 | back from lenders | 23 | +6 | 7/8 | 125 | 535 |  |
| 11 | switch to savings | 23 | +5 | 71/94 | 81 | 549 |  |
| 12 | switch to home loans | 26 | +7 | 16/30 | 61 | 565 |  |
| 13 | open filters | 29 | +12 | 23/28 | 133 | 569 |  |
| 14 | close filters | 24 | +8 | 6/8 | 150 | 564 |  |
| 15 | open market | 22 | +7 | 19/30 | 73 | 563 |  |
| 16 | open rba | 2555 | +2538 | 48/64 | 61 | 563 |  |
| 17 | scroll rba | 684 | -16 | 26/44 | 73 | 562 |  |
| 18 | back from rba | 27 | +8 | 13/20 | 69 | 563 |  |
| 19 | scroll market | 721 | +33 | 27/43 | 69 | 562 |  |
| 20 | open saved | 30 | +14 | 12/21 | 61 | 568 |  |
| 21 | return to rates | 21 | +5 | 17/32 | 69 | 570 |  |
| 22 | cold start | 9985 | +2346 | 28/37 | 150 | 657 | 3 errors; start 4276ms; boot js-start 707961, layout-mounted 708154, hydrated 708254, cache-read 709538, core-ready 710290, splash-hide 710414, rates-ready 714313 |
| 23 | /browse | 4467 |  | 2/2 | 32 | 432 |  |
| 24 | /watchlist | 37 |  | 2/3 | 53 | 434 |  |
| 25 | /market | 31 |  | 11/20 | 57 | 531 |  |
| 26 | /tools | 30 |  | 15/21 | 85 | 585 |  |
| 27 | /trends | 27 |  |  |  | 621 |  |
| 28 | /search | 25 |  | 31/43 | 117 | 632 |  |
| 29 | /banks | 26 |  | 31/38 | 117 | 641 |  |
| 30 | /bank-rates | 27 |  | 22/31 | 69 | 656 |  |
| 31 | /categories | 26 |  | 37/47 | 101 | 668 |  |
| 32 | /catalogue | 34 |  | 32/38 | 109 | 689 |  |
| 33 | /compare | 31 |  | 13/15 | 121 | 681 |  |
| 34 | /matches | 29 |  | 34/45 | 93 | 693 |  |
| 35 | /calculator | 28 |  | 16/23 | 73 | 678 |  |
| 36 | /projections | 24 |  | 24/33 | 97 | 679 |  |
| 37 | /profile | 27 |  | 17/23 | 65 | 684 |  |
| 38 | /research | 34 |  | 18/27 | 81 | 693 |  |
| 39 | /rba | 34 |  | 11/24 | 81 | 698 |  |
| 40 | /rba-response | 24 |  | 15/28 | 77 | 701 |  |
| 41 | /settings | 26 |  | 16/20 | 150 | 709 |  |
| 42 | /about | 28 |  | 12/22 | 69 | 708 |  |
| 43 | /terms | 27 |  | 14/22 | 69 | 709 |  |
| 44 | /privacy | 23 |  |  |  | 709 |  |
| 45 | /third-party-notices | 24 |  | 16/24 | 77 | 712 |  |
| 46 | /node | 26 |  | 35/49 | 93 | 738 |  |
| 47 | /passthrough | 26 |  | 31/49 | 93 | 714 |  |
| 48 | /calculation-receipt | 27 |  | 15/23 | 69 | 708 |  |
| 49 | /rate-receipt | 25 |  | 6/10 | 105 | 708 |  |
| 50 | warm resume | 804 |  | 5/5 | 200 | 708 | start 391ms |
| 51 | cold relaunch | 9935 |  | 33/42 | 133 | 572 | 1 errors; start 3930ms; boot js-start 940422, layout-mounted 940607, hydrated 940734, cache-read 941928, core-ready 942670, splash-hide 942802, rates-ready 946837 |
| 52 | about | 28 | +5 | 13/20 | 250 | 600 |  |
| 53 | audit screen | 21 | +6 | 112/201 | 65 | 579 |  |
| 54 | audit 0 min | 0 |  | 27/32 | 69 | 838 | 19 errors |
| 55 | audit 2 min | 0 | 0 | 1330/1505 | 109 | 1032 | 80 errors |
| 56 | audit 4 min | 0 | 0 | 776/894 | 113 | 1153 | 80 errors |
| 57 | audit 5 min | 0 | 0 | 223/255 | 105 | 1178 | 80 errors |
| 58 | audit 7 min | 0 | 0 | 1273/1462 | 113 | 1153 | 80 errors |
| 59 | audit 8 min | 0 | 0 | 32/33 | 48 | 1166 | 38 errors |
| 60 | audit 9 min | 0 | 0 | 977/1147 | 109 | 1326 | 80 errors |
| 61 | audit 11 min | 0 | 0 | 901/1051 | 113 | 1375 | 80 errors |
| 62 | audit 13 min | 0 |  | 239/269 | 97 | 1198 | 80 errors |
| 63 | audit 14 min | 0 | 0 | 153/182 | 36 | 1213 |  |
| 64 | audit 15 min | 0 |  | 31/40 | 34 | 1215 |  |
| 65 | audit 16 min | 0 |  | 79/93 | 81 | 1205 |  |
| 66 | audit finished | 0 | 0 | 87/159 | 69 | 1193 |  |
| 67 | audit result 1 | 0 | 0 |  |  | 1193 |  |
| 68 | audit result 2 | 0 | 0 |  |  | 1196 |  |
| 69 | audit result 3 | 0 | 0 |  |  | 1193 |  |
| 70 | audit result 4 | 0 | 0 |  |  | 1193 |  |
| 71 | audit result 5 | 0 | 0 |  |  | 1197 |  |
| 72 | audit result 6 | 0 | 0 |  |  | 1194 |  |
| 73 | audit result 7 | 0 | 0 |  |  | 1198 |  |
| 74 | audit result 8 | 0 | 0 |  |  | 1195 |  |
| 75 | audit result 9 | 0 | 0 |  |  | 1195 |  |
| 76 | audit result 10 | 0 | 0 |  |  | 1198 |  |
| 77 | audit result 11 | 0 | 0 |  |  | 1196 |  |
| 78 | audit result 12 | 0 | 0 |  |  | 1199 |  |
| 79 | about for debug log | 3147 | +68 | 20/32 | 77 | 1230 |  |
| 80 | debug log screen | 0 | 0 | 106/199 | 61 | 1249 |  |

## Errors

### 1 open app
```
11-20 22:41:42.068 E/australianrates(10702): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-20 22:46:02.809 E/australianrates(13055): Not starting debugger since process cannot load the jdwp agent.
11-20 22:46:06.988 E/SurfaceSyncGroup(13055): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-20 22:46:06.988 E/SurfaceSyncGroup(13055): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 51 cold relaunch
```
11-20 22:49:55.381 E/australianrates(16042): Not starting debugger since process cannot load the jdwp agent.
```

### 54 audit 0 min
```
11-20 22:51:05.079 E/ReactNativeJS(16042): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpkoy79-249948701c3d3391","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":6004.9,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":254.8,"liveStage:dates-index:fetched:ms":250.6,"liveStage:revision:verified:ms":72.8,"liveStage:Core asset:downloaded:ms":248.9,"liveStage:Core asset:hash-verified:ms":15.5,"liveStage:Core asset:native-inflated-and-text-decoded:ms":200.3,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":255.2,"liveStage:core:history-sealed:ms":0,"liveStage:core:normalized:ms":630.5,"liveStage:Details asset:downloaded:ms":1336,"liveStage:Details asset:hash-verified:ms":30.7,"liveSta…
11-20 22:51:05.090 E/unknown:ReactNative(16042): ?anon_0_@1:3678380
11-20 22:51:05.090 E/unknown:ReactNative(16042): ?anon_0_@1:3684180
11-20 22:51:05.090 E/unknown:ReactNative(16042): SyntheticError@1:162928
11-20 22:51:05.090 E/unknown:ReactNative(16042): Wrapper@1:163443
11-20 22:51:05.090 E/unknown:ReactNative(16042): _callSuper@1:148316
11-20 22:51:05.090 E/unknown:ReactNative(16042): _construct@1:163791
11-20 22:51:05.090 E/unknown:ReactNative(16042): _next@1:594785
```

### 55 audit 2 min
```
11-20 22:51:06.042 E/ReactNativeJS(16042): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpkoy79-249948701c3d3391","check":{"id":"maximum-coverage-profile","label":"Maximum safe audit coverage preparation","kind":"data","status":"fail","durationMs":854,"metrics":{"profile":"maximum-safe-coverage-v1","maximumSafeFeaturesEnabled":true,"enabledSections":"Mortgage,Savings,TD","includeNonStandard":true,"deepSearchEnabled":true,"historyExplorerEnabled":true,"depositRankMetric":"max","mortgageRateMetric":"comparison","requiredAssets":8,"availableAssets":8,"localCacheOnly":false,"bankInsightsPreparationAttempted":true,"bankInsightsCacheOnly":false,"executionAttempted":true,"measurementAvailable":true,"nonTimingFailure":false,"eventLoopSamples":5,"eventLoopMeasurementAvailable":true,"eventLoopP95Ms":463.7,"maxEventLoopLagMs":463.7,"stallsOver100Ms":2,"frameSamples":11,"frameMeasurementAvailable":true,"frameP95Ms":471,"maxFrameGapMs":471,"framesOver50Ms":3}}}
11-20 22:51:06.047 E/unknown:ReactNative(16042): ?anon_0_@1:3678380
11-20 22:51:06.047 E/unknown:ReactNative(16042): ?anon_0_@1:3684180
11-20 22:51:06.047 E/unknown:ReactNative(16042): SyntheticError@1:162928
11-20 22:51:06.047 E/unknown:ReactNative(16042): Wrapper@1:163443
11-20 22:51:06.047 E/unknown:ReactNative(16042): _callSuper@1:148316
11-20 22:51:06.047 E/unknown:ReactNative(16042): _construct@1:163791
11-20 22:51:06.047 E/unknown:ReactNative(16042): _next@1:594785
```

### 56 audit 4 min
```
11-20 22:53:45.666 E/ReactNativeJS(16042): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpkoy79-249948701c3d3391","check":{"id":"deep-first-pass.route.rates-mortgage-scope.search.mortgage.scope.clear","label":"route.rates-mortgage-scope: search.mortgage.scope.clear (first-pass)","kind":"journey","status":"fail","durationMs":9140.6,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.clear","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.clear","iteration":"cold","passId":"first-pass","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.clear","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":21,"actionRevisionAfter":22,"renderRevisionBefore":"state-21","renderRevisionAfter":"state-27","actionMs":215.6,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActi…
11-20 22:53:45.667 E/unknown:ReactNative(16042): ?anon_0_@1:3678380
11-20 22:53:45.667 E/unknown:ReactNative(16042): ?anon_0_@1:3684180
11-20 22:53:45.667 E/unknown:ReactNative(16042): SyntheticError@1:162928
11-20 22:53:45.667 E/unknown:ReactNative(16042): Wrapper@1:163443
11-20 22:53:45.667 E/unknown:ReactNative(16042): _callSuper@1:148316
11-20 22:53:45.667 E/unknown:ReactNative(16042): _construct@1:163791
11-20 22:53:45.667 E/unknown:ReactNative(16042): _next@1:594785
```

### 57 audit 5 min
```
11-20 22:55:22.128 E/ReactNativeJS(16042): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpkoy79-249948701c3d3391","check":{"id":"deep-first-pass.sample.catalogue.3.product.open","label":"sample.catalogue.3: product.open (first-pass)","kind":"journey","status":"fail","durationMs":1750.1,"metrics":{"journeyId":"sample.catalogue.3.product.open","journeyLabel":"sample.catalogue.3: product.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.3","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Great%20Southern%20Bank%7C1000-0600%7CTERM_DEPOSITS%7CPlatinum%20Plus%20Term%20Deposit%2012%20months","expectedPath":"/product/Great%20Southern%20Bank%7C1000-0600%7CTERM_DEPOSITS%7CPlatinum%20Plus%20Term%20Deposit%2012%20months","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":452.2,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailure…
11-20 22:55:22.129 E/unknown:ReactNative(16042): ?anon_0_@1:3678380
11-20 22:55:22.129 E/unknown:ReactNative(16042): ?anon_0_@1:3684180
11-20 22:55:22.129 E/unknown:ReactNative(16042): SyntheticError@1:162928
11-20 22:55:22.129 E/unknown:ReactNative(16042): Wrapper@1:163443
11-20 22:55:22.129 E/unknown:ReactNative(16042): _callSuper@1:148316
11-20 22:55:22.129 E/unknown:ReactNative(16042): _construct@1:163791
11-20 22:55:22.129 E/unknown:ReactNative(16042): _next@1:594785
```

### 58 audit 7 min
```
11-20 22:55:48.462 E/ReactNativeJS(16042): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpkoy79-249948701c3d3391","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":1283.6,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-21:22f3e7dd04ce…:state-8","renderRevisionAfter":"2026-11-21:22f3e7dd04ce…:state-9","actionResultEvidence":"{\"applied\":…
11-20 22:55:48.463 E/unknown:ReactNative(16042): ?anon_0_@1:3678380
11-20 22:55:48.463 E/unknown:ReactNative(16042): ?anon_0_@1:3684180
11-20 22:55:48.463 E/unknown:ReactNative(16042): SyntheticError@1:162928
11-20 22:55:48.463 E/unknown:ReactNative(16042): Wrapper@1:163443
11-20 22:55:48.463 E/unknown:ReactNative(16042): _callSuper@1:148316
11-20 22:55:48.463 E/unknown:ReactNative(16042): _construct@1:163791
11-20 22:55:48.463 E/unknown:ReactNative(16042): _next@1:594785
```

### 59 audit 8 min
```
11-20 22:58:20.945 E/ReactNativeJS(16042): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpkoy79-249948701c3d3391","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.open","label":"route.rates-mortgage-scope: search.open (repeat)","kind":"journey","status":"fail","durationMs":10158.7,"metrics":{"journeyId":"route.rates-mortgage-scope.search.open","journeyLabel":"route.rates-mortgage-scope: search.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.open","depth":0,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":121.8,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":9348.5,"forwardWorkMs":9348.5,"navigationCommitMs":339.2,"firstReadyFrameMs":9009.3,"first…
11-20 22:58:20.946 E/unknown:ReactNative(16042): ?anon_0_@1:3678380
11-20 22:58:20.946 E/unknown:ReactNative(16042): ?anon_0_@1:3684180
11-20 22:58:20.946 E/unknown:ReactNative(16042): SyntheticError@1:162928
11-20 22:58:20.946 E/unknown:ReactNative(16042): Wrapper@1:163443
11-20 22:58:20.946 E/unknown:ReactNative(16042): _callSuper@1:148316
11-20 22:58:20.946 E/unknown:ReactNative(16042): _construct@1:163791
11-20 22:58:20.946 E/unknown:ReactNative(16042): _next@1:594785
```

### 60 audit 9 min
```
11-20 22:58:37.823 E/ReactNativeJS(16042): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpkoy79-249948701c3d3391","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.mortgage.scope.apply.1","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.1 (repeat)","kind":"journey","status":"fail","durationMs":7422.4,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.1","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.1","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.1","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":42,"actionRevisionAfter":43,"renderRevisionBefore":"state-14","renderRevisionAfter":"state-20","actionMs":132.2,"preActionWaitMs":0.8,"preActionQuietWindowReused":true,"preAction…
11-20 22:58:37.824 E/unknown:ReactNative(16042): ?anon_0_@1:3678380
11-20 22:58:37.824 E/unknown:ReactNative(16042): ?anon_0_@1:3684180
11-20 22:58:37.824 E/unknown:ReactNative(16042): SyntheticError@1:162928
11-20 22:58:37.824 E/unknown:ReactNative(16042): Wrapper@1:163443
11-20 22:58:37.824 E/unknown:ReactNative(16042): _callSuper@1:148316
11-20 22:58:37.824 E/unknown:ReactNative(16042): _construct@1:163791
11-20 22:58:37.824 E/unknown:ReactNative(16042): _next@1:594785
```

### 61 audit 11 min
```
11-20 23:00:59.955 E/ReactNativeJS(16042): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpkoy79-249948701c3d3391","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":2277.2,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Greater%20Bank%7C3060%7CTRANS_AND_SAVINGS_ACCOUNTS%7CRetirement%20Plus","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"renderRevisionBefore":"2026-1…
11-20 23:00:59.956 E/unknown:ReactNative(16042): ?anon_0_@1:3678380
11-20 23:00:59.956 E/unknown:ReactNative(16042): ?anon_0_@1:3684180
11-20 23:00:59.956 E/unknown:ReactNative(16042): SyntheticError@1:162928
11-20 23:00:59.956 E/unknown:ReactNative(16042): Wrapper@1:163443
11-20 23:00:59.956 E/unknown:ReactNative(16042): _callSuper@1:148316
11-20 23:00:59.956 E/unknown:ReactNative(16042): _construct@1:163791
11-20 23:00:59.956 E/unknown:ReactNative(16042): _next@1:594785
```

### 62 audit 13 min
```
11-20 23:02:36.495 E/ReactNativeJS(16042): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwpkoy79-249948701c3d3391","check":{"id":"deep-repeat.redirect.tab-trends.redirect.tab-trends.verify","label":"redirect.tab-trends: redirect.tab-trends.verify (repeat)","kind":"journey","status":"fail","durationMs":1709.5,"metrics":{"journeyId":"redirect.tab-trends.redirect.tab-trends.verify","journeyLabel":"redirect.tab-trends: redirect.tab-trends.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.tab-trends","semanticActionId":"redirect.tab-trends.verify","depth":1,"plannedExpectedPath":"/research","expectedPath":"/research","expectedSurface":"outlook.dashboard","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":342.1,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":707.8,"forwardWorkMs":707.8,"navigationComm…
11-20 23:02:36.496 E/unknown:ReactNative(16042): ?anon_0_@1:3678380
11-20 23:02:36.496 E/unknown:ReactNative(16042): ?anon_0_@1:3684180
11-20 23:02:36.496 E/unknown:ReactNative(16042): SyntheticError@1:162928
11-20 23:02:36.496 E/unknown:ReactNative(16042): Wrapper@1:163443
11-20 23:02:36.496 E/unknown:ReactNative(16042): _callSuper@1:148316
11-20 23:02:36.496 E/unknown:ReactNative(16042): _construct@1:163791
11-20 23:02:36.496 E/unknown:ReactNative(16042): _next@1:594785
```
