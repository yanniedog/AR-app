# App explorer: 1.0.380 (436)

**Real-use session ATTENTION vs 1.0.379: 0 broken, 23 friction, 2 slower**

- Friction: No reaction for 3.6 s after "scroll rates 1"
- Friction: No reaction for 3.4 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll product fees"
- Friction: No reaction for 3.1 s after "scroll product eligibility"
- Friction: No reaction for 3.1 s after "scroll product sources"
- Friction: No reaction for 3.5 s after "scroll lenders"
- Friction: No reaction for 4.4 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 5.1 s after "open term deposits"
- Friction: No reaction for 3.9 s after "verify term deposit rates"
- Friction: No reaction for 7.2 s after "search Macquarie"
- Friction: No reaction for 3.3 s after "return from savings search"
- Friction: No reaction for 3.6 s after "open mortgage filter draft"
- Friction: No reaction for 3.7 s after "verify fixed was not applied"
- Friction: No reaction for 3.5 s after "open unsaved rate"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: "No saved rates" shown on "follow browse rates recovery"
- Friction: No reaction for 7.5 s after "start compare from rates"
- Slower: "start compare from rates" content 0.0 s to 7.5 s
- Slower: "start compare from rates" reaction 2.1 s to 7.5 s

**Initial Rates readiness:** 39.7 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-26

