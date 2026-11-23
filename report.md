# App explorer: 1.0.363 (419)

**Real-use session ATTENTION vs 1.0.360: 0 broken, 9 friction, 0 slower**

- Friction: No reaction for 3.2 s after "scroll rates 1"
- Friction: No reaction for 3.1 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "open product"
- Friction: No reaction for 3.0 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll lenders"
- Friction: No reaction for 3.6 s after "switch to savings"
- Friction: No reaction for 3.0 s after "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode full | 79 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 10
Baseline 1.0.361
**Audit live: outcome failed | 904 s | audit log 851517 bytes (audit-log.txt) https://paste.c-net.org/e3964dab-4ede-94bf-a31f-63dbd3819ea8 | debug log Upload and copy link not found**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 27446 |  | 389/669 | 73 | 582 | 1 errors; start 2725ms; boot js-start 396439, layout-mounted 397024, cache-read 397262, hydrated 397487, splash-hide 397487, manifest 398641, resolved 399645, core-fetched 403430, core-saved 404122, rows-prepared 404360, search-index-idle 404360, leading-requested 404360, details-start 404677, leading-scoped 404721, pricing-ready 405708, last-gate 406725, details-fetched 412253, detail-filters-idle 415637, last-pricing 415637, suitability-built 416265, post-refresh-wait 416675, leading-page 417436, last-rows 422225, rates-ready 422367, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 141, pricing-scope-ms 6805, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 3, filter-rows 38533, filter-yields 5, filter-ms 742, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 49 |
| 2 | scroll rates 1 | 712 |  | 17/32 | 53 | 688 |  |
| 3 | scroll rates 2 | 680 |  | 30/57 | 69 | 546 |  |
| 4 | scroll rates back | 672 |  |  |  | 528 |  |
| 5 | open product | 6155 |  | 37/66 | 77 | 660 |  |
| 6 | scroll product | 712 |  | 29/61 | 69 | 704 |  |
| 7 | back to rates | 25 |  | 11/23 | 61 | 672 |  |
| 8 | open lenders | 23 |  | 18/24 | 300 | 671 |  |
| 9 | scroll lenders | 706 |  | 21/25 | 117 | 669 |  |
| 10 | back from lenders | 23 |  | 8/10 | 150 | 670 |  |
| 11 | switch to savings | 23 |  | 36/55 | 81 | 679 |  |
| 12 | switch to home loans | 23 |  | 16/32 | 48 | 697 |  |
| 13 | open filters | 22 |  | 24/28 | 105 | 705 |  |
| 14 | close filters | 22 |  | 6/8 | 81 | 693 |  |
| 15 | open market | 22 |  | 17/33 | 61 | 695 |  |
| 16 | open rba | 2495 |  | 50/71 | 53 | 710 |  |
| 17 | scroll rba | 715 |  | 28/59 | 65 | 703 |  |
| 18 | back from rba | 28 |  | 8/21 | 46 | 704 |  |
| 19 | scroll market | 699 |  | 22/44 | 61 | 703 |  |
| 20 | open saved | 22 |  | 10/16 | 61 | 706 |  |
| 21 | return to rates | 22 |  | 16/36 | 57 | 708 |  |
| 22 | cold start | 8886 | -7148 | 29/40 | 113 | 597 | 1 errors; start 3361ms; boot js-start 622258, layout-mounted 622435, hydrated 622463, cache-read 623585, core-ready 624077, rows-prepared 624158, search-index-idle 624158, detail-filters-idle 624158, leading-requested 624158, last-pricing 624158, splash-hide 624159, manifest 625456, leading-scoped 625744, leading-page 625744, pricing-ready 626446, last-rows 626446, resolved 626496, rates-ready 627207, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 22, pricing-scope-ms 1338, filter-runs 2, filter-rows 13722, filter-yields 5, filter-cancels 1, filter-ms 242, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 11 |
| 23 | /browse | 40 | -5990 | 1/2 | 32 | 435 |  |
| 24 | /watchlist | 24 | -50 | 3/3 | 46 | 520 |  |
| 25 | /market | 33 | -5246 | 10/20 | 48 | 601 |  |
| 26 | /tools | 4457 | +4399 | 11/22 | 77 | 615 |  |
| 27 | /trends | 22 | -56 | 20/40 | 85 | 611 |  |
| 28 | /search | 25 | -15 | 29/43 | 109 | 635 |  |
| 29 | /banks | 26 | -23 | 32/44 | 97 | 648 |  |
| 30 | /bank-rates | 34 | 0 | 16/28 | 69 | 662 |  |
| 31 | /categories | 24 | -13 | 32/50 | 81 | 682 |  |
| 32 | /catalogue | 25 | -26 | 29/45 | 81 | 717 |  |
| 33 | /compare | 29 | -3 | 10/15 | 93 | 697 |  |
| 34 | /matches | 24 | -10 | 33/52 | 81 | 725 |  |
| 35 | /calculator | 31 | -7 | 13/25 | 57 | 710 |  |
| 36 | /projections | 29 | -10 | 14/26 | 85 | 715 |  |
| 37 | /profile | 30 | -7 | 13/25 | 61 | 722 |  |
| 38 | /research | 32 | -3 | 15/31 | 53 | 736 |  |
| 39 | /rba | 36 | -3 | 18/29 | 81 | 752 |  |
| 40 | /rba-response | 32 | -14 | 15/30 | 65 | 754 |  |
| 41 | /settings | 26 | -13 | 12/26 | 105 | 765 |  |
| 42 | /about | 28 | -12 | 14/25 | 61 | 766 |  |
| 43 | /terms | 30 | -4 | 12/26 | 65 | 769 |  |
| 44 | /privacy | 23 | -19 |  |  | 770 |  |
| 45 | /third-party-notices | 24 | -14 | 13/23 | 57 | 774 |  |
| 46 | /node | 22 | -17 | 30/44 | 85 | 818 |  |
| 47 | /passthrough | 24 | -27 | 31/52 | 81 | 741 |  |
| 48 | /calculation-receipt | 24 | -11 | 13/29 | 53 | 695 |  |
| 49 | /rate-receipt | 24 | -11 | 5/9 | 93 | 689 |  |
| 50 | warm resume | 730 | +24 | 5/5 | 105 | 687 |  |
| 51 | cold relaunch | 8449 | -2323 | 26/36 | 350 | 590 | 1 errors; start 3202ms; boot js-start 848196, layout-mounted 848355, hydrated 848466, cache-read 849516, core-ready 850028, rows-prepared 850112, search-index-idle 850112, detail-filters-idle 850112, leading-requested 850112, last-pricing 850112, splash-hide 850113, manifest 851401, leading-scoped 851676, leading-page 851676, pricing-ready 852297, last-rows 852297, resolved 852346, rates-ready 853005, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 20, pricing-scope-ms 1268, filter-runs 2, filter-rows 13722, filter-yields 5, filter-cancels 1, filter-ms 216, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 10 |
| 52 | about | 30 |  | 10/20 | 150 | 472 |  |
| 53 | audit screen | 21 |  | 100/233 | 57 | 620 |  |
| 54 | audit 0 min | 0 |  | 28/28 | 77 | 752 |  |
| 55 | audit 2 min | 0 |  | 1283/1524 | 97 | 1012 | 80 errors |
| 56 | audit 4 min | 0 |  | 777/950 | 101 | 1041 | 80 errors |
| 57 | audit 5 min | 0 |  | 872/1050 | 97 | 1082 | 80 errors |
| 58 | audit 7 min | 0 |  | 1042/1231 | 97 | 1265 | 80 errors |
| 59 | audit 8 min | 0 |  | 249/309 | 89 | 1201 | 80 errors |
| 60 | audit 10 min | 0 |  | 825/1000 | 101 | 1247 | 80 errors |
| 61 | audit 11 min | 0 |  | 245/301 | 93 | 1278 | 80 errors |
| 62 | audit 12 min | 0 |  | 96/129 | 34 | 1283 |  |
| 63 | audit 13 min | 0 |  | 126/156 | 34 | 1302 |  |
| 64 | audit 14 min | 0 |  | 67/78 | 57 | 1313 |  |
| 65 | audit finished | 0 |  | 102/225 | 61 | 1375 |  |
| 66 | audit result 1 | 0 |  |  |  | 1372 |  |
| 67 | audit result 2 | 0 |  |  |  | 1375 |  |
| 68 | audit result 3 | 0 |  |  |  | 1372 |  |
| 69 | audit result 4 | 0 |  |  |  | 1372 |  |
| 70 | audit result 5 | 0 |  |  |  | 1375 |  |
| 71 | audit result 6 | 0 |  |  |  | 1373 |  |
| 72 | audit result 7 | 0 |  |  |  | 1375 |  |
| 73 | audit result 8 | 0 |  |  |  | 1373 |  |
| 74 | audit result 9 | 0 |  |  |  | 1376 |  |
| 75 | audit result 10 | 0 |  |  |  | 1377 |  |
| 76 | audit result 11 | 0 |  |  |  | 1375 |  |
| 77 | audit result 12 | 0 |  |  |  | 1378 |  |
| 78 | about for debug log | 2977 |  | 15/29 | 65 | 1418 |  |
| 79 | debug log screen | 0 |  | 86/219 | 48 | 1432 |  |

