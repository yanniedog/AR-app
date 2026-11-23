# App explorer: 1.0.359 (415)

**Real-use session ATTENTION vs 1.0.359: 0 broken, 12 friction, 16 slower**

- Friction: No reaction for 3.6 s after "scroll rates 1"
- Friction: No reaction for 3.4 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 3.0 s after "scroll lenders"
- Friction: No reaction for 4.5 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.5 s after "open filters"
- Friction: No reaction for 3.2 s after "open market"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.2 s after "scroll rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: "No saved rates" shown on "open saved"
- Slower: Dropped frames 49% to 72% on "open app"
- Slower: "open app" content 24.3 s to 41.3 s
- Slower: "open app" reaction 24.3 s to 41.3 s
- Slower: Dropped frames 44% to 78% on "scroll rates 1"
- Slower: Dropped frames 48% to 66% on "open product"
- Slower: Dropped frames 31% to 65% on "scroll product"
- Slower: Dropped frames 42% to 64% on "back to rates"
- Slower: Dropped frames 48% to 77% on "switch to savings"
- Slower: Dropped frames 35% to 61% on "switch to home loans"
- Slower: Dropped frames 45% to 78% on "open rba"
- Slower: "open rba" content 0.0 s to 2.5 s
- Slower: Dropped frames 41% to 63% on "scroll rba"
- Slower: Dropped frames 33% to 55% on "back from rba"
- Slower: Dropped frames 43% to 65% on "scroll market"
- Slower: Dropped frames 45% to 64% on "open saved"
- Slower: Dropped frames 32% to 58% on "return to rates"

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode full | 80 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 13
Baseline 1.0.359
**Audit live: outcome completed | 972 s | audit log 859038 bytes (audit-log.txt) https://paste.c-net.org/f89b8bb7-7298-3056-a187-4259c4dbbce5 | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3168 | -23493 | 705/983 | 85 | 504 | 1 errors; start 3093ms |
| 2 | scroll rates 1 | 729 | 0 | 40/51 | 77 | 590 | boot js-start 439621, layout-mounted 440361, cache-read 440517, hydrated 440711, splash-hide 440711, manifest 441797, resolved 442219, core-fetched 447262, core-saved 448286, rows-prepared 448594, search-index-idle 448594, leading-requested 448594, details-start 449076, leading-scoped 449169, pricing-ready 451229, last-gate 455916, details-fetched 461307, detail-filters-idle 469640, last-pricing 469640, suitability-built 471339, post-refresh-wait 472396, leading-page 474644, last-rows 484225, rates-ready 484424, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 205, pricing-scope-ms 15303, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 3, filter-rows 38533, filter-yields 10, filter-ms 4024, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 528 |
| 3 | scroll rates 2 | 700 | +3 | 19/34 | 105 | 653 |  |
| 4 | scroll rates back | 686 | +6 |  |  | 547 |  |
| 5 | open product | 5849 | +3126 | 37/56 | 89 | 668 |  |
| 6 | scroll product | 697 | +1 | 33/51 | 85 | 670 |  |
| 7 | back to rates | 30 | +5 | 14/22 | 81 | 637 |  |
| 8 | open lenders | 24 | +4 | 20/23 | 200 | 643 |  |
| 9 | scroll lenders | 692 | -27 | 19/21 | 121 | 641 |  |
| 10 | back from lenders | 24 | +3 | 10/10 | 105 | 642 |  |
| 11 | switch to savings | 25 | +4 | 54/70 | 81 | 656 |  |
| 12 | switch to home loans | 23 | +3 | 17/28 | 65 | 672 |  |
| 13 | open filters | 25 | +5 | 24/28 | 150 | 674 |  |
| 14 | close filters | 24 | +4 | 6/8 | 121 | 672 |  |
| 15 | open market | 26 | +6 | 17/31 | 61 | 673 |  |
| 16 | open rba | 2611 | +2590 | 50/64 | 57 | 668 |  |
| 17 | scroll rba | 708 | +29 | 27/43 | 77 | 669 |  |
| 18 | back from rba | 26 | +3 | 11/20 | 61 | 670 |  |
| 19 | scroll market | 702 | +7 | 15/23 | 89 | 670 |  |
| 20 | open saved | 23 | +4 | 14/22 | 81 | 674 |  |
| 21 | return to rates | 25 | +5 | 19/33 | 65 | 676 |  |
| 22 | cold start | 13249 | +4355 | 33/41 | 117 | 585 | 3 errors; start 4696ms; boot js-start 681372, layout-mounted 681577, hydrated 681664, cache-read 683055, core-ready 683832, rows-prepared 683956, search-index-idle 683956, detail-filters-idle 683956, leading-requested 683956, last-pricing 683956, splash-hide 683958, manifest 686356, leading-scoped 686747, leading-page 686747, resolved 687289, pricing-ready 688273, last-rows 688273, rates-ready 688474, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 25, pricing-scope-ms 1803, filter-runs 1, filter-rows 6861, filter-yields 4, filter-ms 108, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 15 |
| 23 | /browse | 29 |  | 2/2 | 32 | 424 |  |
| 24 | /watchlist | 31 |  | 3/3 | 34 | 425 |  |
| 25 | /market | 2406 |  | 13/21 | 61 | 521 |  |
| 26 | /tools | 30 |  | 14/20 | 250 | 579 |  |
| 27 | /trends | 46 |  |  |  | 613 |  |
| 28 | /search | 37 |  | 37/51 | 101 | 622 |  |
| 29 | /banks | 27 |  | 32/39 | 117 | 630 |  |
| 30 | /bank-rates | 33 |  | 20/28 | 81 | 643 |  |
| 31 | /categories | 34 |  | 36/47 | 93 | 656 |  |
| 32 | /catalogue | 34 |  | 35/42 | 125 | 668 |  |
| 33 | /compare | 27 |  | 13/15 | 133 | 658 |  |
| 34 | /matches | 35 |  | 34/42 | 89 | 679 |  |
| 35 | /calculator | 29 |  | 16/22 | 73 | 662 |  |
| 36 | /projections | 42 |  | 23/34 | 97 | 663 |  |
| 37 | /profile | 27 |  | 13/23 | 65 | 668 |  |
| 38 | /research | 32 |  | 19/28 | 73 | 677 |  |
| 39 | /rba | 32 |  | 16/23 | 81 | 691 |  |
| 40 | /rba-response | 30 |  | 20/32 | 69 | 686 |  |
| 41 | /settings | 31 |  | 13/23 | 85 | 692 |  |
| 42 | /about | 33 |  | 11/23 | 73 | 691 |  |
| 43 | /terms | 31 |  | 16/25 | 65 | 692 |  |
| 44 | /privacy | 26 |  |  |  | 691 |  |
| 45 | /third-party-notices | 23 |  | 12/23 | 57 | 695 |  |
| 46 | /node | 24 |  | 26/39 | 105 | 710 |  |
| 47 | /passthrough | 28 |  | 28/39 | 93 | 695 |  |
| 48 | /calculation-receipt | 29 |  | 15/24 | 85 | 689 |  |
| 49 | /rate-receipt | 23 |  | 8/9 | 117 | 690 |  |
| 50 | warm resume | 709 |  | 4/4 | 150 | 689 | start 353ms |
| 51 | cold relaunch | 9953 |  | 22/28 | 500 | 577 | 3 errors; start 4329ms; boot js-start 914388, layout-mounted 914613, hydrated 914651, cache-read 915932, core-ready 916681, rows-prepared 916789, search-index-idle 916789, detail-filters-idle 916789, leading-requested 916789, last-pricing 916789, splash-hide 916791, manifest 918514, leading-scoped 919086, leading-page 919086, resolved 919601, pricing-ready 920346, last-rows 920346, rates-ready 920524, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 21, pricing-scope-ms 1767, filter-runs 1, filter-rows 6861, filter-yields 4, filter-ms 100, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 14 |
| 52 | about | 33 | +3 | 12/19 | 250 | 605 |  |
| 53 | audit screen | 21 | +2 | 114/202 | 69 | 586 |  |
| 54 | audit 0 min | 0 | 0 | 445/501 | 117 | 730 | 80 errors |
| 55 | audit 2 min | 0 | 0 | 820/958 | 113 | 1005 | 80 errors |
| 56 | audit 3 min | 0 | 0 | 619/730 | 109 | 1061 | 80 errors |
| 57 | audit 4 min | 0 |  | 366/407 | 105 | 1175 | 80 errors |
| 58 | audit 6 min | 0 |  | 1258/1436 | 113 | 1148 | 80 errors |
| 59 | audit 7 min | 0 | 0 | 756/851 | 113 | 1261 | 80 errors |
| 60 | audit 9 min | 0 |  | 224/261 | 105 | 1304 | 80 errors |
| 61 | audit 10 min | 0 | 0 | 944/1083 | 113 | 1334 | 80 errors |
| 62 | audit 11 min | 0 | 0 | 168/188 | 105 | 1338 | 80 errors |
| 63 | audit 12 min | 0 |  | 139/174 | 36 | 1367 | 19 errors |
| 64 | audit 14 min | 0 |  | 147/174 | 34 | 1394 |  |
| 65 | audit 15 min | 0 |  | 59/72 | 73 | 1223 |  |
| 66 | audit finished | 0 | 0 | 114/197 | 69 | 1348 |  |
| 67 | audit result 1 | 0 | 0 |  |  | 1348 |  |
| 68 | audit result 2 | 0 | 0 |  |  | 1346 |  |
| 69 | audit result 3 | 0 | 0 |  |  | 1349 |  |
| 70 | audit result 4 | 0 | 0 |  |  | 1347 |  |
| 71 | audit result 5 | 0 | 0 |  |  | 1347 |  |
| 72 | audit result 6 | 0 | 0 |  |  | 1350 |  |
| 73 | audit result 7 | 0 | 0 |  |  | 1348 |  |
| 74 | audit result 8 | 0 | 0 |  |  | 1352 |  |
| 75 | audit result 9 | 0 | 0 |  |  | 1351 |  |
| 76 | audit result 10 | 0 | 0 |  |  | 1352 |  |
| 77 | audit result 11 | 0 | 0 |  |  | 1354 |  |
| 78 | audit result 12 | 0 | 0 |  |  | 1352 |  |
| 79 | about for debug log | 4305 | +705 | 22/36 | 73 | 1218 |  |
| 80 | debug log screen | 0 | 0 | 102/196 | 61 | 1223 |  |

