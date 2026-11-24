# App explorer: 1.0.364 (420)

**Real-use session ATTENTION vs 1.0.364: 0 broken, 4 friction, 0 slower**

- Friction: No reaction for 3.0 s after "scroll rates 1"
- Friction: No reaction for 3.0 s after "scroll rates 2"
- Friction: No reaction for 3.5 s after "switch to savings"
- Friction: "No saved rates" shown on "open saved"

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode full | 78 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 10
Baseline 1.0.364
**Audit live: outcome failed | 846 s | audit log 843641 bytes (audit-log.txt) https://paste.c-net.org/1b529736-874b-3cba-ff87-fd8a7efa132f | debug log Upload and copy link not found**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 25367 | -3246 | 330/682 | 65 | 492 | 1 errors; start 2604ms; boot js-start 385320, layout-mounted 385846, cache-read 386008, hydrated 386413, splash-hide 386413, manifest 387646, resolved 388165, core-fetched 391265, core-saved 391800, rows-prepared 391993, search-index-idle 391993, leading-requested 391993, details-start 392492, leading-scoped 392779, pricing-ready 395437, last-gate 395650, details-fetched 399049, detail-filters-idle 402804, last-pricing 402804, suitability-built 403609, post-refresh-wait 403996, leading-page 404587, last-rows 408716, rates-ready 408828, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 141, pricing-scope-ms 7109, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 3, filter-rows 38533, filter-yields 5, filter-ms 152, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 61 |
| 2 | scroll rates 1 | 5342 | +4644 | 34/73 | 61 | 719 |  |
| 3 | scroll rates 2 | 698 | +13 | 19/41 | 69 | 568 |  |
| 4 | scroll rates back | 684 | +10 |  |  | 553 |  |
| 5 | open product | 2700 | +56 | 23/55 | 69 | 654 |  |
| 6 | scroll product | 675 | -45 | 21/62 | 65 | 649 |  |
| 7 | back to rates | 24 | -5 | 10/26 | 57 | 633 |  |
| 8 | open lenders | 18 | -6 | 21/26 | 150 | 640 |  |
| 9 | scroll lenders | 714 | -21 | 21/24 | 113 | 638 |  |
| 10 | back from lenders | 19 | -3 | 8/9 | 117 | 641 |  |
| 11 | switch to savings | 17 | -5 | 28/64 | 69 | 650 |  |
| 12 | switch to home loans | 17 | -7 | 11/34 | 42 | 667 |  |
| 13 | open filters | 17 | -6 | 23/30 | 117 | 677 |  |
| 14 | close filters | 17 | -4 | 7/10 | 121 | 664 |  |
| 15 | open market | 17 | -5 | 14/36 | 53 | 666 |  |
| 16 | open rba | 2352 | -126 | 38/74 | 53 | 681 |  |
| 17 | scroll rba | 680 | -30 | 22/59 | 61 | 675 |  |
| 18 | back from rba | 21 | -1 | 7/23 | 44 | 675 |  |
| 19 | scroll market | 674 | -28 | 19/47 | 65 | 674 |  |
| 20 | open saved | 15 | -8 | 7/17 | 57 | 682 |  |
| 21 | return to rates | 16 | -6 | 15/35 | 48 | 683 |  |
| 22 | cold start | 7916 | -863 | 28/46 | 69 | 419 | 1 errors; start 2947ms; boot js-start 602555, layout-mounted 602706, hydrated 602706, cache-read 603544, core-ready 603966, rows-prepared 604038, search-index-idle 604038, detail-filters-idle 604038, leading-requested 604038, last-pricing 604038, splash-hide 604039, leading-scoped 605273, leading-page 605273, manifest 605494, resolved 605976, pricing-ready 606061, last-rows 606061, rates-ready 606658, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 25, pricing-scope-ms 1602, filter-runs 2, filter-rows 13722, filter-yields 5, filter-cancels 1, filter-ms 181, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 9 |
| 23 | /browse | 22 |  |  |  | 447 |  |
| 24 | /watchlist | 24 |  | 1/2 | 31 | 550 |  |
| 25 | /market | 4301 |  | 6/22 | 32 | 612 |  |
| 26 | /tools | 21 |  | 10/23 | 65 | 618 |  |
| 27 | /trends | 19 |  | 16/37 | 73 | 627 |  |
| 28 | /search | 34 |  | 25/42 | 85 | 646 |  |
| 29 | /banks | 20 |  | 26/48 | 81 | 644 |  |
| 30 | /bank-rates | 19 |  | 14/33 | 61 | 657 |  |
| 31 | /categories | 18 |  | 32/58 | 61 | 687 |  |
| 32 | /catalogue | 18 |  | 25/41 | 81 | 689 |  |
| 33 | /compare | 39 |  | 15/18 | 89 | 668 |  |
| 34 | /matches | 23 |  | 26/49 | 73 | 688 |  |
| 35 | /calculator | 18 |  | 10/25 | 69 | 688 |  |
| 36 | /projections | 25 |  | 18/43 | 65 | 676 |  |
| 37 | /profile | 18 |  | 10/28 | 57 | 679 |  |
| 38 | /research | 23 |  | 15/33 | 57 | 687 |  |
| 39 | /rba | 23 |  | 6/24 | 77 | 700 |  |
| 40 | /rba-response | 26 |  | 12/38 | 53 | 702 |  |
| 41 | /settings | 21 |  | 12/27 | 69 | 709 |  |
| 42 | /about | 29 |  | 9/26 | 48 | 709 |  |
| 43 | /terms | 18 |  | 7/24 | 48 | 710 |  |
| 44 | /privacy | 26 |  |  |  | 710 |  |
| 45 | /third-party-notices | 21 |  | 10/26 | 53 | 714 |  |
| 46 | /node | 18 |  | 28/56 | 69 | 734 |  |
| 47 | /passthrough | 23 |  | 24/47 | 73 | 712 |  |
| 48 | /calculation-receipt | 28 |  | 11/23 | 69 | 707 |  |
| 49 | /rate-receipt | 26 |  | 6/11 | 65 | 707 |  |
| 50 | warm resume | 379 |  | 3/4 | 133 | 705 |  |
| 51 | cold relaunch | 8577 |  | 29/37 | 400 | 594 | 1 errors; start 3330ms; boot js-start 818049, layout-mounted 818211, hydrated 818309, cache-read 819190, core-ready 819689, rows-prepared 819796, search-index-idle 819796, detail-filters-idle 819796, leading-requested 819796, last-pricing 819796, splash-hide 819797, manifest 821297, leading-scoped 821826, leading-page 821826, resolved 822168, pricing-ready 822823, last-rows 822823, rates-ready 822961, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 19, pricing-scope-ms 1475, filter-runs 1, filter-rows 6861, filter-yields 3, filter-ms 74, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 13 |
| 52 | about | 33 | +2 | 10/22 | 65 | 468 |  |
| 53 | audit screen | 22 | +2 | 85/226 | 48 | 615 |  |
| 54 | audit 0 min | 0 | 0 | 509/604 | 101 | 807 | 80 errors |
| 55 | audit 2 min | 0 | 0 | 886/1078 | 97 | 1090 | 80 errors |
| 56 | audit 3 min | 0 | 0 | 633/860 | 85 | 1048 | 80 errors |
| 57 | audit 5 min | 0 |  | 1131/1461 | 89 | 1179 | 80 errors |
| 58 | audit 7 min | 0 | 0 | 439/593 | 81 | 1265 | 80 errors |
| 59 | audit 8 min | 0 | 0 | 873/1129 | 89 | 1347 | 80 errors |
| 60 | audit 10 min | 0 |  | 110/163 | 73 | 1326 | 80 errors |
| 61 | audit 11 min | 0 | 0 | 123/171 | 29 | 1354 |  |
| 62 | audit 12 min | 0 |  | 88/117 | 32 | 1371 |  |
| 63 | audit 14 min | 0 | 0 | 53/83 | 53 | 1298 |  |
| 64 | audit finished | 0 | 0 | 84/240 | 53 | 1423 |  |
| 65 | audit result 1 | 0 | 0 |  |  | 1411 |  |
| 66 | audit result 2 | 0 | 0 |  |  | 1411 |  |
| 67 | audit result 3 | 0 | 0 |  |  | 1411 |  |
| 68 | audit result 4 | 0 | 0 |  |  | 1414 |  |
| 69 | audit result 5 | 0 | 0 |  |  | 1410 |  |
| 70 | audit result 6 | 0 | 0 |  |  | 1413 |  |
| 71 | audit result 7 | 0 | 0 |  |  | 1411 |  |
| 72 | audit result 8 | 0 | 0 |  |  | 1411 |  |
| 73 | audit result 9 | 0 | 0 |  |  | 1412 |  |
| 74 | audit result 10 | 0 | 0 |  |  | 1413 |  |
| 75 | audit result 11 | 0 | 0 |  |  | 1415 |  |
| 76 | audit result 12 | 0 | 0 |  |  | 1413 |  |
| 77 | about for debug log | 12260 | +9061 | 21/45 | 48 | 1289 |  |
| 78 | debug log screen | 0 | 0 | 59/240 | 40 | 1288 |  |

