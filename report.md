# App explorer: 1.0.355 (411)

**Real-use session FAIL vs 1.0.355: 1 broken, 14 friction, 14 slower**

- Broken: 96% dropped frames on "scroll lenders"
- Friction: No reaction for 3.5 s after "scroll rates 1"
- Friction: No reaction for 3.6 s after "scroll rates 2"
- Friction: No reaction for 3.0 s after "open lenders"
- Friction: No reaction for 3.3 s after "scroll lenders"
- Friction: No reaction for 5.0 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.5 s after "open filters"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "open rba"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Slower: Dropped frames 49% to 72% on "open app"
- Slower: "open app" content 23.1 s to 38.7 s
- Slower: "open app" reaction 23.1 s to 38.7 s
- Slower: Dropped frames 51% to 74% on "scroll rates 2"
- Slower: Dropped frames 46% to 65% on "open product"
- Slower: Dropped frames 42% to 64% on "back to rates"
- Slower: Dropped frames 44% to 74% on "switch to savings"
- Slower: "switch to savings" content 3.3 s to 5.0 s
- Slower: "switch to savings" reaction 3.3 s to 5.0 s
- Slower: Dropped frames 40% to 74% on "open rba"
- Slower: Dropped frames 42% to 64% on "scroll rba"
- Slower: Dropped frames 29% to 50% on "back from rba"
- Slower: Dropped frames 45% to 63% on "scroll market"
- Slower: Dropped frames 36% to 55% on "return to rates"

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode full | 83 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 15
Baseline 1.0.355
**Audit live: outcome completed | 1129 s | audit log 867074 bytes (audit-log.txt) https://paste.c-net.org/7dbca5ef-e92d-1e10-ba79-291f3c741bd9 | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3267 | -22212 | 683/943 | 85 | 496 | 1 errors; start 3213ms |
| 2 | scroll rates 1 | 718 | +25 | 34/53 | 85 | 483 | boot js-start 436019, layout-mounted 436851, cache-read 437021, hydrated 437326, splash-hide 437326, manifest 438639, resolved 439180, core-fetched 444457, core-saved 445481, rows-prepared 445791, search-index-idle 445791, leading-requested 445791, details-start 446324, leading-scoped 446476, pricing-ready 447965, last-gate 452403, details-fetched 457960, detail-filters-idle 465576, last-pricing 465576, suitability-built 466837, post-refresh-wait 467974, leading-page 470512, last-rows 479708, rates-ready 479915, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 198, pricing-scope-ms 14309, leading-short 1, leading-short-rows 0, leading-scope-rows 113, leading-visible-rows 0, leading-nonstd-rows 10, filter-runs 3, filter-rows 38576, filter-yields 10, filter-ms 892, sort-runs 5, sort-rows 1182, sort-yields 5, sort-ms 3343 |
| 3 | scroll rates 2 | 699 | +26 | 34/46 | 81 | 649 |  |
| 4 | scroll rates back | 680 | +3 |  |  | 556 |  |
| 5 | open product | 5611 | +2878 | 36/55 | 85 | 644 |  |
| 6 | scroll product | 704 | +14 | 13/26 | 69 | 649 |  |
| 7 | back to rates | 36 | +14 | 14/22 | 73 | 645 |  |
| 8 | open lenders | 26 | +8 | 21/23 | 300 | 636 |  |
| 9 | scroll lenders | 716 | +14 | 23/24 | 129 | 633 |  |
| 10 | back from lenders | 24 | +6 | 7/8 | 101 | 634 |  |
| 11 | switch to savings | 26 | +9 | 66/89 | 85 | 648 |  |
| 12 | switch to home loans | 23 | +5 | 17/30 | 73 | 665 |  |
| 13 | open filters | 25 | +6 | 21/23 | 150 | 667 |  |
| 14 | close filters | 25 | +8 | 8/9 | 105 | 666 |  |
| 15 | open market | 24 | +7 | 18/32 | 65 | 671 |  |
| 16 | open rba | 31 | -2528 | 35/47 | 65 | 663 |  |
| 17 | scroll rba | 700 | -7 | 27/42 | 77 | 663 |  |
| 18 | back from rba | 28 | +5 | 10/20 | 73 | 664 |  |
| 19 | scroll market | 713 | +27 | 26/41 | 81 | 663 |  |
| 20 | open saved | 22 | -15 | 16/32 | 73 | 667 |  |
| 21 | return to rates | 23 | +7 | 26/47 | 69 | 670 |  |
| 22 | cold start | 10487 | +2626 | 31/40 | 150 | 585 | 3 errors; start 4217ms; boot js-start 674878, layout-mounted 675069, hydrated 675200, cache-read 676439, core-ready 677296, rows-prepared 677433, search-index-idle 677433, detail-filters-idle 677433, leading-requested 677433, last-pricing 677433, splash-hide 677434, manifest 679758, leading-scoped 680168, leading-page 680168, resolved 680696, pricing-ready 681589, last-rows 681589, rates-ready 681771, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 23, pricing-scope-ms 1716, filter-runs 1, filter-rows 6878, filter-yields 4, filter-ms 102, sort-runs 1, sort-rows 1182, sort-yields 1, sort-ms 14 |
| 23 | /browse | 39 |  | 2/2 | 32 | 415 |  |
| 24 | /watchlist | 37 |  | 3/3 | 18 | 424 |  |
| 25 | /market | 27 |  | 16/22 | 65 | 520 |  |
| 26 | /tools | 34 |  | 17/22 | 101 | 583 |  |
| 27 | /trends | 27 |  |  |  | 607 |  |
| 28 | /search | 26 |  | 39/52 | 129 | 618 |  |
| 29 | /banks | 29 |  | 31/40 | 101 | 622 |  |
| 30 | /bank-rates | 25 |  | 16/24 | 89 | 635 |  |
| 31 | /categories | 24 |  | 31/49 | 89 | 648 |  |
| 32 | /catalogue | 29 |  | 32/42 | 93 | 673 |  |
| 33 | /compare | 30 |  | 10/14 | 117 | 658 |  |
| 34 | /matches | 31 |  | 33/43 | 89 | 671 |  |
| 35 | /calculator | 36 |  | 18/26 | 69 | 657 |  |
| 36 | /projections | 28 |  | 18/29 | 73 | 656 |  |
| 37 | /profile | 27 |  | 15/22 | 65 | 662 |  |
| 38 | /research | 23 |  | 17/27 | 81 | 670 |  |
| 39 | /rba | 26 |  | 17/27 | 89 | 678 |  |
| 40 | /rba-response | 30 |  | 21/34 | 73 | 679 |  |
| 41 | /settings | 32 |  | 13/21 | 73 | 685 |  |
| 42 | /about | 29 |  | 13/22 | 65 | 688 |  |
| 43 | /terms | 32 |  | 18/25 | 77 | 690 |  |
| 44 | /privacy | 31 |  |  |  | 691 |  |
| 45 | /third-party-notices | 30 |  | 14/23 | 81 | 696 |  |
| 46 | /node | 30 |  | 33/45 | 105 | 723 |  |
| 47 | /passthrough | 29 |  | 30/45 | 105 | 712 |  |
| 48 | /calculation-receipt | 35 |  | 17/28 | 85 | 701 |  |
| 49 | /rate-receipt | 30 |  | 6/9 | 85 | 703 |  |
| 50 | warm resume | 705 |  | 5/5 | 150 | 703 | start 304ms |
| 51 | cold relaunch | 12625 |  | 34/44 | 133 | 574 | 1 errors; start 3972ms; boot js-start 904891, layout-mounted 905102, hydrated 905208, cache-read 906477, core-ready 907210, rows-prepared 907348, search-index-idle 907348, detail-filters-idle 907348, leading-requested 907348, last-pricing 907348, splash-hide 907350, manifest 909617, leading-scoped 910048, leading-page 910048, resolved 910413, pricing-ready 911294, last-rows 911294, rates-ready 911490, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 23, pricing-scope-ms 1556, filter-runs 1, filter-rows 6878, filter-yields 4, filter-ms 102, sort-runs 1, sort-rows 1182, sort-yields 1, sort-ms 14 |
| 52 | about | 43 | +23 | 13/20 | 300 | 603 |  |
| 53 | audit screen | 26 | +10 | 117/205 | 61 | 582 |  |
| 54 | audit 0 min | 0 |  | 5/6 | 200 | 612 |  |
| 55 | audit 1 min | 0 | 0 | 956/1118 | 113 | 935 | 80 errors |
| 56 | audit 2 min | 0 | 0 | 169/189 | 117 | 1080 | 80 errors |
| 57 | audit 4 min | 0 | 0 | 754/852 | 109 | 1108 | 80 errors |
| 58 | audit 5 min | 0 |  | 546/647 | 105 | 1053 | 80 errors |
| 59 | audit 6 min | 0 | 0 | 707/807 | 105 | 1117 | 80 errors |
| 60 | audit 8 min | 0 |  | 511/570 | 121 | 1164 | 80 errors |
| 61 | audit 9 min | 0 | 0 | 173/185 | 105 | 1156 | 80 errors |
| 62 | audit 10 min | 0 |  | 661/768 | 109 | 1215 | 80 errors |
| 63 | audit 11 min | 0 | 0 | 461/523 | 109 | 1325 | 80 errors |
| 64 | audit 12 min | 0 | 0 | 696/819 | 97 | 1364 | 80 errors |
| 65 | audit 14 min | 0 | 0 | 493/556 | 121 | 1225 | 80 errors |
| 66 | audit 15 min | 0 |  | 99/109 | 44 | 1235 | 19 errors |
| 67 | audit 16 min | 0 |  | 145/183 | 36 | 1253 |  |
| 68 | audit 18 min | 0 |  | 125/153 | 48 | 1280 |  |
| 69 | audit finished | 0 | 0 | 123/204 | 69 | 1341 |  |
| 70 | audit result 1 | 0 | 0 |  |  | 1306 |  |
| 71 | audit result 2 | 0 | 0 |  |  | 1305 |  |
| 72 | audit result 3 | 0 | 0 |  |  | 1303 |  |
| 73 | audit result 4 | 0 | 0 |  |  | 1306 |  |
| 74 | audit result 5 | 0 | 0 |  |  | 1304 |  |
| 75 | audit result 6 | 0 | 0 |  |  | 1304 |  |
| 76 | audit result 7 | 0 | 0 |  |  | 1307 |  |
| 77 | audit result 8 | 0 | 0 |  |  | 1305 |  |
| 78 | audit result 9 | 0 | 0 |  |  | 1308 |  |
| 79 | audit result 10 | 0 | 0 |  |  | 1306 |  |
| 80 | audit result 11 | 0 | 0 |  |  | 1306 |  |
| 81 | audit result 12 | 0 | 0 |  |  | 1308 |  |
| 82 | about for debug log | 3177 | +144 | 21/32 | 77 | 1354 |  |
| 83 | debug log screen | 0 | 0 | 106/198 | 65 | 1356 |  |

