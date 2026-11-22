# App explorer: 1.0.354 (410)

**Real-use session ATTENTION vs 1.0.353: 0 broken, 11 friction, 4 slower**

- Friction: No reaction for 3.1 s after "scroll rates 1"
- Friction: No reaction for 3.2 s after "scroll rates 2"
- Friction: No reaction for 3.0 s after "scroll product"
- Friction: No reaction for 3.2 s after "scroll lenders"
- Friction: No reaction for 4.0 s after "switch to savings"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.5 s after "open rba"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: "No saved rates" shown on "open saved"
- Slower: Dropped frames 35% to 50% on "scroll product"
- Slower: Dropped frames 27% to 56% on "scroll rba"
- Slower: Dropped frames 29% to 55% on "back from rba"
- Slower: Dropped frames 42% to 64% on "scroll market"

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode full | 79 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 12
Baseline 1.0.353
**Audit live: outcome completed | 949 s | audit log 853902 bytes (audit-log.txt) https://paste.c-net.org/3e6ac1e4-e36e-5d54-3e40-672ffa4b76f6 | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2767 | -1332 | 471/727 | 77 | 508 | 1 errors; start 2673ms; boot js-start 400982, layout-mounted 401608, cache-read 401933, hydrated 402113, splash-hide 402113, manifest 403236, resolved 403567, core-fetched 407927, core-saved 408676, rows-prepared 408949, search-index-idle 408949, leading-requested 408949, details-start 409340, leading-scoped 409891, pricing-ready 410681, last-gate 410879, details-fetched 418615, detail-filters-idle 422465, last-pricing 422465, suitability-built 423605, post-refresh-wait 424070, leading-page 424979, last-rows 431555, rates-ready 431732, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 154, pricing-scope-ms 9350, leading-short 1, leading-short-rows 0, leading-scope-rows 113, leading-visible-rows 0, leading-nonstd-rows 10, filter-runs 3, filter-rows 38576, filter-yields 6, filter-ms 138, sort-runs 5, sort-rows 1182, sort-yields 5, sort-ms 67 |
| 2 | scroll rates 1 | 698 | -30 | 19/32 | 69 | 561 |  |
| 3 | scroll rates 2 | 711 | -61 | 33/50 | 81 | 721 |  |
| 4 | scroll rates back | 684 | +2 |  |  | 561 |  |
| 5 | open product | 5048 | +2272 | 37/58 | 77 | 630 |  |
| 6 | scroll product | 691 | +2 | 28/56 | 73 | 678 |  |
| 7 | back to rates | 24 | -8 | 12/22 | 61 | 655 |  |
| 8 | open lenders | 20 | +2 | 20/25 | 150 | 660 |  |
| 9 | scroll lenders | 752 | +46 | 17/20 | 89 | 662 |  |
| 10 | back from lenders | 19 | 0 | 8/10 | 117 | 669 |  |
| 11 | switch to savings | 20 | +1 | 46/74 | 77 | 694 |  |
| 12 | switch to home loans | 20 | +1 | 14/31 | 53 | 716 |  |
| 13 | open filters | 20 | +1 | 23/27 | 150 | 723 |  |
| 14 | close filters | 19 | +1 | 6/9 | 133 | 725 |  |
| 15 | open market | 19 | +2 | 18/34 | 57 | 730 |  |
| 16 | open rba | 19 | 0 | 38/65 | 48 | 712 |  |
| 17 | scroll rba | 720 | +34 | 23/41 | 81 | 687 |  |
| 18 | back from rba | 19 | -4 | 11/20 | 53 | 687 |  |
| 19 | scroll market | 678 | -7 | 27/42 | 69 | 687 |  |
| 20 | open saved | 19 | +1 | 13/20 | 65 | 691 |  |
| 21 | return to rates | 19 | 0 | 16/36 | 73 | 691 |  |
| 22 | cold start | 9116 |  | 26/35 | 93 | 589 | 1 errors; start 3532ms; boot js-start 620989, layout-mounted 621145, hydrated 621225, cache-read 622276, core-ready 622857, rows-prepared 622953, search-index-idle 622953, detail-filters-idle 622953, leading-requested 622953, last-pricing 622953, splash-hide 622954, manifest 624566, leading-scoped 625107, leading-page 625107, resolved 625485, pricing-ready 626129, last-rows 626129, rates-ready 626270, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 21, pricing-scope-ms 1479, filter-runs 1, filter-rows 6878, filter-yields 3, filter-ms 75, sort-runs 1, sort-rows 1182, sort-yields 1, sort-ms 12 |
| 23 | /browse | 2212 |  | 2/2 | 32 | 441 |  |
| 24 | /watchlist | 20 |  | 1/2 | 46 | 523 |  |
| 25 | /market | 25 |  | 10/21 | 65 | 599 |  |
| 26 | /tools | 4337 |  | 15/22 | 85 | 610 |  |
| 27 | /trends | 25 |  | 21/38 | 89 | 604 |  |
| 28 | /search | 27 |  | 27/39 | 97 | 626 |  |
| 29 | /banks | 21 |  | 24/32 | 101 | 640 |  |
| 30 | /bank-rates | 25 |  | 15/27 | 73 | 650 |  |
| 31 | /categories | 22 |  | 32/45 | 113 | 666 |  |
| 32 | /catalogue | 25 |  | 34/45 | 89 | 690 |  |
| 33 | /compare | 23 |  | 11/16 | 121 | 677 |  |
| 34 | /matches | 22 |  | 27/44 | 81 | 690 |  |
| 35 | /calculator | 25 |  | 14/24 | 69 | 690 |  |
| 36 | /projections | 22 |  | 21/34 | 81 | 685 |  |
| 37 | /profile | 21 |  | 14/24 | 69 | 691 |  |
| 38 | /research | 21 |  | 17/32 | 65 | 705 |  |
| 39 | /rba | 21 |  | 14/24 | 85 | 710 |  |
| 40 | /rba-response | 21 |  | 14/25 | 53 | 714 |  |
| 41 | /settings | 25 |  | 12/27 | 77 | 725 |  |
| 42 | /about | 22 |  | 12/24 | 73 | 727 |  |
| 43 | /terms | 21 |  | 11/23 | 65 | 729 |  |
| 44 | /privacy | 28 |  |  |  | 730 |  |
| 45 | /third-party-notices | 22 |  | 12/25 | 61 | 735 |  |
| 46 | /node | 23 |  | 29/40 | 93 | 776 |  |
| 47 | /passthrough | 31 |  | 28/45 | 93 | 748 |  |
| 48 | /calculation-receipt | 24 |  | 15/28 | 69 | 743 |  |
| 49 | /rate-receipt | 27 |  | 7/9 | 65 | 744 |  |
| 50 | warm resume | 550 |  | 4/5 | 133 | 743 |  |
| 51 | cold relaunch | 8775 |  | 32/46 | 77 | 576 | 1 errors; start 3501ms; boot js-start 847076, layout-mounted 847231, hydrated 847331, cache-read 848309, core-ready 848873, rows-prepared 848957, search-index-idle 848957, detail-filters-idle 848957, leading-requested 848957, last-pricing 848957, splash-hide 848958, manifest 850445, leading-scoped 850978, leading-page 850978, resolved 851363, pricing-ready 852021, last-rows 852021, rates-ready 852159, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 20, pricing-scope-ms 1494, filter-runs 1, filter-rows 6878, filter-yields 3, filter-ms 74, sort-runs 1, sort-rows 1182, sort-yields 1, sort-ms 12 |
| 52 | about | 26 |  | 10/21 | 65 | 605 |  |
| 53 | audit screen | 17 |  | 103/221 | 57 | 581 |  |
| 54 | audit 0 min | 0 |  | 503/598 | 105 | 790 | 80 errors |
| 55 | audit 2 min | 0 |  | 594/709 | 101 | 1101 | 80 errors |
| 56 | audit 3 min | 0 |  | 655/800 | 105 | 1188 | 80 errors |
| 57 | audit 4 min | 0 |  | 424/527 | 97 | 1190 | 80 errors |
| 58 | audit 5 min | 0 |  | 821/1010 | 101 | 1272 | 80 errors |
| 59 | audit 7 min | 0 |  | 773/915 | 105 | 1186 | 80 errors |
| 60 | audit 8 min | 0 |  | 569/676 | 93 | 1251 | 80 errors |
| 61 | audit 10 min | 0 |  | 917/1116 | 101 | 1245 | 80 errors |
| 62 | audit 12 min | 0 |  | 197/244 | 85 | 1235 | 80 errors |
| 63 | audit 13 min | 0 |  | 144/185 | 34 | 1249 |  |
| 64 | audit 15 min | 0 |  | 95/118 | 61 | 1271 |  |
| 65 | audit finished | 0 |  | 113/222 | 61 | 1290 |  |
| 66 | audit result 1 | 0 |  |  |  | 1280 |  |
| 67 | audit result 2 | 0 |  |  |  | 1276 |  |
| 68 | audit result 3 | 0 |  |  |  | 1279 |  |
| 69 | audit result 4 | 0 |  |  |  | 1277 |  |
| 70 | audit result 5 | 0 |  |  |  | 1277 |  |
| 71 | audit result 6 | 0 |  |  |  | 1280 |  |
| 72 | audit result 7 | 0 |  |  |  | 1278 |  |
| 73 | audit result 8 | 0 |  |  |  | 1280 |  |
| 74 | audit result 9 | 0 |  |  |  | 1278 |  |
| 75 | audit result 10 | 0 |  |  |  | 1278 |  |
| 76 | audit result 11 | 0 |  |  |  | 1281 |  |
| 77 | audit result 12 | 0 |  |  |  | 1279 |  |
| 78 | about for debug log | 3093 |  | 21/35 | 57 | 1320 |  |
| 79 | debug log screen | 1 |  | 95/212 | 53 | 1320 |  |