## Errors

### 1 open app
```
11-23 18:52:26.756 E/australianrates(10529): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-23 18:56:29.311 E/australianrates(12816): Not starting debugger since process cannot load the jdwp agent.
11-23 18:56:33.721 E/SurfaceSyncGroup(12816): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-23 18:56:33.722 E/SurfaceSyncGroup(12816): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 51 cold relaunch
```
11-23 19:00:22.464 E/australianrates(15855): Not starting debugger since process cannot load the jdwp agent.
11-23 19:00:26.568 E/SurfaceSyncGroup(15855): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-23 19:00:26.569 E/SurfaceSyncGroup(15855): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 54 audit 0 min
```
11-23 19:01:31.846 E/ReactNativeJS(15855): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtmtb04-587eed4772a10227","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":5257.7,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":216.6,"liveStage:dates-index:fetched:ms":268.3,"liveStage:revision:verified:ms":72.3,"liveStage:Core asset:downloaded:ms":237.2,"liveStage:Core asset:hash-verified:ms":4.7,"liveStage:Core asset:native-inflated-and-text-decoded:ms":163.8,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":260,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":643.5,"liveStage:Details asset:downloaded:ms":1421.4,"liveStage:Details asset:hash-verified:ms":21.5,"liveSt…
11-23 19:01:31.847 E/unknown:ReactNative(15855): ?anon_0_@1:3693367
11-23 19:01:31.847 E/unknown:ReactNative(15855): ?anon_0_@1:3699167
11-23 19:01:31.847 E/unknown:ReactNative(15855): SyntheticError@1:163016
11-23 19:01:31.847 E/unknown:ReactNative(15855): Wrapper@1:163531
11-23 19:01:31.847 E/unknown:ReactNative(15855): _callSuper@1:148404
11-23 19:01:31.847 E/unknown:ReactNative(15855): _construct@1:163879
11-23 19:01:31.847 E/unknown:ReactNative(15855): _next@1:594867
```

