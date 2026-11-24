# App explorer: 1.0.365 (421)

**Real-use session ATTENTION vs 1.0.365: 0 broken, 6 friction, 0 slower**

- Friction: No reaction for 3.7 s after "scroll rates 1"
- Friction: No reaction for 3.2 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "scroll lenders"
- Friction: No reaction for 4.1 s after "switch to savings"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode full | 78 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 11
Baseline 1.0.365
**Audit live: outcome failed | 898 s | audit log 853613 bytes (audit-log.txt) https://paste.c-net.org/0d9c5a21-8fcd-5f7d-38f0-fbaa55d2d8e1 | debug log Upload and copy link not found**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 29467 | +26330 | 389/786 | 69 | 593 | 1 errors; start 2812ms; boot js-start 401371, layout-mounted 401904, cache-read 401993, hydrated 402256, splash-hide 402256, manifest 403306, resolved 404067, core-fetched 407880, core-saved 408431, rows-prepared 408623, search-index-idle 408623, leading-requested 408623, details-start 409276, leading-scoped 409383, pricing-ready 410176, last-gate 410546, details-fetched 416448, detail-filters-idle 421557, last-pricing 421557, suitability-built 422513, post-refresh-wait 423123, leading-page 423933, last-rows 428352, rates-ready 428467, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 137, pricing-scope-ms 6994, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 3, filter-rows 38533, filter-yields 9, filter-ms 192, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 48 |
| 2 | scroll rates 1 | 694 | -21 | 32/62 | 77 | 553 |  |
| 3 | scroll rates 2 | 694 | -33 | 20/44 | 65 | 552 |  |
| 4 | scroll rates back | 681 | -23 |  |  | 539 |  |
| 5 | open product | 2923 | -2860 | 28/45 | 89 | 667 |  |
| 6 | scroll product | 762 | 0 | 13/30 | 65 | 670 |  |
| 7 | back to rates | 29 | -7 | 11/25 | 65 | 661 |  |
| 8 | open lenders | 25 | -3 | 19/23 | 350 | 663 |  |
| 9 | scroll lenders | 701 | -141 | 24/29 | 109 | 660 |  |
| 10 | back from lenders | 26 | -4 | 6/6 | 150 | 661 |  |
| 11 | switch to savings | 27 | -6 | 40/78 | 73 | 670 |  |
| 12 | switch to home loans | 24 | -5 | 11/32 | 48 | 686 |  |
| 13 | open filters | 24 | -9 | 25/30 | 105 | 687 |  |
| 14 | close filters | 27 | 0 | 6/10 | 150 | 685 |  |
| 15 | open market | 23 | -4 | 16/34 | 53 | 685 |  |
| 16 | open rba | 2416 | -177 | 34/78 | 48 | 702 |  |
| 17 | scroll rba | 691 | -43 | 26/62 | 61 | 694 |  |
| 18 | back from rba | 28 | -6 | 6/22 | 44 | 695 |  |
| 19 | scroll market | 696 | -18 | 23/42 | 65 | 694 |  |
| 20 | open saved | 22 | -6 | 8/15 | 65 | 698 |  |
| 21 | return to rates | 23 | -3 | 13/35 | 57 | 699 |  |
| 22 | cold start | 8770 | -1257 | 26/42 | 101 | 616 | 1 errors; start 3170ms; boot js-start 626449, layout-mounted 626641, hydrated 626641, cache-read 627766, core-ready 628251, rows-prepared 628340, search-index-idle 628340, detail-filters-idle 628340, leading-requested 628340, last-pricing 628340, splash-hide 628341, manifest 629898, leading-scoped 630386, leading-page 630386, resolved 630743, pricing-ready 631313, last-rows 631313, rates-ready 631431, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 18, pricing-scope-ms 1334, filter-runs 1, filter-rows 6861, filter-yields 3, filter-ms 61, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 10 |
| 23 | /browse | 30 |  | 2/2 | 32 | 450 |  |
| 24 | /watchlist | 23 |  | 2/3 | 32 | 541 |  |
| 25 | /market | 29 |  | 10/22 | 48 | 628 |  |
| 26 | /tools | 2241 |  | 13/23 | 81 | 601 |  |
| 27 | /trends | 30 |  | 21/38 | 81 | 612 |  |
| 28 | /search | 26 |  | 27/42 | 101 | 638 |  |
| 29 | /banks | 29 |  | 29/47 | 93 | 652 |  |
| 30 | /bank-rates | 30 |  | 19/29 | 77 | 663 |  |
| 31 | /categories | 33 |  | 29/52 | 81 | 724 |  |
| 32 | /catalogue | 28 |  | 27/40 | 101 | 764 |  |
| 33 | /compare | 24 |  | 13/17 | 105 | 789 |  |
| 34 | /matches | 29 |  | 32/47 | 81 | 775 |  |
| 35 | /calculator | 29 |  | 12/23 | 73 | 757 |  |
| 36 | /projections | 31 |  | 18/32 | 73 | 687 |  |
| 37 | /profile | 27 |  | 12/29 | 65 | 689 |  |
| 38 | /research | 28 |  | 15/29 | 65 | 696 |  |
| 39 | /rba | 22 |  | 12/26 | 81 | 706 |  |
| 40 | /rba-response | 23 |  | 16/35 | 69 | 706 |  |
| 41 | /settings | 29 |  | 14/29 | 57 | 712 |  |
| 42 | /about | 24 |  | 10/25 | 69 | 712 |  |
| 43 | /terms | 23 |  | 11/24 | 57 | 713 |  |
| 44 | /privacy | 33 |  |  |  | 712 |  |
| 45 | /third-party-notices | 27 |  | 10/25 | 61 | 715 |  |
| 46 | /node | 29 |  | 25/47 | 77 | 733 |  |
| 47 | /passthrough | 28 |  | 30/52 | 73 | 713 |  |
| 48 | /calculation-receipt | 30 |  | 13/27 | 61 | 708 |  |
| 49 | /rate-receipt | 23 |  | 5/8 | 34 | 708 |  |
| 50 | warm resume | 352 |  | 4/5 | 150 | 706 |  |
| 51 | cold relaunch | 8146 |  | 24/38 | 250 | 603 | 1 errors; start 3034ms; boot js-start 850748, layout-mounted 850914, hydrated 850915, cache-read 851990, core-ready 852465, rows-prepared 852558, search-index-idle 852558, detail-filters-idle 852558, leading-requested 852558, last-pricing 852558, splash-hide 852559, manifest 853758, leading-scoped 853997, leading-page 853997, resolved 854483, pricing-ready 855067, last-rows 855067, rates-ready 855193, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 22, pricing-scope-ms 1154, filter-runs 1, filter-rows 6861, filter-yields 3, filter-ms 63, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 10 |
| 52 | about | 29 | -2 | 10/24 | 48 | 479 |  |
| 53 | audit screen | 20 | -5 | 93/235 | 48 | 626 |  |
| 54 | audit 1 min | 0 | 0 | 925/1177 | 93 | 948 | 80 errors |
| 55 | audit 3 min | 0 | 0 | 765/963 | 93 | 1085 | 80 errors |
| 56 | audit 4 min | 0 | 0 | 278/387 | 85 | 1037 | 80 errors |
| 57 | audit 5 min | 0 | 0 | 665/847 | 93 | 1153 | 80 errors |
| 58 | audit 7 min | 0 | 0 | 1131/1387 | 97 | 1333 | 80 errors |
| 59 | audit 8 min | 0 |  | 217/309 | 81 | 1231 | 80 errors |
| 60 | audit 10 min | 0 |  | 689/895 | 89 | 1295 | 80 errors |
| 61 | audit 11 min | 0 | 0 | 388/483 | 93 | 1326 | 80 errors |
| 62 | audit 12 min | 0 | 0 | 138/179 | 32 | 1349 |  |
| 63 | audit 14 min | 0 |  | 119/158 | 48 | 1371 |  |
| 64 | audit finished | 0 | 0 | 100/242 | 53 | 1446 |  |
| 65 | audit result 1 | 0 | 0 |  |  | 1424 |  |
| 66 | audit result 2 | 0 | 0 |  |  | 1424 |  |
| 67 | audit result 3 | 0 | 0 |  |  | 1422 |  |
| 68 | audit result 4 | 0 | 0 |  |  | 1424 |  |
| 69 | audit result 5 | 0 | 0 |  |  | 1422 |  |
| 70 | audit result 6 | 0 | 0 |  |  | 1422 |  |
| 71 | audit result 7 | 0 | 0 |  |  | 1425 |  |
| 72 | audit result 8 | 0 | 0 |  |  | 1423 |  |
| 73 | audit result 9 | 0 | 0 |  |  | 1427 |  |
| 74 | audit result 10 | 0 | 0 |  |  | 1425 |  |
| 75 | audit result 11 | 0 | 0 |  |  | 1425 |  |
| 76 | audit result 12 | 0 | 0 |  |  | 1427 |  |
| 77 | about for debug log | 3661 | +233 | 18/33 | 57 | 1274 |  |
| 78 | debug log screen | 0 | -1 | 73/220 | 48 | 1286 |  |

