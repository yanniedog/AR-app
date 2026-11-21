# App explorer: 1.0.351 (407)

**Real-use session ATTENTION vs 1.0.351: 0 broken, 11 friction, 1 slower**

- Friction: No reaction for 3.1 s after "scroll rates 1"
- Friction: No reaction for 3.3 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.2 s after "scroll lenders"
- Friction: No reaction for 3.9 s after "switch to savings"
- Friction: No reaction for 3.0 s after "open market"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Slower: "open rba" content 0.0 s to 2.3 s

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode full | 79 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 12
Baseline 1.0.351
**Audit live: outcome completed | 968 s | audit log 854918 bytes (audit-log.txt) https://paste.c-net.org/c52fecc5-233e-8544-71d2-c09a23b57988 | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2654 | -28015 | 540/856 | 77 | 523 | 1 errors; start 2580ms; boot js-start 412859, layout-mounted 413222, cache-read 413539, hydrated 413840, splash-hide 413840, manifest 414888, resolved 415323, core-fetched 420031, core-saved 421051, rows-prepared 421271, search-index-idle 421271, leading-requested 421271, details-start 421485, leading-scoped 421697, pricing-ready 422485, last-gate 425854, details-fetched 430948, detail-filters-idle 436447, last-pricing 436447, suitability-built 437843, post-refresh-wait 438824, leading-page 440351, last-rows 446762, rates-ready 446966, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 143, pricing-scope-ms 10202, leading-short 1, leading-short-rows 0, leading-scope-rows 113, leading-visible-rows 0, leading-nonstd-rows 10, filter-runs 4, filter-rows 63396, filter-yields 8, filter-ms 774, sort-runs 5, sort-rows 1182, sort-yields 5, sort-ms 2397 |
| 2 | scroll rates 1 | 744 | +26 | 17/28 | 57 | 642 |  |
| 3 | scroll rates 2 | 5722 | +5031 | 34/65 | 65 | 550 |  |
| 4 | scroll rates back | 691 | +22 |  |  | 532 |  |
| 5 | open product | 2685 | -2658 | 34/57 | 101 | 657 |  |
| 6 | scroll product | 715 | +7 | 32/57 | 77 | 685 |  |
| 7 | back to rates | 29 | +8 | 10/20 | 81 | 652 |  |
| 8 | open lenders | 24 | +5 | 20/23 | 250 | 660 |  |
| 9 | scroll lenders | 769 | +63 | 18/21 | 133 | 657 |  |
| 10 | back from lenders | 25 | +5 | 8/10 | 200 | 659 |  |
| 11 | switch to savings | 28 | +9 | 39/59 | 77 | 672 |  |
| 12 | switch to home loans | 28 | +9 | 13/30 | 53 | 686 |  |
| 13 | open filters | 25 | +6 | 22/27 | 105 | 696 |  |
| 14 | close filters | 23 | 0 | 9/11 | 113 | 680 |  |
| 15 | open market | 22 | +4 | 16/33 | 65 | 683 |  |
| 16 | open rba | 2498 | +2479 | 43/66 | 57 | 683 |  |
| 17 | scroll rba | 713 | +30 | 23/41 | 69 | 681 |  |
| 18 | back from rba | 28 | +7 | 9/20 | 53 | 682 |  |
| 19 | scroll market | 717 | -2 | 25/44 | 73 | 682 |  |
| 20 | open saved | 22 | +4 | 10/17 | 81 | 688 |  |
| 21 | return to rates | 25 | +5 | 19/36 | 69 | 690 |  |
| 22 | cold start | 9334 | +175 | 31/42 | 81 | 592 | 1 errors; start 3689ms; boot js-start 644153, layout-mounted 644349, hydrated 644392, cache-read 645534, core-ready 646085, rows-prepared 646222, search-index-idle 646222, detail-filters-idle 646222, leading-requested 646222, last-pricing 646222, splash-hide 646223, manifest 647814, leading-scoped 648368, leading-page 648368, resolved 648827, pricing-ready 649451, last-rows 649451, rates-ready 649595, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 18, pricing-scope-ms 1554, filter-runs 1, filter-rows 6878, filter-yields 3, filter-ms 77, sort-runs 1, sort-rows 1182, sort-yields 1, sort-ms 12 |
| 23 | /browse | 2248 |  | 2/2 | 22 | 443 |  |
| 24 | /watchlist | 27 |  | 2/3 | 44 | 527 |  |
| 25 | /market | 28 |  | 13/22 | 53 | 608 |  |
| 26 | /tools | 4492 |  | 13/22 | 85 | 614 |  |
| 27 | /trends | 32 |  | 24/36 | 89 | 608 |  |
| 28 | /search | 23 |  | 30/45 | 109 | 624 |  |
| 29 | /banks | 25 |  | 31/41 | 121 | 637 |  |
| 30 | /bank-rates | 29 |  | 19/30 | 77 | 651 |  |
| 31 | /categories | 23 |  | 35/49 | 85 | 666 |  |
| 32 | /catalogue | 29 |  | 31/45 | 101 | 689 |  |
| 33 | /compare | 22 |  | 11/16 | 105 | 672 |  |
| 34 | /matches | 28 |  | 36/51 | 81 | 707 |  |
| 35 | /calculator | 24 |  | 14/22 | 73 | 690 |  |
| 36 | /projections | 26 |  | 23/37 | 77 | 695 |  |
| 37 | /profile | 25 |  | 13/25 | 65 | 702 |  |
| 38 | /research | 24 |  | 18/26 | 77 | 713 |  |
| 39 | /rba | 28 |  | 10/23 | 81 | 721 |  |
| 40 | /rba-response | 23 |  | 18/28 | 85 | 725 |  |
| 41 | /settings | 22 |  | 13/23 | 101 | 736 |  |
| 42 | /about | 28 |  | 13/24 | 53 | 738 |  |
| 43 | /terms | 24 |  | 12/22 | 65 | 741 |  |
| 44 | /privacy | 24 |  |  |  | 741 |  |
| 45 | /third-party-notices | 26 |  | 11/24 | 73 | 746 |  |
| 46 | /node | 31 |  | 30/46 | 93 | 783 |  |
| 47 | /passthrough | 28 |  | 33/49 | 93 | 757 |  |
| 48 | /calculation-receipt | 26 |  | 12/25 | 61 | 752 |  |
| 49 | /rate-receipt | 25 |  | 7/10 | 77 | 754 |  |
| 50 | warm resume | 235 |  | 3/4 | 121 | 753 |  |
| 51 | cold relaunch | 9221 |  | 29/43 | 73 | 578 | 1 errors; start 3376ms; boot js-start 874799, layout-mounted 874977, hydrated 875045, cache-read 876203, core-ready 876823, rows-prepared 876937, search-index-idle 876937, detail-filters-idle 876937, leading-requested 876937, last-pricing 876937, splash-hide 876938, manifest 878441, leading-scoped 878991, leading-page 878991, resolved 879427, pricing-ready 880053, last-rows 880053, rates-ready 880194, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 22, pricing-scope-ms 1524, filter-runs 1, filter-rows 6878, filter-yields 3, filter-ms 74, sort-runs 1, sort-rows 1182, sort-yields 1, sort-ms 11 |
| 52 | about | 34 | +13 | 12/21 | 53 | 410 |  |
| 53 | audit screen | 25 | +6 | 108/217 | 57 | 606 |  |
| 54 | audit 0 min | 0 | 0 | 491/577 | 109 | 761 | 80 errors |
| 55 | audit 2 min | 0 | 0 | 800/927 | 109 | 1034 | 80 errors |
| 56 | audit 4 min | 0 |  | 840/1003 | 105 | 1170 | 80 errors |
| 57 | audit 5 min | 0 | 0 | 864/1045 | 105 | 1247 | 80 errors |
| 58 | audit 7 min | 0 | 0 | 710/828 | 109 | 1170 | 80 errors |
| 59 | audit 9 min | 0 | 0 | 553/663 | 101 | 1268 | 80 errors |
| 60 | audit 10 min | 0 | 0 | 868/1062 | 105 | 1243 | 80 errors |
| 61 | audit 11 min | 0 | 0 | 162/192 | 105 | 1221 | 80 errors |
| 62 | audit 13 min | 0 | 0 | 195/241 | 34 | 1250 | 38 errors |
| 63 | audit 14 min | 0 |  | 141/177 | 36 | 1257 |  |
| 64 | audit 15 min | 0 | 0 | 37/47 | 61 | 1279 |  |
| 65 | audit finished | 0 | 0 | 114/213 | 65 | 1313 |  |
| 66 | audit result 1 | 0 | 0 |  |  | 1266 |  |
| 67 | audit result 2 | 0 | 0 |  |  | 1266 |  |
| 68 | audit result 3 | 0 | 0 |  |  | 1268 |  |
| 69 | audit result 4 | 0 | 0 |  |  | 1265 |  |
| 70 | audit result 5 | 0 | 0 |  |  | 1268 |  |
| 71 | audit result 6 | 0 | 0 |  |  | 1266 |  |
| 72 | audit result 7 | 0 | 0 |  |  | 1269 |  |
| 73 | audit result 8 | 0 | 0 |  |  | 1270 |  |
| 74 | audit result 9 | 0 | 0 |  |  | 1267 |  |
| 75 | audit result 10 | 0 | 0 |  |  | 1271 |  |
| 76 | audit result 11 | 0 | 0 |  |  | 1268 |  |
| 77 | audit result 12 | 0 | 0 |  |  | 1271 |  |
| 78 | about for debug log | 3135 | +67 | 20/31 | 69 | 1300 |  |
| 79 | debug log screen | 0 | 0 | 92/201 | 53 | 1320 |  |

