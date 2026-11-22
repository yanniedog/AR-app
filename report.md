# App explorer: 1.0.353 (409)

**Real-use session FAIL vs 1.0.352: 1 broken, 14 friction, 7 slower**

- Broken: 96% dropped frames on "open filters"
- Friction: No reaction for 4.0 s after "scroll rates 1"
- Friction: No reaction for 3.4 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 3.4 s after "scroll lenders"
- Friction: No reaction for 5.3 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.6 s after "open filters"
- Friction: No reaction for 3.2 s after "open market"
- Friction: No reaction for 3.5 s after "open rba"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.3 s after "scroll rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Slower: Dropped frames 65% to 81% on "open app"
- Slower: Dropped frames 58% to 78% on "scroll rates 1"
- Slower: Dropped frames 59% to 87% on "scroll rates 2"
- Slower: Dropped frames 48% to 77% on "scroll product"
- Slower: Dropped frames 52% to 71% on "back to rates"
- Slower: Dropped frames 62% to 80% on "switch to savings"
- Slower: Dropped frames 55% to 71% on "open rba"

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode full | 79 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 11
Baseline 1.0.352
**Audit live: outcome completed | 974 s | audit log 858318 bytes (audit-log.txt) https://paste.c-net.org/2fec9f36-9758-a327-bc04-05dc44f86a9b | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3003 |  | 674/829 | 97 | 496 | 1 errors; start 2912ms |
| 2 | scroll rates 1 | 703 |  | 43/55 | 89 | 586 | boot js-start 444356, layout-mounted 444934, cache-read 445077, hydrated 445308, splash-hide 445308, manifest 446541, resolved 447111, core-fetched 453728, core-saved 454685, rows-prepared 454940, search-index-idle 454940, leading-requested 454940, details-start 455510, leading-scoped 455878, pricing-ready 457236, last-gate 461145, details-fetched 466102, detail-filters-idle 473726, last-pricing 473726, suitability-built 475100, post-refresh-wait 475759, leading-page 477522, last-rows 485588, rates-ready 485758, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 174, pricing-scope-ms 12201, leading-short 1, leading-short-rows 0, leading-scope-rows 113, leading-visible-rows 0, leading-nonstd-rows 10, filter-runs 3, filter-rows 38576, filter-yields 7, filter-ms 1941, sort-runs 5, sort-rows 1182, sort-yields 5, sort-ms 2535 |
| 3 | scroll rates 2 | 714 |  | 26/30 | 113 | 675 |  |
| 4 | scroll rates back | 682 |  |  |  | 547 |  |
| 5 | open product | 5798 |  | 38/56 | 101 | 661 |  |
| 6 | scroll product | 693 |  | 36/47 | 85 | 654 |  |
| 7 | back to rates | 29 |  | 15/21 | 97 | 660 |  |
| 8 | open lenders | 33 |  | 21/23 | 200 | 654 |  |
| 9 | scroll lenders | 814 |  | 18/20 | 150 | 652 |  |
| 10 | back from lenders | 27 |  | 7/8 | 200 | 653 |  |
| 11 | switch to savings | 33 |  | 74/93 | 97 | 668 |  |
| 12 | switch to home loans | 34 |  | 17/28 | 65 | 683 |  |
| 13 | open filters | 28 |  | 23/24 | 133 | 684 |  |
| 14 | close filters | 27 |  | 6/7 | 150 | 686 |  |
| 15 | open market | 26 |  | 20/29 | 89 | 685 |  |
| 16 | open rba | 30 |  | 40/56 | 73 | 679 |  |
| 17 | scroll rba | 746 |  | 26/39 | 97 | 680 |  |
| 18 | back from rba | 28 |  | 12/18 | 65 | 681 |  |
| 19 | scroll market | 698 |  | 27/37 | 89 | 680 |  |
| 20 | open saved | 33 |  | 16/24 | 77 | 686 |  |
| 21 | return to rates | 27 |  | 18/29 | 81 | 687 |  |
| 22 | cold start | 10448 | -1405 | 31/37 | 101 | 588 | 1 errors; start 4191ms; boot js-start 687002, layout-mounted 687196, hydrated 687325, cache-read 688599, core-ready 689240, rows-prepared 689357, search-index-idle 689357, detail-filters-idle 689357, leading-requested 689357, last-pricing 689357, splash-hide 689359, manifest 691578, leading-scoped 691999, leading-page 691999, resolved 692436, pricing-ready 693297, last-rows 693297, rates-ready 693502, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 22, pricing-scope-ms 1597, filter-runs 1, filter-rows 6878, filter-yields 5, filter-ms 130, sort-runs 1, sort-rows 1182, sort-yields 1, sort-ms 13 |
| 23 | /browse | 4650 | +4590 | 2/2 | 48 | 439 |  |
| 24 | /watchlist | 34 | -21 | 3/5 | 34 | 520 |  |
| 25 | /market | 31 | -2257 | 13/19 | 65 | 593 |  |
| 26 | /tools | 4542 | +4489 | 14/20 | 200 | 610 |  |
| 27 | /trends | 31 | +5 | 26/35 | 113 | 602 |  |
| 28 | /search | 30 | +3 | 27/32 | 150 | 621 |  |
| 29 | /banks | 27 | -7 | 38/43 | 133 | 635 |  |
| 30 | /bank-rates | 32 | +7 | 19/31 | 85 | 649 |  |
| 31 | /categories | 35 | +13 | 36/44 | 117 | 664 |  |
| 32 | /catalogue | 43 | +4 | 31/35 | 150 | 679 |  |
| 33 | /compare | 38 | -1 | 9/13 | 150 | 673 |  |
| 34 | /matches | 37 | +4 | 34/44 | 105 | 687 |  |
| 35 | /calculator | 41 | +16 | 19/23 | 77 | 681 |  |
| 36 | /projections | 34 | +11 | 29/37 | 101 | 678 |  |
| 37 | /profile | 38 | +11 | 16/22 | 77 | 684 |  |
| 38 | /research | 37 | +12 | 20/29 | 85 | 695 |  |
| 39 | /rba | 42 | +21 | 19/23 | 109 | 706 |  |
| 40 | /rba-response | 35 | +8 | 14/22 | 97 | 709 |  |
| 41 | /settings | 37 | +9 | 13/22 | 93 | 719 |  |
| 42 | /about | 36 | +14 | 15/23 | 109 | 719 |  |
| 43 | /terms | 34 | +10 | 15/21 | 89 | 722 |  |
| 44 | /privacy | 34 | +12 |  |  | 722 |  |
| 45 | /third-party-notices | 38 | +13 | 15/23 | 73 | 729 |  |
| 46 | /node | 42 | +17 | 35/43 | 109 | 769 |  |
| 47 | /passthrough | 41 | +12 | 29/38 | 101 | 758 |  |
| 48 | /calculation-receipt | 31 | +2 | 17/26 | 77 | 735 |  |
| 49 | /rate-receipt | 33 | +10 | 6/8 | 40 | 736 |  |
| 50 | warm resume | 374 | +127 | 5/5 | 250 | 735 |  |
| 51 | cold relaunch | 10203 | -2724 | 29/38 | 450 | 578 | 1 errors; start 4488ms; boot js-start 933133, layout-mounted 933343, hydrated 933456, cache-read 934768, core-ready 935439, rows-prepared 935553, search-index-idle 935553, detail-filters-idle 935553, leading-requested 935553, last-pricing 935553, splash-hide 935554, leading-scoped 937699, leading-page 937699, manifest 937896, resolved 938289, pricing-ready 939070, last-rows 939070, rates-ready 939248, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 26, pricing-scope-ms 2059, filter-runs 1, filter-rows 6878, filter-yields 4, filter-ms 92, sort-runs 1, sort-rows 1182, sort-yields 1, sort-ms 15 |
| 52 | about | 42 |  | 13/19 | 250 | 409 |  |
| 53 | audit screen | 27 |  | 122/188 | 73 | 605 |  |
| 54 | audit 0 min | 0 |  | 464/511 | 129 | 739 | 80 errors |
| 55 | audit 2 min | 0 |  | 854/928 | 129 | 975 | 80 errors |
| 56 | audit 4 min | 0 |  | 817/913 | 125 | 1112 | 80 errors |
| 57 | audit 5 min | 0 |  | 1054/1190 | 121 | 1241 | 80 errors |
| 58 | audit 7 min | 0 |  | 694/757 | 133 | 1189 | 80 errors |
| 59 | audit 9 min | 0 |  | 481/541 | 117 | 1233 | 80 errors |
| 60 | audit 10 min | 0 |  | 865/973 | 125 | 1321 | 80 errors |
| 61 | audit 11 min | 0 |  | 400/441 | 133 | 1397 | 80 errors |
| 62 | audit 13 min | 0 |  | 152/171 | 40 | 1219 |  |
| 63 | audit 14 min | 0 |  | 163/185 | 42 | 1231 |  |
| 64 | audit 16 min | 0 |  | 58/68 | 77 | 1213 |  |
| 65 | audit finished | 0 |  | 128/184 | 81 | 1201 |  |
| 66 | audit result 1 | 0 |  |  |  | 1183 |  |
| 67 | audit result 2 | 0 |  |  |  | 1181 |  |
| 68 | audit result 3 | 0 |  |  |  | 1183 |  |
| 69 | audit result 4 | 0 |  |  |  | 1181 |  |
| 70 | audit result 5 | 0 |  |  |  | 1184 |  |
| 71 | audit result 6 | 0 |  |  |  | 1183 |  |
| 72 | audit result 7 | 0 |  |  |  | 1184 |  |
| 73 | audit result 8 | 0 |  |  |  | 1185 |  |
| 74 | audit result 9 | 0 |  |  |  | 1183 |  |
| 75 | audit result 10 | 0 |  |  |  | 1183 |  |
| 76 | audit result 11 | 0 |  |  |  | 1186 |  |
| 77 | audit result 12 | 0 |  |  |  | 1184 |  |
| 78 | about for debug log | 3193 |  | 22/35 | 61 | 1225 |  |
| 79 | debug log screen | 0 |  | 116/186 | 69 | 1233 |  |