## Errors

### 1 open app
```
11-24 01:18:29.910 E/australianrates(10415): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-24 01:22:16.027 E/australianrates(12730): Not starting debugger since process cannot load the jdwp agent.
```

### 51 cold relaunch
```
11-24 01:26:00.465 E/australianrates(15728): Not starting debugger since process cannot load the jdwp agent.
```

### 54 audit 1 min
```
11-24 01:27:07.308 E/ReactNativeJS(15728): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu0l4ug-440f76ffa9f88a27","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":3908.7,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":304.5,"liveStage:dates-index:fetched:ms":218.1,"liveStage:revision:verified:ms":70.4,"liveStage:Core asset:downloaded:ms":230.4,"liveStage:Core asset:hash-verified:ms":13.9,"liveStage:Core asset:native-inflated-and-text-decoded:ms":146.8,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":173.6,"liveStage:core:history-sealed:ms":0,"liveStage:core:normalized:ms":512.4,"liveStage:Details asset:downloaded:ms":880,"liveStage:Details asset:hash-verified:ms":25.9,"liveStage:…
11-24 01:27:07.310 E/unknown:ReactNative(15728): ?anon_0_@1:3694852
11-24 01:27:07.310 E/unknown:ReactNative(15728): ?anon_0_@1:3700652
11-24 01:27:07.310 E/unknown:ReactNative(15728): SyntheticError@1:163016
11-24 01:27:07.310 E/unknown:ReactNative(15728): Wrapper@1:163531
11-24 01:27:07.310 E/unknown:ReactNative(15728): _callSuper@1:148404
11-24 01:27:07.310 E/unknown:ReactNative(15728): _construct@1:163879
11-24 01:27:07.310 E/unknown:ReactNative(15728): _next@1:594867
```

