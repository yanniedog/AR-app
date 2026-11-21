# App explorer: 1.0.340 (396)

**Real-use session FAIL vs 1.0.340: 1 broken, 15 friction, 10 slower**

- Broken: 97% dropped frames on "open filters"
- Friction: No reaction for 3.9 s after "scroll rates 1"
- Friction: No reaction for 3.2 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.1 s after "open lenders"
- Friction: No reaction for 3.2 s after "scroll lenders"
- Friction: No reaction for 5.2 s after "switch to savings"
- Friction: No reaction for 3.2 s after "switch to home loans"
- Friction: No reaction for 3.6 s after "open filters"
- Friction: No reaction for 3.2 s after "open market"
- Friction: No reaction for 3.1 s after "open rba"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.2 s after "scroll rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Slower: Dropped frames 58% to 81% on "open app"
- Slower: Dropped frames 55% to 76% on "scroll rates 1"
- Slower: Dropped frames 55% to 81% on "scroll rates 2"
- Slower: Dropped frames 44% to 73% on "scroll product"
- Slower: Dropped frames 57% to 78% on "switch to savings"
- Slower: Dropped frames 48% to 71% on "switch to home loans"
- Slower: Dropped frames 57% to 78% on "open rba"
- Slower: Dropped frames 48% to 76% on "scroll rba"
- Slower: Dropped frames 52% to 83% on "scroll market"
- Slower: Dropped frames 45% to 70% on "return to rates"

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode full | 80 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 13
Baseline 1.0.340
**Audit live: outcome completed | 1038 s | audit log 842074 bytes (audit-log.txt) https://paste.c-net.org/d2ea1a00-a870-8c70-5038-27bbe0797944 | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3434 | -28038 | 690/854 | 97 | 529 | 1 errors; start 3292ms |
| 2 | scroll rates 1 | 692 | -2529 | 39/51 | 93 | 484 | boot js-start 439236, layout-mounted 439753, cache-read 439924, hydrated 440148, splash-hide 440148, manifest 441382, resolved 442174, core-fetched 447493, core-saved 448409, rows-prepared 448787, search-index-idle 448787, details-start 449260, pricing-ready 450845, details-fetched 460092, detail-filters-idle 467814, suitability-built 469200, core-ready 478307, rates-ready 482137 |
| 3 | scroll rates 2 | 735 | +4 | 21/26 | 97 | 700 |  |
| 4 | scroll rates back | 688 | +2 |  |  | 554 |  |
| 5 | open product | 5921 | +3145 | 37/53 | 97 | 624 |  |
| 6 | scroll product | 752 | +29 | 19/26 | 73 | 636 |  |
| 7 | back to rates | 29 | +6 | 15/21 | 85 | 628 |  |
| 8 | open lenders | 29 | +7 | 19/22 | 200 | 635 |  |
| 9 | scroll lenders | 730 | +51 | 19/19 | 150 | 633 |  |
| 10 | back from lenders | 29 | +8 | 5/6 | 150 | 635 |  |
| 11 | switch to savings | 27 | +4 | 70/90 | 93 | 643 |  |
| 12 | switch to home loans | 29 | +6 | 20/28 | 65 | 652 |  |
| 13 | open filters | 33 | +12 | 28/29 | 150 | 657 |  |
| 14 | close filters | 28 | +7 | 7/8 | 200 | 661 |  |
| 15 | open market | 27 | +6 | 17/30 | 85 | 660 |  |
| 16 | open rba | 33 | +11 | 35/45 | 65 | 659 |  |
| 17 | scroll rba | 716 | +9 | 25/33 | 73 | 662 |  |
| 18 | back from rba | 31 | +10 | 13/17 | 73 | 662 |  |
| 19 | scroll market | 737 | +47 | 29/35 | 85 | 662 |  |
| 20 | open saved | 28 | +6 | 12/22 | 89 | 666 |  |
| 21 | return to rates | 28 | +7 | 21/30 | 81 | 667 |  |
| 22 | cold start | 10462 | +1920 | 33/41 | 117 | 584 | 1 errors; start 4505ms; boot js-start 682414, layout-mounted 682625, hydrated 682741, cache-read 684054, core-ready 684721, rows-prepared 684839, search-index-idle 684839, detail-filters-idle 684839, splash-hide 684841, manifest 687052, resolved 687895, pricing-ready 688790, rates-ready 689033 |
| 23 | /browse | 4579 |  | 2/2 | 32 | 438 |  |
| 24 | /watchlist | 31 |  | 3/3 | 46 | 518 |  |
| 25 | /market | 33 |  | 16/18 | 73 | 590 |  |
| 26 | /tools | 44 |  | 9/11 | 200 | 585 |  |
| 27 | /trends | 36 |  | 24/34 | 117 | 600 |  |
| 28 | /search | 40 |  | 33/41 | 121 | 612 |  |
| 29 | /banks | 46 |  | 31/42 | 105 | 627 |  |
| 30 | /bank-rates | 43 |  | 20/27 | 85 | 634 |  |
| 31 | /categories | 37 |  | 37/46 | 93 | 653 |  |
| 32 | /catalogue | 44 |  | 30/39 | 129 | 693 |  |
| 33 | /compare | 50 |  | 14/15 | 150 | 665 |  |
| 34 | /matches | 32 |  | 34/46 | 93 | 688 |  |
| 35 | /calculator | 43 |  | 16/22 | 97 | 689 |  |
| 36 | /projections | 38 |  | 23/34 | 129 | 680 |  |
| 37 | /profile | 36 |  | 18/21 | 77 | 686 |  |
| 38 | /research | 30 |  | 18/28 | 81 | 698 |  |
| 39 | /rba | 34 |  | 18/24 | 117 | 712 |  |
| 40 | /rba-response | 36 |  | 18/31 | 73 | 714 |  |
| 41 | /settings | 36 |  | 12/20 | 200 | 722 |  |
| 42 | /about | 36 |  | 15/21 | 97 | 724 |  |
| 43 | /terms | 36 |  | 15/24 | 89 | 727 |  |
| 44 | /privacy | 39 |  |  |  | 726 |  |
| 45 | /third-party-notices | 35 |  | 15/23 | 93 | 732 |  |
| 46 | /node | 36 |  | 32/39 | 150 | 775 |  |
| 47 | /passthrough | 41 |  | 32/44 | 105 | 745 |  |
| 48 | /calculation-receipt | 32 |  | 16/23 | 77 | 740 |  |
| 49 | /rate-receipt | 36 |  | 6/7 | 105 | 741 |  |
| 50 | warm resume | 1070 |  | 4/5 | 150 | 740 | start 783ms |
| 51 | cold relaunch | 10101 |  | 33/40 | 200 | 576 | 1 errors; start 4149ms; boot js-start 923784, layout-mounted 923976, hydrated 924111, cache-read 925382, core-ready 926003, rows-prepared 926138, search-index-idle 926138, detail-filters-idle 926138, splash-hide 926139, manifest 928256, resolved 929027, pricing-ready 929833, rates-ready 930097 |
| 52 | about | 32 | -1 | 15/19 | 250 | 404 |  |
| 53 | audit screen | 26 | +6 | 118/194 | 69 | 605 |  |
| 54 | audit 0 min | 0 |  | 457/504 | 125 | 1000 | 80 errors |
| 55 | audit 2 min | 0 |  | 808/881 | 133 | 1190 | 80 errors |
| 56 | audit 3 min | 0 | 0 | 532/596 | 125 | 1170 | 80 errors |
| 57 | audit 5 min | 0 | 0 | 396/438 | 117 | 1182 | 80 errors |
| 58 | audit 6 min | 0 |  | 1005/1117 | 129 |  | 80 errors |
| 59 | audit 8 min | 0 | 0 | 629/687 | 150 | 1208 | 80 errors |
| 60 | audit 9 min | 0 |  | 589/654 | 117 | 1269 | 80 errors |
| 61 | audit 11 min | 0 | 0 | 198/222 | 117 | 1298 | 80 errors |
| 62 | audit 12 min | 0 | 0 | 1022/1134 | 129 | 1309 | 80 errors |
| 63 | audit 13 min | 0 | 0 | 157/174 | 40 | 1336 | 57 errors |
| 64 | audit 15 min | 0 |  | 140/158 | 42 | 1364 |  |
| 65 | audit 16 min | 0 |  | 114/129 | 61 | 1205 |  |
| 66 | audit finished | 0 | 0 | 132/186 | 81 | 1349 |  |
| 67 | audit result 1 | 0 | 0 |  |  | 1339 |  |
| 68 | audit result 2 | 0 | 0 |  |  | 1336 |  |
| 69 | audit result 3 | 0 | 0 |  |  | 1335 |  |
| 70 | audit result 4 | 0 | 0 |  |  | 1339 |  |
| 71 | audit result 5 | 0 | 0 |  |  | 1337 |  |
| 72 | audit result 6 | 0 | 0 |  |  | 1337 |  |
| 73 | audit result 7 | 0 | 0 |  |  | 1340 |  |
| 74 | audit result 8 | 0 | 0 |  |  | 1338 |  |
| 75 | audit result 9 | 0 | 0 |  |  | 1341 |  |
| 76 | audit result 10 | 0 | 0 |  |  | 1339 |  |
| 77 | audit result 11 | 0 | 0 |  |  | 1342 |  |
| 78 | audit result 12 | 0 | 0 |  |  | 1344 |  |
| 79 | about for debug log | 6985 | +3922 | 28/40 | 77 | 1227 |  |
| 80 | debug log screen | 0 | 0 | 115/186 | 69 | 1213 |  |