## Fatal lines
```
56 E/AndroidRuntime(16972): FATAL EXCEPTION: UiAutomation
```

## Errors

### 1 open app
```
11-22 09:23:03.314 E/australianrates(10447): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-22 09:27:07.122 E/australianrates(12702): Not starting debugger since process cannot load the jdwp agent.
```

### 51 cold relaunch
```
11-22 09:31:12.834 E/australianrates(15724): Not starting debugger since process cannot load the jdwp agent.
```

### 54 audit 0 min
```
11-22 09:32:22.303 E/ReactNativeJS(15724): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrn1iy7-0507b0ed472b6279","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":4701.2,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":131.8,"liveStage:dates-index:fetched:ms":217.5,"liveStage:revision:verified:ms":55.6,"liveStage:Core asset:downloaded:ms":204.3,"liveStage:Core asset:hash-verified:ms":21.9,"liveStage:Core asset:native-inflated-and-text-decoded:ms":230.3,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":257.7,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":714.4,"liveStage:Details asset:downloaded:ms":1066.7,"liveStage:Details asset:hash-verified:ms":30.5,"liv…
11-22 09:32:22.305 E/unknown:ReactNative(15724): ?anon_0_@1:3691375
11-22 09:32:22.305 E/unknown:ReactNative(15724): ?anon_0_@1:3697175
11-22 09:32:22.305 E/unknown:ReactNative(15724): SyntheticError@1:162984
11-22 09:32:22.305 E/unknown:ReactNative(15724): Wrapper@1:163499
11-22 09:32:22.305 E/unknown:ReactNative(15724): _callSuper@1:148372
11-22 09:32:22.305 E/unknown:ReactNative(15724): _construct@1:163847
11-22 09:32:22.305 E/unknown:ReactNative(15724): _next@1:594835
```

