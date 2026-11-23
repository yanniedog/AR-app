# App explorer: 1.0.356 (412)

**Real-use session ATTENTION vs 1.0.356: 0 broken, 14 friction, 3 slower**

- Friction: No reaction for 3.0 s after "scroll rates 1"
- Friction: No reaction for 3.6 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.3 s after "scroll lenders"
- Friction: No reaction for 5.1 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.4 s after "open filters"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "open rba"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.2 s after "scroll rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Slower: Dropped frames 51% to 70% on "scroll rates 1"
- Slower: Dropped frames 61% to 77% on "switch to savings"
- Slower: Dropped frames 45% to 67% on "return to rates"

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode full | 80 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 13
Baseline 1.0.356
**Audit live: outcome completed | 966 s | audit log 860358 bytes (audit-log.txt) https://paste.c-net.org/96a653fb-1f78-0d26-9c99-d33a27cc1342 | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3082 | +388 | 688/896 | 89 | 493 | 1 errors; start 3032ms |
| 2 | scroll rates 1 | 703 | +27 | 26/37 | 85 | 574 | boot js-start 423180, layout-mounted 423548, cache-read 423704, hydrated 423880, splash-hide 423880, manifest 425106, resolved 425804, core-fetched 430771, core-saved 431681, rows-prepared 432139, search-index-idle 432139, leading-requested 432139, details-start 432830, leading-scoped 433210, pricing-ready 434347, last-gate 438668, details-fetched 442906, detail-filters-idle 451554, last-pricing 451554, suitability-built 452797, post-refresh-wait 453387, leading-page 455585, last-rows 464973, rates-ready 465485, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 202, pricing-scope-ms 14115, leading-short 1, leading-short-rows 0, leading-scope-rows 112, leading-visible-rows 0, leading-nonstd-rows 9, filter-runs 3, filter-rows 38624, filter-yields 11, filter-ms 1413, sort-runs 5, sort-rows 1182, sort-yields 5, sort-ms 3181 |
| 3 | scroll rates 2 | 718 | +15 | 32/48 | 85 | 662 |  |
| 4 | scroll rates back | 688 | +4 |  |  | 532 |  |
| 5 | open product | 23 | -5078 | 38/55 | 101 | 613 |  |
| 6 | scroll product | 698 | -21 | 17/26 | 69 | 673 |  |
| 7 | back to rates | 28 | +6 | 13/23 | 81 | 670 |  |
| 8 | open lenders | 23 | +3 | 17/23 | 250 | 659 |  |
| 9 | scroll lenders | 747 | +5 | 16/20 | 133 | 656 |  |
| 10 | back from lenders | 22 | +4 | 9/10 | 150 | 656 |  |
| 11 | switch to savings | 26 | +8 | 76/99 | 85 | 669 |  |
| 12 | switch to home loans | 25 | +2 | 14/30 | 69 | 684 |  |
| 13 | open filters | 24 | +4 | 25/28 | 200 | 691 |  |
| 14 | close filters | 23 | +4 | 6/7 | 150 | 679 |  |
| 15 | open market | 24 | +5 | 16/27 | 69 | 682 |  |
| 16 | open rba | 25 | +5 | 36/47 | 65 | 683 |  |
| 17 | scroll rba | 689 | -16 | 25/39 | 77 | 681 |  |
| 18 | back from rba | 24 | +3 | 8/20 | 53 | 682 |  |
| 19 | scroll market | 715 | +40 | 26/38 | 81 | 682 |  |
| 20 | open saved | 24 | +6 | 10/17 | 36 | 688 |  |
| 21 | return to rates | 21 | +2 | 22/33 | 73 | 690 |  |
| 22 | cold start | 10676 | +1698 | 26/35 | 150 | 584 | 3 errors; start 4686ms; boot js-start 654671, layout-mounted 654866, hydrated 655009, cache-read 656230, core-ready 656998, rows-prepared 657118, search-index-idle 657118, detail-filters-idle 657119, leading-requested 657119, last-pricing 657119, splash-hide 657120, manifest 659456, leading-scoped 659844, leading-page 659844, resolved 660306, pricing-ready 661175, last-rows 661175, rates-ready 661358, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 23, pricing-scope-ms 1588, filter-runs 1, filter-rows 6879, filter-yields 4, filter-ms 102, sort-runs 1, sort-rows 1182, sort-yields 1, sort-ms 14 |
| 23 | /browse | 32 |  | 2/2 | 32 | 420 |  |
| 24 | /watchlist | 36 |  | 3/4 | 32 | 422 |  |
| 25 | /market | 2310 |  | 14/22 | 46 | 526 |  |
| 26 | /tools | 26 |  | 14/21 | 97 | 583 |  |
| 27 | /trends | 29 |  |  |  | 618 |  |
| 28 | /search | 33 |  | 34/47 | 113 | 623 |  |
| 29 | /banks | 31 |  | 31/38 | 133 | 636 |  |
| 30 | /bank-rates | 31 |  | 18/31 | 69 | 646 |  |
| 31 | /categories | 29 |  | 36/46 | 81 | 663 |  |
| 32 | /catalogue | 31 |  | 28/42 | 93 | 675 |  |
| 33 | /compare | 35 |  | 13/16 | 129 | 667 |  |
| 34 | /matches | 33 |  | 39/46 | 93 | 684 |  |
| 35 | /calculator | 23 |  | 16/25 | 69 | 673 |  |
| 36 | /projections | 29 |  | 19/29 | 121 | 672 |  |
| 37 | /profile | 30 |  | 19/26 | 69 | 676 |  |
| 38 | /research | 28 |  | 20/32 | 85 | 686 |  |
| 39 | /rba | 29 |  | 17/27 | 69 | 706 |  |
| 40 | /rba-response | 34 |  | 21/33 | 65 | 694 |  |
| 41 | /settings | 26 |  | 14/22 | 89 | 701 |  |
| 42 | /about | 25 |  | 11/22 | 73 | 699 |  |
| 43 | /terms | 28 |  | 14/23 | 69 | 701 |  |
| 44 | /privacy | 32 |  |  |  | 700 |  |
| 45 | /third-party-notices | 33 |  | 12/23 | 69 | 703 |  |
| 46 | /node | 34 |  | 36/47 | 109 | 729 |  |
| 47 | /passthrough | 37 |  | 34/48 | 97 | 705 |  |
| 48 | /calculation-receipt | 31 |  | 14/23 | 69 | 700 |  |
| 49 | /rate-receipt | 28 |  | 6/9 | 89 | 700 |  |
| 50 | warm resume | 208 |  | 4/4 | 200 | 699 |  |
| 51 | cold relaunch | 10396 |  | 30/42 | 113 | 575 | 3 errors; start 4315ms; boot js-start 885856, layout-mounted 886065, hydrated 886175, cache-read 887485, core-ready 888246, rows-prepared 888378, search-index-idle 888378, detail-filters-idle 888378, leading-requested 888378, last-pricing 888378, splash-hide 888380, manifest 890686, leading-scoped 891057, leading-page 891057, resolved 891570, pricing-ready 892421, last-rows 892421, rates-ready 892609, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 22, pricing-scope-ms 1624, filter-runs 1, filter-rows 6879, filter-yields 4, filter-ms 101, sort-runs 1, sort-rows 1182, sort-yields 1, sort-ms 14 |
| 52 | about | 48 | +10 | 12/20 | 350 | 603 |  |
| 53 | audit screen | 22 | +5 | 121/202 | 65 | 581 |  |
| 54 | audit 0 min | 0 | 0 | 464/521 | 109 | 742 | 80 errors |
| 55 | audit 2 min | 0 | 0 | 723/817 | 109 | 1092 | 80 errors |
| 56 | audit 3 min | 0 | 0 | 709/796 | 117 | 1019 | 80 errors |
| 57 | audit 4 min | 0 |  | 399/475 | 101 | 1123 | 80 errors |
| 58 | audit 5 min | 0 | 0 | 853/975 | 117 | 1174 | 80 errors |
| 59 | audit 7 min | 0 |  | 453/499 | 117 | 1117 | 80 errors |
| 60 | audit 8 min | 0 | 0 | 1009/1168 | 109 | 1310 | 80 errors |
| 61 | audit 10 min | 0 | 0 | 878/1003 | 105 | 1303 | 80 errors |
| 62 | audit 11 min | 0 |  | 263/298 | 117 | 1367 | 80 errors |
| 63 | audit 12 min | 0 | 0 | 168/191 | 42 | 1380 | 19 errors |
| 64 | audit 14 min | 0 | 0 | 152/185 | 34 | 1208 |  |
| 65 | audit 15 min | 0 |  | 62/70 | 69 | 1235 |  |
| 66 | audit finished | 0 | 0 | 125/197 | 69 | 1366 |  |
| 67 | audit result 1 | 0 | 0 |  |  | 1355 |  |
| 68 | audit result 2 | 0 | 0 |  |  | 1352 |  |
| 69 | audit result 3 | 0 | 0 |  |  | 1352 |  |
| 70 | audit result 4 | 0 | 0 |  |  | 1355 |  |
| 71 | audit result 5 | 0 | 0 |  |  | 1352 |  |
| 72 | audit result 6 | 0 | 0 |  |  | 1356 |  |
| 73 | audit result 7 | 0 | 0 |  |  | 1354 |  |
| 74 | audit result 8 | 0 | 0 |  |  | 1356 |  |
| 75 | audit result 9 | 0 | 0 |  |  | 1358 |  |
| 76 | audit result 10 | 0 | 0 |  |  | 1356 |  |
| 77 | audit result 11 | 0 | 0 |  |  | 1359 |  |
| 78 | audit result 12 | 0 | 0 |  |  | 1358 |  |
| 79 | about for debug log | 3279 | -462 | 23/35 | 69 | 1234 |  |
| 80 | debug log screen | 0 | 0 | 101/192 | 57 | 1233 |  |