## Errors

### 1 open app
```
11-22 10:22:52.948 E/australianrates(10494): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-22 10:26:33.613 E/australianrates(12798): Not starting debugger since process cannot load the jdwp agent.
```

### 51 cold relaunch
```
11-22 10:30:19.871 E/australianrates(15921): Not starting debugger since process cannot load the jdwp agent.
```

### 54 audit 0 min
```
11-22 10:31:23.857 E/ReactNativeJS(15921): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrp5gch-83ba4480e03eb52c","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":4397.9,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":221.9,"liveStage:dates-index:fetched:ms":234.3,"liveStage:revision:verified:ms":42.2,"liveStage:Core asset:downloaded:ms":183.2,"liveStage:Core asset:hash-verified:ms":7.1,"liveStage:Core asset:native-inflated-and-text-decoded:ms":137.8,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":246.7,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":514.8,"liveStage:Details asset:downloaded:ms":1146.2,"liveStage:Details asset:hash-verified:ms":31.9,"live…
11-22 10:31:23.859 E/unknown:ReactNative(15921): ?anon_0_@1:3691545
11-22 10:31:23.859 E/unknown:ReactNative(15921): ?anon_0_@1:3697345
11-22 10:31:23.859 E/unknown:ReactNative(15921): SyntheticError@1:162984
11-22 10:31:23.859 E/unknown:ReactNative(15921): Wrapper@1:163499
11-22 10:31:23.859 E/unknown:ReactNative(15921): _callSuper@1:148372
11-22 10:31:23.859 E/unknown:ReactNative(15921): _construct@1:163847
11-22 10:31:23.859 E/unknown:ReactNative(15921): _next@1:594835
```