## Errors

### 1 open app
```
11-21 21:59:51.791 E/australianrates(10505): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-21 22:03:43.752 E/australianrates(12815): Not starting debugger since process cannot load the jdwp agent.
```

### 51 cold relaunch
```
11-21 22:07:34.521 E/australianrates(15797): Not starting debugger since process cannot load the jdwp agent.
```

### 54 audit 0 min
```
11-21 22:08:39.741 E/ReactNativeJS(15797): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqymaml-15cb6624b9a5327f","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":4230.5,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":289.2,"liveStage:dates-index:fetched:ms":217.5,"liveStage:revision:verified:ms":54.4,"liveStage:Core asset:downloaded:ms":189.5,"liveStage:Core asset:hash-verified:ms":5.4,"liveStage:Core asset:native-inflated-and-text-decoded:ms":167.9,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":213.8,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":526.9,"liveStage:Details asset:downloaded:ms":1018.5,"liveStage:Details asset:hash-verified:ms":29.2,"live…
11-21 22:08:39.744 E/unknown:ReactNative(15797): ?anon_0_@1:3691375
11-21 22:08:39.744 E/unknown:ReactNative(15797): ?anon_0_@1:3697175
11-21 22:08:39.744 E/unknown:ReactNative(15797): SyntheticError@1:162984
11-21 22:08:39.744 E/unknown:ReactNative(15797): Wrapper@1:163499
11-21 22:08:39.744 E/unknown:ReactNative(15797): _callSuper@1:148372
11-21 22:08:39.744 E/unknown:ReactNative(15797): _construct@1:163847
11-21 22:08:39.744 E/unknown:ReactNative(15797): _next@1:594835
```