### 55 audit 2 min
```
11-22 09:33:15.139 E/ReactNativeJS(15724): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrn1iy7-0507b0ed472b6279","check":{"id":"journey-compare-cold","label":"Product comparison (cold)","kind":"journey","status":"fail","durationMs":1415.5,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":601.1,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"compare","journeyLabel":"Product comparison","iteration":"cold","expectedPath":"/compare","expectedSurface":"compare.table","navigationKind":"stack","forwardMs":601.1,"firstReadyFrameObserved":true,"firstReadyFrameMs":419.9975229999982,"backgroundSettleMs":483.1,"destinationReadinessMs":420,"backMs":41.1,"firstBackMs":41.1,"firstBackDestination":"/performance-audit","originReadinessMs":0.5,"backDestination":"/performance-audit","backChangedPath":true,…
11-22 09:33:15.141 E/unknown:ReactNative(15724): ?anon_0_@1:3691375
11-22 09:33:15.141 E/unknown:ReactNative(15724): ?anon_0_@1:3697175
11-22 09:33:15.141 E/unknown:ReactNative(15724): SyntheticError@1:162984
11-22 09:33:15.141 E/unknown:ReactNative(15724): Wrapper@1:163499
11-22 09:33:15.141 E/unknown:ReactNative(15724): _callSuper@1:148372
11-22 09:33:15.141 E/unknown:ReactNative(15724): _construct@1:163847
11-22 09:33:15.141 E/unknown:ReactNative(15724): _next@1:594835
```