## Errors

### 1 open app
```
11-23 22:08:44.575 E/australianrates( 9862): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-23 22:12:31.191 E/australianrates(12196): Not starting debugger since process cannot load the jdwp agent.
```

### 51 cold relaunch
```
11-23 22:16:17.307 E/australianrates(15175): Not starting debugger since process cannot load the jdwp agent.
```

### 55 audit 2 min
```
11-23 22:17:26.811 E/ReactNativeJS(15175): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwttt690-65042bdbaef77e5a","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":4815.5,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":1317.2,"liveStage:dates-index:fetched:ms":183.2,"liveStage:revision:verified:ms":56,"liveStage:Core asset:downloaded:ms":157.2,"liveStage:Core asset:hash-verified:ms":3,"liveStage:Core asset:native-inflated-and-text-decoded:ms":136.6,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":163.3,"liveStage:core:history-sealed:ms":0,"liveStage:core:normalized:ms":572.3,"liveStage:Details asset:downloaded:ms":837.3,"liveStage:Details asset:hash-verified:ms":45.8,"liveStage:De…
11-23 22:17:26.812 E/unknown:ReactNative(15175): ?anon_0_@1:3693709
11-23 22:17:26.812 E/unknown:ReactNative(15175): ?anon_0_@1:3699509
11-23 22:17:26.812 E/unknown:ReactNative(15175): SyntheticError@1:163016
11-23 22:17:26.812 E/unknown:ReactNative(15175): Wrapper@1:163531
11-23 22:17:26.812 E/unknown:ReactNative(15175): _callSuper@1:148404
11-23 22:17:26.812 E/unknown:ReactNative(15175): _construct@1:163879
11-23 22:17:26.812 E/unknown:ReactNative(15175): _next@1:594867
```