### 55 audit 2 min
```
11-22 10:32:16.500 E/ReactNativeJS(15921): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrp5gch-83ba4480e03eb52c","check":{"id":"journey-rates-warm","label":"Rates (warm)","kind":"journey","status":"fail","durationMs":2034.7,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1070.5,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates","journeyLabel":"Rates","iteration":"warm","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1070.5,"firstReadyFrameObserved":true,"firstReadyFrameMs":165.0383290000027,"backgroundSettleMs":674.8,"destinationReadinessMs":165,"backgroundTasks":"Product details, Search index availability","backMs":125.6,"firstBackMs":125.6,"firstBackDestination":"/performance-audit","orig…
11-22 10:32:16.506 E/unknown:ReactNative(15921): ?anon_0_@1:3691545
11-22 10:32:16.506 E/unknown:ReactNative(15921): ?anon_0_@1:3697345
11-22 10:32:16.506 E/unknown:ReactNative(15921): SyntheticError@1:162984
11-22 10:32:16.506 E/unknown:ReactNative(15921): Wrapper@1:163499
11-22 10:32:16.506 E/unknown:ReactNative(15921): _callSuper@1:148372
11-22 10:32:16.506 E/unknown:ReactNative(15921): _construct@1:163847
11-22 10:32:16.506 E/unknown:ReactNative(15921): _next@1:594835
```

### 56 audit 3 min
```
11-22 10:33:15.447 E/ReactNativeJS(15921): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrp5gch-83ba4480e03eb52c","check":{"id":"deep-first-pass.route.rates.search.compare.open","label":"route.rates: search.compare.open (first-pass)","kind":"journey","status":"fail","durationMs":1463.6,"metrics":{"journeyId":"route.rates.search.compare.open","journeyLabel":"route.rates: search.compare.open","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.compare.open","depth":2,"plannedExpectedPath":"/compare","expectedPath":"/compare","expectedSurface":"compare.table","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":12,"actionRevisionAfter":13,"renderRevisionBefore":"state-61","actionMs":270,"preActionWaitMs":1,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scro…
11-22 10:33:15.448 E/unknown:ReactNative(15921): ?anon_0_@1:3691545
11-22 10:33:15.448 E/unknown:ReactNative(15921): ?anon_0_@1:3697345
11-22 10:33:15.448 E/unknown:ReactNative(15921): SyntheticError@1:162984
11-22 10:33:15.448 E/unknown:ReactNative(15921): Wrapper@1:163499
11-22 10:33:15.448 E/unknown:ReactNative(15921): _callSuper@1:148372
11-22 10:33:15.448 E/unknown:ReactNative(15921): _construct@1:163847
11-22 10:33:15.448 E/unknown:ReactNative(15921): _next@1:594835
```