## Errors

### 1 open app
```
11-23 14:12:52.509 E/australianrates(10318): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-23 14:16:44.784 E/australianrates(12537): Not starting debugger since process cannot load the jdwp agent.
11-23 14:16:49.380 E/SurfaceSyncGroup(12537): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-23 14:16:49.380 E/SurfaceSyncGroup(12537): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 51 cold relaunch
```
11-23 14:20:36.442 E/australianrates(15555): Not starting debugger since process cannot load the jdwp agent.
11-23 14:20:40.650 E/SurfaceSyncGroup(15555): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-23 14:20:40.653 E/SurfaceSyncGroup(15555): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 54 audit 0 min
```
11-23 14:21:46.726 E/ReactNativeJS(15555): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtctji1-21985cacb2caeba1","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":5298.4,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":260.8,"liveStage:dates-index:fetched:ms":250.8,"liveStage:revision:verified:ms":56.4,"liveStage:Core asset:downloaded:ms":232.7,"liveStage:Core asset:hash-verified:ms":9.7,"liveStage:Core asset:native-inflated-and-text-decoded:ms":165.4,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":279.4,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":640.2,"liveStage:Details asset:downloaded:ms":1430.8,"liveStage:Details asset:hash-verified:ms":27.8,"live…
11-23 14:21:46.729 E/unknown:ReactNative(15555): ?anon_0_@1:3692196
11-23 14:21:46.729 E/unknown:ReactNative(15555): ?anon_0_@1:3697996
11-23 14:21:46.729 E/unknown:ReactNative(15555): SyntheticError@1:162984
11-23 14:21:46.729 E/unknown:ReactNative(15555): Wrapper@1:163499
11-23 14:21:46.729 E/unknown:ReactNative(15555): _callSuper@1:148372
11-23 14:21:46.729 E/unknown:ReactNative(15555): _construct@1:163847
11-23 14:21:46.729 E/unknown:ReactNative(15555): _next@1:594835
```