## Errors

### 1 open app
```
11-21 09:02:08.797 E/australianrates(10516): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-21 09:06:13.011 E/australianrates(12814): Not starting debugger since process cannot load the jdwp agent.
```

### 51 cold relaunch
```
11-21 09:10:14.689 E/australianrates(15835): Not starting debugger since process cannot load the jdwp agent.
```

### 54 audit 0 min
```
11-21 09:11:24.545 E/ReactNativeJS(15835): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq6upnq-ef11bb849888ed9c","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":5131.2,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":288.1,"liveStage:dates-index:fetched:ms":234.2,"liveStage:revision:verified:ms":77.1,"liveStage:Core asset:downloaded:ms":264.3,"liveStage:Core asset:hash-verified:ms":21.3,"liveStage:Core asset:native-inflated-and-text-decoded:ms":236.4,"liveStage:Core asset:inflated:ms":0.2,"liveStage:Core asset:text-decoded:ms":0.1,"liveStage:Core asset:decoded:ms":255.5,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":669.2,"liveStage:Details asset:downloaded:ms":1112.3,"liveStage:Details asset:hash-verified:ms":49.5,"l…
11-21 09:11:24.547 E/unknown:ReactNative(15835): ?anon_0_@1:3680632
11-21 09:11:24.547 E/unknown:ReactNative(15835): ?anon_0_@1:3686437
11-21 09:11:24.547 E/unknown:ReactNative(15835): SyntheticError@1:162956
11-21 09:11:24.547 E/unknown:ReactNative(15835): Wrapper@1:163471
11-21 09:11:24.547 E/unknown:ReactNative(15835): _callSuper@1:148344
11-21 09:11:24.547 E/unknown:ReactNative(15835): _construct@1:163819
11-21 09:11:24.547 E/unknown:ReactNative(15835): _next@1:594807
```