## Errors

### 1 open app
```
11-23 23:45:13.938 E/australianrates(10400): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-23 23:48:52.051 E/australianrates(12723): Not starting debugger since process cannot load the jdwp agent.
```

### 51 cold relaunch
```
11-23 23:52:27.540 E/australianrates(15740): Not starting debugger since process cannot load the jdwp agent.
```

### 54 audit 0 min
```
11-23 23:53:30.623 E/ReactNativeJS(15740): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtx8uis-d8006033fcb3429a","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":3948.6,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":242,"liveStage:dates-index:fetched:ms":234.4,"liveStage:revision:verified:ms":68.4,"liveStage:Core asset:downloaded:ms":211.9,"liveStage:Core asset:hash-verified:ms":19.3,"liveStage:Core asset:native-inflated-and-text-decoded:ms":128.6,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":198.7,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":421.4,"liveStage:Details asset:downloaded:ms":1008.4,"liveStage:Details asset:hash-verified:ms":49.6,"liveS…
11-23 23:53:30.624 E/unknown:ReactNative(15740): ?anon_0_@1:3693803
11-23 23:53:30.624 E/unknown:ReactNative(15740): ?anon_0_@1:3699603
11-23 23:53:30.624 E/unknown:ReactNative(15740): SyntheticError@1:163016
11-23 23:53:30.624 E/unknown:ReactNative(15740): Wrapper@1:163531
11-23 23:53:30.624 E/unknown:ReactNative(15740): _callSuper@1:148404
11-23 23:53:30.624 E/unknown:ReactNative(15740): _construct@1:163879
11-23 23:53:30.624 E/unknown:ReactNative(15740): _next@1:594867
```

