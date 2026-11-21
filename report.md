# App explorer: 1.0.339 (395)

**Real-use session ATTENTION vs 1.0.339: 0 broken, 14 friction, 12 slower**

- Friction: No reaction for 4.0 s after "scroll rates 1"
- Friction: No reaction for 3.1 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 3.3 s after "open lenders"
- Friction: No reaction for 3.4 s after "scroll lenders"
- Friction: No reaction for 4.3 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.5 s after "open filters"
- Friction: No reaction for 3.2 s after "open market"
- Friction: "Refresh failed" shown on "open rba"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: "Bond data unavailable" shown on "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Slower: Dropped frames 57% to 78% on "open app"
- Slower: "open app" content 22.8 s to 35.3 s
- Slower: "open app" reaction 22.8 s to 35.3 s
- Slower: Dropped frames 52% to 69% on "scroll rates 1"
- Slower: Dropped frames 53% to 71% on "scroll rates 2"
- Slower: Dropped frames 39% to 65% on "scroll product"
- Slower: Dropped frames 42% to 76% on "back to rates"
- Slower: Dropped frames 51% to 72% on "switch to savings"
- Slower: Dropped frames 54% to 77% on "open rba"
- Slower: "open rba" content 0.0 s to 2.3 s
- Slower: Dropped frames 41% to 73% on "scroll rba"
- Slower: Dropped frames 45% to 72% on "scroll market"

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode full | 73 steps | crashes 1 | step failures 2 | settle timeouts 0 | steps with JS/native errors 6
Baseline 1.0.339
**Audit live: outcome app crashed | 155 s | audit log not uploaded | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3192 |  | 624/805 | 93 | 537 | 1 errors; start 3137ms |
| 2 | scroll rates 1 | 747 |  | 40/58 | 81 | 488 | boot js-start 434187, layout-mounted 434406, cache-read 434549, hydrated 434812, splash-hide 434812, manifest 435933, resolved 436265, core-fetched 441959, core-saved 442763, rows-prepared 443166, search-index-idle 443166, details-start 443592, pricing-ready 445410, details-fetched 453557, detail-filters-idle 460695, suitability-built 462388, core-ready 469512, rates-ready 473221 |
| 3 | scroll rates 2 | 681 |  | 17/24 | 65 | 696 |  |
| 4 | scroll rates back | 685 |  |  |  | 552 |  |
| 5 | open product | 5372 |  | 34/51 | 121 | 628 |  |
| 6 | scroll product | 707 |  | 34/52 | 85 | 627 |  |
| 7 | back to rates | 30 |  | 16/21 | 81 | 632 |  |
| 8 | open lenders | 28 |  | 19/22 | 200 | 627 |  |
| 9 | scroll lenders | 791 |  | 18/21 | 121 | 625 |  |
| 10 | back from lenders | 28 |  | 6/9 | 150 | 625 |  |
| 11 | switch to savings | 27 |  | 42/58 | 97 | 637 |  |
| 12 | switch to home loans | 27 |  | 14/27 | 69 | 656 |  |
| 13 | open filters | 32 |  | 24/26 | 150 | 657 |  |
| 14 | close filters | 28 |  | 8/9 | 150 | 657 |  |
| 15 | open market | 26 |  | 15/29 | 65 | 658 |  |
| 16 | open rba | 2482 |  | 44/57 | 65 | 653 |  |
| 17 | scroll rba | 725 |  | 32/44 | 77 | 652 |  |
| 18 | back from rba | 28 |  | 12/18 | 69 | 655 |  |
| 19 | scroll market | 689 |  | 28/39 | 85 | 655 |  |
| 20 | open saved | 26 |  | 13/16 | 93 | 659 |  |
| 21 | return to rates | 25 |  | 17/31 | 85 | 661 |  |
| 22 | cold start | 13019 | -645 | 33/41 | 117 | 369 | 1 errors; start 4142ms; boot js-start 671591, layout-mounted 671787, hydrated 671915, cache-read 673132, core-ready 673782, rows-prepared 673903, search-index-idle 673903, detail-filters-idle 673903, splash-hide 673904, manifest 676087, resolved 676642, pricing-ready 677580, rates-ready 677815 |
| 23 | /browse | 34 | -4713 | 2/2 | 32 | 410 |  |
| 24 | /watchlist | 37 | -17 | 4/5 | 36 | 401 |  |
| 25 | /market | 4525 | +4454 | 13/20 | 73 | 446 |  |
| 26 | /tools | 37 | +3 | 14/23 | 105 | 454 |  |
| 27 | /trends | 35 | +6 | 31/40 | 117 | 467 |  |
| 28 | /search | 34 | +2 | 27/35 | 129 | 486 |  |
| 29 | /banks | 32 | +3 | 32/44 | 101 | 495 |  |
| 30 | /bank-rates | 40 | +6 | 19/28 | 97 | 499 |  |
| 31 | /categories | 29 | +5 | 38/47 | 93 | 524 |  |
| 32 | /catalogue | 43 | +16 | 31/40 | 113 | 548 |  |
| 33 | /compare | 35 | +12 | 11/15 | 113 | 554 |  |
| 34 | /matches | 26 | +1 | 39/45 | 97 | 546 |  |
| 35 | /calculator | 29 | +4 | 17/23 | 81 | 547 |  |
| 36 | /projections | 30 | +6 | 27/36 | 89 | 538 |  |
| 37 | /profile | 30 | +10 | 15/20 | 89 | 544 |  |
| 38 | /research | 37 | +16 | 17/29 | 89 | 554 |  |
| 39 | /rba | 2541 | +2515 | 16/23 | 65 | 585 |  |
| 40 | /rba-response | 38 | +17 | 18/31 | 65 | 570 |  |
| 41 | /settings | 31 | +10 | 27/38 | 73 | 582 |  |
| 42 | /about | 31 | +7 | 16/23 | 65 | 580 |  |
| 43 | /terms | 33 | +5 | 14/23 | 77 | 532 |  |
| 44 | /privacy | 29 | +1 |  |  | 532 |  |
| 45 | /third-party-notices | 35 | +13 | 12/22 | 85 | 534 |  |
| 46 | /node | 36 | +13 | 36/45 | 93 | 563 |  |
| 47 | /passthrough | 34 | +7 | 32/47 | 89 | 548 |  |
| 48 | /calculation-receipt | 36 | +13 | 15/23 | 69 | 526 |  |
| 49 | /rate-receipt | 29 | +7 | 7/9 | 93 | 526 |  |
| 50 | warm resume | 940 | +747 | 5/5 | 77 | 526 |  |
| 51 | cold relaunch | 9887 | +1065 | 34/43 | 97 | 588 | 1 errors; start 4220ms; boot js-start 915888, layout-mounted 916096, hydrated 916175, cache-read 917533, core-ready 918163, rows-prepared 918287, search-index-idle 918287, detail-filters-idle 918287, splash-hide 918289, manifest 919854, resolved 920943, pricing-ready 921813, rates-ready 922081 |
| 52 | about | 46 |  | 15/20 | 200 | 617 |  |
| 53 | audit screen | 24 |  | 116/200 | 69 | 608 |  |
| 54 | audit 0 min | 0 |  | 444/496 | 125 | 739 | 80 errors |
| 55 | audit crashed | 0 |  |  |  |  | CRASH; app process died during audit; 42 errors |
| 56 | relaunch after audit crash | 10017 |  | 29/37 | 129 | 514 | 1 errors; boot js-start 1069651, layout-mounted 1069839, cache-read 1071189, core-ready 1072017, rows-prepared 1072048, search-index-idle 1072048, detail-filters-idle 1072048, manifest 1072838, resolved 1073161, hydrated 1073743, splash-hide 1073743, pricing-ready 1076759, rates-ready 1077374 |
| 57 | about | 46 |  | 11/21 | 150 | 382 |  |
| 58 | audit screen | 24 |  | 125/205 | 69 | 464 |  |
| 59 | audit finished | 0 |  |  |  | 457 | no uploaded log URL (app crashed) |
| 60 | audit result 1 | 0 |  |  |  | 457 |  |
| 61 | audit result 2 | 0 |  |  |  | 458 |  |
| 62 | audit result 3 | 0 |  |  |  | 457 |  |
| 63 | audit result 4 | 0 |  |  |  | 457 |  |
| 64 | audit result 5 | 0 |  |  |  | 458 |  |
| 65 | audit result 6 | 0 |  |  |  | 457 |  |
| 66 | audit result 7 | 0 |  |  |  | 458 |  |
| 67 | audit result 8 | 0 |  |  |  | 458 |  |
| 68 | audit result 9 | 0 |  |  |  | 458 |  |
| 69 | audit result 10 | 0 |  |  |  | 459 |  |
| 70 | audit result 11 | 0 |  |  |  | 458 |  |
| 71 | audit result 12 | 0 |  |  |  | 459 |  |
| 72 | about for debug log | 40 |  | 14/21 | 77 | 499 |  |
| 73 | debug log screen | 0 |  | 109/174 | 65 | 484 |  |

