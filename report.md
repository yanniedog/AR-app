# App explorer: 1.0.357 (413)

**Real-use session ATTENTION vs 1.0.357: 0 broken, 14 friction, 0 slower**

- Friction: No reaction for 3.8 s after "scroll rates 1"
- Friction: No reaction for 3.0 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll lenders"
- Friction: No reaction for 4.9 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.6 s after "open filters"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.4 s after "open rba"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.2 s after "scroll rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode full | 80 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 12
Baseline 1.0.357
**Audit live: outcome completed | 974 s | audit log 857558 bytes (audit-log.txt) https://paste.c-net.org/dac572ce-e849-b3f3-856c-ec9dcc2276f1 | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3056 | -110 | 740/974 | 85 | 538 | 1 errors; start 3011ms; boot js-start 441129, layout-mounted 441662, cache-read 441809, hydrated 442110, splash-hide 442110, manifest 443243, resolved 443830, core-fetched 448700, core-saved 449942, rows-prepared 450344, search-index-idle 450344, leading-requested 450344, details-start 450777, leading-scoped 450830, pricing-ready 456294, last-gate 456661, details-fetched 462213, detail-filters-idle 470028, last-pricing 470028, suitability-built 471810, post-refresh-wait 473088, leading-page 476840, last-rows 485726, rates-ready 485908, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 208, pricing-scope-ms 19541, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 3, filter-rows 38533, filter-yields 9, filter-ms 666, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 70 |
| 2 | scroll rates 1 | 701 | -52 | 34/51 | 81 | 500 |  |
| 3 | scroll rates 2 | 724 | +41 | 24/33 | 117 | 659 |  |
| 4 | scroll rates back | 694 | +13 |  |  | 556 |  |
| 5 | open product | 5687 | +16 | 41/56 | 97 | 671 |  |
| 6 | scroll product | 691 | -8 | 34/53 | 81 | 673 |  |
| 7 | back to rates | 34 | +5 | 13/21 | 73 | 641 |  |
| 8 | open lenders | 24 | 0 | 19/24 | 300 | 647 |  |
| 9 | scroll lenders | 732 | +7 | 17/19 | 150 | 645 |  |
| 10 | back from lenders | 24 | +1 | 9/10 | 125 | 646 |  |
| 11 | switch to savings | 26 | +2 | 63/85 | 85 | 659 |  |
| 12 | switch to home loans | 24 | -1 | 17/28 | 65 | 678 |  |
| 13 | open filters | 24 | -3 | 24/27 | 133 | 679 |  |
| 14 | close filters | 24 | +2 | 9/10 | 250 | 672 |  |
| 15 | open market | 24 | +1 | 18/28 | 81 | 671 |  |
| 16 | open rba | 25 | +1 | 37/58 | 69 | 671 |  |
| 17 | scroll rba | 680 | -2 | 26/42 | 77 | 672 |  |
| 18 | back from rba | 25 | +1 | 10/19 | 61 | 673 |  |
| 19 | scroll market | 727 | +33 | 28/40 | 85 | 672 |  |
| 20 | open saved | 27 | +4 | 17/24 | 85 | 679 |  |
| 21 | return to rates | 26 | +4 | 26/43 | 81 | 679 |  |
| 22 | cold start | 12582 | -847 | 27/35 | 400 | 585 | 3 errors; start 4433ms; boot js-start 684305, layout-mounted 684504, hydrated 684658, cache-read 685881, core-ready 686670, rows-prepared 686786, search-index-idle 686786, detail-filters-idle 686786, leading-requested 686786, last-pricing 686786, splash-hide 686787, manifest 688877, leading-scoped 689413, leading-page 689413, resolved 689841, pricing-ready 690719, last-rows 690719, rates-ready 690910, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 20, pricing-scope-ms 1992, filter-runs 1, filter-rows 6861, filter-yields 4, filter-ms 103, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 14 |
| 23 | /browse | 45 |  | 2/2 | 32 | 425 |  |
| 24 | /watchlist | 29 |  | 3/3 | 65 | 426 |  |
| 25 | /market | 2365 |  | 12/21 | 61 | 514 |  |
| 26 | /tools | 32 |  | 18/22 | 89 | 578 |  |
| 27 | /trends | 37 |  |  |  | 620 |  |
| 28 | /search | 34 |  | 33/45 | 101 | 628 |  |
| 29 | /banks | 31 |  | 31/39 | 109 | 638 |  |
| 30 | /bank-rates | 31 |  | 18/25 | 85 | 646 |  |
| 31 | /categories | 30 |  | 32/47 | 101 | 662 |  |
| 32 | /catalogue | 30 |  | 30/41 | 113 | 676 |  |
| 33 | /compare | 27 |  | 11/13 | 117 | 671 |  |
| 34 | /matches | 29 |  | 36/44 | 89 | 687 |  |
| 35 | /calculator | 28 |  | 15/22 | 77 | 673 |  |
| 36 | /projections | 30 |  | 27/38 | 97 | 673 |  |
| 37 | /profile | 30 |  | 16/22 | 69 | 679 |  |
| 38 | /research | 32 |  | 19/25 | 77 | 687 |  |
| 39 | /rba | 32 |  | 15/24 | 89 | 709 |  |
| 40 | /rba-response | 35 |  | 18/27 | 73 | 696 |  |
| 41 | /settings | 33 |  | 13/22 | 89 | 702 |  |
| 42 | /about | 40 |  | 13/22 | 73 | 702 |  |
| 43 | /terms | 32 |  | 13/22 | 93 | 703 |  |
| 44 | /privacy | 33 |  |  |  | 702 |  |
| 45 | /third-party-notices | 32 |  | 13/24 | 69 | 705 |  |
| 46 | /node | 39 |  | 31/45 | 89 | 724 |  |
| 47 | /passthrough | 39 |  | 35/47 | 97 | 706 |  |
| 48 | /calculation-receipt | 31 |  | 16/26 | 69 | 701 |  |
| 49 | /rate-receipt | 30 |  | 9/10 | 73 | 702 |  |
| 50 | warm resume | 1169 |  | 4/4 | 150 | 700 | start 621ms |
| 51 | cold relaunch | 12716 |  | 25/32 | 200 | 667 | 3 errors; start 4553ms; boot js-start 920925, layout-mounted 921156, hydrated 921205, cache-read 922561, core-ready 923318, rows-prepared 923458, search-index-idle 923458, detail-filters-idle 923458, leading-requested 923458, last-pricing 923458, splash-hide 923459, manifest 925560, leading-scoped 925974, leading-page 925974, resolved 926481, pricing-ready 927363, last-rows 927363, rates-ready 927568, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 21, pricing-scope-ms 1712, filter-runs 1, filter-rows 6861, filter-yields 5, filter-ms 119, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 16 |
| 52 | about | 44 | +14 | 14/20 | 300 | 610 |  |
| 53 | audit screen | 22 | +1 | 123/198 | 65 | 562 |  |
| 54 | audit 0 min | 0 | 0 | 469/538 | 113 | 977 | 80 errors |
| 55 | audit 2 min | 0 | 0 | 755/861 | 113 | 1138 | 80 errors |
| 56 | audit 3 min | 0 |  | 895/1032 | 113 | 1121 | 80 errors |
| 57 | audit 4 min | 0 | 0 | 519/592 | 105 | 1099 | 80 errors |
| 58 | audit 6 min | 0 | 0 | 832/946 | 117 | 1119 | 80 errors |
| 59 | audit 8 min | 0 | 0 | 957/1095 | 109 | 1277 | 80 errors |
| 60 | audit 9 min | 0 |  | 446/514 | 109 | 1247 | 80 errors |
| 61 | audit 11 min | 0 | 0 | 672/773 | 117 | 1353 | 80 errors |
| 62 | audit 12 min | 0 |  | 94/111 | 34 | 1364 | 19 errors |
| 63 | audit 13 min | 0 | 0 | 168/192 | 38 | 1389 |  |
| 64 | audit 15 min | 0 | 0 | 120/141 | 48 | 1212 |  |
| 65 | audit 16 min | 0 |  | 31/37 | 81 | 1360 |  |
| 66 | audit finished | 0 | 0 | 91/160 | 73 | 1360 |  |
| 67 | audit result 1 | 0 | 0 |  |  | 1352 |  |
| 68 | audit result 2 | 0 | 0 |  |  | 1351 |  |
| 69 | audit result 3 | 0 | 0 |  |  | 1355 |  |
| 70 | audit result 4 | 0 | 0 |  |  | 1353 |  |
| 71 | audit result 5 | 0 | 0 |  |  | 1355 |  |
| 72 | audit result 6 | 0 | 0 |  |  | 1353 |  |
| 73 | audit result 7 | 0 | 0 |  |  | 1353 |  |
| 74 | audit result 8 | 0 | 0 |  |  | 1357 |  |
| 75 | audit result 9 | 0 | 0 |  |  | 1355 |  |
| 76 | audit result 10 | 0 | 0 |  |  | 1355 |  |
| 77 | audit result 11 | 0 | 0 |  |  | 1358 |  |
| 78 | audit result 12 | 0 | 0 |  |  | 1356 |  |
| 79 | about for debug log | 36 | -3256 | 24/39 | 69 | 1368 |  |
| 80 | debug log screen | 0 | 0 | 106/197 | 61 | 1383 |  |