### 55 audit 3 min
```
11-24 01:28:39.354 E/ReactNativeJS(15728): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu0l4ug-440f76ffa9f88a27","check":{"id":"deep-first-pass.route.rates.search.open","label":"route.rates: search.open (first-pass)","kind":"journey","status":"fail","durationMs":1767.9,"metrics":{"journeyId":"route.rates.search.open","journeyLabel":"route.rates: search.open","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.open","depth":0,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":34.9,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1073.6,"forwardWorkMs":1073.6,"navigationCommitMs":877.8,"firstReadyFrameMs":195.7,"firstReadyFrameObserved":true,"readinessMs":195.7,"backgroundSettleMs":…
11-24 01:28:39.356 E/unknown:ReactNative(15728): ?anon_0_@1:3694852
11-24 01:28:39.356 E/unknown:ReactNative(15728): ?anon_0_@1:3700652
11-24 01:28:39.356 E/unknown:ReactNative(15728): SyntheticError@1:163016
11-24 01:28:39.356 E/unknown:ReactNative(15728): Wrapper@1:163531
11-24 01:28:39.356 E/unknown:ReactNative(15728): _callSuper@1:148404
11-24 01:28:39.356 E/unknown:ReactNative(15728): _construct@1:163879
11-24 01:28:39.356 E/unknown:ReactNative(15728): _next@1:594867
```