### 55 audit 2 min
```
11-21 09:12:16.353 E/ReactNativeJS(15835): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq6upnq-ef11bb849888ed9c","check":{"id":"journey-lender-cold","label":"Lender details (cold)","kind":"journey","status":"fail","durationMs":2072.1,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":786.6,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"lender","journeyLabel":"Lender details","iteration":"cold","expectedPath":"/bank/Fire%20Service%20Credit%20Union","expectedSurface":"lender.details","navigationKind":"stack","forwardMs":786.6,"firstReadyFrameObserved":true,"firstReadyFrameMs":85.889216999989,"backgroundSettleMs":991.2,"destinationReadinessMs":85.9,"backgroundTasks":"Bank response analysis","backMs":103.5,"firstBackMs":103.5,"firstBackDestination":"/performance-audit","originReadinessMs":0.…
11-21 09:12:16.359 E/unknown:ReactNative(15835): ?anon_0_@1:3680632
11-21 09:12:16.359 E/unknown:ReactNative(15835): ?anon_0_@1:3686437
11-21 09:12:16.359 E/unknown:ReactNative(15835): SyntheticError@1:162956
11-21 09:12:16.359 E/unknown:ReactNative(15835): Wrapper@1:163471
11-21 09:12:16.359 E/unknown:ReactNative(15835): _callSuper@1:148344
11-21 09:12:16.359 E/unknown:ReactNative(15835): _construct@1:163819
11-21 09:12:16.359 E/unknown:ReactNative(15835): _next@1:594807
```

