# App explorer: 1.0.389 (445)

**Real-use session ATTENTION vs 1.0.387: 0 broken, 15 friction, 1 slower**

- Friction: No reaction for 3.5 s after "scroll rates 1"
- Friction: No reaction for 4.2 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "open product"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 3.2 s after "scroll lenders"
- Friction: No reaction for 3.5 s after "switch to savings"
- Friction: No reaction for 3.0 s after "scroll rba"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 3.8 s after "open term deposits"
- Friction: No reaction for 3.3 s after "verify term deposit rates"
- Friction: No reaction for 7.1 s after "search Macquarie"
- Friction: No reaction for 3.4 s after "open mortgage filter draft"
- Friction: No reaction for 4.3 s after "open unsaved rate"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: No reaction for 4.9 s after "follow browse rates recovery"
- Slower: "select second comparison rate" content 0.0 s to 2.4 s

**Initial Rates readiness:** 25.1 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3752 bytes, latest published run date 2026-11-27

Mode full | 118 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 17
Baseline 1.0.387
**Audit live: outcome failed | 809 s | audit log 842385 bytes (audit-log.txt) https://paste.c-net.org/07598c0c-3ea3-1676-2b58-fa477362bf33 | debug log 5702533 bytes read from host https://paste.c-net.org/e30181d6-cf31-1057-f79f-184da43630fc**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 26487 | +23440 | 380/654 | 73 | 579 | 1 errors; start 2525ms; boot js-start 423929, layout-mounted 424537, cache-read 424830, hydrated 425060, splash-hide 425060, manifest 426236, resolved 426580, core-fetched 429518, core-saved 430345, search-index-idle 430555, leading-requested 430555, details-start 430835, leading-scoped 431102, pricing-ready 432747, details-fetched 438590, rows-prepared 442198, detail-filters-idle 442198, last-pricing 442198, suitability-built 442653, post-refresh-wait 443182, leading-page 444304, last-rows 448886, rates-ready 449009, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 144, pricing-scope-ms 8047, leading-gated 1, filter-runs 2, filter-rows 31912, filter-yields 7, filter-ms 156, sort-runs 4, sort-rows 1191, sort-yields 4, sort-ms 75 |
| 2 | scroll rates 1 | 744 | +30 | 36/62 | 69 | 551 |  |
| 3 | scroll rates 2 | 694 | +3 | 26/55 | 61 | 555 |  |
| 4 | scroll rates back | 680 | +5 |  |  | 527 |  |
| 5 | open product | 6170 | -445 | 36/64 | 81 | 665 |  |
| 6 | scroll product | 702 | +2 | 28/59 | 77 | 656 |  |
| 7 | expand visible fees | 22 |  | 7/16 | 73 | 655 |  |
| 8 | expand product facts | 0 | -22 | 204/419 | 69 | 651 |  |
| 9 | scroll product fees | 738 | +34 | 20/36 | 73 | 662 |  |
| 10 | scroll product eligibility | 719 | -15 | 23/37 | 73 | 656 |  |
| 11 | expand eligibility | 0 | 0 | 195/331 | 69 | 662 |  |
| 12 | expand constraints | 19 | -5 | 7/16 | 48 | 659 |  |
| 13 | scroll product sources | 685 | -64 | 20/38 | 65 | 660 |  |
| 14 | back to rates | 21 | -6 | 11/24 | 53 | 659 |  |
| 15 | open lenders | 20 | -4 | 20/28 | 150 | 667 |  |
| 16 | scroll lenders | 714 | +21 | 23/27 | 121 | 662 |  |
| 17 | back from lenders | 21 | -1 | 7/9 | 109 | 663 |  |
| 18 | switch to savings | 21 | -5 | 34/56 | 81 | 676 |  |
| 19 | switch to home loans | 22 | -4 | 14/30 | 48 | 687 |  |
| 20 | open filters | 23 | +1 | 22/28 | 117 | 689 |  |
| 21 | close filters | 20 | -2 | 7/10 | 129 | 689 |  |
| 22 | open market | 20 | -3 | 19/36 | 65 | 691 |  |
| 23 | open rba | 2477 | -163 | 78/110 | 53 | 708 |  |
| 24 | scroll rba | 689 | -6 | 27/58 | 61 | 700 |  |
| 25 | back from rba | 25 | +1 | 9/20 | 57 | 701 |  |
| 26 | scroll market | 689 | -52 | 23/46 | 65 | 699 |  |
| 27 | open saved | 20 | -4 | 10/23 | 77 | 704 |  |
| 28 | return to rates | 18 | -5 | 15/33 | 61 | 705 |  |
| 29 | start category switch | 24 | -5 |  |  | 704 |  |
| 30 | open term deposits | 19 | -5 | 37/66 | 77 | 725 |  |
| 31 | verify term deposit rates | 711 | -5 | 34/60 | 73 | 726 |  |
| 32 | restore home loans | 21 | -3 | 13/28 | 53 | 733 |  |
| 33 | start search from rates | 26 | -2 |  |  | 730 |  |
| 34 | open savings search | 21 | -1 | 14/31 | 48 | 747 |  |
| 35 | search Macquarie | 1997 | -91 | 77/97 | 150 | 757 | 1 errors |
| 36 | verify Macquarie result | 0 | 0 | 14/15 | 16 | 748 |  |
| 37 | clear query and restore results | 20 | -6 | 17/19 | 34 | 755 |  |
| 38 | return from savings search | 23 | 0 | 32/43 | 81 | 777 |  |
| 39 | start filter rollback | 48 | +19 | 13/15 | 17 | 768 |  |
| 40 | open mortgage filter draft | 20 | -3 | 29/31 | 200 | 774 |  |
| 41 | select fixed in draft | 19 | -5 | 9/11 | 97 | 773 |  |
| 42 | discard unsaved filter draft | 18 | -6 | 21/23 | 93 | 775 |  |
| 43 | verify fixed was not applied | 29 | +3 | 19/27 | 250 | 781 | 1 errors |
| 44 | close verified filter draft | 18 | -4 | 19/23 | 73 | 774 |  |
| 45 | start save from rates | 23 | -9 | 15/15 | 16 | 771 | 1 errors |
| 46 | open unsaved rate | 19 | -4 | 37/64 | 85 | 807 | 1 errors |
| 47 | save a rate | 19 | -5 | 8/16 | 57 | 804 | 1 errors |
| 48 | leave saved product | 22 | -8 | 13/25 | 61 | 807 |  |
| 49 | restart with a saved rate | 11270 | -7018 | 105/179 | 81 | 607 | 1 errors; start 4909ms; boot js-start 954212, layout-mounted 954482, hydrated 955503, cache-read 956259, core-ready 956784, rows-prepared 956890, search-index-idle 956890, detail-filters-idle 956890, leading-requested 956890, last-pricing 956890, splash-hide 956891, manifest 958513, leading-scoped 959319, leading-page 959319, resolved 959814, pricing-ready 961084, last-rows 961084, rates-ready 961217, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 19, pricing-scope-ms 2570, filter-runs 1, filter-rows 6944, filter-yields 3, filter-ms 67, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 15 |
| 50 | verify saved rate after restart | 24 | -6 | 14/29 | 81 | 463 |  |
| 51 | open product from saved rates | 21 | -3 | 38/70 | 77 | 608 |  |
| 52 | remove saved rate | 27 | -3 |  |  | 616 |  |
| 53 | leave removed product | 23 | -20129 | 17/29 | 61 | 636 |  |
| 54 | follow browse rates recovery | 7206 |  | 14/29 | 57 | 720 |  |
| 55 | start compare from rates | 29 | 0 |  |  | 696 |  |
| 56 | enter selection mode | 21 | -2 | 7/16 | 48 | 698 |  |
| 57 | select first comparison rate | 20 | -5 | 8/16 | 48 | 699 |  |
| 58 | select second comparison rate | 22 | -3 | 7/14 | 57 | 697 |  |
| 59 | open two-rate comparison | 21 | -3 | 20/32 | 89 | 708 |  |
| 60 | return from two-rate comparison | 23 | 0 | 18/32 | 81 | 707 |  |
| 61 | cold start | 8339 | -4423 | 28/36 | 250 | 598 | 1 errors; start 3141ms; boot js-start 1077494, layout-mounted 1077647, hydrated 1077729, cache-read 1078707, core-ready 1079260, rows-prepared 1079369, search-index-idle 1079369, detail-filters-idle 1079369, leading-requested 1079369, last-pricing 1079369, splash-hide 1079371, manifest 1080513, leading-scoped 1080790, leading-page 1080790, resolved 1081360, pricing-ready 1081910, last-rows 1081910, rates-ready 1082050, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 18, pricing-scope-ms 1339, filter-runs 1, filter-rows 6944, filter-yields 3, filter-ms 75, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 12 |
| 62 | /browse | 25 | -9 | 2/2 | 32 | 432 |  |
| 63 | /watchlist | 35 | +10 | 2/2 | 36 | 507 |  |
| 64 | /market | 28 | -2512 | 10/22 | 46 | 585 |  |
| 65 | /tools | 24 | -2 | 5/10 | 150 | 613 |  |
| 66 | /trends | 22 | -9 | 21/36 | 89 | 624 |  |
| 67 | /search | 24 | -4584 | 27/43 | 105 | 648 |  |
| 68 | /banks | 25 | 0 | 25/34 | 105 | 668 |  |
| 69 | /bank-rates | 26 | -5 | 17/27 | 81 | 683 |  |
| 70 | /categories | 25 | -5 | 30/48 | 77 | 715 |  |
| 71 | /catalogue | 21 | -7 | 31/50 | 81 | 738 |  |
| 72 | /compare | 23 | -4 | 11/17 | 97 | 720 |  |
| 73 | /matches | 31 | +2 | 30/49 | 81 | 731 |  |
| 74 | /calculator | 27 | -3 | 13/24 | 65 | 728 |  |
| 75 | /projections | 27 | 0 | 15/26 | 65 | 717 |  |
| 76 | /profile | 23 | -1 | 13/27 | 69 | 722 |  |
| 77 | /research | 23 | -2 | 18/30 | 65 | 733 |  |
| 78 | /rba | 23 | -3 | 11/27 | 97 | 750 |  |
| 79 | /rba-response | 28 | -5 | 15/31 | 69 | 753 |  |
| 80 | /settings | 26 | 0 | 13/25 | 77 | 761 |  |
| 81 | /about | 28 | -6 | 10/24 | 53 | 763 |  |
| 82 | /terms | 24 | -5 | 13/24 | 73 | 767 |  |
| 83 | /privacy | 30 | -1 |  |  | 766 |  |
| 84 | /third-party-notices | 20 | -16 | 11/25 | 65 | 772 |  |
| 85 | /node | 24 | -8 | 29/43 | 81 | 812 |  |
| 86 | /passthrough | 32 | -4 | 19/39 | 69 | 785 |  |
| 87 | /calculation-receipt | 24 | -7 | 14/26 | 61 | 776 |  |
| 88 | /rate-receipt | 27 | -5 | 5/10 | 69 | 777 |  |
| 89 | warm resume | 622 | -106 | 2/5 | 65 | 776 |  |
| 90 | cold relaunch | 8657 | -4117 | 34/45 | 93 | 419 | 1 errors; start 3186ms; boot js-start 1298291, layout-mounted 1298477, hydrated 1298477, cache-read 1299598, core-ready 1300112, rows-prepared 1300230, search-index-idle 1300230, detail-filters-idle 1300230, leading-requested 1300230, last-pricing 1300230, splash-hide 1300231, manifest 1301458, leading-scoped 1301748, leading-page 1301748, resolved 1302339, pricing-ready 1302396, last-rows 1302396, rates-ready 1303098, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 2, pricing-yields 21, pricing-scope-ms 1280, filter-runs 2, filter-rows 13888, filter-yields 5, filter-cancels 1, filter-ms 186, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 11 |
| 91 | about | 34 | -16 | 8/23 | 69 | 405 |  |
| 92 | audit screen | 19 | -10 | 97/224 | 57 | 433 |  |
| 93 | audit 0 min | 0 | 0 | 25/32 | 69 | 714 | 19 errors |
| 94 | audit 2 min | 0 | 0 | 1494/1797 | 101 | 843 | 80 errors |
| 95 | audit 3 min | 0 | 0 | 577/722 | 93 | 941 | 80 errors |
| 96 | audit 4 min | 0 |  | 837/1008 | 97 | 1112 | 80 errors |
| 97 | audit 6 min | 0 |  | 895/1102 | 101 | 1107 | 80 errors |
| 98 | audit 7 min | 0 | 0 | 322/410 | 97 | 1141 | 80 errors |
| 99 | audit 8 min | 0 | 0 | 846/1070 | 97 | 1100 | 80 errors |
| 100 | audit 10 min | 0 | 0 | 291/369 | 89 | 1105 | 80 errors |
| 101 | audit 12 min | 0 | 0 | 152/202 | 34 | 1132 |  |
| 102 | audit 13 min | 0 |  | 60/75 | 81 | 1204 |  |
| 103 | audit finished | 0 | 0 | 86/193 | 61 | 1221 |  |
| 104 | audit result 1 | 0 | 0 |  |  | 1213 |  |
| 105 | audit result 2 | 0 | 0 |  |  | 1209 |  |
| 106 | audit result 3 | 0 | 0 |  |  | 1209 |  |
| 107 | audit result 4 | 0 | 0 |  |  | 1212 |  |
| 108 | audit result 5 | 0 | 0 |  |  | 1210 |  |
| 109 | audit result 6 | 0 | 0 |  |  | 1212 |  |
| 110 | audit result 7 | 0 | 0 |  |  | 1210 |  |
| 111 | audit result 8 | 0 | 0 |  |  | 1210 |  |
| 112 | audit result 9 | 0 | 0 |  |  | 1213 |  |
| 113 | audit result 10 | 0 | 0 |  |  | 1211 |  |
| 114 | audit result 11 | 0 | 0 |  |  | 1213 |  |
| 115 | audit result 12 | 0 | 0 |  |  | 1211 |  |
| 116 | about for debug log | 3095 | -146 | 16/34 | 57 | 1221 |  |
| 117 | debug log screen | 1 | 0 | 88/233 | 48 | 1225 |  |
| 118 | debug log uploaded | 0 | 0 | 24/32 | 81 | 1289 |  |