### 56 audit 4 min
```
11-24 01:30:14.537 E/ReactNativeJS(15728): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu0l4ug-440f76ffa9f88a27","check":{"id":"deep-first-pass.sample.catalogue.0.product.lender.open","label":"sample.catalogue.0: product.lender.open (first-pass)","kind":"journey","status":"fail","durationMs":1722.6,"metrics":{"journeyId":"sample.catalogue.0.product.lender.open","journeyLabel":"sample.catalogue.0: product.lender.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.0","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/Unity%20Bank","expectedPath":"/bank/Unity%20Bank","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"actionResultEvidence":"{\"expectedPath\":\"/bank/Unity%20Bank\"}","actionMs":559.7,"preActionWaitMs":1,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"ob…
11-24 01:30:14.543 E/unknown:ReactNative(15728): ?anon_0_@1:3694852
11-24 01:30:14.543 E/unknown:ReactNative(15728): ?anon_0_@1:3700652
11-24 01:30:14.543 E/unknown:ReactNative(15728): SyntheticError@1:163016
11-24 01:30:14.543 E/unknown:ReactNative(15728): Wrapper@1:163531
11-24 01:30:14.543 E/unknown:ReactNative(15728): _callSuper@1:148404
11-24 01:30:14.543 E/unknown:ReactNative(15728): _construct@1:163879
11-24 01:30:14.543 E/unknown:ReactNative(15728): _next@1:594867
```

### 57 audit 5 min
```
11-24 01:31:01.870 E/ReactNativeJS(15728): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu0l4ug-440f76ffa9f88a27","check":{"id":"deep-first-pass.route.moves.moves.open","label":"route.moves: moves.open (first-pass)","kind":"journey","status":"fail","durationMs":1104.2,"metrics":{"journeyId":"route.moves.moves.open","journeyLabel":"route.moves: moves.open","iteration":"cold","passId":"first-pass","scenarioId":"route.moves","semanticActionId":"moves.open","depth":0,"plannedExpectedPath":"/rba-response","expectedPath":"/rba-response","expectedSurface":"moves.response-chart","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":179.2,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":365.6,"forwardWorkMs":365.6,"navigationCommitMs":0,"firstReadyFrameMs":365.6,"firstReadyFrameObserved":true,"readinessMs":365.6,"backgroundS…
11-24 01:31:01.872 E/unknown:ReactNative(15728): ?anon_0_@1:3694852
11-24 01:31:01.872 E/unknown:ReactNative(15728): ?anon_0_@1:3700652
11-24 01:31:01.872 E/unknown:ReactNative(15728): SyntheticError@1:163016
11-24 01:31:01.872 E/unknown:ReactNative(15728): Wrapper@1:163531
11-24 01:31:01.872 E/unknown:ReactNative(15728): _callSuper@1:148404
11-24 01:31:01.872 E/unknown:ReactNative(15728): _construct@1:163879
11-24 01:31:01.872 E/unknown:ReactNative(15728): _next@1:594867
```

### 58 audit 7 min
```
11-24 01:32:29.631 E/ReactNativeJS(15728): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu0l4ug-440f76ffa9f88a27","check":{"id":"deep-first-pass.redirect.categories.redirect.categories.verify","label":"redirect.categories: redirect.categories.verify (first-pass)","kind":"journey","status":"fail","durationMs":2783.2,"metrics":{"journeyId":"redirect.categories.redirect.categories.verify","journeyLabel":"redirect.categories: redirect.categories.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.categories","semanticActionId":"redirect.categories.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":28.6,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":2049.7,"forwardWorkMs":2049.7,"navigatio…
11-24 01:32:29.633 E/unknown:ReactNative(15728): ?anon_0_@1:3694852
11-24 01:32:29.633 E/unknown:ReactNative(15728): ?anon_0_@1:3700652
11-24 01:32:29.633 E/unknown:ReactNative(15728): SyntheticError@1:163016
11-24 01:32:29.633 E/unknown:ReactNative(15728): Wrapper@1:163531
11-24 01:32:29.633 E/unknown:ReactNative(15728): _callSuper@1:148404
11-24 01:32:29.633 E/unknown:ReactNative(15728): _construct@1:163879
11-24 01:32:29.633 E/unknown:ReactNative(15728): _next@1:594867
```