## Errors

### 1 open app
```
11-23 15:44:44.296 E/australianrates(10582): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-23 15:48:48.653 E/australianrates(12834): Not starting debugger since process cannot load the jdwp agent.
11-23 15:48:52.822 E/SurfaceSyncGroup(12834): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-23 15:48:52.828 E/SurfaceSyncGroup(12834): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 51 cold relaunch
```
11-23 15:52:45.162 E/australianrates(15868): Not starting debugger since process cannot load the jdwp agent.
11-23 15:52:49.482 E/SurfaceSyncGroup(15868): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-23 15:52:49.489 E/SurfaceSyncGroup(15868): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 54 audit 0 min
```
11-23 15:53:57.366 E/ReactNativeJS(15868): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtg4221-c070a922df8df6e0","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":6456.1,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":230.5,"liveStage:dates-index:fetched:ms":235.5,"liveStage:revision:verified:ms":105.5,"liveStage:Core asset:downloaded:ms":256.7,"liveStage:Core asset:hash-verified:ms":18.6,"liveStage:Core asset:native-inflated-and-text-decoded:ms":188.7,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":267.2,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":724.6,"liveStage:Details asset:downloaded:ms":2343.5,"liveStage:Details asset:hash-verified:ms":25.5,"live…
11-23 15:53:57.368 E/unknown:ReactNative(15868): ?anon_0_@1:3693316
11-23 15:53:57.368 E/unknown:ReactNative(15868): ?anon_0_@1:3699116
11-23 15:53:57.368 E/unknown:ReactNative(15868): SyntheticError@1:163016
11-23 15:53:57.368 E/unknown:ReactNative(15868): Wrapper@1:163531
11-23 15:53:57.368 E/unknown:ReactNative(15868): _callSuper@1:148404
11-23 15:53:57.368 E/unknown:ReactNative(15868): _construct@1:163879
11-23 15:53:57.368 E/unknown:ReactNative(15868): _next@1:594867
```