## Errors

### 1 open app
```
11-26 23:09:36.497 E/australianrates(10771): Not starting debugger since process cannot load the jdwp agent.
```

### 35 search Macquarie
```
11-26 23:16:37.185 E/FrameTracker(10771): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 43 verify fixed was not applied
```
11-26 23:17:39.218 E/FrameTracker(10771): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 start save from rates
```
11-26 23:17:55.600 E/FrameTracker(10771): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 open unsaved rate
```
11-26 23:18:01.133 E/ImeBackDispatcher(10771): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 2580155
```

### 47 save a rate
```
11-26 23:18:11.715 E/FrameTracker(10771): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 49 restart with a saved rate
```
11-26 23:18:26.545 E/australianrates(16659): Not starting debugger since process cannot load the jdwp agent.
```

### 61 cold start
```
11-26 23:20:30.730 E/australianrates(18215): Not starting debugger since process cannot load the jdwp agent.
```

### 90 cold relaunch
```
11-26 23:24:11.514 E/australianrates(21289): Not starting debugger since process cannot load the jdwp agent.
```

### 93 audit 0 min
```
11-26 23:25:19.600 E/ReactNativeJS(21289): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy6k3s8-397e970706fb6981","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":6565,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":274.2,"liveStage:dates-index:fetched:ms":217.5,"liveStage:revision:verified:ms":54,"liveStage:Core asset:downloaded:ms":166.8,"liveStage:Core asset:hash-verified:ms":13.5,"liveStage:Core asset:native-inflated-and-text-decoded:ms":155.2,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0.1,"liveStage:Core asset:decoded:ms":176.8,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":515.5,"liveStage:Details asset:downloaded:ms":796.3,"liveStage:Details asset:hash-verified:ms":14.5,"liveStag…
11-26 23:25:19.602 E/unknown:ReactNative(21289): ?anon_0_@1:3699674
11-26 23:25:19.602 E/unknown:ReactNative(21289): ?anon_0_@1:3705474
11-26 23:25:19.602 E/unknown:ReactNative(21289): SyntheticError@1:163048
11-26 23:25:19.602 E/unknown:ReactNative(21289): Wrapper@1:163563
11-26 23:25:19.602 E/unknown:ReactNative(21289): _callSuper@1:148436
11-26 23:25:19.602 E/unknown:ReactNative(21289): _construct@1:163911
11-26 23:25:19.602 E/unknown:ReactNative(21289): _next@1:594899
```