### 55 audit 2 min
```
11-23 23:54:21.658 E/ReactNativeJS(15740): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtx8uis-d8006033fcb3429a","check":{"id":"journey-rates-warm","label":"Rates (warm)","kind":"journey","status":"fail","durationMs":1892.5,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1013.5,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates","journeyLabel":"Rates","iteration":"warm","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1013.5,"firstReadyFrameObserved":true,"firstReadyFrameMs":165.86373199999798,"backgroundSettleMs":658.1,"destinationReadinessMs":165.9,"backgroundTasks":"Product details, Search index availability","backMs":50.3,"firstBackMs":50.3,"firstBackDestination":"/performance-audit","ori…
11-23 23:54:21.661 E/unknown:ReactNative(15740): ?anon_0_@1:3693803
11-23 23:54:21.661 E/unknown:ReactNative(15740): ?anon_0_@1:3699603
11-23 23:54:21.661 E/unknown:ReactNative(15740): SyntheticError@1:163016
11-23 23:54:21.661 E/unknown:ReactNative(15740): Wrapper@1:163531
11-23 23:54:21.661 E/unknown:ReactNative(15740): _callSuper@1:148404
11-23 23:54:21.661 E/unknown:ReactNative(15740): _construct@1:163879
11-23 23:54:21.661 E/unknown:ReactNative(15740): _next@1:594867
```

### 56 audit 3 min
```
11-23 23:55:57.560 E/ReactNativeJS(15740): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtx8uis-d8006033fcb3429a","check":{"id":"deep-first-pass.redirect.node.redirect.node.verify","label":"redirect.node: redirect.node.verify (first-pass)","kind":"journey","status":"fail","durationMs":2108.7,"metrics":{"journeyId":"redirect.node.redirect.node.verify","journeyLabel":"redirect.node: redirect.node.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.node","semanticActionId":"redirect.node.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":46.2,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1333.3,"forwardWorkMs":1333.3,"navigationCommitMs":314.2,"firstReadyFrameMs":1019.1,"firstReadyFrame…
11-23 23:55:57.563 E/unknown:ReactNative(15740): ?anon_0_@1:3693803
11-23 23:55:57.563 E/unknown:ReactNative(15740): ?anon_0_@1:3699603
11-23 23:55:57.563 E/unknown:ReactNative(15740): SyntheticError@1:163016
11-23 23:55:57.563 E/unknown:ReactNative(15740): Wrapper@1:163531
11-23 23:55:57.563 E/unknown:ReactNative(15740): _callSuper@1:148404
11-23 23:55:57.563 E/unknown:ReactNative(15740): _construct@1:163879
11-23 23:55:57.563 E/unknown:ReactNative(15740): _next@1:594867
```