### 55 audit 2 min
```
11-21 22:09:28.417 E/ReactNativeJS(15797): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqymaml-15cb6624b9a5327f","check":{"id":"journey-compare-cold","label":"Product comparison (cold)","kind":"journey","status":"fail","durationMs":1364.4,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":584.8,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"compare","journeyLabel":"Product comparison","iteration":"cold","expectedPath":"/compare","expectedSurface":"compare.table","navigationKind":"stack","forwardMs":584.8,"firstReadyFrameObserved":true,"firstReadyFrameMs":368.87757400004193,"backgroundSettleMs":422.4,"destinationReadinessMs":368.9,"backMs":37.6,"firstBackMs":37.6,"firstBackDestination":"/performance-audit","originReadinessMs":4.7,"backDestination":"/performance-audit","backChangedPath":tr…
11-21 22:09:28.423 E/unknown:ReactNative(15797): ?anon_0_@1:3691375
11-21 22:09:28.423 E/unknown:ReactNative(15797): ?anon_0_@1:3697175
11-21 22:09:28.423 E/unknown:ReactNative(15797): SyntheticError@1:162984
11-21 22:09:28.423 E/unknown:ReactNative(15797): Wrapper@1:163499
11-21 22:09:28.423 E/unknown:ReactNative(15797): _callSuper@1:148372
11-21 22:09:28.423 E/unknown:ReactNative(15797): _construct@1:163847
11-21 22:09:28.423 E/unknown:ReactNative(15797): _next@1:594835
```

