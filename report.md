# App explorer: 1.0.397 (453)

**Real-use session ATTENTION vs 1.0.396: 0 broken, 18 friction, 4 slower**

- Friction: No reaction for 3.7 s after "scroll rates 1"
- Friction: No reaction for 3.2 s after "scroll rates 2"
- Friction: No reaction for 3.7 s after "open product"
- Friction: No reaction for 3.0 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll product fees"
- Friction: No reaction for 3.0 s after "scroll product sources"
- Friction: No reaction for 3.8 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.0 s after "scroll rba"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 4.3 s after "start category switch"
- Friction: No reaction for 3.5 s after "open term deposits"
- Friction: No reaction for 3.3 s after "verify term deposit rates"
- Friction: No reaction for 5.2 s after "search Macquarie"
- Friction: No reaction for 3.3 s after "return from savings search"
- Friction: No reaction for 3.5 s after "open unsaved rate"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: No reaction for 4.7 s after "follow browse rates recovery"
- Slower: "start category switch" content 0.0 s to 4.3 s
- Slower: Dropped frames 77% to 95% on "discard unsaved filter draft"
- Slower: "follow browse rates recovery" content 0.0 s to 4.7 s
- Slower: "select second comparison rate" content 0.0 s to 2.5 s

**Initial Rates readiness:** 25.1 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-28