### 57 audit 4 min
```
11-22 10:34:53.898 E/ReactNativeJS(15921): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrp5gch-83ba4480e03eb52c","check":{"id":"deep-first-pass.route.lender.lender.history.date.previous","label":"route.lender: lender.history.date.previous (first-pass)","kind":"journey","status":"fail","durationMs":10015.4,"metrics":{"journeyId":"route.lender.lender.history.date.previous","journeyLabel":"route.lender: lender.history.date.previous","iteration":"cold","passId":"first-pass","scenarioId":"route.lender","semanticActionId":"lender.history.date.previous","depth":3,"plannedExpectedPath":"/bank/People%20First%20and%20Heritage%20Bank","expectedPath":"/bank/People%20First%20and%20Heritage%20Bank","expectedSurface":"lender.details","actionSource":"lender.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":2,"actionRevisionAfter":3,"renderRevisionBefore":"People First and Heritage Bank:8:1:7:rich:26:9c369287e53a…:People First and Heritage Bank:Savings:2026-11-22:194:1…
11-22 10:34:53.900 E/unknown:ReactNative(15921): ?anon_0_@1:3691545
11-22 10:34:53.900 E/unknown:ReactNative(15921): ?anon_0_@1:3697345
11-22 10:34:53.900 E/unknown:ReactNative(15921): SyntheticError@1:162984
11-22 10:34:53.900 E/unknown:ReactNative(15921): Wrapper@1:163499
11-22 10:34:53.900 E/unknown:ReactNative(15921): _callSuper@1:148372
11-22 10:34:53.900 E/unknown:ReactNative(15921): _construct@1:163847
11-22 10:34:53.900 E/unknown:ReactNative(15921): _next@1:594835
```

### 58 audit 5 min
```
11-22 10:35:49.353 E/ReactNativeJS(15921): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrp5gch-83ba4480e03eb52c","check":{"id":"deep-first-pass.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (first-pass)","kind":"journey","status":"fail","durationMs":1489.3,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/People%20First%20and%20Heritage%20Bank%7Cd9772ff5-78d8-46c4-b489-caa0f05d4c98%7CTRANS_AND_SAVINGS_ACCOUNTS%7CDream%20Fund","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBef…
11-22 10:35:49.355 E/unknown:ReactNative(15921): ?anon_0_@1:3691545
11-22 10:35:49.355 E/unknown:ReactNative(15921): ?anon_0_@1:3697345
11-22 10:35:49.355 E/unknown:ReactNative(15921): SyntheticError@1:162984
11-22 10:35:49.355 E/unknown:ReactNative(15921): Wrapper@1:163499
11-22 10:35:49.355 E/unknown:ReactNative(15921): _callSuper@1:148372
11-22 10:35:49.355 E/unknown:ReactNative(15921): _construct@1:163847
11-22 10:35:49.355 E/unknown:ReactNative(15921): _next@1:594835
```

### 59 audit 7 min
```
11-22 10:37:18.514 E/ReactNativeJS(15921): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrp5gch-83ba4480e03eb52c","check":{"id":"deep-first-pass.redirect.projections.redirect.projections.verify","label":"redirect.projections: redirect.projections.verify (first-pass)","kind":"journey","status":"fail","durationMs":1278.4,"metrics":{"journeyId":"redirect.projections.redirect.projections.verify","journeyLabel":"redirect.projections: redirect.projections.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.projections","semanticActionId":"redirect.projections.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"projections.inputs","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":353,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":143.2,"forwardWork…
11-22 10:37:18.515 E/unknown:ReactNative(15921): ?anon_0_@1:3691545
11-22 10:37:18.515 E/unknown:ReactNative(15921): ?anon_0_@1:3697345
11-22 10:37:18.515 E/unknown:ReactNative(15921): SyntheticError@1:162984
11-22 10:37:18.515 E/unknown:ReactNative(15921): Wrapper@1:163499
11-22 10:37:18.515 E/unknown:ReactNative(15921): _callSuper@1:148372
11-22 10:37:18.515 E/unknown:ReactNative(15921): _construct@1:163847
11-22 10:37:18.515 E/unknown:ReactNative(15921): _next@1:594835
```