### 56 audit 4 min
```
11-21 22:11:12.318 E/ReactNativeJS(15797): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqymaml-15cb6624b9a5327f","check":{"id":"deep-first-pass.route.market.market.history.open","label":"route.market: market.history.open (first-pass)","kind":"journey","status":"fail","durationMs":1767.7,"metrics":{"journeyId":"route.market.market.history.open","journeyLabel":"route.market: market.history.open","iteration":"cold","passId":"first-pass","scenarioId":"route.market","semanticActionId":"market.history.open","depth":1,"plannedExpectedPath":"/bank-rates","expectedPath":"/bank-rates","expectedSurface":"bank-rates.dashboard","actionSource":"market.overview","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRevisionAfter":4,"renderRevisionBefore":"state-1","actionMs":167.9,"preActionWaitMs":212.1,"preActionQuietWindowReused":false,"preActionQuietWindowAvoidedMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"r…
11-21 22:11:12.320 E/unknown:ReactNative(15797): ?anon_0_@1:3691375
11-21 22:11:12.320 E/unknown:ReactNative(15797): ?anon_0_@1:3697175
11-21 22:11:12.320 E/unknown:ReactNative(15797): SyntheticError@1:162984
11-21 22:11:12.320 E/unknown:ReactNative(15797): Wrapper@1:163499
11-21 22:11:12.320 E/unknown:ReactNative(15797): _callSuper@1:148372
11-21 22:11:12.320 E/unknown:ReactNative(15797): _construct@1:163847
11-21 22:11:12.320 E/unknown:ReactNative(15797): _next@1:594835
```

### 57 audit 5 min
```
11-21 22:12:50.263 E/ReactNativeJS(15797): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqymaml-15cb6624b9a5327f","check":{"id":"deep-first-pass.sample.catalogue.5.product.lender.open","label":"sample.catalogue.5: product.lender.open (first-pass)","kind":"journey","status":"fail","durationMs":2342.6,"metrics":{"journeyId":"sample.catalogue.5.product.lender.open","journeyLabel":"sample.catalogue.5: product.lender.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.5","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/Teachers%20Mutual%20Bank","expectedPath":"/bank/Teachers%20Mutual%20Bank","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":10,"actionRevisionAfter":11,"actionResultEvidence":"{\"expectedPath\":\"/bank/Teachers%20Mutual%20Bank\"}","actionMs":947.9,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQuietWindowAvoide…
11-21 22:12:50.496 E/unknown:ReactNative(15797): ?anon_0_@1:3691375
11-21 22:12:50.496 E/unknown:ReactNative(15797): ?anon_0_@1:3697175
11-21 22:12:50.496 E/unknown:ReactNative(15797): SyntheticError@1:162984
11-21 22:12:50.496 E/unknown:ReactNative(15797): Wrapper@1:163499
11-21 22:12:50.496 E/unknown:ReactNative(15797): _callSuper@1:148372
11-21 22:12:50.496 E/unknown:ReactNative(15797): _construct@1:163847
11-21 22:12:50.496 E/unknown:ReactNative(15797): _next@1:594835
```

### 58 audit 7 min
```
11-21 22:14:38.200 E/ReactNativeJS(15797): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqymaml-15cb6624b9a5327f","check":{"id":"deep-first-pass.redirect.projections.redirect.projections.verify","label":"redirect.projections: redirect.projections.verify (first-pass)","kind":"journey","status":"fail","durationMs":1828.6,"metrics":{"journeyId":"redirect.projections.redirect.projections.verify","journeyLabel":"redirect.projections: redirect.projections.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.projections","semanticActionId":"redirect.projections.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"projections.inputs","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":792,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":255.7,"forwardWork…
11-21 22:14:38.202 E/unknown:ReactNative(15797): ?anon_0_@1:3691375
11-21 22:14:38.202 E/unknown:ReactNative(15797): ?anon_0_@1:3697175
11-21 22:14:38.202 E/unknown:ReactNative(15797): SyntheticError@1:162984
11-21 22:14:38.202 E/unknown:ReactNative(15797): Wrapper@1:163499
11-21 22:14:38.202 E/unknown:ReactNative(15797): _callSuper@1:148372
11-21 22:14:38.202 E/unknown:ReactNative(15797): _construct@1:163847
11-21 22:14:38.202 E/unknown:ReactNative(15797): _next@1:594835
```