### 55 audit 2 min
```
11-23 14:22:40.585 E/ReactNativeJS(15555): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtctji1-21985cacb2caeba1","check":{"id":"journey-compare-cold","label":"Product comparison (cold)","kind":"journey","status":"fail","durationMs":1774.9,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1004,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"compare","journeyLabel":"Product comparison","iteration":"cold","expectedPath":"/compare","expectedSurface":"compare.table","navigationKind":"stack","forwardMs":1004,"firstReadyFrameObserved":true,"firstReadyFrameMs":531.5051080000121,"backgroundSettleMs":560.3,"destinationReadinessMs":531.5,"backMs":45,"firstBackMs":45,"firstBackDestination":"/performance-audit","originReadinessMs":0.3,"backDestination":"/performance-audit","backChangedPath":true,"bac…
11-23 14:22:40.612 E/unknown:ReactNative(15555): ?anon_0_@1:3692196
11-23 14:22:40.612 E/unknown:ReactNative(15555): ?anon_0_@1:3697996
11-23 14:22:40.612 E/unknown:ReactNative(15555): SyntheticError@1:162984
11-23 14:22:40.612 E/unknown:ReactNative(15555): Wrapper@1:163499
11-23 14:22:40.612 E/unknown:ReactNative(15555): _callSuper@1:148372
11-23 14:22:40.612 E/unknown:ReactNative(15555): _construct@1:163847
11-23 14:22:40.612 E/unknown:ReactNative(15555): _next@1:594835
```