Mode full | 119 steps | crashes 0 | step failures 1 | settle timeouts 0 | steps with JS/native errors 15
Baseline 1.0.396
**Audit live: outcome failed | 903 s | audit log 846629 bytes (audit-log.txt) https://paste.c-net.org/444acd1a-22f0-6a91-3282-37158dfa4cb4 | debug log none**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 25883 | +22780 | 361/645 | 73 | 519 | 2 errors; start 2900ms; boot js-start 448082, layout-mounted 448697, cache-read 448772, hydrated 448855, splash-hide 448954, manifest 450344, resolved 450782, core-fetched 454130, core-saved 454540, pricing-wait-suitability 454738, search-index-idle 454739, details-start 454977, details-fetched 461415, rows-prepared 464047, detail-filters-idle 464047, leading-requested 464047, last-pricing 464047, suitability-built 465101, post-refresh-wait 465538, leading-scoped 467677, leading-page 467677, pricing-ready 472967, last-rows 472967, rates-ready 473181, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 196, pricing-scope-ms 8276, filter-runs 2, filter-rows 37735, filter-yields 7, filter-ms 132, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 15 |
| 2 | scroll rates 1 | 741 | +2 | 30/57 | 69 | 644 |  |
| 3 | scroll rates 2 | 3306 | +2587 | 22/43 | 69 | 631 |  |
| 4 | scroll rates back | 684 | +3 |  |  | 631 |  |
| 5 | open product | 30 | +5 | 27/51 | 65 | 615 | 3 errors |
| 6 | scroll product | 686 | -25 | 34/73 | 69 | 628 |  |
| 7 | expand visible fees | 20 | -4503 | 9/18 | 65 | 620 |  |
| 8 | expand product facts | 18 | -4 | 70/171 | 65 | 616 |  |
| 9 | scroll product fees | 719 | +24 | 24/63 | 65 | 661 |  |
| 10 | scroll product eligibility | 699 | -21 | 24/53 | 65 | 648 |  |
| 11 | expand eligibility | 0 | 0 | 191/334 | 69 | 620 |  |
| 12 | expand constraints | 19 | -4 | 6/17 | 32 | 622 |  |
| 13 | scroll product sources | 745 | +47 | 22/36 | 69 | 627 |  |
| 14 | back to rates | 20 | -10 | 10/25 | 53 | 624 |  |
| 15 | open lenders | 19 | -7 | 19/25 | 200 | 626 |  |
| 16 | scroll lenders | 727 | -33 | 20/24 | 117 | 624 |  |
| 17 | back from lenders | 19 | -4 | 7/9 | 109 | 625 |  |
| 18 | switch to savings | 19 | -3 | 42/70 | 69 | 641 |  |
| 19 | switch to home loans | 19 | -6 | 12/33 | 48 | 671 |  |
| 20 | open filters | 19 | -13 | 26/29 | 150 | 669 |  |
| 21 | close filters | 18 | -7 | 6/9 | 150 | 671 |  |
| 22 | open market | 19 | -3 | 18/34 | 53 | 676 |  |
| 23 | open rba | 2510 | -227 | 53/99 | 53 | 699 |  |
| 24 | scroll rba | 688 | -12 | 22/62 | 57 | 691 |  |
| 25 | back from rba | 21 | -3 | 6/22 | 46 | 692 |  |
| 26 | scroll market | 692 | -19 | 23/45 | 61 | 691 |  |
| 27 | open saved | 19 | -2 | 10/20 | 57 | 699 |  |
| 28 | return to rates | 20 | -1 | 11/29 | 53 | 703 |  |
| 29 | start category switch | 14131 | +14098 | 7/11 | 36 | 734 |  |
| 30 | open term deposits | 18 | -4 | 28/58 | 61 | 737 |  |
| 31 | verify term deposit rates | 685 | -23 | 31/66 | 69 | 751 |  |
| 32 | restore home loans | 20 | -4 | 11/31 | 48 | 782 |  |
| 33 | start search from rates | 25 | -6 |  |  | 771 |  |
| 34 | open savings search | 20 | -3 | 15/33 | 46 | 734 |  |
| 35 | search Macquarie | 1400 | -1075 | 42/57 | 129 | 721 |  |
| 36 | verify Macquarie result | 0 | 0 | 12/15 | 18 | 719 |  |
| 37 | clear query and restore results | 21 | -7 | 15/19 | 30 | 726 |  |
| 38 | return from savings search | 19 | -5 | 28/43 | 85 | 744 |  |
| 39 | start filter rollback | 30 | 0 | 14/15 | 17 | 737 |  |
| 40 | open mortgage filter draft | 34 | +12 | 20/24 | 200 | 737 |  |
| 41 | select fixed in draft | 18 | -5 | 11/12 | 129 | 735 |  |
| 42 | discard unsaved filter draft | 19 | -3 | 20/21 | 89 | 737 |  |
| 43 | verify fixed was not applied | 19 | -3 | 20/27 | 150 | 741 |  |
| 44 | close verified filter draft | 17 | -5 | 20/22 | 69 | 740 |  |
| 45 | start save from rates | 24 | -4 | 12/15 | 16 | 738 | 1 errors |
| 46 | open unsaved rate | 46 | +1 | 74/124 | 77 | 753 | 1 errors |
| 47 | save a rate | 19 | -4 | 7/17 | 65 | 759 | 1 errors |
| 48 | leave saved product | 22 | -5 | 11/23 | 77 | 759 |  |
| 49 | restart with a saved rate | 19252 | +1552 | 256/451 | 77 | 426 | 3 errors; start 6883ms; boot js-start 953601, layout-mounted 954274, hydrated 954764, cache-read 956239, core-ready 957189, rows-prepared 957511, search-index-idle 957511, detail-filters-idle 957511, leading-requested 957511, last-pricing 957511, splash-hide 957512, manifest 960499, resolved 961596, leading-scoped 965906, leading-page 965906, pricing-ready 967328, last-rows 967328, rates-ready 967729, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 102, pricing-scope-ms 6768, filter-runs 2, filter-rows 37735, filter-yields 12, filter-ms 279, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 37 |
| 50 | verify saved rate after restart | 25 | -40 | 18/35 | 73 | 511 |  |
| 51 | open product from saved rates | 21 | -2 | 40/70 | 69 | 649 |  |
| 52 | remove saved rate | 26 | +2 |  |  | 628 |  |
| 53 | leave removed product | 22 | -7 | 18/30 | 69 | 660 |  |
| 54 | follow browse rates recovery | 2183 | +2160 | 12/28 | 48 | 704 |  |
| 55 | start compare from rates | 23 | -11 | 2/2 | 17 | 702 |  |
| 56 | enter selection mode | 27 | -5 | 6/13 | 53 | 713 |  |
| 57 | select first comparison rate | 19 | -4 | 7/15 | 48 | 709 |  |
| 58 | select second comparison rate | 19 | -12 | 7/16 | 42 | 709 |  |
| 59 | open two-rate comparison | 18 | -5 | 17/32 | 150 | 720 |  |
| 60 | return from two-rate comparison | 19 | -3 | 17/33 | 85 | 724 |  |
| 61 | cold start | 11785 | +1680 | 31/38 | 350 | 388 | 1 errors; start 3476ms; boot js-start 1083392, layout-mounted 1083545, hydrated 1083625, cache-read 1084625, core-ready 1085129, rows-prepared 1085220, search-index-idle 1085220, detail-filters-idle 1085220, leading-requested 1085220, last-pricing 1085220, splash-hide 1085221, manifest 1086417, resolved 1087263, leading-scoped 1088203, leading-page 1088203, pricing-ready 1089177, last-rows 1089177, rates-ready 1089397, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 69, pricing-scope-ms 3091, filter-runs 2, filter-rows 37735, filter-yields 7, filter-ms 132, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 18 |
| 62 | /browse | 24 | -4452 |  |  | 427 |  |
| 63 | /watchlist | 20 | -11 | 3/3 | 32 | 423 |  |
| 64 | /market | 22 | -2 |  |  | 428 |  |
| 65 | /tools | 2156 | +2128 | 15/31 | 89 | 427 |  |
| 66 | /trends | 21 | -10 | 16/33 | 61 | 451 |  |
| 67 | /search | 4324 | -152 | 24/35 | 105 | 469 |  |
| 68 | /banks | 35 | +2 | 29/42 | 93 | 489 |  |
| 69 | /bank-rates | 23 | -11 | 14/30 | 65 | 485 |  |
| 70 | /categories | 30 | +4 | 31/56 | 81 | 514 |  |
| 71 | /catalogue | 25 | -1 | 30/46 | 113 | 537 |  |
| 72 | /compare | 30 | +4 | 12/17 | 101 | 506 |  |
| 73 | /matches | 21 | -2 | 31/48 | 81 | 530 |  |
| 74 | /calculator | 25 | -2 | 11/25 | 57 | 516 |  |
| 75 | /projections | 21 | -4 | 19/34 | 61 | 519 |  |
| 76 | /profile | 23 | -7 | 12/23 | 65 | 523 |  |
| 77 | /research | 25 | +1 | 17/31 | 65 | 539 |  |
| 78 | /rba | 27 | -3 | 14/27 | 53 | 507 |  |
| 79 | /rba-response | 25 | +2 | 17/31 | 97 | 503 |  |
| 80 | /settings | 22 | -6 | 20/42 | 53 | 507 |  |
| 81 | /about | 25 | -2 | 13/24 | 53 | 506 |  |
| 82 | /terms | 25 | 0 | 11/24 | 57 | 508 |  |
| 83 | /privacy | 27 | -5 |  |  | 508 |  |
| 84 | /third-party-notices | 25 | 0 | 14/23 | 69 | 511 |  |
| 85 | /node | 25 | -8 | 33/47 | 81 | 540 |  |
| 86 | /passthrough | 36 | -2 | 25/43 | 81 | 525 |  |
| 87 | /calculation-receipt | 26 | -2 | 13/26 | 57 | 507 |  |
| 88 | /rate-receipt | 27 | -1 | 5/10 | 69 | 507 |  |
| 89 | warm resume | 251 | -407 | 2/4 | 200 | 506 |  |
| 90 | cold relaunch | 10891 | +893 | 30/45 | 65 | 577 | 1 errors; start 2817ms; boot js-start 1307808, layout-mounted 1307970, hydrated 1307971, cache-read 1308863, core-ready 1309359, rows-prepared 1309444, search-index-idle 1309444, detail-filters-idle 1309444, leading-requested 1309444, last-pricing 1309444, splash-hide 1309445, manifest 1310795, resolved 1311214, leading-scoped 1312067, leading-page 1312067, pricing-ready 1313050, last-rows 1313050, rates-ready 1313263, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 54, pricing-scope-ms 2157, filter-runs 2, filter-rows 37735, filter-yields 7, filter-ms 131, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 15 |
| 91 | about | 29 | -9 | 8/23 | 65 | 410 |  |
| 92 | audit screen | 18 | -6 | 89/235 | 48 | 445 |  |
| 93 | audit 0 min | 0 | 0 | 25/29 | 73 | 719 |  |
| 94 | audit 2 min | 0 | 0 | 1363/1663 | 97 | 875 | 80 errors |
| 95 | audit 4 min | 0 | 0 | 830/1081 | 89 | 927 | 80 errors |
| 96 | audit 5 min | 0 | 0 | 825/1063 | 93 | 1089 | 80 errors |
| 97 | audit 6 min | 0 | 0 | 675/817 | 97 | 1041 | 80 errors |
| 98 | audit 8 min | 0 | 0 | 659/830 | 85 | 1087 | 80 errors |
| 99 | audit 9 min | 0 | 0 | 928/1212 | 93 | 1121 | 80 errors |
| 100 | audit 11 min | 0 | 0 | 167/233 | 77 | 1114 | 80 errors |
| 101 | audit 12 min | 0 | 0 | 134/182 | 32 | 1135 |  |
| 102 | audit 14 min | 0 | 0 | 56/70 | 32 | 1146 |  |
| 103 | audit 15 min | 0 |  | 78/107 | 69 | 1265 |  |
| 104 | audit finished | 0 | 0 | 76/190 | 61 | 1270 |  |
| 105 | audit result 1 | 0 | 0 |  |  | 1259 |  |
| 106 | audit result 2 | 0 | 0 |  |  | 1256 |  |
| 107 | audit result 3 | 0 | 0 |  |  | 1259 |  |
| 108 | audit result 4 | 0 | 0 |  |  | 1257 |  |
| 109 | audit result 5 | 0 | 0 |  |  | 1256 |  |
| 110 | audit result 6 | 0 | 0 |  |  | 1260 |  |
| 111 | audit result 7 | 0 | 0 |  |  | 1258 |  |
| 112 | audit result 8 | 0 | 0 |  |  | 1260 |  |
| 113 | audit result 9 | 0 | 0 |  |  | 1258 |  |
| 114 | audit result 10 | 0 | 0 |  |  | 1261 |  |
| 115 | audit result 11 | 0 | 0 |  |  | 1259 |  |
| 116 | audit result 12 | 0 | 0 |  |  | 1258 |  |
| 117 | about for debug log | 26 | -3186 | 12/35 | 57 | 1267 |  |
| 118 | debug log screen | 0 | -1 | 76/247 | 44 | 1278 |  |
| 119 | debug log uploaded | 0 | 0 | 26/31 | 73 | 1332 | debug log upload URL not shown |