### 59 audit 9 min
```
11-21 22:16:13.617 E/ReactNativeJS(15797): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqymaml-15cb6624b9a5327f","check":{"id":"deep-repeat.route.product-calculation.product.calculate.open","label":"route.product-calculation: product.calculate.open (repeat)","kind":"journey","status":"fail","durationMs":1054.2,"metrics":{"journeyId":"route.product-calculation.product.calculate.open","journeyLabel":"route.product-calculation: product.calculate.open","iteration":"warm","passId":"repeat","scenarioId":"route.product-calculation","semanticActionId":"product.calculate.open","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"actionResultEvidence":"{\"expectedPath\":\"/calculator\"}","actionMs":261.1,"preActionWaitMs":3,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimum…
11-21 22:16:13.618 E/unknown:ReactNative(15797): ?anon_0_@1:3691375
11-21 22:16:13.618 E/unknown:ReactNative(15797): ?anon_0_@1:3697175
11-21 22:16:13.618 E/unknown:ReactNative(15797): SyntheticError@1:162984
11-21 22:16:13.618 E/unknown:ReactNative(15797): Wrapper@1:163499
11-21 22:16:13.618 E/unknown:ReactNative(15797): _callSuper@1:148372
11-21 22:16:13.618 E/unknown:ReactNative(15797): _construct@1:163847
11-21 22:16:13.618 E/unknown:ReactNative(15797): _next@1:594835
```

### 60 audit 10 min
```
11-21 22:17:51.690 E/ReactNativeJS(15797): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqymaml-15cb6624b9a5327f","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1484,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Teachers%20Mutual%20Bank%7C547fbdc8-8e95-4f1f-9481-df8c742394ba%7CTERM_DEPOSITS%7CTerm%20Deposit%20for%20Customers","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisi…
11-21 22:17:51.692 E/unknown:ReactNative(15797): ?anon_0_@1:3691375
11-21 22:17:51.692 E/unknown:ReactNative(15797): ?anon_0_@1:3697175
11-21 22:17:51.692 E/unknown:ReactNative(15797): SyntheticError@1:162984
11-21 22:17:51.692 E/unknown:ReactNative(15797): Wrapper@1:163499
11-21 22:17:51.692 E/unknown:ReactNative(15797): _callSuper@1:148372
11-21 22:17:51.692 E/unknown:ReactNative(15797): _construct@1:163847
11-21 22:17:51.692 E/unknown:ReactNative(15797): _next@1:594835
```

### 61 audit 11 min
```
11-21 22:19:24.983 E/ReactNativeJS(15797): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqymaml-15cb6624b9a5327f","check":{"id":"deep-repeat.redirect.projections.redirect.projections.verify","label":"redirect.projections: redirect.projections.verify (repeat)","kind":"journey","status":"fail","durationMs":1509.6,"metrics":{"journeyId":"redirect.projections.redirect.projections.verify","journeyLabel":"redirect.projections: redirect.projections.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.projections","semanticActionId":"redirect.projections.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"projections.inputs","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":448.3,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":243.5,"forwardWorkMs":243.5,…
11-21 22:19:24.984 E/unknown:ReactNative(15797): ?anon_0_@1:3691375
11-21 22:19:24.984 E/unknown:ReactNative(15797): ?anon_0_@1:3697175
11-21 22:19:24.984 E/unknown:ReactNative(15797): SyntheticError@1:162984
11-21 22:19:24.984 E/unknown:ReactNative(15797): Wrapper@1:163499
11-21 22:19:24.984 E/unknown:ReactNative(15797): _callSuper@1:148372
11-21 22:19:24.984 E/unknown:ReactNative(15797): _construct@1:163847
11-21 22:19:24.984 E/unknown:ReactNative(15797): _next@1:594835
```

### 62 audit 13 min
```
11-21 22:19:52.716 E/ReactNativeJS(15797): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwqymaml-15cb6624b9a5327f","check":{"id":"external-link-148","kind":"network","status":"fail","durationMs":1263.969821000006,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"pass","browserHandler":"pass","httpReachability":"fail","statusCode":404,"handlerAttempted":true,"httpAttempted":true,"httpSelected":true,"handlerResolution":"pass","host":"www.bankaust.com.au","destinationPath":"/clean-energy-home-loan-key-information"},"error":"HTTP 404: the destination is missing or unavailable.","canonicalMetrics":true}}
11-21 22:19:52.719 E/unknown:ReactNative(15797): ?anon_0_@1:3691375
11-21 22:19:52.719 E/unknown:ReactNative(15797): ?anon_0_@1:3700736
11-21 22:19:52.719 E/unknown:ReactNative(15797): SyntheticError@1:162984
11-21 22:19:52.719 E/unknown:ReactNative(15797): Wrapper@1:163499
11-21 22:19:52.719 E/unknown:ReactNative(15797): _callSuper@1:148372
11-21 22:19:52.719 E/unknown:ReactNative(15797): _construct@1:163847
11-21 22:19:52.719 E/unknown:ReactNative(15797): _next@1:594835
```