### 55 audit 2 min
```
11-23 19:02:19.631 E/ReactNativeJS(15855): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtmtb04-587eed4772a10227","check":{"id":"journey-product-cold","label":"Product details (cold)","kind":"journey","status":"fail","durationMs":1677.7,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":663.1,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"product","journeyLabel":"Product details","iteration":"cold","expectedPath":"/product/ING%20BANK%20(Australia)%20Ltd%7C2aeb8d10-5633-4c68-a1e5-0cd1e4ed7b1a%7CTRANS_AND_SAVINGS_ACCOUNTS%7CBusiness%20Optimiser","expectedSurface":"product.details","navigationKind":"stack","forwardMs":663.1,"firstReadyFrameObserved":true,"firstReadyFrameMs":463.5257950000232,"backgroundSettleMs":716.3,"destinationReadinessMs":463.5,"backgroundTasks":"Bank response analysis",…
11-23 19:02:19.639 E/unknown:ReactNative(15855): ?anon_0_@1:3693367
11-23 19:02:19.639 E/unknown:ReactNative(15855): ?anon_0_@1:3699167
11-23 19:02:19.639 E/unknown:ReactNative(15855): SyntheticError@1:163016
11-23 19:02:19.639 E/unknown:ReactNative(15855): Wrapper@1:163531
11-23 19:02:19.639 E/unknown:ReactNative(15855): _callSuper@1:148404
11-23 19:02:19.639 E/unknown:ReactNative(15855): _construct@1:163879
11-23 19:02:19.639 E/unknown:ReactNative(15855): _next@1:594867
```