### 55 audit 2 min
```
11-23 15:54:48.485 E/ReactNativeJS(15868): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtg4221-c070a922df8df6e0","check":{"id":"journey-lender-cold","label":"Lender details (cold)","kind":"journey","status":"fail","durationMs":2043.1,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":889.8,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"lender","journeyLabel":"Lender details","iteration":"cold","expectedPath":"/bank/Heartland","expectedSurface":"lender.details","navigationKind":"stack","forwardMs":889.8,"firstReadyFrameObserved":true,"firstReadyFrameMs":172.7584659999702,"backgroundSettleMs":821.9,"destinationReadinessMs":172.8,"backgroundTasks":"Bank response analysis","backMs":77.3,"firstBackMs":77.3,"firstBackDestination":"/performance-audit","originReadinessMs":0.4,"backDestination":"…
11-23 15:54:48.516 E/unknown:ReactNative(15868): ?anon_0_@1:3693316
11-23 15:54:48.516 E/unknown:ReactNative(15868): ?anon_0_@1:3699116
11-23 15:54:48.516 E/unknown:ReactNative(15868): SyntheticError@1:163016
11-23 15:54:48.516 E/unknown:ReactNative(15868): Wrapper@1:163531
11-23 15:54:48.516 E/unknown:ReactNative(15868): _callSuper@1:148404
11-23 15:54:48.516 E/unknown:ReactNative(15868): _construct@1:163879
11-23 15:54:48.516 E/unknown:ReactNative(15868): _next@1:594867
```