## Fatal lines
```
55 E/AndroidRuntime(15792): Caused by: java.lang.IllegalStateException: The specified child already has a parent. You must call removeView() on the child's parent first.
55 E/AndroidRuntime(15792): FATAL EXCEPTION: main
55 E/AndroidRuntime(15792): java.lang.IllegalStateException: addViewAt: failed to insert view [30622] into parent [30630] at index 0
```

## Errors

### 1 open app
```
11-21 08:22:36.833 E/australianrates(10447): Not starting debugger since process cannot load the jdwp agent.
```

### 22 cold start
```
11-21 08:26:35.693 E/australianrates(12716): Not starting debugger since process cannot load the jdwp agent.
```

### 51 cold relaunch
```
11-21 08:30:39.976 E/australianrates(15792): Not starting debugger since process cannot load the jdwp agent.
```

### 54 audit 0 min
```
11-21 08:31:49.199 E/ReactNativeJS(15792): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5fsw5-298bb2c6c647f40e","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":4960.9,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":254.5,"liveStage:dates-index:fetched:ms":249.8,"liveStage:revision:verified:ms":72.1,"liveStage:Core asset:downloaded:ms":198.4,"liveStage:Core asset:hash-verified:ms":18.7,"liveStage:Core asset:native-inflated-and-text-decoded:ms":208.2,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":231.7,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":633.5,"liveStage:Details asset:downloaded:ms":1111.8,"liveStage:Details asset:hash-verified:ms":42,"liveS…
11-21 08:31:49.202 E/unknown:ReactNative(15792): ?anon_0_@1:3680632
11-21 08:31:49.202 E/unknown:ReactNative(15792): ?anon_0_@1:3686437
11-21 08:31:49.202 E/unknown:ReactNative(15792): SyntheticError@1:162956
11-21 08:31:49.202 E/unknown:ReactNative(15792): Wrapper@1:163471
11-21 08:31:49.202 E/unknown:ReactNative(15792): _callSuper@1:148344
11-21 08:31:49.202 E/unknown:ReactNative(15792): _construct@1:163819
11-21 08:31:49.202 E/unknown:ReactNative(15792): _next@1:594807
```