### 56 audit 4 min
```
11-23 22:19:56.514 E/ReactNativeJS(15175): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwttt690-65042bdbaef77e5a","check":{"id":"deep-first-pass.route.rates-mortgage-scope.search.mortgage.scope.clear","label":"route.rates-mortgage-scope: search.mortgage.scope.clear (first-pass)","kind":"journey","status":"fail","durationMs":6384.6,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.clear","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.clear","iteration":"cold","passId":"first-pass","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.clear","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":22,"actionRevisionAfter":23,"renderRevisionBefore":"state-21","renderRevisionAfter":"state-27","actionMs":114.6,"preActionWaitMs":1.7,"preActionQuietWindowReused":true,"preActi…
11-23 22:19:56.515 E/unknown:ReactNative(15175): ?anon_0_@1:3693709
11-23 22:19:56.515 E/unknown:ReactNative(15175): ?anon_0_@1:3699509
11-23 22:19:56.515 E/unknown:ReactNative(15175): SyntheticError@1:163016
11-23 22:19:56.515 E/unknown:ReactNative(15175): Wrapper@1:163531
11-23 22:19:56.515 E/unknown:ReactNative(15175): _callSuper@1:148404
11-23 22:19:56.515 E/unknown:ReactNative(15175): _construct@1:163879
11-23 22:19:56.515 E/unknown:ReactNative(15175): _next@1:594867
```

### 57 audit 5 min
```
11-23 22:21:11.713 E/ReactNativeJS(15175): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwttt690-65042bdbaef77e5a","check":{"id":"deep-first-pass.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (first-pass)","kind":"journey","status":"fail","durationMs":1319.3,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Hejaz%20Islamic%20Home%20Finance%7CHomepay_Standard%7CRESIDENTIAL_MORTGAGES%7CHomepay%20Standard","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":7,"actionRevisionAft…
11-23 22:21:11.714 E/unknown:ReactNative(15175): ?anon_0_@1:3693709
11-23 22:21:11.714 E/unknown:ReactNative(15175): ?anon_0_@1:3699509
11-23 22:21:11.714 E/unknown:ReactNative(15175): SyntheticError@1:163016
11-23 22:21:11.714 E/unknown:ReactNative(15175): Wrapper@1:163531
11-23 22:21:11.714 E/unknown:ReactNative(15175): _callSuper@1:148404
11-23 22:21:11.714 E/unknown:ReactNative(15175): _construct@1:163879
11-23 22:21:11.714 E/unknown:ReactNative(15175): _next@1:594867
```