### 56 audit 3 min
```
11-23 15:56:10.389 E/ReactNativeJS(15868): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtg4221-c070a922df8df6e0","check":{"id":"deep-first-pass.route.rates-sheets.search.section.next","label":"route.rates-sheets: search.section.next (first-pass)","kind":"journey","status":"fail","durationMs":1417.1,"metrics":{"journeyId":"route.rates-sheets.search.section.next","journeyLabel":"route.rates-sheets: search.section.next","iteration":"cold","passId":"first-pass","scenarioId":"route.rates-sheets","semanticActionId":"search.section.next","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":18,"actionRevisionAfter":19,"renderRevisionBefore":"state-25","renderRevisionAfter":"state-28","actionMs":398.3,"preActionWaitMs":22.8,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"re…
11-23 15:56:10.391 E/unknown:ReactNative(15868): ?anon_0_@1:3693316
11-23 15:56:10.391 E/unknown:ReactNative(15868): ?anon_0_@1:3699116
11-23 15:56:10.391 E/unknown:ReactNative(15868): SyntheticError@1:163016
11-23 15:56:10.391 E/unknown:ReactNative(15868): Wrapper@1:163531
11-23 15:56:10.391 E/unknown:ReactNative(15868): _callSuper@1:148404
11-23 15:56:10.391 E/unknown:ReactNative(15868): _construct@1:163879
11-23 15:56:10.391 E/unknown:ReactNative(15868): _next@1:594867
```

### 57 audit 4 min
```
11-23 15:57:47.635 E/ReactNativeJS(15868): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtg4221-c070a922df8df6e0","check":{"id":"deep-first-pass.sample.catalogue.5.product.open","label":"sample.catalogue.5: product.open (first-pass)","kind":"journey","status":"fail","durationMs":2182.1,"metrics":{"journeyId":"sample.catalogue.5.product.open","journeyLabel":"sample.catalogue.5: product.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.5","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/TMCU%7C3M_TO_LESS_THAN_6M%7CTERM_DEPOSITS%7C3M%20TO%20LESS%20THAN%206M","expectedPath":"/product/TMCU%7C3M_TO_LESS_THAN_6M%7CTERM_DEPOSITS%7C3M%20TO%20LESS%20THAN%206M","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":617.8,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"mo…
11-23 15:57:47.637 E/unknown:ReactNative(15868): ?anon_0_@1:3693316
11-23 15:57:47.637 E/unknown:ReactNative(15868): ?anon_0_@1:3699116
11-23 15:57:47.637 E/unknown:ReactNative(15868): SyntheticError@1:163016
11-23 15:57:47.637 E/unknown:ReactNative(15868): Wrapper@1:163531
11-23 15:57:47.637 E/unknown:ReactNative(15868): _callSuper@1:148404
11-23 15:57:47.637 E/unknown:ReactNative(15868): _construct@1:163879
11-23 15:57:47.637 E/unknown:ReactNative(15868): _next@1:594867
```

### 58 audit 6 min
```
11-23 15:58:58.989 E/ReactNativeJS(15868): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtg4221-c070a922df8df6e0","check":{"id":"deep-first-pass.route.settings.settings.open","label":"route.settings: settings.open (first-pass)","kind":"journey","status":"fail","durationMs":1147.8,"metrics":{"journeyId":"route.settings.settings.open","journeyLabel":"route.settings: settings.open","iteration":"cold","passId":"first-pass","scenarioId":"route.settings","semanticActionId":"settings.open","depth":0,"plannedExpectedPath":"/settings","expectedPath":"/settings","expectedSurface":"settings.sections","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":386.1,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":107.9,"forwardWorkMs":107.9,"navigationCommitMs":0,"firstReadyFrameMs":107.9,"firstReadyFrameObserved":true,"readinessMs"…
11-23 15:58:58.991 E/unknown:ReactNative(15868): ?anon_0_@1:3693316
11-23 15:58:58.991 E/unknown:ReactNative(15868): ?anon_0_@1:3699116
11-23 15:58:58.991 E/unknown:ReactNative(15868): SyntheticError@1:163016
11-23 15:58:58.991 E/unknown:ReactNative(15868): Wrapper@1:163531
11-23 15:58:58.991 E/unknown:ReactNative(15868): _callSuper@1:148404
11-23 15:58:58.991 E/unknown:ReactNative(15868): _construct@1:163879
11-23 15:58:58.991 E/unknown:ReactNative(15868): _next@1:594867
```

### 59 audit 8 min
```
11-23 16:00:40.240 E/ReactNativeJS(15868): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtg4221-c070a922df8df6e0","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.open","label":"route.rates-mortgage-scope: search.open (repeat)","kind":"journey","status":"fail","durationMs":10616.8,"metrics":{"journeyId":"route.rates-mortgage-scope.search.open","journeyLabel":"route.rates-mortgage-scope: search.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.open","depth":0,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":117.4,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":9827.2,"forwardWorkMs":9827.2,"navigationCommitMs":340.8,"firstReadyFrameMs":9486.3,"first…
11-23 16:00:40.241 E/unknown:ReactNative(15868): ?anon_0_@1:3693316
11-23 16:00:40.241 E/unknown:ReactNative(15868): ?anon_0_@1:3699116
11-23 16:00:40.241 E/unknown:ReactNative(15868): SyntheticError@1:163016
11-23 16:00:40.241 E/unknown:ReactNative(15868): Wrapper@1:163531
11-23 16:00:40.241 E/unknown:ReactNative(15868): _callSuper@1:148404
11-23 16:00:40.241 E/unknown:ReactNative(15868): _construct@1:163879
11-23 16:00:40.241 E/unknown:ReactNative(15868): _next@1:594867
```