### 60 audit 8 min
```
11-22 10:38:59.247 E/ReactNativeJS(15921): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrp5gch-83ba4480e03eb52c","check":{"id":"deep-repeat.route.receipt.receipt.back-to-product","label":"route.receipt: receipt.back-to-product (repeat)","kind":"journey","status":"fail","durationMs":2465.5,"metrics":{"journeyId":"route.receipt.receipt.back-to-product","journeyLabel":"route.receipt: receipt.back-to-product","iteration":"warm","passId":"repeat","scenarioId":"route.receipt","semanticActionId":"receipt.back-to-product","depth":1,"plannedExpectedPath":"/product/People%20First%20and%20Heritage%20Bank%7Cd9772ff5-78d8-46c4-b489-caa0f05d4c98%7CTRANS_AND_SAVINGS_ACCOUNTS%7CDream%20Fund","expectedPath":"/product/People%20First%20and%20Heritage%20Bank%7Cd9772ff5-78d8-46c4-b489-caa0f05d4c98%7CTRANS_AND_SAVINGS_ACCOUNTS%7CDream%20Fund","expectedSurface":"product.details","actionSource":"receipt.evidence","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRevisionAfter…
11-22 10:38:59.248 E/unknown:ReactNative(15921): ?anon_0_@1:3691545
11-22 10:38:59.248 E/unknown:ReactNative(15921): ?anon_0_@1:3697345
11-22 10:38:59.248 E/unknown:ReactNative(15921): SyntheticError@1:162984
11-22 10:38:59.248 E/unknown:ReactNative(15921): Wrapper@1:163499
11-22 10:38:59.248 E/unknown:ReactNative(15921): _callSuper@1:148372
11-22 10:38:59.248 E/unknown:ReactNative(15921): _construct@1:163847
11-22 10:38:59.248 E/unknown:ReactNative(15921): _next@1:594835
```

### 61 audit 10 min
```
11-22 10:40:14.160 E/ReactNativeJS(15921): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrp5gch-83ba4480e03eb52c","check":{"id":"deep-repeat.route.calculator.calculator.open","label":"route.calculator: calculator.open (repeat)","kind":"journey","status":"fail","durationMs":2143.5,"metrics":{"journeyId":"route.calculator.calculator.open","journeyLabel":"route.calculator: calculator.open","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.open","depth":0,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":560,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":201,"forwardWorkMs":201,"navigationCommitMs":0,"firstReadyFrameMs":200.9,"firstReadyFrameObserved":true,"readi…
11-22 10:40:14.161 E/unknown:ReactNative(15921): ?anon_0_@1:3691545
11-22 10:40:14.161 E/unknown:ReactNative(15921): ?anon_0_@1:3697345
11-22 10:40:14.161 E/unknown:ReactNative(15921): SyntheticError@1:162984
11-22 10:40:14.161 E/unknown:ReactNative(15921): Wrapper@1:163499
11-22 10:40:14.161 E/unknown:ReactNative(15921): _callSuper@1:148372
11-22 10:40:14.161 E/unknown:ReactNative(15921): _construct@1:163847
11-22 10:40:14.161 E/unknown:ReactNative(15921): _next@1:594835
```

### 62 audit 12 min
```
11-22 10:42:11.030 E/ReactNativeJS(15921): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrp5gch-83ba4480e03eb52c","check":{"id":"deep-repeat.redirect.root.redirect.root.verify","label":"redirect.root: redirect.root.verify (repeat)","kind":"journey","status":"fail","durationMs":1745,"metrics":{"journeyId":"redirect.root.redirect.root.verify","journeyLabel":"redirect.root: redirect.root.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.root","semanticActionId":"redirect.root.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":81.2,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":674.9,"forwardWorkMs":674.9,"navigationCommitMs":353.7,"firstReadyFrameMs":321.2,"firstReadyFrameObserved":true,"r…
11-22 10:42:11.031 E/unknown:ReactNative(15921): ?anon_0_@1:3691545
11-22 10:42:11.031 E/unknown:ReactNative(15921): ?anon_0_@1:3697345
11-22 10:42:11.031 E/unknown:ReactNative(15921): SyntheticError@1:162984
11-22 10:42:11.031 E/unknown:ReactNative(15921): Wrapper@1:163499
11-22 10:42:11.031 E/unknown:ReactNative(15921): _callSuper@1:148372
11-22 10:42:11.031 E/unknown:ReactNative(15921): _construct@1:163847
11-22 10:42:11.031 E/unknown:ReactNative(15921): _next@1:594835
```