### 57 audit 5 min
```
11-23 23:57:00.967 E/ReactNativeJS(15740): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtx8uis-d8006033fcb3429a","check":{"id":"deep-first-pass.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (first-pass)","kind":"journey","status":"fail","durationMs":1468.6,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/People%20First%20and%20Heritage%20Bank%7C02901be8-7e53-49c8-ae99-097c55c11074%7CTRANS_AND_SAVINGS_ACCOUNTS%7COnline%20Saver%20Account","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actio…
11-23 23:57:00.968 E/unknown:ReactNative(15740): ?anon_0_@1:3693803
11-23 23:57:00.968 E/unknown:ReactNative(15740): ?anon_0_@1:3699603
11-23 23:57:00.968 E/unknown:ReactNative(15740): SyntheticError@1:163016
11-23 23:57:00.968 E/unknown:ReactNative(15740): Wrapper@1:163531
11-23 23:57:00.968 E/unknown:ReactNative(15740): _callSuper@1:148404
11-23 23:57:00.968 E/unknown:ReactNative(15740): _construct@1:163879
11-23 23:57:00.968 E/unknown:ReactNative(15740): _next@1:594867
```

### 58 audit 7 min
```
11-23 23:59:14.018 E/ReactNativeJS(15740): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtx8uis-d8006033fcb3429a","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.open","label":"route.rates-mortgage-scope: search.open (repeat)","kind":"journey","status":"fail","durationMs":6649.9,"metrics":{"journeyId":"route.rates-mortgage-scope.search.open","journeyLabel":"route.rates-mortgage-scope: search.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.open","depth":0,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":95.7,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":5849.7,"forwardWorkMs":5849.7,"navigationCommitMs":503.9,"firstReadyFrameMs":5345.8,"firstRe…
11-23 23:59:14.019 E/unknown:ReactNative(15740): ?anon_0_@1:3693803
11-23 23:59:14.019 E/unknown:ReactNative(15740): ?anon_0_@1:3699603
11-23 23:59:14.019 E/unknown:ReactNative(15740): SyntheticError@1:163016
11-23 23:59:14.019 E/unknown:ReactNative(15740): Wrapper@1:163531
11-23 23:59:14.019 E/unknown:ReactNative(15740): _callSuper@1:148404
11-23 23:59:14.019 E/unknown:ReactNative(15740): _construct@1:163879
11-23 23:59:14.019 E/unknown:ReactNative(15740): _next@1:594867
```

### 59 audit 8 min
```
11-24 00:00:49.885 E/ReactNativeJS(15740): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtx8uis-d8006033fcb3429a","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1303.9,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/People%20First%20and%20Heritage%20Bank%7C02901be8-7e53-49c8-ae99-097c55c11074%7CTRANS_AND_SAVINGS_ACCOUNTS%7COnline%20Saver%20Account","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBef…
11-24 00:00:49.886 E/unknown:ReactNative(15740): ?anon_0_@1:3693803
11-24 00:00:49.886 E/unknown:ReactNative(15740): ?anon_0_@1:3699603
11-24 00:00:49.886 E/unknown:ReactNative(15740): SyntheticError@1:163016
11-24 00:00:49.886 E/unknown:ReactNative(15740): Wrapper@1:163531
11-24 00:00:49.886 E/unknown:ReactNative(15740): _callSuper@1:148404
11-24 00:00:49.886 E/unknown:ReactNative(15740): _construct@1:163879
11-24 00:00:49.886 E/unknown:ReactNative(15740): _next@1:594867
```

### 60 audit 10 min
```
11-24 00:02:25.223 E/ReactNativeJS(15740): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtx8uis-d8006033fcb3429a","check":{"id":"deep-repeat.redirect.tab-index.redirect.tab-index.verify","label":"redirect.tab-index: redirect.tab-index.verify (repeat)","kind":"journey","status":"fail","durationMs":1633.3,"metrics":{"journeyId":"redirect.tab-index.redirect.tab-index.verify","journeyLabel":"redirect.tab-index: redirect.tab-index.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.tab-index","semanticActionId":"redirect.tab-index.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":76.2,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":846.5,"forwardWorkMs":846.5,"navigationCommitMs":715.7,"firstR…
11-24 00:02:25.224 E/unknown:ReactNative(15740): ?anon_0_@1:3693803
11-24 00:02:25.224 E/unknown:ReactNative(15740): ?anon_0_@1:3699603
11-24 00:02:25.224 E/unknown:ReactNative(15740): SyntheticError@1:163016
11-24 00:02:25.224 E/unknown:ReactNative(15740): Wrapper@1:163531
11-24 00:02:25.224 E/unknown:ReactNative(15740): _callSuper@1:148404
11-24 00:02:25.224 E/unknown:ReactNative(15740): _construct@1:163879
11-24 00:02:25.224 E/unknown:ReactNative(15740): _next@1:594867
```