### 56 audit 3 min
```
11-23 19:03:58.512 E/ReactNativeJS(15855): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtmtb04-587eed4772a10227","check":{"id":"deep-first-pass.route.rates-mortgage-scope.search.mortgage.scope.apply.0","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.0 (first-pass)","kind":"journey","status":"fail","durationMs":8219.5,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.0","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.0","iteration":"cold","passId":"first-pass","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.0","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":19,"actionRevisionAfter":20,"renderRevisionBefore":"state-9","renderRevisionAfter":"state-15","actionMs":181.5,"preActionWaitMs":0.9,"preActionQuietWindowReused":true…
11-23 19:03:58.513 E/unknown:ReactNative(15855): ?anon_0_@1:3693367
11-23 19:03:58.513 E/unknown:ReactNative(15855): ?anon_0_@1:3699167
11-23 19:03:58.513 E/unknown:ReactNative(15855): SyntheticError@1:163016
11-23 19:03:58.513 E/unknown:ReactNative(15855): Wrapper@1:163531
11-23 19:03:58.513 E/unknown:ReactNative(15855): _callSuper@1:148404
11-23 19:03:58.513 E/unknown:ReactNative(15855): _construct@1:163879
11-23 19:03:58.513 E/unknown:ReactNative(15855): _next@1:594867
```

### 57 audit 4 min
```
11-23 19:04:59.822 E/ReactNativeJS(15855): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtmtb04-587eed4772a10227","check":{"id":"deep-first-pass.sample.catalogue.1.product.open","label":"sample.catalogue.1: product.open (first-pass)","kind":"journey","status":"fail","durationMs":1804.9,"metrics":{"journeyId":"sample.catalogue.1.product.open","journeyLabel":"sample.catalogue.1: product.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.1","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/First%20Option%20Bank%7CBONUS_SAVER%7CTRANS_AND_SAVINGS_ACCOUNTS%7CBonus%20Saver","expectedPath":"/product/First%20Option%20Bank%7CBONUS_SAVER%7CTRANS_AND_SAVINGS_ACCOUNTS%7CBonus%20Saver","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":443.1,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"…
11-23 19:04:59.824 E/unknown:ReactNative(15855): ?anon_0_@1:3693367
11-23 19:04:59.824 E/unknown:ReactNative(15855): ?anon_0_@1:3699167
11-23 19:04:59.824 E/unknown:ReactNative(15855): SyntheticError@1:163016
11-23 19:04:59.824 E/unknown:ReactNative(15855): Wrapper@1:163531
11-23 19:04:59.824 E/unknown:ReactNative(15855): _callSuper@1:148404
11-23 19:04:59.824 E/unknown:ReactNative(15855): _construct@1:163879
11-23 19:04:59.824 E/unknown:ReactNative(15855): _next@1:594867
```