### 94 audit 2 min
```
11-26 23:25:20.436 E/ReactNativeJS(21289): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy6k3s8-397e970706fb6981","check":{"id":"maximum-coverage-profile","label":"Maximum safe audit coverage preparation","kind":"data","status":"fail","durationMs":763.2,"metrics":{"profile":"maximum-safe-coverage-v1","maximumSafeFeaturesEnabled":true,"enabledSections":"Mortgage,Savings,TD","includeNonStandard":true,"deepSearchEnabled":true,"historyExplorerEnabled":true,"depositRankMetric":"max","mortgageRateMetric":"comparison","requiredAssets":8,"availableAssets":8,"localCacheOnly":false,"bankInsightsPreparationAttempted":true,"bankInsightsCacheOnly":false,"executionAttempted":true,"measurementAvailable":true,"nonTimingFailure":false,"eventLoopSamples":6,"eventLoopMeasurementAvailable":true,"eventLoopP95Ms":461,"maxEventLoopLagMs":461,"stallsOver100Ms":1,"frameSamples":12,"frameMeasurementAvailable":true,"frameP95Ms":460.4,"maxFrameGapMs":460.4,"framesOver50Ms":3}}}
11-26 23:25:20.437 E/unknown:ReactNative(21289): ?anon_0_@1:3699674
11-26 23:25:20.437 E/unknown:ReactNative(21289): ?anon_0_@1:3705474
11-26 23:25:20.437 E/unknown:ReactNative(21289): SyntheticError@1:163048
11-26 23:25:20.437 E/unknown:ReactNative(21289): Wrapper@1:163563
11-26 23:25:20.437 E/unknown:ReactNative(21289): _callSuper@1:148436
11-26 23:25:20.437 E/unknown:ReactNative(21289): _construct@1:163911
11-26 23:25:20.437 E/unknown:ReactNative(21289): _next@1:594899
```