### 56 audit 3 min
```
11-21 09:13:51.618 E/ReactNativeJS(15835): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq6upnq-ef11bb849888ed9c","check":{"id":"deep-first-pass.route.rates-mortgage-scope.search.mortgage.scope.apply.0","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.0 (first-pass)","kind":"journey","status":"fail","durationMs":8529.6,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.0","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.0","iteration":"cold","passId":"first-pass","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.0","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":19,"actionRevisionAfter":20,"renderRevisionBefore":"state-8","renderRevisionAfter":"state-14","actionMs":190.3,"preActionWaitMs":1,"preActionQuietWindowReused":true,"…
11-21 09:13:51.619 E/unknown:ReactNative(15835): ?anon_0_@1:3680632
11-21 09:13:51.619 E/unknown:ReactNative(15835): ?anon_0_@1:3686437
11-21 09:13:51.619 E/unknown:ReactNative(15835): SyntheticError@1:162956
11-21 09:13:51.619 E/unknown:ReactNative(15835): Wrapper@1:163471
11-21 09:13:51.619 E/unknown:ReactNative(15835): _callSuper@1:148344
11-21 09:13:51.619 E/unknown:ReactNative(15835): _construct@1:163819
11-21 09:13:51.619 E/unknown:ReactNative(15835): _next@1:594807
```

### 57 audit 5 min
```
11-21 09:14:59.101 E/ReactNativeJS(15835): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq6upnq-ef11bb849888ed9c","check":{"id":"deep-first-pass.route.lender.lender.chart.section.next","label":"route.lender: lender.chart.section.next (first-pass)","kind":"journey","status":"fail","durationMs":10490.2,"metrics":{"journeyId":"route.lender.lender.chart.section.next","journeyLabel":"route.lender: lender.chart.section.next","iteration":"cold","passId":"first-pass","scenarioId":"route.lender","semanticActionId":"lender.chart.section.next","depth":1,"plannedExpectedPath":"/bank/Fire%20Service%20Credit%20Union","expectedPath":"/bank/Fire%20Service%20Credit%20Union","expectedSurface":"lender.details","actionSource":"lender.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":0,"actionRevisionAfter":1,"renderRevisionBefore":"Fire Service Credit Union:5:1:7:rich:26:9d0f4b5c4416…:Fire Service Credit Union:Mortgage:2026-11-21:193:1:7:rich:26:9d0f4b5c4416…:Fire Service …
11-21 09:14:59.103 E/unknown:ReactNative(15835): ?anon_0_@1:3680632
11-21 09:14:59.103 E/unknown:ReactNative(15835): ?anon_0_@1:3686437
11-21 09:14:59.103 E/unknown:ReactNative(15835): SyntheticError@1:162956
11-21 09:14:59.103 E/unknown:ReactNative(15835): Wrapper@1:163471
11-21 09:14:59.103 E/unknown:ReactNative(15835): _callSuper@1:148344
11-21 09:14:59.103 E/unknown:ReactNative(15835): _construct@1:163819
11-21 09:14:59.103 E/unknown:ReactNative(15835): _next@1:594807
```