### 56 audit 3 min
```
11-23 14:23:51.337 E/ReactNativeJS(15555): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtctji1-21985cacb2caeba1","check":{"id":"deep-first-pass.route.rates.search.compare.open","label":"route.rates: search.compare.open (first-pass)","kind":"journey","status":"fail","durationMs":1633.4,"metrics":{"journeyId":"route.rates.search.compare.open","journeyLabel":"route.rates: search.compare.open","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.compare.open","depth":2,"plannedExpectedPath":"/compare","expectedPath":"/compare","expectedSurface":"compare.table","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":12,"actionRevisionAfter":13,"renderRevisionBefore":"state-58","actionMs":490.7,"preActionWaitMs":3.5,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"…
11-23 14:23:51.339 E/unknown:ReactNative(15555): ?anon_0_@1:3692196
11-23 14:23:51.339 E/unknown:ReactNative(15555): ?anon_0_@1:3697996
11-23 14:23:51.339 E/unknown:ReactNative(15555): SyntheticError@1:162984
11-23 14:23:51.339 E/unknown:ReactNative(15555): Wrapper@1:163499
11-23 14:23:51.339 E/unknown:ReactNative(15555): _callSuper@1:148372
11-23 14:23:51.339 E/unknown:ReactNative(15555): _construct@1:163847
11-23 14:23:51.339 E/unknown:ReactNative(15555): _next@1:594835
```

### 57 audit 4 min
```
11-23 14:25:17.208 E/ReactNativeJS(15555): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtctji1-21985cacb2caeba1","check":{"id":"deep-first-pass.sample.catalogue.0.product.open","label":"sample.catalogue.0: product.open (first-pass)","kind":"journey","status":"fail","durationMs":1943.7,"metrics":{"journeyId":"sample.catalogue.0.product.open","journeyLabel":"sample.catalogue.0: product.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.0","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Great%20Southern%20Bank%20Business%2B%7Cc6821563-815b-4e53-89cc-6054bf119647%7CTRANS_AND_SAVINGS_ACCOUNTS%7CBusiness%2B%20Saver","expectedPath":"/product/Great%20Southern%20Bank%20Business%2B%7Cc6821563-815b-4e53-89cc-6054bf119647%7CTRANS_AND_SAVINGS_ACCOUNTS%7CBusiness%2B%20Saver","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":614.9,"avoidableWaitMs":0,"minimumJustifiedActions…
11-23 14:25:17.209 E/unknown:ReactNative(15555): ?anon_0_@1:3692196
11-23 14:25:17.209 E/unknown:ReactNative(15555): ?anon_0_@1:3697996
11-23 14:25:17.209 E/unknown:ReactNative(15555): SyntheticError@1:162984
11-23 14:25:17.209 E/unknown:ReactNative(15555): Wrapper@1:163499
11-23 14:25:17.209 E/unknown:ReactNative(15555): _callSuper@1:148372
11-23 14:25:17.209 E/unknown:ReactNative(15555): _construct@1:163847
11-23 14:25:17.209 E/unknown:ReactNative(15555): _next@1:594835
```