Mode full | 117 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 16
Baseline 1.0.379
**Audit live: outcome failed | 986 s | audit log 848085 bytes (audit-log.txt) https://paste.c-net.org/bec9a409-1ef1-dc3c-4868-ab4bf33103b9 | debug log fetch failed (Hosted log exceeds the upload byte limit) https://paste.rs/yFMXO**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2957 | -153 | 629/848 | 85 | 478 | 1 errors; start 2920ms |
| 2 | scroll rates 1 | 727 | +46 | 34/51 | 85 | 567 | boot js-start 460731, layout-mounted 461425, cache-read 461565, hydrated 461751, splash-hide 461751, manifest 462733, resolved 463480, core-fetched 468783, core-saved 469479, search-index-idle 469718, leading-requested 469718, details-start 469963, leading-scoped 470210, pricing-ready 471496, details-fetched 481370, rows-prepared 487940, detail-filters-idle 487940, last-pricing 487940, suitability-built 489332, post-refresh-wait 489953, leading-page 491339, last-rows 500245, rates-ready 500414, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 187, pricing-scope-ms 12489, leading-gated 1, filter-runs 2, filter-rows 31602, filter-yields 6, filter-ms 122, sort-runs 4, sort-rows 1183, sort-yields 4, sort-ms 62 |
| 3 | scroll rates 2 | 696 | -17 | 23/34 | 81 | 777 |  |
| 4 | scroll rates back | 687 | +7 |  |  | 579 |  |
| 5 | open product | 5320 | -595 | 39/54 | 81 | 626 |  |
| 6 | scroll product | 706 | +6 | 32/52 | 73 | 681 |  |
| 7 | expand product facts | 22 | 0 | 41/67 | 77 | 682 |  |
| 8 | scroll product fees | 734 | +11 | 32/55 | 85 | 679 |  |
| 9 | scroll product eligibility | 718 | -14 | 23/34 | 77 | 665 |  |
| 10 | expand eligibility | 0 | 0 | 219/294 | 81 | 671 |  |
| 11 | expand constraints | 22 | +1 | 10/15 | 73 | 673 |  |
| 12 | scroll product sources | 740 | +18 | 25/34 | 81 | 674 |  |
| 13 | back to rates | 24 | -5 | 16/22 | 69 | 694 |  |
| 14 | open lenders | 24 | +1 | 23/25 | 250 | 714 |  |
| 15 | scroll lenders | 792 | +79 | 23/27 | 133 | 697 |  |
| 16 | back from lenders | 21 | -1 | 7/9 | 150 | 701 |  |
| 17 | switch to savings | 23 | -2 | 54/75 | 85 | 722 |  |
| 18 | switch to home loans | 22 | -2 | 16/28 | 65 | 699 |  |
| 19 | open filters | 21 | -3 | 21/24 | 125 | 696 |  |
| 20 | close filters | 22 | -1 | 8/9 | 105 | 694 |  |
| 21 | open market | 21 | -2 | 18/31 | 69 | 695 |  |
| 22 | open rba | 2599 | -65 | 64/73 | 65 | 710 |  |
| 23 | scroll rba | 696 | -12 | 31/54 | 77 | 704 |  |
| 24 | back from rba | 23 | 0 | 10/19 | 65 | 705 |  |
| 25 | scroll market | 724 | +36 | 27/40 | 85 | 704 |  |
| 26 | open saved | 23 | +1 | 14/21 | 73 | 708 |  |
| 27 | return to rates | 22 | -2 | 18/31 | 65 | 709 |  |
| 28 | start category switch | 32 | +4 |  |  | 708 |  |
| 29 | open term deposits | 24 | +1 | 69/95 | 85 | 727 |  |
| 30 | verify term deposit rates | 699 | -25 | 39/55 | 77 | 727 |  |
| 31 | restore home loans | 23 | 0 | 14/28 | 65 | 738 |  |
| 32 | start search from rates | 29 | +3 |  |  | 733 |  |
| 33 | open savings search | 22 | -1 | 19/30 | 69 | 749 |  |
| 34 | search Macquarie | 1275 | -1067 | 69/76 | 150 | 747 | 1 errors |
| 35 | verify Macquarie result | 2 | +1 | 14/15 | 16 | 739 |  |
| 36 | clear query and restore results | 23 | -3 | 17/19 | 34 | 748 |  |
| 37 | return from savings search | 23 | -1 | 31/39 | 93 | 760 |  |
| 38 | start filter rollback | 30 | -37 | 11/16 | 16 | 750 |  |
| 39 | open mortgage filter draft | 25 | +3 | 26/29 | 200 | 761 |  |
| 40 | select fixed in draft | 20 | -1 | 14/15 | 97 | 760 |  |
| 41 | discard unsaved filter draft | 23 | +2 | 18/22 | 69 | 761 |  |
| 42 | verify fixed was not applied | 22 | -1 | 22/28 | 133 | 769 | 1 errors |
| 43 | close verified filter draft | 21 | -1 | 19/22 | 97 | 767 |  |
| 44 | start save from rates | 29 | 0 | 12/16 | 17 | 763 | 1 errors |
| 45 | open unsaved rate | 29 | +5 | 47/60 | 97 | 787 | 1 errors |
| 46 | save a rate | 24 | +1 | 10/16 | 89 | 784 | 1 errors |
| 47 | leave saved product | 25 | +1 | 12/21 | 97 | 785 |  |
| 48 | restart with a saved rate | 18401 | +660 | 214/307 | 97 | 592 | 3 errors; start 6140ms; boot js-start 966615, layout-mounted 967254, hydrated 967518, cache-read 968770, core-ready 969559, rows-prepared 969732, search-index-idle 969732, detail-filters-idle 969732, leading-requested 969732, last-pricing 969732, splash-hide 969733, manifest 973155, leading-scoped 974351, leading-page 974351, resolved 974822, pricing-ready 978067, last-rows 978067, rates-ready 978242, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 23, pricing-scope-ms 4350, filter-runs 1, filter-rows 6864, filter-yields 4, filter-ms 103, sort-runs 1, sort-rows 1183, sort-yields 1, sort-ms 14 |
| 49 | verify saved rate after restart | 23 | 0 | 21/34 | 69 | 624 |  |
| 50 | open product from saved rates | 24 | -6 | 40/57 | 81 | 527 |  |
| 51 | remove saved rate | 34 | +4 | 13/20 | 77 | 570 |  |
| 52 | leave removed product | 26 | -20125 | 10/11 | 73 | 657 |  |
| 53 | follow browse rates recovery | 25 |  |  |  | 654 |  |
| 54 | start compare from rates | 4464 | +4436 | 18/27 | 73 | 661 |  |
| 55 | enter selection mode | 23 | -4788 | 12/15 | 61 | 668 |  |
| 56 | select first comparison rate | 29 | +6 |  |  | 723 |  |
| 57 | select second comparison rate | 23 | +1 | 21/30 | 61 | 728 |  |
| 58 | open two-rate comparison | 25 | +4 | 21/31 | 113 | 746 |  |
| 59 | return from two-rate comparison | 26 | +3 | 21/29 | 85 | 747 |  |
| 60 | cold start | 16643 | +5954 | 39/46 | 200 | 477 | 3 errors; start 4927ms; boot js-start 1102962, layout-mounted 1103177, hydrated 1103273, cache-read 1104688, core-ready 1105490, rows-prepared 1105652, search-index-idle 1105652, detail-filters-idle 1105652, leading-requested 1105652, last-pricing 1105652, splash-hide 1105653, manifest 1107414, leading-scoped 1108008, leading-page 1108008, pricing-ready 1108737, last-rows 1108737, rates-ready 1108962, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 13, pricing-scope-ms 1447, filter-runs 1, filter-rows 6864, filter-yields 5, filter-ms 134, sort-runs 1, sort-rows 1183, sort-yields 1, sort-ms 17 |
| 61 | /browse | 2364 | -2161 | 1/2 | 32 | 367 |  |
| 62 | /watchlist | 28 | -6 | 3/3 | 32 | 368 |  |
| 63 | /market | 43 | +9 |  |  | 451 |  |
| 64 | /tools | 37 | +9 | 12/14 | 250 | 465 |  |
| 65 | /trends | 29 | +2 | 19/29 | 129 | 498 |  |
| 66 | /search | 4466 | +2126 | 24/32 | 150 | 506 |  |
| 67 | /banks | 26 | +1 | 33/47 | 101 | 513 |  |
| 68 | /bank-rates | 34 | +9 | 15/25 | 81 | 525 |  |
| 69 | /categories | 33 | +3 | 34/46 | 93 | 547 |  |
| 70 | /catalogue | 28 | -1 | 28/41 | 81 | 572 |  |
| 71 | /compare | 26 | -7 | 10/15 | 129 | 586 |  |
| 72 | /matches | 41 | +5 | 37/50 | 85 | 569 |  |
| 73 | /calculator | 36 | +5 | 13/22 | 85 | 554 |  |
| 74 | /projections | 28 | -1 | 26/36 | 89 | 564 |  |
| 75 | /profile | 28 | -2 | 15/21 | 65 | 565 |  |
| 76 | /research | 36 | +8 | 16/27 | 73 | 572 |  |
| 77 | /rba | 29 | +4 | 15/23 | 57 | 586 |  |
| 78 | /rba-response | 29 | -2 | 19/29 | 65 | 588 |  |
| 79 | /settings | 29 | +4 | 27/41 | 73 | 595 |  |
| 80 | /about | 33 | +2 | 14/25 | 77 | 594 |  |
| 81 | /terms | 35 | -1 | 13/23 | 61 | 595 |  |
| 82 | /privacy | 33 | +1 |  |  | 595 |  |
| 83 | /third-party-notices | 32 | +3 | 15/23 | 89 | 601 |  |
| 84 | /node | 27 | 0 | 35/46 | 81 | 634 |  |
| 85 | /passthrough | 30 | -3 | 28/41 | 93 | 609 |  |
| 86 | /calculation-receipt | 27 | -5 | 15/23 | 93 | 598 |  |
| 87 | /rate-receipt | 28 | +4 | 7/10 | 85 | 598 |  |
| 88 | warm resume | 588 | -87 | 4/5 | 85 | 597 |  |
| 89 | cold relaunch | 10438 | +312 | 31/38 | 150 | 589 | 3 errors; start 4334ms; boot js-start 1348670, layout-mounted 1348865, hydrated 1348980, cache-read 1350219, core-ready 1350987, rows-prepared 1351131, search-index-idle 1351131, detail-filters-idle 1351131, leading-requested 1351131, last-pricing 1351131, splash-hide 1351133, manifest 1353493, leading-scoped 1353887, leading-page 1353887, resolved 1354461, pricing-ready 1355373, last-rows 1355373, rates-ready 1355560, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 25, pricing-scope-ms 1777, filter-runs 1, filter-rows 6864, filter-yields 4, filter-ms 103, sort-runs 1, sort-rows 1183, sort-yields 1, sort-ms 14 |
| 90 | about | 31 | +2 | 11/19 | 300 | 417 |  |
| 91 | audit screen | 23 | +2 | 139/250 | 61 | 628 |  |
| 92 | audit 0 min | 0 | 0 | 29/35 | 81 | 849 |  |
| 93 | audit 2 min | 0 | 0 | 1311/1500 | 113 | 993 | 80 errors |
| 94 | audit 4 min | 0 | 0 | 1016/1178 | 109 | 1182 | 80 errors |
| 95 | audit 5 min | 0 |  | 865/1008 | 113 | 1205 | 80 errors |
| 96 | audit 7 min | 0 | 0 | 705/780 | 117 | 1224 | 80 errors |
| 97 | audit 9 min | 0 |  | 827/939 | 105 | 1191 | 80 errors |
| 98 | audit 10 min | 0 | 0 | 889/1025 | 113 | 1391 | 80 errors |
| 99 | audit 12 min | 0 | 0 | 380/432 | 113 | 1254 | 80 errors |
| 100 | audit 14 min | 0 |  | 167/194 | 40 | 1274 |  |
| 101 | audit 15 min | 0 | 0 | 136/158 | 48 | 1295 |  |
| 102 | audit finished | 0 | 0 | 118/204 | 69 | 1338 |  |
| 103 | audit result 1 | 0 | 0 |  |  | 1295 |  |
| 104 | audit result 2 | 0 | 0 |  |  | 1295 |  |
| 105 | audit result 3 | 0 | 0 |  |  | 1298 |  |
| 106 | audit result 4 | 0 | 0 |  |  | 1296 |  |
| 107 | audit result 5 | 0 | 0 |  |  | 1299 |  |
| 108 | audit result 6 | 0 | 0 |  |  | 1297 |  |
| 109 | audit result 7 | 0 | 0 |  |  | 1297 |  |
| 110 | audit result 8 | 0 | 0 |  |  | 1300 |  |
| 111 | audit result 9 | 0 | 0 |  |  | 1299 |  |
| 112 | audit result 10 | 0 | 0 |  |  | 1301 |  |
| 113 | audit result 11 | 0 | 0 |  |  | 1300 |  |
| 114 | audit result 12 | 0 | 0 |  |  | 1302 |  |
| 115 | about for debug log | 3233 | +53 | 22/30 | 69 | 1350 |  |
| 116 | debug log screen | 0 | 0 | 116/213 | 61 | 1340 |  |
| 117 | debug log uploaded | 0 | 0 | 24/31 | 105 | 1394 |  |