### 95 audit 3 min
```
11-26 23:27:52.559 E/ReactNativeJS(21289): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy6k3s8-397e970706fb6981","check":{"id":"deep-first-pass.route.product.product.receipt.open","label":"route.product: product.receipt.open (first-pass)","kind":"journey","status":"fail","durationMs":1398,"metrics":{"journeyId":"route.product.product.receipt.open","journeyLabel":"route.product: product.receipt.open","iteration":"cold","passId":"first-pass","scenarioId":"route.product","semanticActionId":"product.receipt.open","depth":1,"plannedExpectedPath":"/rate-receipt","expectedPath":"/rate-receipt","expectedSurface":"receipt.evidence","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":2,"actionRevisionAfter":3,"actionMs":376.5,"preActionWaitMs":0.8,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDe…
11-26 23:27:52.560 E/unknown:ReactNative(21289): ?anon_0_@1:3699674
11-26 23:27:52.560 E/unknown:ReactNative(21289): ?anon_0_@1:3705474
11-26 23:27:52.560 E/unknown:ReactNative(21289): SyntheticError@1:163048
11-26 23:27:52.560 E/unknown:ReactNative(21289): Wrapper@1:163563
11-26 23:27:52.560 E/unknown:ReactNative(21289): _callSuper@1:148436
11-26 23:27:52.560 E/unknown:ReactNative(21289): _construct@1:163911
11-26 23:27:52.560 E/unknown:ReactNative(21289): _next@1:594899
```