### 58 audit 5 min
```
11-23 14:25:59.104 E/ReactNativeJS(15555): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtctji1-21985cacb2caeba1","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":2264.7,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-23:5d846c296be3…:state-8","renderRevisionAfter":"2026-11-23:5d846c296be3…:state-9","actionResultEvidence":"{\"applied\":…
11-23 14:25:59.124 E/unknown:ReactNative(15555): ?anon_0_@1:3692196
11-23 14:25:59.124 E/unknown:ReactNative(15555): ?anon_0_@1:3697996
11-23 14:25:59.124 E/unknown:ReactNative(15555): SyntheticError@1:162984
11-23 14:25:59.124 E/unknown:ReactNative(15555): Wrapper@1:163499
11-23 14:25:59.124 E/unknown:ReactNative(15555): _callSuper@1:148372
11-23 14:25:59.124 E/unknown:ReactNative(15555): _construct@1:163847
11-23 14:25:59.124 E/unknown:ReactNative(15555): _next@1:594835
```

### 59 audit 7 min
```
11-23 14:27:41.456 E/ReactNativeJS(15555): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtctji1-21985cacb2caeba1","check":{"id":"deep-first-pass.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (first-pass)","kind":"journey","status":"fail","durationMs":2953.8,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":165.5,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1419.3,"forwardWorkMs":1419.3,"navigationCommitMs":1418.8,"firstReadyFrameMs…
11-23 14:27:41.457 E/unknown:ReactNative(15555): ?anon_0_@1:3692196
11-23 14:27:41.457 E/unknown:ReactNative(15555): ?anon_0_@1:3697996
11-23 14:27:41.457 E/unknown:ReactNative(15555): SyntheticError@1:162984
11-23 14:27:41.457 E/unknown:ReactNative(15555): Wrapper@1:163499
11-23 14:27:41.457 E/unknown:ReactNative(15555): _callSuper@1:148372
11-23 14:27:41.457 E/unknown:ReactNative(15555): _construct@1:163847
11-23 14:27:41.457 E/unknown:ReactNative(15555): _next@1:594835
```

### 60 audit 8 min
```
11-23 14:28:45.988 E/ReactNativeJS(15555): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtctji1-21985cacb2caeba1","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.mortgage.scope.apply.0","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.0 (repeat)","kind":"journey","status":"fail","durationMs":9779.9,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.0","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.0","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.0","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":41,"actionRevisionAfter":42,"renderRevisionBefore":"state-8","renderRevisionAfter":"state-14","actionMs":147.5,"preActionWaitMs":0.9,"preActionQuietWindowReused":false,"preAction…
11-23 14:28:45.989 E/unknown:ReactNative(15555): ?anon_0_@1:3692196
11-23 14:28:45.989 E/unknown:ReactNative(15555): ?anon_0_@1:3697996
11-23 14:28:45.989 E/unknown:ReactNative(15555): SyntheticError@1:162984
11-23 14:28:45.989 E/unknown:ReactNative(15555): Wrapper@1:163499
11-23 14:28:45.989 E/unknown:ReactNative(15555): _callSuper@1:148372
11-23 14:28:45.989 E/unknown:ReactNative(15555): _construct@1:163847
11-23 14:28:45.989 E/unknown:ReactNative(15555): _next@1:594835
```