### 56 audit 4 min
```
11-22 09:34:57.152 E/ReactNativeJS(15724): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrn1iy7-0507b0ed472b6279","check":{"id":"deep-first-pass.route.rates-mortgage-scope.search.mortgage.scope.apply.1","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.1 (first-pass)","kind":"journey","status":"fail","durationMs":10295,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.1","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.1","iteration":"cold","passId":"first-pass","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.1","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":20,"actionRevisionAfter":21,"renderRevisionBefore":"state-14","renderRevisionAfter":"state-20","actionMs":134.8,"preActionWaitMs":1,"preActionQuietWindowReused":true,"…
11-22 09:34:57.153 E/unknown:ReactNative(15724): ?anon_0_@1:3691375
11-22 09:34:57.153 E/unknown:ReactNative(15724): ?anon_0_@1:3697175
11-22 09:34:57.153 E/unknown:ReactNative(15724): SyntheticError@1:162984
11-22 09:34:57.153 E/unknown:ReactNative(15724): Wrapper@1:163499
11-22 09:34:57.153 E/unknown:ReactNative(15724): _callSuper@1:148372
11-22 09:34:57.153 E/unknown:ReactNative(15724): _construct@1:163847
11-22 09:34:57.153 E/unknown:ReactNative(15724): _next@1:594835
```

### 57 audit 5 min
```
11-22 09:36:13.261 E/ReactNativeJS(15724): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrn1iy7-0507b0ed472b6279","check":{"id":"deep-first-pass.sample.catalogue.3.product.lender.open","label":"sample.catalogue.3: product.lender.open (first-pass)","kind":"journey","status":"fail","durationMs":3005,"metrics":{"journeyId":"sample.catalogue.3.product.lender.open","journeyLabel":"sample.catalogue.3: product.lender.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.3","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/BNK%20Bank%20(Goldfields%20Money_BCHL)","expectedPath":"/bank/BNK%20Bank%20(Goldfields%20Money_BCHL)","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":8,"actionRevisionAfter":9,"actionResultEvidence":"{\"expectedPath\":\"/bank/BNK%20Bank%20(Goldfields%20Money_BCHL)\"}","actionMs":1178.5,"preActionWaitMs":1.5,"preActionQuietWindowR…
11-22 09:36:13.263 E/unknown:ReactNative(15724): ?anon_0_@1:3691375
11-22 09:36:13.263 E/unknown:ReactNative(15724): ?anon_0_@1:3697175
11-22 09:36:13.263 E/unknown:ReactNative(15724): SyntheticError@1:162984
11-22 09:36:13.263 E/unknown:ReactNative(15724): Wrapper@1:163499
11-22 09:36:13.263 E/unknown:ReactNative(15724): _callSuper@1:148372
11-22 09:36:13.263 E/unknown:ReactNative(15724): _construct@1:163847
11-22 09:36:13.263 E/unknown:ReactNative(15724): _next@1:594835
```

### 58 audit 7 min
```
11-22 09:38:25.136 E/ReactNativeJS(15724): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrn1iy7-0507b0ed472b6279","check":{"id":"deep-first-pass.redirect.projections.redirect.projections.verify","label":"redirect.projections: redirect.projections.verify (first-pass)","kind":"journey","status":"fail","durationMs":3819.6,"metrics":{"journeyId":"redirect.projections.redirect.projections.verify","journeyLabel":"redirect.projections: redirect.projections.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.projections","semanticActionId":"redirect.projections.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"projections.inputs","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":869.9,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":170.8,"forwardWo…
11-22 09:38:25.164 E/unknown:ReactNative(15724): ?anon_0_@1:3691375
11-22 09:38:25.164 E/unknown:ReactNative(15724): ?anon_0_@1:3697175
11-22 09:38:25.164 E/unknown:ReactNative(15724): SyntheticError@1:162984
11-22 09:38:25.164 E/unknown:ReactNative(15724): Wrapper@1:163499
11-22 09:38:25.164 E/unknown:ReactNative(15724): _callSuper@1:148372
11-22 09:38:25.164 E/unknown:ReactNative(15724): _construct@1:163847
11-22 09:38:25.164 E/unknown:ReactNative(15724): _next@1:594835
```