### 55 audit crashed
```
11-21 08:32:40.626 E/ReactNativeJS(15792): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5fsw5-298bb2c6c647f40e","check":{"id":"journey-lender-cold","label":"Lender details (cold)","kind":"journey","status":"fail","durationMs":2246.9,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":949.2,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"lender","journeyLabel":"Lender details","iteration":"cold","expectedPath":"/bank/BankSA","expectedSurface":"lender.details","navigationKind":"stack","forwardMs":949.2,"firstReadyFrameObserved":true,"firstReadyFrameMs":202.9917719999794,"backgroundSettleMs":995.1,"destinationReadinessMs":203,"backgroundTasks":"Bank response analysis","backMs":101.5,"firstBackMs":101.5,"firstBackDestination":"/performance-audit","originReadinessMs":0.3,"backDestination":"/pe…
11-21 08:32:42.790 E/ReactNativeJS(15792): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5fsw5-298bb2c6c647f40e","check":{"id":"journey-compare-cold","label":"Product comparison (cold)","kind":"journey","status":"fail","durationMs":1371.9,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":607.3,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"compare","journeyLabel":"Product comparison","iteration":"cold","expectedPath":"/compare","expectedSurface":"compare.table","navigationKind":"stack","forwardMs":607.3,"firstReadyFrameObserved":true,"firstReadyFrameMs":262.99011500005145,"backgroundSettleMs":483.9,"destinationReadinessMs":263,"backMs":38.8,"firstBackMs":38.8,"firstBackDestination":"/performance-audit","originReadinessMs":0.3,"backDestination":"/performance-audit","backChangedPath":true…
11-21 08:32:48.849 E/ReactNativeJS(15792): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5fsw5-298bb2c6c647f40e","check":{"id":"journey-rates-warm","label":"Rates (warm)","kind":"journey","status":"fail","durationMs":2074.7,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1224.7,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates","journeyLabel":"Rates","iteration":"warm","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1224.7,"firstReadyFrameObserved":true,"firstReadyFrameMs":263.8671649999451,"backgroundSettleMs":598.2,"destinationReadinessMs":263.9,"backgroundTasks":"Product details, Search index availability","backMs":72.7,"firstBackMs":72.7,"firstBackDestination":"/performance-audit","orig…
11-21 08:32:51.994 E/ReactNativeJS(15792): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5fsw5-298bb2c6c647f40e","check":{"id":"journey-market-warm","label":"Market (warm)","kind":"journey","status":"fail","durationMs":2353.4,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":777.5,"minimumJustifiedActions":2,"observedActions":3,"retries":0,"validationFailures":0,"backtracks":1,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"market","journeyLabel":"Market","iteration":"warm","expectedPath":"/market","expectedSurface":"market.overview","navigationKind":"tab","forwardMs":777.5,"firstReadyFrameObserved":true,"firstReadyFrameMs":606.2343790000305,"backgroundSettleMs":675.1,"destinationReadinessMs":606.2,"backgroundTasks":"RBA calendar, Bank response analysis","backMs":626.9,"firstBackMs":593.4,"firstBackDestination":"/browse","originReadinessMs":0.4,"backDestination":"/performance-audit",…
11-21 08:32:57.113 E/ReactNativeJS(15792): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5fsw5-298bb2c6c647f40e","check":{"id":"journey-rates-mortgage-warm","label":"Rates: Home loans (warm)","kind":"journey","status":"fail","durationMs":2321.7,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1535.3,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-mortgage","journeyLabel":"Rates: Home loans","iteration":"warm","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1535.3,"firstReadyFrameObserved":true,"firstReadyFrameMs":274.53939100005664,"backgroundSettleMs":538,"destinationReadinessMs":274.5,"backgroundTasks":"Product details, Search index availability","backMs":81.8,"firstBackMs":81.8,"firstBa…
11-21 08:33:00.061 E/ReactNativeJS(15792): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5fsw5-298bb2c6c647f40e","check":{"id":"journey-rates-savings-warm","label":"Rates: Savings accounts (warm)","kind":"journey","status":"fail","durationMs":2137.3,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1143.3,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-savings","journeyLabel":"Rates: Savings accounts","iteration":"warm","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1143.3,"firstReadyFrameObserved":true,"firstReadyFrameMs":203.82162500009872,"backgroundSettleMs":691.2,"destinationReadinessMs":203.8,"backgroundTasks":"Product details, Search index availability","backMs":128.1,"firstBackMs":…
11-21 08:33:02.974 E/ReactNativeJS(15792): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5fsw5-298bb2c6c647f40e","check":{"id":"journey-rates-td-warm","label":"Rates: Term deposits (warm)","kind":"journey","status":"fail","durationMs":2090.6,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1205.2,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates-td","journeyLabel":"Rates: Term deposits","iteration":"warm","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":1205.2,"firstReadyFrameObserved":true,"firstReadyFrameMs":217.14151300000958,"backgroundSettleMs":636.3,"destinationReadinessMs":217.1,"backgroundTasks":"Product details, Search index availability","backMs":87.1,"firstBackMs":87.1,"firstBackDe…
11-21 08:33:07.058 E/ReactNativeJS(15792): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwq5fsw5-298bb2c6c647f40e","check":{"id":"journey-outlook-warm","label":"Outlook (warm)","kind":"journey","status":"fail","durationMs":1433.6,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":652.2,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"outlook","journeyLabel":"Outlook","iteration":"warm","expectedPath":"/research","expectedSurface":"outlook.dashboard","navigationKind":"stack","forwardMs":652.2,"firstReadyFrameObserved":true,"firstReadyFrameMs":241.30151899997145,"backgroundSettleMs":501.6,"destinationReadinessMs":241.3,"backgroundTasks":"RBA calendar, Bank response analysis, Bank history","backMs":30.3,"firstBackMs":30.3,"firstBackDestination":"/performance-audit","originReadinessMs":0.4,"back…
```

### 56 relaunch after audit crash
```
11-21 08:33:13.803 E/australianrates(16829): Not starting debugger since process cannot load the jdwp agent.
```