### 58 audit 6 min
```
11-21 09:15:57.085 E/ReactNativeJS(15835): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq6upnq-ef11bb849888ed9c","check":{"id":"deep-first-pass.sample.catalogue.4.product.lender.open","label":"sample.catalogue.4: product.lender.open (first-pass)","kind":"journey","status":"fail","durationMs":2516.1,"metrics":{"journeyId":"sample.catalogue.4.product.lender.open","journeyLabel":"sample.catalogue.4: product.lender.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.4","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/St.George%20Bank","expectedPath":"/bank/St.George%20Bank","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":9,"actionRevisionAfter":10,"actionResultEvidence":"{\"expectedPath\":\"/bank/St.George%20Bank\"}","actionMs":1036.8,"preActionWaitMs":5.2,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifi…
11-21 09:15:57.334 E/unknown:ReactNative(15835): ?anon_0_@1:3680632
11-21 09:15:57.334 E/unknown:ReactNative(15835): ?anon_0_@1:3686437
11-21 09:15:57.334 E/unknown:ReactNative(15835): SyntheticError@1:162956
11-21 09:15:57.334 E/unknown:ReactNative(15835): Wrapper@1:163471
11-21 09:15:57.334 E/unknown:ReactNative(15835): _callSuper@1:148344
11-21 09:15:57.334 E/unknown:ReactNative(15835): _construct@1:163819
11-21 09:15:57.334 E/unknown:ReactNative(15835): _next@1:594807
```

### 59 audit 8 min
```
11-21 09:18:00.935 E/ReactNativeJS(15835): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq6upnq-ef11bb849888ed9c","check":{"id":"deep-first-pass.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (first-pass)","kind":"journey","status":"fail","durationMs":3117.6,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":115.6,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1508.9,"forwardWorkMs":1508.9,"navigationCommitMs":1508.4,"firstReadyFrameMs…
11-21 09:18:00.938 E/unknown:ReactNative(15835): ?anon_0_@1:3680632
11-21 09:18:00.938 E/unknown:ReactNative(15835): ?anon_0_@1:3686437
11-21 09:18:00.938 E/unknown:ReactNative(15835): SyntheticError@1:162956
11-21 09:18:00.938 E/unknown:ReactNative(15835): Wrapper@1:163471
11-21 09:18:00.938 E/unknown:ReactNative(15835): _callSuper@1:148344
11-21 09:18:00.938 E/unknown:ReactNative(15835): _construct@1:163819
11-21 09:18:00.938 E/unknown:ReactNative(15835): _next@1:594807
```

### 60 audit 9 min
```
11-21 09:19:47.817 E/ReactNativeJS(15835): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq6upnq-ef11bb849888ed9c","check":{"id":"deep-repeat.route.compare.compare.open","label":"route.compare: compare.open (repeat)","kind":"journey","status":"fail","durationMs":1503.3,"metrics":{"journeyId":"route.compare.compare.open","journeyLabel":"route.compare: compare.open","iteration":"warm","passId":"repeat","scenarioId":"route.compare","semanticActionId":"compare.open","depth":0,"plannedExpectedPath":"/compare","expectedPath":"/compare","expectedSurface":"compare.table","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":497.9,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":342.5,"forwardWorkMs":342.5,"navigationCommitMs":0,"firstReadyFrameMs":342.5,"firstReadyFrameObserved":true,"readinessMs":342.5,"backgroundSettleMs":…
11-21 09:19:47.819 E/unknown:ReactNative(15835): ?anon_0_@1:3680632
11-21 09:19:47.819 E/unknown:ReactNative(15835): ?anon_0_@1:3686437
11-21 09:19:47.819 E/unknown:ReactNative(15835): SyntheticError@1:162956
11-21 09:19:47.819 E/unknown:ReactNative(15835): Wrapper@1:163471
11-21 09:19:47.819 E/unknown:ReactNative(15835): _callSuper@1:148344
11-21 09:19:47.819 E/unknown:ReactNative(15835): _construct@1:163819
11-21 09:19:47.819 E/unknown:ReactNative(15835): _next@1:594807
```