### 58 audit 7 min
```
11-23 22:22:59.878 E/ReactNativeJS(15175): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwttt690-65042bdbaef77e5a","check":{"id":"deep-first-pass.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (first-pass)","kind":"journey","status":"fail","durationMs":3542,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":57.6,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":978.1,"forwardWorkMs":978.1,"navigationCommitMs":977.5,"firstReadyFrameMs":0.6,…
11-23 22:22:59.879 E/unknown:ReactNative(15175): ?anon_0_@1:3693709
11-23 22:22:59.879 E/unknown:ReactNative(15175): ?anon_0_@1:3699509
11-23 22:22:59.879 E/unknown:ReactNative(15175): SyntheticError@1:163016
11-23 22:22:59.879 E/unknown:ReactNative(15175): Wrapper@1:163531
11-23 22:22:59.879 E/unknown:ReactNative(15175): _callSuper@1:148404
11-23 22:22:59.879 E/unknown:ReactNative(15175): _construct@1:163879
11-23 22:22:59.879 E/unknown:ReactNative(15175): _next@1:594867
```

### 59 audit 8 min
```
11-23 22:25:01.100 E/ReactNativeJS(15175): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwttt690-65042bdbaef77e5a","check":{"id":"deep-repeat.sample.catalogue.2.product.open","label":"sample.catalogue.2: product.open (repeat)","kind":"journey","status":"fail","durationMs":1721.7,"metrics":{"journeyId":"sample.catalogue.2.product.open","journeyLabel":"sample.catalogue.2: product.open","iteration":"warm","passId":"repeat","scenarioId":"sample.catalogue.2","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Bank%20First%7C993169e5-0490-4e85-a2c9-011f3c689e97%7CTERM_DEPOSITS%7C1%20Year%20Term%20Deposit","expectedPath":"/product/Bank%20First%7C993169e5-0490-4e85-a2c9-011f3c689e97%7CTERM_DEPOSITS%7C1%20Year%20Term%20Deposit","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":498,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"rep…
11-23 22:25:01.101 E/unknown:ReactNative(15175): ?anon_0_@1:3693709
11-23 22:25:01.101 E/unknown:ReactNative(15175): ?anon_0_@1:3699509
11-23 22:25:01.101 E/unknown:ReactNative(15175): SyntheticError@1:163016
11-23 22:25:01.101 E/unknown:ReactNative(15175): Wrapper@1:163531
11-23 22:25:01.101 E/unknown:ReactNative(15175): _callSuper@1:148404
11-23 22:25:01.101 E/unknown:ReactNative(15175): _construct@1:163879
11-23 22:25:01.101 E/unknown:ReactNative(15175): _next@1:594867
```

### 60 audit 10 min
```
11-23 22:25:36.124 E/ReactNativeJS(15175): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwttt690-65042bdbaef77e5a","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1428.6,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Hejaz%20Islamic%20Home%20Finance%7CHomepay_Standard%7CRESIDENTIAL_MORTGAGES%7CHomepay%20Standard","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"ren…
11-23 22:25:36.126 E/unknown:ReactNative(15175): ?anon_0_@1:3693709
11-23 22:25:36.126 E/unknown:ReactNative(15175): ?anon_0_@1:3699509
11-23 22:25:36.126 E/unknown:ReactNative(15175): SyntheticError@1:163016
11-23 22:25:36.126 E/unknown:ReactNative(15175): Wrapper@1:163531
11-23 22:25:36.126 E/unknown:ReactNative(15175): _callSuper@1:148404
11-23 22:25:36.126 E/unknown:ReactNative(15175): _construct@1:163879
11-23 22:25:36.126 E/unknown:ReactNative(15175): _next@1:594867
```

### 61 audit 11 min
```
11-23 22:27:12.428 E/ReactNativeJS(15175): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwttt690-65042bdbaef77e5a","check":{"id":"deep-repeat.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (repeat)","kind":"journey","status":"fail","durationMs":3432.1,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":40.8,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":881.8,"forwardWorkMs":881.8,"navigationCommitMs":881.3,"firstReadyFrameMs":0.5,"firstRead…
11-23 22:27:12.429 E/unknown:ReactNative(15175): ?anon_0_@1:3693709
11-23 22:27:12.429 E/unknown:ReactNative(15175): ?anon_0_@1:3699509
11-23 22:27:12.429 E/unknown:ReactNative(15175): SyntheticError@1:163016
11-23 22:27:12.429 E/unknown:ReactNative(15175): Wrapper@1:163531
11-23 22:27:12.429 E/unknown:ReactNative(15175): _callSuper@1:148404
11-23 22:27:12.429 E/unknown:ReactNative(15175): _construct@1:163879
11-23 22:27:12.429 E/unknown:ReactNative(15175): _next@1:594867
```