### 60 audit 9 min
```
11-23 16:02:48.166 E/ReactNativeJS(15868): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtg4221-c070a922df8df6e0","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1992.4,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Heartland%7CS02.1%7CTRANS_AND_SAVINGS_ACCOUNTS%7CMySavings%20account","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"renderRevisionBefore":"2026-11-…
11-23 16:02:48.168 E/unknown:ReactNative(15868): ?anon_0_@1:3693316
11-23 16:02:48.168 E/unknown:ReactNative(15868): ?anon_0_@1:3699116
11-23 16:02:48.168 E/unknown:ReactNative(15868): SyntheticError@1:163016
11-23 16:02:48.168 E/unknown:ReactNative(15868): Wrapper@1:163531
11-23 16:02:48.168 E/unknown:ReactNative(15868): _callSuper@1:148404
11-23 16:02:48.168 E/unknown:ReactNative(15868): _construct@1:163879
11-23 16:02:48.168 E/unknown:ReactNative(15868): _next@1:594867
```

### 61 audit 11 min
```
11-23 16:03:33.105 E/ReactNativeJS(15868): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtg4221-c070a922df8df6e0","check":{"id":"deep-repeat.route.profile.profile.open","label":"route.profile: profile.open (repeat)","kind":"journey","status":"fail","durationMs":1226,"metrics":{"journeyId":"route.profile.profile.open","journeyLabel":"route.profile: profile.open","iteration":"warm","passId":"repeat","scenarioId":"route.profile","semanticActionId":"profile.open","depth":0,"plannedExpectedPath":"/profile","expectedPath":"/profile","expectedSurface":"profile.filters","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":90,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":521.2,"forwardWorkMs":521.2,"navigationCommitMs":0.1,"firstReadyFrameMs":521.2,"firstReadyFrameObserved":true,"readinessMs":521.2,"backgroundSettleMs":6…
11-23 16:03:33.107 E/unknown:ReactNative(15868): ?anon_0_@1:3693316
11-23 16:03:33.107 E/unknown:ReactNative(15868): ?anon_0_@1:3699116
11-23 16:03:33.107 E/unknown:ReactNative(15868): SyntheticError@1:163016
11-23 16:03:33.107 E/unknown:ReactNative(15868): Wrapper@1:163531
11-23 16:03:33.107 E/unknown:ReactNative(15868): _callSuper@1:148404
11-23 16:03:33.107 E/unknown:ReactNative(15868): _construct@1:163879
11-23 16:03:33.107 E/unknown:ReactNative(15868): _next@1:594867
```

### 62 audit 12 min
```
11-23 16:05:20.156 E/ReactNativeJS(15868): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtg4221-c070a922df8df6e0","check":{"id":"external-link-373","kind":"network","status":"fail","durationMs":1215.3670369999018,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"pass","browserHandler":"pass","httpReachability":"fail","statusCode":404,"handlerAttempted":true,"httpAttempted":true,"httpSelected":true,"handlerResolution":"pass","host":"www.defencebank.com.au","destinationPath":"/banking/home-loans/essentials-home-loan---ultimate-package-investor-interest-only/"},"error":"HTTP 404: the destination is missing or unavailable.","canonicalMetrics":true}}
11-23 16:05:20.158 E/unknown:ReactNative(15868): ?anon_0_@1:3693316
11-23 16:05:20.158 E/unknown:ReactNative(15868): ?anon_0_@1:3702677
11-23 16:05:20.158 E/unknown:ReactNative(15868): SyntheticError@1:163016
11-23 16:05:20.158 E/unknown:ReactNative(15868): Wrapper@1:163531
11-23 16:05:20.158 E/unknown:ReactNative(15868): _callSuper@1:148404
11-23 16:05:20.158 E/unknown:ReactNative(15868): _construct@1:163879
11-23 16:05:20.158 E/unknown:ReactNative(15868): _next@1:594867
```