### 96 audit 4 min
```
11-26 23:28:47.061 E/ReactNativeJS(21289): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy6k3s8-397e970706fb6981","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":5169.4,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-27:02500ce424dd…:state-8","renderRevisionAfter":"2026-11-27:02500ce424dd…:state-9","actionResultEvidence":"{\"applied\":…
11-26 23:28:47.062 E/unknown:ReactNative(21289): ?anon_0_@1:3699674
11-26 23:28:47.062 E/unknown:ReactNative(21289): ?anon_0_@1:3705474
11-26 23:28:47.062 E/unknown:ReactNative(21289): SyntheticError@1:163048
11-26 23:28:47.062 E/unknown:ReactNative(21289): Wrapper@1:163563
11-26 23:28:47.062 E/unknown:ReactNative(21289): _callSuper@1:148436
11-26 23:28:47.062 E/unknown:ReactNative(21289): _construct@1:163911
11-26 23:28:47.062 E/unknown:ReactNative(21289): _next@1:594899
```

### 97 audit 6 min
```
11-26 23:30:18.842 E/ReactNativeJS(21289): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy6k3s8-397e970706fb6981","check":{"id":"deep-first-pass.redirect.projections.redirect.projections.verify","label":"redirect.projections: redirect.projections.verify (first-pass)","kind":"journey","status":"fail","durationMs":1247.5,"metrics":{"journeyId":"redirect.projections.redirect.projections.verify","journeyLabel":"redirect.projections: redirect.projections.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.projections","semanticActionId":"redirect.projections.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"projections.inputs","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":338.3,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":156.4,"forwardWo…
11-26 23:30:18.843 E/unknown:ReactNative(21289): ?anon_0_@1:3699674
11-26 23:30:18.843 E/unknown:ReactNative(21289): ?anon_0_@1:3705474
11-26 23:30:18.843 E/unknown:ReactNative(21289): SyntheticError@1:163048
11-26 23:30:18.843 E/unknown:ReactNative(21289): Wrapper@1:163563
11-26 23:30:18.843 E/unknown:ReactNative(21289): _callSuper@1:148436
11-26 23:30:18.843 E/unknown:ReactNative(21289): _construct@1:163911
11-26 23:30:18.843 E/unknown:ReactNative(21289): _next@1:594899
```