## Errors

### 1 open app
```
11-28 14:31:31.675 E/australianrates(11300): Not starting debugger since process cannot load the jdwp agent.
11-28 14:31:34.972 W/ReactNativeJS(11300): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
```

### 5 open product
```
11-28 14:32:37.118 W/ReactNativeJS(11300): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-28 14:32:37.481 W/ReactNativeJS(11300): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-28 14:32:38.608 W/ReactNativeJS(11300): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
```

### 45 start save from rates
```
11-28 14:39:27.369 E/FrameTracker(11300): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 open unsaved rate
```
11-28 14:39:32.555 E/ImeBackDispatcher(11300): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 175421328
```

### 47 save a rate
```
11-28 14:39:43.303 E/FrameTracker(11300): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 49 restart with a saved rate
```
11-28 14:39:57.500 E/australianrates(17187): Not starting debugger since process cannot load the jdwp agent.
11-28 14:40:03.731 E/SurfaceSyncGroup(17187): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-28 14:40:03.737 E/SurfaceSyncGroup(17187): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 61 cold start
```
11-28 14:42:08.055 E/australianrates(18781): Not starting debugger since process cannot load the jdwp agent.
```

### 90 cold relaunch
```
11-28 14:45:52.589 E/australianrates(21882): Not starting debugger since process cannot load the jdwp agent.
```

### 94 audit 2 min
```
11-28 14:47:00.351 E/ReactNativeJS(21882): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0ix8c4-024d37cb995789a3","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":6805.7,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":200.8,"liveStage:dates-index:fetched:ms":200.5,"liveStage:revision:verified:ms":70.7,"liveStage:Core asset:downloaded:ms":158.6,"liveStage:Core asset:hash-verified:ms":3.1,"liveStage:Core asset:native-inflated-and-text-decoded:ms":128.7,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":185.1,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":442.1,"liveStage:Details asset:downloaded:ms":890.2,"liveStage:Details asset:hash-verified:ms":16.9,"liveS…
11-28 14:47:00.352 E/unknown:ReactNative(21882): ?anon_0_@1:3711859
11-28 14:47:00.352 E/unknown:ReactNative(21882): ?anon_0_@1:3717659
11-28 14:47:00.352 E/unknown:ReactNative(21882): SyntheticError@1:163204
11-28 14:47:00.352 E/unknown:ReactNative(21882): Wrapper@1:163719
11-28 14:47:00.352 E/unknown:ReactNative(21882): _callSuper@1:148592
11-28 14:47:00.352 E/unknown:ReactNative(21882): _construct@1:164067
11-28 14:47:00.352 E/unknown:ReactNative(21882): _next@1:595055
```

### 95 audit 4 min
```
11-28 14:49:31.895 E/ReactNativeJS(21882): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0ix8c4-024d37cb995789a3","check":{"id":"deep-first-pass.route.market.market.history.open","label":"route.market: market.history.open (first-pass)","kind":"journey","status":"fail","durationMs":1891.3,"metrics":{"journeyId":"route.market.market.history.open","journeyLabel":"route.market: market.history.open","iteration":"cold","passId":"first-pass","scenarioId":"route.market","semanticActionId":"market.history.open","depth":1,"plannedExpectedPath":"/bank-rates","expectedPath":"/bank-rates","expectedSurface":"bank-rates.dashboard","actionSource":"market.overview","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRevisionAfter":4,"renderRevisionBefore":"state-1","actionMs":417.9,"preActionWaitMs":171,"preActionQuietWindowReused":false,"preActionQuietWindowAvoidedMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"rep…
11-28 14:49:31.903 E/unknown:ReactNative(21882): ?anon_0_@1:3711859
11-28 14:49:31.903 E/unknown:ReactNative(21882): ?anon_0_@1:3717659
11-28 14:49:31.903 E/unknown:ReactNative(21882): SyntheticError@1:163204
11-28 14:49:31.903 E/unknown:ReactNative(21882): Wrapper@1:163719
11-28 14:49:31.903 E/unknown:ReactNative(21882): _callSuper@1:148592
11-28 14:49:31.903 E/unknown:ReactNative(21882): _construct@1:164067
11-28 14:49:31.903 E/unknown:ReactNative(21882): _next@1:595055
```

### 96 audit 5 min
```
11-28 14:50:50.205 E/ReactNativeJS(21882): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0ix8c4-024d37cb995789a3","check":{"id":"deep-first-pass.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (first-pass)","kind":"journey","status":"fail","durationMs":1507.8,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Regional%20Australia%20Bank%7Cdea3dd4f-eeb8-4b11-9ee1-9c842d389890%7CTERM_DEPOSITS%7CTerm%20Savings","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":7,"actionRevision…
11-28 14:50:50.207 E/unknown:ReactNative(21882): ?anon_0_@1:3711859
11-28 14:50:50.207 E/unknown:ReactNative(21882): ?anon_0_@1:3717659
11-28 14:50:50.207 E/unknown:ReactNative(21882): SyntheticError@1:163204
11-28 14:50:50.207 E/unknown:ReactNative(21882): Wrapper@1:163719
11-28 14:50:50.207 E/unknown:ReactNative(21882): _callSuper@1:148592
11-28 14:50:50.207 E/unknown:ReactNative(21882): _construct@1:164067
11-28 14:50:50.207 E/unknown:ReactNative(21882): _next@1:595055
```

### 97 audit 6 min
```
11-28 14:52:22.895 E/ReactNativeJS(21882): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0ix8c4-024d37cb995789a3","check":{"id":"deep-first-pass.redirect.projections.redirect.projections.verify","label":"redirect.projections: redirect.projections.verify (first-pass)","kind":"journey","status":"fail","durationMs":1378.8,"metrics":{"journeyId":"redirect.projections.redirect.projections.verify","journeyLabel":"redirect.projections: redirect.projections.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.projections","semanticActionId":"redirect.projections.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"projections.inputs","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":397.8,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":188.1,"forwardWo…
11-28 14:52:22.896 E/unknown:ReactNative(21882): ?anon_0_@1:3711859
11-28 14:52:22.896 E/unknown:ReactNative(21882): ?anon_0_@1:3717659
11-28 14:52:22.896 E/unknown:ReactNative(21882): SyntheticError@1:163204
11-28 14:52:22.896 E/unknown:ReactNative(21882): Wrapper@1:163719
11-28 14:52:22.896 E/unknown:ReactNative(21882): _callSuper@1:148592
11-28 14:52:22.896 E/unknown:ReactNative(21882): _construct@1:164067
11-28 14:52:22.896 E/unknown:ReactNative(21882): _next@1:595055
```

### 98 audit 8 min
```
11-28 14:54:04.861 E/ReactNativeJS(21882): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0ix8c4-024d37cb995789a3","check":{"id":"deep-repeat.route.product.product.open","label":"route.product: product.open (repeat)","kind":"journey","status":"fail","durationMs":2403.2,"metrics":{"journeyId":"route.product.product.open","journeyLabel":"route.product: product.open","iteration":"warm","passId":"repeat","scenarioId":"route.product","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Regional%20Australia%20Bank%7Cdea3dd4f-eeb8-4b11-9ee1-9c842d389890%7CTERM_DEPOSITS%7CTerm%20Savings","expectedPath":"/product/Regional%20Australia%20Bank%7Cdea3dd4f-eeb8-4b11-9ee1-9c842d389890%7CTERM_DEPOSITS%7CTerm%20Savings","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":512.6,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,…
11-28 14:54:04.863 E/unknown:ReactNative(21882): ?anon_0_@1:3711859
11-28 14:54:04.863 E/unknown:ReactNative(21882): ?anon_0_@1:3717659
11-28 14:54:04.863 E/unknown:ReactNative(21882): SyntheticError@1:163204
11-28 14:54:04.863 E/unknown:ReactNative(21882): Wrapper@1:163719
11-28 14:54:04.863 E/unknown:ReactNative(21882): _callSuper@1:148592
11-28 14:54:04.863 E/unknown:ReactNative(21882): _construct@1:164067
11-28 14:54:04.863 E/unknown:ReactNative(21882): _next@1:595055
```

### 99 audit 9 min
```
11-28 14:55:12.160 E/ReactNativeJS(21882): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0ix8c4-024d37cb995789a3","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1597.8,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Regional%20Australia%20Bank%7Cdea3dd4f-eeb8-4b11-9ee1-9c842d389890%7CTERM_DEPOSITS%7CTerm%20Savings","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"…
11-28 14:55:12.161 E/unknown:ReactNative(21882): ?anon_0_@1:3711859
11-28 14:55:12.161 E/unknown:ReactNative(21882): ?anon_0_@1:3717659
11-28 14:55:12.161 E/unknown:ReactNative(21882): SyntheticError@1:163204
11-28 14:55:12.161 E/unknown:ReactNative(21882): Wrapper@1:163719
11-28 14:55:12.161 E/unknown:ReactNative(21882): _callSuper@1:148592
11-28 14:55:12.161 E/unknown:ReactNative(21882): _construct@1:164067
11-28 14:55:12.161 E/unknown:ReactNative(21882): _next@1:595055
```

### 100 audit 11 min
```
11-28 14:56:49.314 E/ReactNativeJS(21882): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0ix8c4-024d37cb995789a3","check":{"id":"deep-repeat.redirect.root.redirect.root.verify","label":"redirect.root: redirect.root.verify (repeat)","kind":"journey","status":"fail","durationMs":1328.5,"metrics":{"journeyId":"redirect.root.redirect.root.verify","journeyLabel":"redirect.root: redirect.root.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.root","semanticActionId":"redirect.root.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":160.1,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":478.5,"forwardWorkMs":478.5,"navigationCommitMs":437.1,"firstReadyFrameMs":41.4,"firstReadyFrameObserved":true,…
11-28 14:56:49.315 E/unknown:ReactNative(21882): ?anon_0_@1:3711859
11-28 14:56:49.315 E/unknown:ReactNative(21882): ?anon_0_@1:3717659
11-28 14:56:49.315 E/unknown:ReactNative(21882): SyntheticError@1:163204
11-28 14:56:49.315 E/unknown:ReactNative(21882): Wrapper@1:163719
11-28 14:56:49.315 E/unknown:ReactNative(21882): _callSuper@1:148592
11-28 14:56:49.315 E/unknown:ReactNative(21882): _construct@1:164067
11-28 14:56:49.315 E/unknown:ReactNative(21882): _next@1:595055
```