### 58 audit 6 min
```
11-23 19:05:48.138 E/ReactNativeJS(15855): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtmtb04-587eed4772a10227","check":{"id":"deep-first-pass.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (first-pass)","kind":"journey","status":"fail","durationMs":1506,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/ING%20BANK%20(Australia)%20Ltd%7C2aeb8d10-5633-4c68-a1e5-0cd1e4ed7b1a%7CTRANS_AND_SAVINGS_ACCOUNTS%7CBusiness%20Optimiser","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefor…
11-23 19:05:48.139 E/unknown:ReactNative(15855): ?anon_0_@1:3693367
11-23 19:05:48.139 E/unknown:ReactNative(15855): ?anon_0_@1:3699167
11-23 19:05:48.139 E/unknown:ReactNative(15855): SyntheticError@1:163016
11-23 19:05:48.139 E/unknown:ReactNative(15855): Wrapper@1:163531
11-23 19:05:48.139 E/unknown:ReactNative(15855): _callSuper@1:148404
11-23 19:05:48.139 E/unknown:ReactNative(15855): _construct@1:163879
11-23 19:05:48.139 E/unknown:ReactNative(15855): _next@1:594867
```

### 59 audit 7 min
```
11-23 19:08:23.790 E/ReactNativeJS(15855): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtmtb04-587eed4772a10227","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.mortgage.scope.apply.0","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.0 (repeat)","kind":"journey","status":"fail","durationMs":8197.6,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.0","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.0","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.0","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":41,"actionRevisionAfter":42,"renderRevisionBefore":"state-8","renderRevisionAfter":"state-14","actionMs":129.5,"preActionWaitMs":0.9,"preActionQuietWindowReused":false,"preAction…
11-23 19:08:23.791 E/unknown:ReactNative(15855): ?anon_0_@1:3693367
11-23 19:08:23.791 E/unknown:ReactNative(15855): ?anon_0_@1:3699167
11-23 19:08:23.791 E/unknown:ReactNative(15855): SyntheticError@1:163016
11-23 19:08:23.791 E/unknown:ReactNative(15855): Wrapper@1:163531
11-23 19:08:23.791 E/unknown:ReactNative(15855): _callSuper@1:148404
11-23 19:08:23.791 E/unknown:ReactNative(15855): _construct@1:163879
11-23 19:08:23.791 E/unknown:ReactNative(15855): _next@1:594867
```

### 60 audit 9 min
```
11-23 19:09:41.163 E/ReactNativeJS(15855): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtmtb04-587eed4772a10227","check":{"id":"deep-repeat.sample.catalogue.2.product.lender.open","label":"sample.catalogue.2: product.lender.open (repeat)","kind":"journey","status":"fail","durationMs":1616.2,"metrics":{"journeyId":"sample.catalogue.2.product.lender.open","journeyLabel":"sample.catalogue.2: product.lender.open","iteration":"warm","passId":"repeat","scenarioId":"sample.catalogue.2","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/RSL%20Money","expectedPath":"/bank/RSL%20Money","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":20,"actionRevisionAfter":21,"actionResultEvidence":"{\"expectedPath\":\"/bank/RSL%20Money\"}","actionMs":279.8,"preActionWaitMs":1.2,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActio…
11-23 19:09:41.165 E/unknown:ReactNative(15855): ?anon_0_@1:3693367
11-23 19:09:41.165 E/unknown:ReactNative(15855): ?anon_0_@1:3699167
11-23 19:09:41.165 E/unknown:ReactNative(15855): SyntheticError@1:163016
11-23 19:09:41.165 E/unknown:ReactNative(15855): Wrapper@1:163531
11-23 19:09:41.165 E/unknown:ReactNative(15855): _callSuper@1:148404
11-23 19:09:41.165 E/unknown:ReactNative(15855): _construct@1:163879
11-23 19:09:41.165 E/unknown:ReactNative(15855): _next@1:594867
```