### 98 audit 7 min
```
11-26 23:31:59.609 E/ReactNativeJS(21289): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy6k3s8-397e970706fb6981","check":{"id":"deep-repeat.sample.catalogue.0.product.lender.open","label":"sample.catalogue.0: product.lender.open (repeat)","kind":"journey","status":"fail","durationMs":2134.3,"metrics":{"journeyId":"sample.catalogue.0.product.lender.open","journeyLabel":"sample.catalogue.0: product.lender.open","iteration":"warm","passId":"repeat","scenarioId":"sample.catalogue.0","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/Bank%20of%20Sydney","expectedPath":"/bank/Bank%20of%20Sydney","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":18,"actionRevisionAfter":19,"actionResultEvidence":"{\"expectedPath\":\"/bank/Bank%20of%20Sydney\"}","actionMs":749.8,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActi…
11-26 23:31:59.780 E/unknown:ReactNative(21289): ?anon_0_@1:3699674
11-26 23:31:59.780 E/unknown:ReactNative(21289): ?anon_0_@1:3705474
11-26 23:31:59.780 E/unknown:ReactNative(21289): SyntheticError@1:163048
11-26 23:31:59.780 E/unknown:ReactNative(21289): Wrapper@1:163563
11-26 23:31:59.780 E/unknown:ReactNative(21289): _callSuper@1:148436
11-26 23:31:59.780 E/unknown:ReactNative(21289): _construct@1:163911
11-26 23:31:59.780 E/unknown:ReactNative(21289): _next@1:594899
```

### 99 audit 8 min
```
11-26 23:32:43.692 E/ReactNativeJS(21289): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy6k3s8-397e970706fb6981","check":{"id":"deep-repeat.route.projections.projections.open","label":"route.projections: projections.open (repeat)","kind":"journey","status":"fail","durationMs":1096.3,"metrics":{"journeyId":"route.projections.projections.open","journeyLabel":"route.projections: projections.open","iteration":"warm","passId":"repeat","scenarioId":"route.projections","semanticActionId":"projections.open","depth":0,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"projections.inputs","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":233.7,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":131.6,"forwardWorkMs":131.6,"navigationCommitMs":0,"firstReadyFrameMs":131.5,"firstReadyFrameObser…
11-26 23:32:43.693 E/unknown:ReactNative(21289): ?anon_0_@1:3699674
11-26 23:32:43.693 E/unknown:ReactNative(21289): ?anon_0_@1:3705474
11-26 23:32:43.693 E/unknown:ReactNative(21289): SyntheticError@1:163048
11-26 23:32:43.693 E/unknown:ReactNative(21289): Wrapper@1:163563
11-26 23:32:43.693 E/unknown:ReactNative(21289): _callSuper@1:148436
11-26 23:32:43.693 E/unknown:ReactNative(21289): _construct@1:163911
11-26 23:32:43.693 E/unknown:ReactNative(21289): _next@1:594899
```

### 100 audit 10 min
```
11-26 23:34:11.092 E/ReactNativeJS(21289): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy6k3s8-397e970706fb6981","check":{"id":"deep-repeat.redirect.projections.redirect.projections.verify","label":"redirect.projections: redirect.projections.verify (repeat)","kind":"journey","status":"fail","durationMs":1329.1,"metrics":{"journeyId":"redirect.projections.redirect.projections.verify","journeyLabel":"redirect.projections: redirect.projections.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.projections","semanticActionId":"redirect.projections.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"projections.inputs","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":273.3,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":273.2,"forwardWorkMs":273.2,…
11-26 23:34:11.093 E/unknown:ReactNative(21289): ?anon_0_@1:3699674
11-26 23:34:11.093 E/unknown:ReactNative(21289): ?anon_0_@1:3705474
11-26 23:34:11.093 E/unknown:ReactNative(21289): SyntheticError@1:163048
11-26 23:34:11.093 E/unknown:ReactNative(21289): Wrapper@1:163563
11-26 23:34:11.093 E/unknown:ReactNative(21289): _callSuper@1:148436
11-26 23:34:11.093 E/unknown:ReactNative(21289): _construct@1:163911
11-26 23:34:11.093 E/unknown:ReactNative(21289): _next@1:594899
```