## Errors

### 1 open app
```
11-22 12:02:55.575 E/australianrates(10688): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-22 12:06:55.321 E/australianrates(12940): Not starting debugger since process cannot load the jdwp agent.
11-22 12:06:59.479 E/SurfaceSyncGroup(12940): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-22 12:06:59.484 E/SurfaceSyncGroup(12940): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 51 cold relaunch
```
11-22 12:10:45.352 E/australianrates(15926): Not starting debugger since process cannot load the jdwp agent.
```

### 55 audit 1 min
```
11-22 12:12:04.563 E/ReactNativeJS(15926): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrsqpbw-6b533cfaa7c4bda6","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":5603.3,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":236.9,"liveStage:dates-index:fetched:ms":251.1,"liveStage:revision:verified:ms":60.4,"liveStage:Core asset:downloaded:ms":231.2,"liveStage:Core asset:hash-verified:ms":7.1,"liveStage:Core asset:native-inflated-and-text-decoded:ms":182.9,"liveStage:Core asset:inflated:ms":0.2,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":313.1,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":601,"liveStage:Details asset:downloaded:ms":1577.1,"liveStage:Details asset:hash-verified:ms":28.7,"liveSt…
11-22 12:12:04.565 E/unknown:ReactNative(15926): ?anon_0_@1:3691545
11-22 12:12:04.565 E/unknown:ReactNative(15926): ?anon_0_@1:3697345
11-22 12:12:04.565 E/unknown:ReactNative(15926): SyntheticError@1:162984
11-22 12:12:04.565 E/unknown:ReactNative(15926): Wrapper@1:163499
11-22 12:12:04.565 E/unknown:ReactNative(15926): _callSuper@1:148372
11-22 12:12:04.565 E/unknown:ReactNative(15926): _construct@1:163847
11-22 12:12:04.565 E/unknown:ReactNative(15926): _next@1:594835
```

### 56 audit 2 min
```
11-22 12:13:46.858 E/ReactNativeJS(15926): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrsqpbw-6b533cfaa7c4bda6","check":{"id":"journey-lender-warm","label":"Lender details (warm)","kind":"journey","status":"fail","durationMs":2278.7,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1155,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"lender","journeyLabel":"Lender details","iteration":"warm","expectedPath":"/bank/Bankwest","expectedSurface":"lender.details","navigationKind":"stack","forwardMs":1155,"firstReadyFrameObserved":true,"firstReadyFrameMs":222.03786400007084,"backgroundSettleMs":741.4,"destinationReadinessMs":222,"backgroundTasks":"Bank response analysis","backMs":50.9,"firstBackMs":50.9,"firstBackDestination":"/performance-audit","originReadinessMs":0.4,"backDestination":"/per…
11-22 12:13:46.863 E/unknown:ReactNative(15926): ?anon_0_@1:3691545
11-22 12:13:46.863 E/unknown:ReactNative(15926): ?anon_0_@1:3697345
11-22 12:13:46.863 E/unknown:ReactNative(15926): SyntheticError@1:162984
11-22 12:13:46.863 E/unknown:ReactNative(15926): Wrapper@1:163499
11-22 12:13:46.863 E/unknown:ReactNative(15926): _callSuper@1:148372
11-22 12:13:46.863 E/unknown:ReactNative(15926): _construct@1:163847
11-22 12:13:46.863 E/unknown:ReactNative(15926): _next@1:594835
```

### 57 audit 4 min
```
11-22 12:14:10.707 E/ReactNativeJS(15926): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrsqpbw-6b533cfaa7c4bda6","check":{"id":"deep-first-pass.route.rates.search.filters.clear","label":"route.rates: search.filters.clear (first-pass)","kind":"journey","status":"fail","durationMs":1379.2,"metrics":{"journeyId":"route.rates.search.filters.clear","journeyLabel":"route.rates: search.filters.clear","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.filters.clear","depth":2,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":6,"actionRevisionAfter":7,"renderRevisionBefore":"state-30","renderRevisionAfter":"state-33","actionMs":450.3,"preActionWaitMs":1,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"ba…
11-22 12:14:10.709 E/unknown:ReactNative(15926): ?anon_0_@1:3691545
11-22 12:14:10.709 E/unknown:ReactNative(15926): ?anon_0_@1:3697345
11-22 12:14:10.709 E/unknown:ReactNative(15926): SyntheticError@1:162984
11-22 12:14:10.709 E/unknown:ReactNative(15926): Wrapper@1:163499
11-22 12:14:10.709 E/unknown:ReactNative(15926): _callSuper@1:148372
11-22 12:14:10.709 E/unknown:ReactNative(15926): _construct@1:163847
11-22 12:14:10.709 E/unknown:ReactNative(15926): _next@1:594835
```

### 58 audit 5 min
```
11-22 12:16:04.398 E/ReactNativeJS(15926): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrsqpbw-6b533cfaa7c4bda6","check":{"id":"deep-first-pass.route.lender.lender.chart.section.next","label":"route.lender: lender.chart.section.next (first-pass)","kind":"journey","status":"fail","durationMs":11544.9,"metrics":{"journeyId":"route.lender.lender.chart.section.next","journeyLabel":"route.lender: lender.chart.section.next","iteration":"cold","passId":"first-pass","scenarioId":"route.lender","semanticActionId":"lender.chart.section.next","depth":1,"plannedExpectedPath":"/bank/Bankwest","expectedPath":"/bank/Bankwest","expectedSurface":"lender.details","actionSource":"lender.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":0,"actionRevisionAfter":1,"renderRevisionBefore":"Bankwest:142:1:7:rich:20:9c369287e53a…:Bankwest:Mortgage:2026-11-22:194:1:7:rich:20:9c369287e53a…:Bankwest:Mortgage:2026-11-22:194:Mortgage:30D:2026-11-22:31:idle:moves-on-demand","renderRe…
11-22 12:16:04.399 E/unknown:ReactNative(15926): ?anon_0_@1:3691545
11-22 12:16:04.399 E/unknown:ReactNative(15926): ?anon_0_@1:3697345
11-22 12:16:04.399 E/unknown:ReactNative(15926): SyntheticError@1:162984
11-22 12:16:04.399 E/unknown:ReactNative(15926): Wrapper@1:163499
11-22 12:16:04.399 E/unknown:ReactNative(15926): _callSuper@1:148372
11-22 12:16:04.399 E/unknown:ReactNative(15926): _construct@1:163847
11-22 12:16:04.399 E/unknown:ReactNative(15926): _next@1:594835
```

### 59 audit 6 min
```
11-22 12:17:18.465 E/ReactNativeJS(15926): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrsqpbw-6b533cfaa7c4bda6","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":1161.3,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-22:e8f2f86bb11d…:state-7","renderRevisionAfter":"2026-11-22:e8f2f86bb11d…:state-8","actionResultEvidence":"{\"applied\":…
11-22 12:17:18.469 E/unknown:ReactNative(15926): ?anon_0_@1:3691545
11-22 12:17:18.469 E/unknown:ReactNative(15926): ?anon_0_@1:3697345
11-22 12:17:18.469 E/unknown:ReactNative(15926): SyntheticError@1:162984
11-22 12:17:18.469 E/unknown:ReactNative(15926): Wrapper@1:163499
11-22 12:17:18.469 E/unknown:ReactNative(15926): _callSuper@1:148372
11-22 12:17:18.469 E/unknown:ReactNative(15926): _construct@1:163847
11-22 12:17:18.469 E/unknown:ReactNative(15926): _next@1:594835
```

### 60 audit 8 min
```
11-22 12:18:59.605 E/ReactNativeJS(15926): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrsqpbw-6b533cfaa7c4bda6","check":{"id":"deep-first-pass.route.not-found.not-found.home","label":"route.not-found: not-found.home (first-pass)","kind":"journey","status":"fail","durationMs":9875.8,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"cold","passId":"first-pass","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":0,"actionRevisionAfter":1,"renderRevisionBefore":"not-found-v1","actionMs":96.8,"preActionWaitMs":0.4,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"s…
11-22 12:18:59.607 E/unknown:ReactNative(15926): ?anon_0_@1:3691545
11-22 12:18:59.607 E/unknown:ReactNative(15926): ?anon_0_@1:3697345
11-22 12:18:59.607 E/unknown:ReactNative(15926): SyntheticError@1:162984
11-22 12:18:59.607 E/unknown:ReactNative(15926): Wrapper@1:163499
11-22 12:18:59.607 E/unknown:ReactNative(15926): _callSuper@1:148372
11-22 12:18:59.607 E/unknown:ReactNative(15926): _construct@1:163847
11-22 12:18:59.607 E/unknown:ReactNative(15926): _next@1:594835
```

### 61 audit 9 min
```
11-22 12:19:48.606 E/ReactNativeJS(15926): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrsqpbw-6b533cfaa7c4bda6","check":{"id":"deep-repeat.route.rates.search.filters.open","label":"route.rates: search.filters.open (repeat)","kind":"journey","status":"fail","durationMs":5487.5,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":26,"actionRevisionAfter":27,"renderRevisionBefore":"state-22","renderRevisionAfter":"state-25","actionMs":0.2,"preActionWaitMs":1,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repe…
11-22 12:19:48.608 E/unknown:ReactNative(15926): ?anon_0_@1:3691545
11-22 12:19:48.608 E/unknown:ReactNative(15926): ?anon_0_@1:3697345
11-22 12:19:48.608 E/unknown:ReactNative(15926): SyntheticError@1:162984
11-22 12:19:48.608 E/unknown:ReactNative(15926): Wrapper@1:163499
11-22 12:19:48.608 E/unknown:ReactNative(15926): _callSuper@1:148372
11-22 12:19:48.608 E/unknown:ReactNative(15926): _construct@1:163847
11-22 12:19:48.608 E/unknown:ReactNative(15926): _next@1:594835
```

### 62 audit 10 min
```
11-22 12:20:31.130 E/ReactNativeJS(15926): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrsqpbw-6b533cfaa7c4bda6","check":{"id":"deep-repeat.route.rates-sheets.search.section.next","label":"route.rates-sheets: search.section.next (repeat)","kind":"journey","status":"fail","durationMs":1454.8,"metrics":{"journeyId":"route.rates-sheets.search.section.next","journeyLabel":"route.rates-sheets: search.section.next","iteration":"warm","passId":"repeat","scenarioId":"route.rates-sheets","semanticActionId":"search.section.next","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":42,"actionRevisionAfter":43,"renderRevisionBefore":"state-23","renderRevisionAfter":"state-28","actionMs":105.8,"preActionWaitMs":1,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"valid…
11-22 12:20:31.131 E/unknown:ReactNative(15926): ?anon_0_@1:3691545
11-22 12:20:31.131 E/unknown:ReactNative(15926): ?anon_0_@1:3697345
11-22 12:20:31.131 E/unknown:ReactNative(15926): SyntheticError@1:162984
11-22 12:20:31.131 E/unknown:ReactNative(15926): Wrapper@1:163499
11-22 12:20:31.131 E/unknown:ReactNative(15926): _callSuper@1:148372
11-22 12:20:31.131 E/unknown:ReactNative(15926): _construct@1:163847
11-22 12:20:31.131 E/unknown:ReactNative(15926): _next@1:594835
```

### 63 audit 11 min
```
11-22 12:22:09.348 E/ReactNativeJS(15926): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrsqpbw-6b533cfaa7c4bda6","check":{"id":"deep-repeat.route.lender.lender.history.date.previous","label":"route.lender: lender.history.date.previous (repeat)","kind":"journey","status":"fail","durationMs":10013.8,"metrics":{"journeyId":"route.lender.lender.history.date.previous","journeyLabel":"route.lender: lender.history.date.previous","iteration":"warm","passId":"repeat","scenarioId":"route.lender","semanticActionId":"lender.history.date.previous","depth":3,"plannedExpectedPath":"/bank/Bankwest","expectedPath":"/bank/Bankwest","expectedSurface":"lender.details","actionSource":"lender.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":6,"actionRevisionAfter":7,"renderRevisionBefore":"Bankwest:19:1:9:rich:64:9c369287e53a…:Bankwest:Savings:2026-11-22:194:1:9:rich:64:9c369287e53a…:Bankwest:Savings:2026-11-22:194:Savings:1Y:2026-11-22:194:idle:moves-on-demand","renderRev…
11-22 12:22:09.349 E/unknown:ReactNative(15926): ?anon_0_@1:3691545
11-22 12:22:09.349 E/unknown:ReactNative(15926): ?anon_0_@1:3697345
11-22 12:22:09.349 E/unknown:ReactNative(15926): SyntheticError@1:162984
11-22 12:22:09.349 E/unknown:ReactNative(15926): Wrapper@1:163499
11-22 12:22:09.349 E/unknown:ReactNative(15926): _callSuper@1:148372
11-22 12:22:09.349 E/unknown:ReactNative(15926): _construct@1:163847
11-22 12:22:09.349 E/unknown:ReactNative(15926): _next@1:594835
```

### 64 audit 12 min
```
11-22 12:22:53.946 E/ReactNativeJS(15926): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrsqpbw-6b533cfaa7c4bda6","check":{"id":"deep-repeat.route.calculator.calculator.open","label":"route.calculator: calculator.open (repeat)","kind":"journey","status":"fail","durationMs":3920.3,"metrics":{"journeyId":"route.calculator.calculator.open","journeyLabel":"route.calculator: calculator.open","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.open","depth":0,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":299.3,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":39.8,"forwardWorkMs":39.8,"navigationCommitMs":0,"firstReadyFrameMs":39.8,"firstReadyFrameObserved":true,"re…
11-22 12:22:53.947 E/unknown:ReactNative(15926): ?anon_0_@1:3691545
11-22 12:22:53.947 E/unknown:ReactNative(15926): ?anon_0_@1:3697345
11-22 12:22:53.947 E/unknown:ReactNative(15926): SyntheticError@1:162984
11-22 12:22:53.947 E/unknown:ReactNative(15926): Wrapper@1:163499
11-22 12:22:53.947 E/unknown:ReactNative(15926): _callSuper@1:148372
11-22 12:22:53.947 E/unknown:ReactNative(15926): _construct@1:163847
11-22 12:22:53.947 E/unknown:ReactNative(15926): _next@1:594835
```

### 65 audit 14 min
```
11-22 12:24:43.885 E/ReactNativeJS(15926): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrsqpbw-6b533cfaa7c4bda6","check":{"id":"deep-repeat.route.not-found.not-found.home","label":"route.not-found: not-found.home (repeat)","kind":"journey","status":"fail","durationMs":9935.9,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"warm","passId":"repeat","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":1,"actionRevisionAfter":2,"renderRevisionBefore":"not-found-v1","actionMs":122.4,"preActionWaitMs":0.5,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetour…
11-22 12:24:43.886 E/unknown:ReactNative(15926): ?anon_0_@1:3691545
11-22 12:24:43.886 E/unknown:ReactNative(15926): ?anon_0_@1:3697345
11-22 12:24:43.886 E/unknown:ReactNative(15926): SyntheticError@1:162984
11-22 12:24:43.886 E/unknown:ReactNative(15926): Wrapper@1:163499
11-22 12:24:43.886 E/unknown:ReactNative(15926): _callSuper@1:148372
11-22 12:24:43.886 E/unknown:ReactNative(15926): _construct@1:163847
11-22 12:24:43.886 E/unknown:ReactNative(15926): _next@1:594835
```

### 66 audit 15 min
```
11-22 12:26:03.963 E/ReactNativeJS(15926): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwrsqpbw-6b533cfaa7c4bda6","check":{"id":"external-link-363","kind":"network","status":"fail","durationMs":1915.1567969999742,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"pass","browserHandler":"pass","httpReachability":"fail","statusCode":404,"handlerAttempted":true,"httpAttempted":true,"httpSelected":true,"handlerResolution":"pass","host":"www.defencebank.com.au","destinationPath":"/banking/home-loans/essentials-home-loan---ultimate-package-investor-interest-only/"},"error":"HTTP 404: the destination is missing or unavailable.","canonicalMetrics":true}}
11-22 12:26:03.964 E/unknown:ReactNative(15926): ?anon_0_@1:3691545
11-22 12:26:03.964 E/unknown:ReactNative(15926): ?anon_0_@1:3700906
11-22 12:26:03.964 E/unknown:ReactNative(15926): SyntheticError@1:162984
11-22 12:26:03.964 E/unknown:ReactNative(15926): Wrapper@1:163499
11-22 12:26:03.964 E/unknown:ReactNative(15926): _callSuper@1:148372
11-22 12:26:03.964 E/unknown:ReactNative(15926): _construct@1:163847
11-22 12:26:03.964 E/unknown:ReactNative(15926): _next@1:594835
```