### 59 audit 8 min
```
11-24 01:34:37.687 E/ReactNativeJS(15728): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu0l4ug-440f76ffa9f88a27","check":{"id":"deep-repeat.sample.catalogue.2.product.open","label":"sample.catalogue.2: product.open (repeat)","kind":"journey","status":"fail","durationMs":2378.9,"metrics":{"journeyId":"sample.catalogue.2.product.open","journeyLabel":"sample.catalogue.2: product.open","iteration":"warm","passId":"repeat","scenarioId":"sample.catalogue.2","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Bank%20of%20us%7CStash_n_Splash%7CTRANS_AND_SAVINGS_ACCOUNTS%7CStash%20n%20Splash","expectedPath":"/product/Bank%20of%20us%7CStash_n_Splash%7CTRANS_AND_SAVINGS_ACCOUNTS%7CStash%20n%20Splash","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":548.4,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDeto…
11-24 01:34:37.688 E/unknown:ReactNative(15728): ?anon_0_@1:3694852
11-24 01:34:37.688 E/unknown:ReactNative(15728): ?anon_0_@1:3700652
11-24 01:34:37.688 E/unknown:ReactNative(15728): SyntheticError@1:163016
11-24 01:34:37.688 E/unknown:ReactNative(15728): Wrapper@1:163531
11-24 01:34:37.688 E/unknown:ReactNative(15728): _callSuper@1:148404
11-24 01:34:37.688 E/unknown:ReactNative(15728): _construct@1:163879
11-24 01:34:37.688 E/unknown:ReactNative(15728): _next@1:594867
```

### 60 audit 10 min
```
11-24 01:35:09.808 E/ReactNativeJS(15728): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu0l4ug-440f76ffa9f88a27","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1354.9,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Unity%20Bank%7CL27_FIXIO1-5_INV_INTVSO60%7CRESIDENTIAL_MORTGAGES%7CFixed%20Rate%20Home%20Loan%20-%20Property%20Investor%20-%20I%2FO%20-%2060%20mths","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"act…
11-24 01:35:09.809 E/unknown:ReactNative(15728): ?anon_0_@1:3694852
11-24 01:35:09.809 E/unknown:ReactNative(15728): ?anon_0_@1:3700652
11-24 01:35:09.809 E/unknown:ReactNative(15728): SyntheticError@1:163016
11-24 01:35:09.809 E/unknown:ReactNative(15728): Wrapper@1:163531
11-24 01:35:09.809 E/unknown:ReactNative(15728): _callSuper@1:148404
11-24 01:35:09.809 E/unknown:ReactNative(15728): _construct@1:163879
11-24 01:35:09.809 E/unknown:ReactNative(15728): _next@1:594867
```

### 61 audit 11 min
```
11-24 01:36:38.771 E/ReactNativeJS(15728): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu0l4ug-440f76ffa9f88a27","check":{"id":"deep-repeat.redirect.banks.redirect.banks.verify","label":"redirect.banks: redirect.banks.verify (repeat)","kind":"journey","status":"fail","durationMs":2195.4,"metrics":{"journeyId":"redirect.banks.redirect.banks.verify","journeyLabel":"redirect.banks: redirect.banks.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.banks","semanticActionId":"redirect.banks.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":95.1,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1410.1,"forwardWorkMs":1410.1,"navigationCommitMs":1226.3,"firstReadyFrameMs":183.8,"firstReadyFrameOb…
11-24 01:36:38.779 E/unknown:ReactNative(15728): ?anon_0_@1:3694852
11-24 01:36:38.779 E/unknown:ReactNative(15728): ?anon_0_@1:3700652
11-24 01:36:38.779 E/unknown:ReactNative(15728): SyntheticError@1:163016
11-24 01:36:38.779 E/unknown:ReactNative(15728): Wrapper@1:163531
11-24 01:36:38.779 E/unknown:ReactNative(15728): _callSuper@1:148404
11-24 01:36:38.779 E/unknown:ReactNative(15728): _construct@1:163879
11-24 01:36:38.779 E/unknown:ReactNative(15728): _next@1:594867
```