### 59 audit 9 min
```
11-22 09:40:07.287 E/ReactNativeJS(15724): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrn1iy7-0507b0ed472b6279","check":{"id":"deep-repeat.route.product.product.open","label":"route.product: product.open (repeat)","kind":"journey","status":"fail","durationMs":2286.1,"metrics":{"journeyId":"route.product.product.open","journeyLabel":"route.product: product.open","iteration":"warm","passId":"repeat","scenarioId":"route.product","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/HSBC%20Bank%20Australia%20Limited%20%E2%80%93%20Wholesale%20Banking%7CND3%7CTERM_DEPOSITS%7C31%20Day%20Notice%20Account","expectedPath":"/product/HSBC%20Bank%20Australia%20Limited%20%E2%80%93%20Wholesale%20Banking%7CND3%7CTERM_DEPOSITS%7C31%20Day%20Notice%20Account","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":621.3,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailur…
11-22 09:40:07.289 E/unknown:ReactNative(15724): ?anon_0_@1:3691375
11-22 09:40:07.289 E/unknown:ReactNative(15724): ?anon_0_@1:3697175
11-22 09:40:07.289 E/unknown:ReactNative(15724): SyntheticError@1:162984
11-22 09:40:07.289 E/unknown:ReactNative(15724): Wrapper@1:163499
11-22 09:40:07.289 E/unknown:ReactNative(15724): _callSuper@1:148372
11-22 09:40:07.289 E/unknown:ReactNative(15724): _construct@1:163847
11-22 09:40:07.289 E/unknown:ReactNative(15724): _next@1:594835
```

### 60 audit 10 min
```
11-22 09:40:48.470 E/ReactNativeJS(15724): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrn1iy7-0507b0ed472b6279","check":{"id":"deep-repeat.sample.catalogue.3.product.lender.open","label":"sample.catalogue.3: product.lender.open (repeat)","kind":"journey","status":"fail","durationMs":2616.9,"metrics":{"journeyId":"sample.catalogue.3.product.lender.open","journeyLabel":"sample.catalogue.3: product.lender.open","iteration":"warm","passId":"repeat","scenarioId":"sample.catalogue.3","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/BNK%20Bank%20(Goldfields%20Money_BCHL)","expectedPath":"/bank/BNK%20Bank%20(Goldfields%20Money_BCHL)","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":21,"actionRevisionAfter":22,"actionResultEvidence":"{\"expectedPath\":\"/bank/BNK%20Bank%20(Goldfields%20Money_BCHL)\"}","actionMs":970.3,"preActionWaitMs":2.2,"preActionQuietWindowReused":tr…
11-22 09:40:48.474 E/unknown:ReactNative(15724): ?anon_0_@1:3691375
11-22 09:40:48.474 E/unknown:ReactNative(15724): ?anon_0_@1:3697175
11-22 09:40:48.474 E/unknown:ReactNative(15724): SyntheticError@1:162984
11-22 09:40:48.474 E/unknown:ReactNative(15724): Wrapper@1:163499
11-22 09:40:48.474 E/unknown:ReactNative(15724): _callSuper@1:148372
11-22 09:40:48.474 E/unknown:ReactNative(15724): _construct@1:163847
11-22 09:40:48.474 E/unknown:ReactNative(15724): _next@1:594835
```

### 61 audit 11 min
```
11-22 09:42:50.497 E/ReactNativeJS(15724): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrn1iy7-0507b0ed472b6279","check":{"id":"deep-repeat.redirect.categories.redirect.categories.verify","label":"redirect.categories: redirect.categories.verify (repeat)","kind":"journey","status":"fail","durationMs":2389.2,"metrics":{"journeyId":"redirect.categories.redirect.categories.verify","journeyLabel":"redirect.categories: redirect.categories.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.categories","semanticActionId":"redirect.categories.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":53.8,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1590.1,"forwardWorkMs":1590.1,"navigationCommitMs":1…
11-22 09:42:50.503 E/unknown:ReactNative(15724): ?anon_0_@1:3691375
11-22 09:42:50.503 E/unknown:ReactNative(15724): ?anon_0_@1:3697175
11-22 09:42:50.503 E/unknown:ReactNative(15724): SyntheticError@1:162984
11-22 09:42:50.503 E/unknown:ReactNative(15724): Wrapper@1:163499
11-22 09:42:50.503 E/unknown:ReactNative(15724): _callSuper@1:148372
11-22 09:42:50.503 E/unknown:ReactNative(15724): _construct@1:163847
11-22 09:42:50.503 E/unknown:ReactNative(15724): _next@1:594835
```