## Errors

### 1 open app
```
11-26 13:11:52.930 E/australianrates(11232): Not starting debugger since process cannot load the jdwp agent.
```

### 34 search Macquarie
```
11-26 13:18:26.887 E/FrameTracker(11232): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 42 verify fixed was not applied
```
11-26 13:19:30.444 E/FrameTracker(11232): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 44 start save from rates
```
11-26 13:19:48.116 E/FrameTracker(11232): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 open unsaved rate
```
11-26 13:19:54.045 E/ImeBackDispatcher(11232): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 151622377
```

### 46 save a rate
```
11-26 13:20:04.588 E/FrameTracker(11232): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 48 restart with a saved rate
```
11-26 13:20:18.600 E/australianrates(16802): Not starting debugger since process cannot load the jdwp agent.
11-26 13:20:24.650 E/SurfaceSyncGroup(16802): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-26 13:20:24.650 E/SurfaceSyncGroup(16802): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 60 cold start
```
11-26 13:22:35.919 E/australianrates(18324): Not starting debugger since process cannot load the jdwp agent.
11-26 13:22:40.577 E/SurfaceSyncGroup(18324): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-26 13:22:40.577 E/SurfaceSyncGroup(18324): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 89 cold relaunch
```
11-26 13:26:41.797 E/australianrates(21544): Not starting debugger since process cannot load the jdwp agent.
11-26 13:26:46.063 E/SurfaceSyncGroup(21544): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-26 13:26:46.066 E/SurfaceSyncGroup(21544): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 93 audit 2 min
```
11-26 13:28:02.077 E/ReactNativeJS(21544): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxl7wso-13d112aff10f50ed","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":8416.3,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":193.2,"liveStage:dates-index:fetched:ms":198.6,"liveStage:revision:verified:ms":40,"liveStage:Core asset:downloaded:ms":258.7,"liveStage:Core asset:hash-verified:ms":16.8,"liveStage:Core asset:native-inflated-and-text-decoded:ms":200.8,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":245.4,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":652.5,"liveStage:Details asset:downloaded:ms":1414.6,"liveStage:Details asset:hash-verified:ms":16.9,"liveSta…
11-26 13:28:02.079 E/unknown:ReactNative(21544): ?anon_0_@1:3697107
11-26 13:28:02.079 E/unknown:ReactNative(21544): ?anon_0_@1:3702907
11-26 13:28:02.079 E/unknown:ReactNative(21544): SyntheticError@1:163048
11-26 13:28:02.079 E/unknown:ReactNative(21544): Wrapper@1:163563
11-26 13:28:02.079 E/unknown:ReactNative(21544): _callSuper@1:148436
11-26 13:28:02.079 E/unknown:ReactNative(21544): _construct@1:163911
11-26 13:28:02.079 E/unknown:ReactNative(21544): _next@1:594899
```

### 94 audit 4 min
```
11-26 13:30:38.256 E/ReactNativeJS(21544): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxl7wso-13d112aff10f50ed","check":{"id":"deep-first-pass.route.rates-mortgage-scope.search.mortgage.scope.apply.1","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.1 (first-pass)","kind":"journey","status":"fail","durationMs":9387.8,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.1","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.1","iteration":"cold","passId":"first-pass","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.1","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":20,"actionRevisionAfter":21,"renderRevisionBefore":"state-15","renderRevisionAfter":"state-21","actionMs":136.7,"preActionWaitMs":0.8,"preActionQuietWindowReused":tru…
11-26 13:30:38.257 E/unknown:ReactNative(21544): ?anon_0_@1:3697107
11-26 13:30:38.257 E/unknown:ReactNative(21544): ?anon_0_@1:3702907
11-26 13:30:38.257 E/unknown:ReactNative(21544): SyntheticError@1:163048
11-26 13:30:38.257 E/unknown:ReactNative(21544): Wrapper@1:163563
11-26 13:30:38.257 E/unknown:ReactNative(21544): _callSuper@1:148436
11-26 13:30:38.257 E/unknown:ReactNative(21544): _construct@1:163911
11-26 13:30:38.257 E/unknown:ReactNative(21544): _next@1:594899
```

### 95 audit 5 min
```
11-26 13:32:20.743 E/ReactNativeJS(21544): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxl7wso-13d112aff10f50ed","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":1491.3,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-26:0e55e66b7edb…:state-8","renderRevisionAfter":"2026-11-26:0e55e66b7edb…:state-9","actionResultEvidence":"{\"applied\":…
11-26 13:32:20.745 E/unknown:ReactNative(21544): ?anon_0_@1:3697107
11-26 13:32:20.745 E/unknown:ReactNative(21544): ?anon_0_@1:3702907
11-26 13:32:20.745 E/unknown:ReactNative(21544): SyntheticError@1:163048
11-26 13:32:20.745 E/unknown:ReactNative(21544): Wrapper@1:163563
11-26 13:32:20.745 E/unknown:ReactNative(21544): _callSuper@1:148436
11-26 13:32:20.745 E/unknown:ReactNative(21544): _construct@1:163911
11-26 13:32:20.745 E/unknown:ReactNative(21544): _next@1:594899
```

### 96 audit 7 min
```
11-26 13:34:02.868 E/ReactNativeJS(21544): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxl7wso-13d112aff10f50ed","check":{"id":"deep-first-pass.redirect.onboarding.redirect.onboarding.verify","label":"redirect.onboarding: redirect.onboarding.verify (first-pass)","kind":"journey","status":"fail","durationMs":1510.9,"metrics":{"journeyId":"redirect.onboarding.redirect.onboarding.verify","journeyLabel":"redirect.onboarding: redirect.onboarding.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.onboarding","semanticActionId":"redirect.onboarding.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":147,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":822.9,"forwardWorkMs":822.9,"navigationCo…
11-26 13:34:02.869 E/unknown:ReactNative(21544): ?anon_0_@1:3697107
11-26 13:34:02.869 E/unknown:ReactNative(21544): ?anon_0_@1:3702907
11-26 13:34:02.869 E/unknown:ReactNative(21544): SyntheticError@1:163048
11-26 13:34:02.869 E/unknown:ReactNative(21544): Wrapper@1:163563
11-26 13:34:02.869 E/unknown:ReactNative(21544): _callSuper@1:148436
11-26 13:34:02.869 E/unknown:ReactNative(21544): _construct@1:163911
11-26 13:34:02.869 E/unknown:ReactNative(21544): _next@1:594899
```

### 97 audit 9 min
```
11-26 13:35:45.434 E/ReactNativeJS(21544): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxl7wso-13d112aff10f50ed","check":{"id":"deep-repeat.redirect.node.redirect.node.verify","label":"redirect.node: redirect.node.verify (repeat)","kind":"journey","status":"fail","durationMs":2868.8,"metrics":{"journeyId":"redirect.node.redirect.node.verify","journeyLabel":"redirect.node: redirect.node.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.node","semanticActionId":"redirect.node.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":300.1,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1896.4,"forwardWorkMs":1896.4,"navigationCommitMs":869.4,"firstReadyFrameMs":1026.9,"firstReadyFrameObserved":t…
11-26 13:35:45.436 E/unknown:ReactNative(21544): ?anon_0_@1:3697107
11-26 13:35:45.436 E/unknown:ReactNative(21544): ?anon_0_@1:3702907
11-26 13:35:45.436 E/unknown:ReactNative(21544): SyntheticError@1:163048
11-26 13:35:45.436 E/unknown:ReactNative(21544): Wrapper@1:163563
11-26 13:35:45.436 E/unknown:ReactNative(21544): _callSuper@1:148436
11-26 13:35:45.436 E/unknown:ReactNative(21544): _construct@1:163911
11-26 13:35:45.436 E/unknown:ReactNative(21544): _next@1:594899
```

### 98 audit 10 min
```
11-26 13:37:18.780 E/ReactNativeJS(21544): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxl7wso-13d112aff10f50ed","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1645.5,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/BOQ%20Specialist%7C06186288-5c03-ee11-8f6e-00224814dce7%7CTRANS_AND_SAVINGS_ACCOUNTS%7COne%20Account","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,…
11-26 13:37:18.781 E/unknown:ReactNative(21544): ?anon_0_@1:3697107
11-26 13:37:18.781 E/unknown:ReactNative(21544): ?anon_0_@1:3702907
11-26 13:37:18.781 E/unknown:ReactNative(21544): SyntheticError@1:163048
11-26 13:37:18.781 E/unknown:ReactNative(21544): Wrapper@1:163563
11-26 13:37:18.781 E/unknown:ReactNative(21544): _callSuper@1:148436
11-26 13:37:18.781 E/unknown:ReactNative(21544): _construct@1:163911
11-26 13:37:18.781 E/unknown:ReactNative(21544): _next@1:594899
```

### 99 audit 12 min
```
11-26 13:38:50.871 E/ReactNativeJS(21544): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxl7wso-13d112aff10f50ed","check":{"id":"deep-repeat.redirect.catalogue.redirect.catalogue.verify","label":"redirect.catalogue: redirect.catalogue.verify (repeat)","kind":"journey","status":"fail","durationMs":2106.7,"metrics":{"journeyId":"redirect.catalogue.redirect.catalogue.verify","journeyLabel":"redirect.catalogue: redirect.catalogue.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.catalogue","semanticActionId":"redirect.catalogue.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":75.1,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1374.8,"forwardWorkMs":1374.8,"navigationCommitMs":804.3,"firs…
11-26 13:38:50.874 E/unknown:ReactNative(21544): ?anon_0_@1:3697107
11-26 13:38:50.874 E/unknown:ReactNative(21544): ?anon_0_@1:3702907
11-26 13:38:50.874 E/unknown:ReactNative(21544): SyntheticError@1:163048
11-26 13:38:50.874 E/unknown:ReactNative(21544): Wrapper@1:163563
11-26 13:38:50.874 E/unknown:ReactNative(21544): _callSuper@1:148436
11-26 13:38:50.874 E/unknown:ReactNative(21544): _construct@1:163911
11-26 13:38:50.874 E/unknown:ReactNative(21544): _next@1:594899
```