### 61 audit 10 min
```
11-23 19:10:24.708 E/ReactNativeJS(15855): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtmtb04-587eed4772a10227","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1704.2,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/ING%20BANK%20(Australia)%20Ltd%7C2aeb8d10-5633-4c68-a1e5-0cd1e4ed7b1a%7CTRANS_AND_SAVINGS_ACCOUNTS%7CBusiness%20Optimiser","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"act…
11-23 19:10:24.709 E/unknown:ReactNative(15855): ?anon_0_@1:3693367
11-23 19:10:24.709 E/unknown:ReactNative(15855): ?anon_0_@1:3699167
11-23 19:10:24.709 E/unknown:ReactNative(15855): SyntheticError@1:163016
11-23 19:10:24.709 E/unknown:ReactNative(15855): Wrapper@1:163531
11-23 19:10:24.709 E/unknown:ReactNative(15855): _callSuper@1:148404
11-23 19:10:24.709 E/unknown:ReactNative(15855): _construct@1:163879
11-23 19:10:24.709 E/unknown:ReactNative(15855): _next@1:594867
```

### 62 audit 11 min
```
11-23 19:12:01.727 E/ReactNativeJS(15855): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtmtb04-587eed4772a10227","check":{"id":"deep-repeat.redirect.trends.redirect.trends.verify","label":"redirect.trends: redirect.trends.verify (repeat)","kind":"journey","status":"fail","durationMs":1428.8,"metrics":{"journeyId":"redirect.trends.redirect.trends.verify","journeyLabel":"redirect.trends: redirect.trends.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.trends","semanticActionId":"redirect.trends.verify","depth":1,"plannedExpectedPath":"/research","expectedPath":"/research","expectedSurface":"outlook.dashboard","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":156.7,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":610.3,"forwardWorkMs":610.3,"navigationCommitMs":0,"firstReadyFrameMs":610.3,"first…
11-23 19:12:01.728 E/unknown:ReactNative(15855): ?anon_0_@1:3693367
11-23 19:12:01.728 E/unknown:ReactNative(15855): ?anon_0_@1:3699167
11-23 19:12:01.728 E/unknown:ReactNative(15855): SyntheticError@1:163016
11-23 19:12:01.728 E/unknown:ReactNative(15855): Wrapper@1:163531
11-23 19:12:01.728 E/unknown:ReactNative(15855): _callSuper@1:148404
11-23 19:12:01.728 E/unknown:ReactNative(15855): _construct@1:163879
11-23 19:12:01.728 E/unknown:ReactNative(15855): _next@1:594867
```

### 63 audit 12 min
```
11-23 19:12:52.904 E/ReactNativeJS(15855): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtmtb04-587eed4772a10227","check":{"id":"external-link-367","kind":"network","status":"fail","durationMs":937.5638850000687,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"pass","browserHandler":"pass","httpReachability":"fail","statusCode":404,"handlerAttempted":true,"httpAttempted":true,"httpSelected":true,"handlerResolution":"pass","host":"www.defencebank.com.au","destinationPath":"/banking/home-loans/essentials-home-loan---ultimate-package-investor-interest-only/"},"error":"HTTP 404: the destination is missing or unavailable.","canonicalMetrics":true}}
11-23 19:12:52.907 E/unknown:ReactNative(15855): ?anon_0_@1:3693367
11-23 19:12:52.907 E/unknown:ReactNative(15855): ?anon_0_@1:3702728
11-23 19:12:52.907 E/unknown:ReactNative(15855): SyntheticError@1:163016
11-23 19:12:52.907 E/unknown:ReactNative(15855): Wrapper@1:163531
11-23 19:12:52.907 E/unknown:ReactNative(15855): _callSuper@1:148404
11-23 19:12:52.907 E/unknown:ReactNative(15855): _construct@1:163879
11-23 19:12:52.907 E/unknown:ReactNative(15855): _next@1:594867
```