### 61 audit 10 min
```
11-23 14:30:52.633 E/ReactNativeJS(15555): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtctji1-21985cacb2caeba1","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":2244.5,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Great%20Southern%20Bank%20Business%2B%7Cc6821563-815b-4e53-89cc-6054bf119647%7CTRANS_AND_SAVINGS_ACCOUNTS%7CBusiness%2B%20Saver","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":1…
11-23 14:30:52.634 E/unknown:ReactNative(15555): ?anon_0_@1:3692196
11-23 14:30:52.634 E/unknown:ReactNative(15555): ?anon_0_@1:3697996
11-23 14:30:52.634 E/unknown:ReactNative(15555): SyntheticError@1:162984
11-23 14:30:52.634 E/unknown:ReactNative(15555): Wrapper@1:163499
11-23 14:30:52.634 E/unknown:ReactNative(15555): _callSuper@1:148372
11-23 14:30:52.634 E/unknown:ReactNative(15555): _construct@1:163847
11-23 14:30:52.634 E/unknown:ReactNative(15555): _next@1:594835
```

### 62 audit 11 min
```
11-23 14:32:27.341 E/ReactNativeJS(15555): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtctji1-21985cacb2caeba1","check":{"id":"deep-repeat.redirect.onboarding.redirect.onboarding.verify","label":"redirect.onboarding: redirect.onboarding.verify (repeat)","kind":"journey","status":"fail","durationMs":1431.8,"metrics":{"journeyId":"redirect.onboarding.redirect.onboarding.verify","journeyLabel":"redirect.onboarding: redirect.onboarding.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.onboarding","semanticActionId":"redirect.onboarding.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":141.8,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":542.7,"forwardWorkMs":542.7,"navigationCommitMs":37…
11-23 14:32:27.342 E/unknown:ReactNative(15555): ?anon_0_@1:3692196
11-23 14:32:27.342 E/unknown:ReactNative(15555): ?anon_0_@1:3697996
11-23 14:32:27.342 E/unknown:ReactNative(15555): SyntheticError@1:162984
11-23 14:32:27.342 E/unknown:ReactNative(15555): Wrapper@1:163499
11-23 14:32:27.342 E/unknown:ReactNative(15555): _callSuper@1:148372
11-23 14:32:27.342 E/unknown:ReactNative(15555): _construct@1:163847
11-23 14:32:27.342 E/unknown:ReactNative(15555): _next@1:594835
```

### 63 audit 12 min
```
11-23 14:33:26.022 E/ReactNativeJS(15555): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtctji1-21985cacb2caeba1","check":{"id":"external-link-382","kind":"network","status":"fail","durationMs":1363.5911640000995,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"pass","browserHandler":"pass","httpReachability":"fail","statusCode":404,"handlerAttempted":true,"httpAttempted":true,"httpSelected":true,"handlerResolution":"pass","host":"www.defencebank.com.au","destinationPath":"/banking/home-loans/essentials-home-loan---ultimate-package-investor-interest-only/"},"error":"HTTP 404: the destination is missing or unavailable.","canonicalMetrics":true}}
11-23 14:33:26.023 E/unknown:ReactNative(15555): ?anon_0_@1:3692196
11-23 14:33:26.023 E/unknown:ReactNative(15555): ?anon_0_@1:3701557
11-23 14:33:26.023 E/unknown:ReactNative(15555): SyntheticError@1:162984
11-23 14:33:26.023 E/unknown:ReactNative(15555): Wrapper@1:163499
11-23 14:33:26.023 E/unknown:ReactNative(15555): _callSuper@1:148372
11-23 14:33:26.023 E/unknown:ReactNative(15555): _construct@1:163847
11-23 14:33:26.023 E/unknown:ReactNative(15555): _next@1:594835
```