### 61 audit 11 min
```
11-21 09:21:14.336 E/ReactNativeJS(15835): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq6upnq-ef11bb849888ed9c","check":{"id":"deep-repeat.sample.catalogue.4.product.open","label":"sample.catalogue.4: product.open (repeat)","kind":"journey","status":"fail","durationMs":1994.2,"metrics":{"journeyId":"sample.catalogue.4.product.open","journeyLabel":"sample.catalogue.4: product.open","iteration":"warm","passId":"repeat","scenarioId":"sample.catalogue.4","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/St.George%20Bank%7CSTGSavBusBusinessAccessSaver%7CTRANS_AND_SAVINGS_ACCOUNTS%7CBusiness%20Access%20Saver","expectedPath":"/product/St.George%20Bank%7CSTGSavBusBusinessAccessSaver%7CTRANS_AND_SAVINGS_ACCOUNTS%7CBusiness%20Access%20Saver","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":454.2,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0…
11-21 09:21:14.338 E/unknown:ReactNative(15835): ?anon_0_@1:3680632
11-21 09:21:14.338 E/unknown:ReactNative(15835): ?anon_0_@1:3686437
11-21 09:21:14.338 E/unknown:ReactNative(15835): SyntheticError@1:162956
11-21 09:21:14.338 E/unknown:ReactNative(15835): Wrapper@1:163471
11-21 09:21:14.338 E/unknown:ReactNative(15835): _callSuper@1:148344
11-21 09:21:14.338 E/unknown:ReactNative(15835): _construct@1:163819
11-21 09:21:14.338 E/unknown:ReactNative(15835): _next@1:594807
```

### 62 audit 12 min
```
11-21 09:21:54.439 E/ReactNativeJS(15835): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq6upnq-ef11bb849888ed9c","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1580.6,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Fire%20Service%20Credit%20Union%7C15%7CTERM_DEPOSITS%7CI12%20FTD%2012%20Months","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"renderRevisionBefore"…
11-21 09:21:54.440 E/unknown:ReactNative(15835): ?anon_0_@1:3680632
11-21 09:21:54.440 E/unknown:ReactNative(15835): ?anon_0_@1:3686437
11-21 09:21:54.440 E/unknown:ReactNative(15835): SyntheticError@1:162956
11-21 09:21:54.440 E/unknown:ReactNative(15835): Wrapper@1:163471
11-21 09:21:54.440 E/unknown:ReactNative(15835): _callSuper@1:148344
11-21 09:21:54.440 E/unknown:ReactNative(15835): _construct@1:163819
11-21 09:21:54.440 E/unknown:ReactNative(15835): _next@1:594807
```

### 63 audit 13 min
```
11-21 09:24:04.204 E/ReactNativeJS(15835): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq6upnq-ef11bb849888ed9c","check":{"id":"external-link-153","kind":"network","status":"fail","durationMs":1768.6097589998972,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"pass","browserHandler":"pass","httpReachability":"fail","statusCode":404,"handlerAttempted":true,"httpAttempted":true,"httpSelected":true,"handlerResolution":"pass","host":"www.bankaust.com.au","destinationPath":"/clean-energy-home-loan-key-information"},"error":"HTTP 404: the destination is missing or unavailable.","canonicalMetrics":true}}
11-21 09:24:04.208 E/unknown:ReactNative(15835): ?anon_0_@1:3680632
11-21 09:24:04.208 E/unknown:ReactNative(15835): ?anon_0_@1:3689999
11-21 09:24:04.208 E/unknown:ReactNative(15835): SyntheticError@1:162956
11-21 09:24:04.208 E/unknown:ReactNative(15835): Wrapper@1:163471
11-21 09:24:04.208 E/unknown:ReactNative(15835): _callSuper@1:148344
11-21 09:24:04.208 E/unknown:ReactNative(15835): _construct@1:163819
11-21 09:24:04.208 E/unknown:ReactNative(15835): _next@1:594807
```
