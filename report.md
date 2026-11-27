# App explorer: 1.0.391 (447)

**Real-use session FAIL vs 1.0.390: 1 broken, 27 friction, 6 slower**

- Broken: "follow browse rates recovery" failed: UI assertion failed: app hierarchy unavailable
- Friction: No reaction for 3.8 s after "scroll rates 1"
- Friction: No reaction for 3.3 s after "scroll rates 2"
- Friction: No reaction for 4.0 s after "open product"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 5.3 s after "expand visible fees"
- Friction: No reaction for 3.1 s after "scroll product fees"
- Friction: No reaction for 3.0 s after "scroll product eligibility"
- Friction: No reaction for 3.0 s after "scroll product sources"
- Friction: No reaction for 6.7 s after "back to rates"
- Friction: No reaction for 4.9 s after "switch to savings"
- Friction: No reaction for 3.2 s after "switch to home loans"
- Friction: No reaction for 3.5 s after "open filters"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 5.0 s after "open term deposits"
- Friction: No reaction for 3.6 s after "verify term deposit rates"
- Friction: No reaction for 7.7 s after "search Macquarie"
- Friction: No reaction for 3.3 s after "return from savings search"
- Friction: No reaction for 3.7 s after "open mortgage filter draft"
- Friction: No reaction for 3.7 s after "verify fixed was not applied"
- Friction: No reaction for 3.6 s after "open unsaved rate"
- Friction: No reaction for 3.3 s after "open product from saved rates"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: "No saved rates" shown on "follow browse rates recovery"
- Friction: No reaction for 3.4 s after "open two-rate comparison"
- Slower: "expand visible fees" content 0.0 s to 5.3 s
- Slower: "expand eligibility" content 0.0 s to 2.4 s
- Slower: "back to rates" content 2.2 s to 6.7 s
- Slower: "back to rates" reaction 2.2 s to 6.7 s
- Slower: Dropped frames 48% to 70% on "switch to home loans"
- Slower: Dropped frames 73% to 91% on "close verified filter draft"

**Initial Rates readiness:** 40.2 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 9 passed, 1 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-28

Mode full | 120 steps | crashes 0 | step failures 1 | settle timeouts 0 | steps with JS/native errors 17
Baseline 1.0.390
**Audit live: outcome failed | 1006 s | audit log 856161 bytes (audit-log.txt) https://paste.c-net.org/d1e80a0c-6392-407c-724f-1cd25c83425e | debug log 5658735 bytes read from host https://paste.c-net.org/338ca767-2586-61fa-d618-c98352e5a5c6**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2940 | -183 | 638/868 | 85 | 490 | 1 errors; start 2871ms |
| 2 | scroll rates 1 | 689 | -38 | 37/54 | 77 | 590 | boot js-start 484386, layout-mounted 484928, cache-read 485184, hydrated 485414, splash-hide 485414, manifest 486412, resolved 486934, core-fetched 492310, core-saved 493365, search-index-idle 493734, leading-requested 493734, details-start 494124, leading-scoped 494173, pricing-ready 495770, details-fetched 505197, rows-prepared 512082, detail-filters-idle 512082, last-pricing 512082, suitability-built 513201, post-refresh-wait 513584, leading-page 515297, last-rows 524416, rates-ready 524590, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 195, pricing-scope-ms 12807, leading-gated 1, filter-runs 2, filter-rows 31912, filter-yields 9, filter-ms 902, sort-runs 4, sort-rows 1191, sort-yields 4, sort-ms 43 |
| 3 | scroll rates 2 | 693 | -3 | 28/39 | 89 | 667 |  |
| 4 | scroll rates back | 679 | -14 |  |  | 527 |  |
| 5 | open product | 22 | -6 | 33/55 | 89 | 623 |  |
| 6 | scroll product | 696 | +15 | 35/56 | 81 | 679 |  |
| 7 | expand visible fees | 2262 | +2262 | 8/16 | 57 | 684 |  |
| 8 | expand product facts | 22 | +1 | 93/142 | 85 | 695 |  |
| 9 | scroll product fees | 759 | +28 | 33/52 | 85 | 693 |  |
| 10 | scroll product eligibility | 688 | -35 | 13/27 | 77 | 667 |  |
| 11 | expand eligibility | 20 | +20 | 10/15 | 81 | 662 |  |
| 12 | expand constraints | 23 | +2 | 41/60 | 81 | 685 |  |
| 13 | scroll product sources | 720 | -33 | 20/33 | 89 | 669 |  |
| 14 | back to rates | 4564 | +4539 | 14/22 | 65 | 666 |  |
| 15 | open lenders | 23 | -1 | 19/24 | 200 | 674 |  |
| 16 | scroll lenders | 776 | -35 | 19/22 | 150 | 668 |  |
| 17 | back from lenders | 22 | 0 | 6/7 | 150 | 668 |  |
| 18 | switch to savings | 22 | -1 | 65/91 | 85 | 684 |  |
| 19 | switch to home loans | 26 | +1 | 19/27 | 77 | 692 |  |
| 20 | open filters | 25 | 0 | 23/27 | 113 | 692 |  |
| 21 | close filters | 23 | +1 | 7/9 | 121 | 692 |  |
| 22 | open market | 21 | -4 | 19/36 | 69 | 692 |  |
| 23 | open rba | 2523 | -323 | 58/69 | 65 | 708 |  |
| 24 | scroll rba | 723 | +19 | 30/54 | 73 | 701 |  |
| 25 | back from rba | 23 | 0 | 10/19 | 61 | 701 |  |
| 26 | scroll market | 720 | +27 | 25/39 | 81 | 700 |  |
| 27 | open saved | 26 | +2 | 15/23 | 81 | 705 |  |
| 28 | return to rates | 22 | -1 | 15/33 | 73 | 707 |  |
| 29 | start category switch | 28 | -3 |  |  | 706 |  |
| 30 | open term deposits | 22 | -3 | 67/87 | 81 | 727 |  |
| 31 | verify term deposit rates | 789 | +72 | 35/53 | 73 | 728 |  |
| 32 | restore home loans | 24 | +2 | 17/27 | 61 | 738 |  |
| 33 | start search from rates | 36 | +9 |  |  | 733 |  |
| 34 | open savings search | 23 | -1 | 18/31 | 61 | 745 |  |
| 35 | search Macquarie | 1984 | -300 | 73/81 | 133 | 749 | 1 errors |
| 36 | verify Macquarie result | 0 | 0 | 10/15 | 16 | 740 |  |
| 37 | clear query and restore results | 23 | +1 | 15/19 | 32 | 752 |  |
| 38 | return from savings search | 24 | +2 | 32/40 | 89 | 778 |  |
| 39 | start filter rollback | 26 | -2 | 15/15 | 16 | 767 |  |
| 40 | open mortgage filter draft | 22 | -2 | 24/30 | 121 | 765 |  |
| 41 | select fixed in draft | 25 | +2 | 9/13 | 117 | 763 |  |
| 42 | discard unsaved filter draft | 23 | 0 | 20/22 | 73 | 765 |  |
| 43 | verify fixed was not applied | 24 | 0 | 27/31 | 200 | 772 | 1 errors |
| 44 | close verified filter draft | 24 | +3 | 20/22 | 89 | 770 |  |
| 45 | start save from rates | 33 | +6 | 14/16 | 30 | 766 | 1 errors |
| 46 | open unsaved rate | 21 | -1 | 143/197 | 73 | 796 | 1 errors |
| 47 | save a rate | 25 | -8 | 8/15 | 73 | 790 | 1 errors |
| 48 | leave saved product | 24 | -5 | 15/21 | 69 | 792 |  |
| 49 | restart with a saved rate | 19814 | +1819 | 241/338 | 93 | 588 | 3 errors; start 6274ms; boot js-start 980610, layout-mounted 981104, hydrated 981760, cache-read 983067, core-ready 983869, rows-prepared 984049, search-index-idle 984049, detail-filters-idle 984049, leading-requested 984049, last-pricing 984049, splash-hide 984050, manifest 987418, leading-scoped 989855, leading-page 989855, resolved 990880, pricing-ready 993518, last-rows 993518, rates-ready 993704, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 23, pricing-scope-ms 5599, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 109, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 14 |
| 50 | verify saved rate after restart | 34 | +2 | 19/33 | 93 | 621 |  |
| 51 | open product from saved rates | 35 | +12 | 41/61 | 89 | 526 |  |
| 52 | remove saved rate | 30 | +5 | 12/18 | 105 | 576 |  |
| 53 | leave removed product | 24 | 0 | 9/10 | 77 | 629 |  |
| 54 | follow browse rates recovery | 26 | -24 |  |  | 632 | UI assertion failed: app hierarchy unavailable |
| 55 | start compare from rates | 4586 | +46 | 18/32 | 69 | 667 |  |
| 56 | enter selection mode | 30 | +6 | 11/15 | 65 | 686 |  |
| 57 | select first comparison rate | 26 | -22 |  |  | 736 |  |
| 58 | select second comparison rate | 23 | +1 | 20/30 | 65 | 735 |  |
| 59 | open two-rate comparison | 23 | 0 | 21/29 | 150 | 724 |  |
| 60 | return from two-rate comparison | 22 | 0 | 19/28 | 113 | 717 |  |
| 61 | cold start | 10371 | +230 | 29/35 | 150 | 579 | 3 errors; start 4349ms; boot js-start 1123716, layout-mounted 1123910, hydrated 1124047, cache-read 1125338, core-ready 1126160, rows-prepared 1126341, search-index-idle 1126341, detail-filters-idle 1126341, leading-requested 1126341, last-pricing 1126341, splash-hide 1126343, manifest 1128655, leading-scoped 1129139, leading-page 1129139, resolved 1129544, pricing-ready 1130434, last-rows 1130434, rates-ready 1130625, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 25, pricing-scope-ms 1705, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 105, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 15 |
| 62 | /browse | 33 | -4464 | 2/2 | 32 | 415 |  |
| 63 | /watchlist | 27 | -3 | 3/4 | 48 | 417 |  |
| 64 | /market | 2300 | +2268 | 12/19 | 65 | 500 |  |
| 65 | /tools | 27 | -1 | 15/21 | 93 | 565 |  |
| 66 | /trends | 29 | +1 |  |  | 615 |  |
| 67 | /search | 4484 | -115 | 38/50 | 150 | 625 |  |
| 68 | /banks | 33 | +8 | 33/44 | 117 | 636 |  |
| 69 | /bank-rates | 28 | -5 | 18/27 | 81 | 652 |  |
| 70 | /categories | 26 | -2 | 39/46 | 93 | 680 |  |
| 71 | /catalogue | 24 | -3 | 32/43 | 101 | 702 |  |
| 72 | /compare | 33 | +3 | 11/14 | 150 | 671 |  |
| 73 | /matches | 27 | -6 | 35/49 | 85 | 692 |  |
| 74 | /calculator | 27 | 0 | 13/21 | 89 | 677 |  |
| 75 | /projections | 24 | -1 | 17/30 | 89 | 680 |  |
| 76 | /profile | 26 | -3 | 15/26 | 69 | 680 |  |
| 77 | /research | 29 | -1 | 19/30 | 61 | 690 |  |
| 78 | /rba | 27 | +1 | 14/24 | 101 | 702 |  |
| 79 | /rba-response | 27 | +1 | 18/27 | 69 | 704 |  |
| 80 | /settings | 25 | -8 | 14/23 | 73 | 709 |  |
| 81 | /about | 33 | +9 | 14/22 | 65 | 709 |  |
| 82 | /terms | 28 | -2 | 12/21 | 73 | 710 |  |
| 83 | /privacy | 32 | +5 |  |  | 709 |  |
| 84 | /third-party-notices | 29 | -6 | 13/23 | 61 | 713 |  |
| 85 | /node | 32 | +1 | 33/43 | 105 | 746 |  |
| 86 | /passthrough | 31 | -5 | 29/42 | 97 | 725 |  |
| 87 | /calculation-receipt | 29 | -3 | 15/24 | 65 | 710 |  |
| 88 | /rate-receipt | 25 | -1 | 5/9 | 73 | 711 |  |
| 89 | warm resume | 301 | -629 | 4/5 | 85 | 709 |  |
| 90 | cold relaunch | 10295 | -131 | 22/29 | 500 | 580 | 3 errors; start 4425ms; boot js-start 1359335, layout-mounted 1359551, hydrated 1359678, cache-read 1360900, core-ready 1361686, rows-prepared 1361826, search-index-idle 1361826, detail-filters-idle 1361826, leading-requested 1361826, last-pricing 1361826, splash-hide 1361827, manifest 1363698, leading-scoped 1364302, leading-page 1364302, resolved 1364747, pricing-ready 1365584, last-rows 1365584, rates-ready 1365771, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 21, pricing-scope-ms 1826, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 101, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 14 |
| 91 | about | 30 | 0 | 12/20 | 250 | 609 |  |
| 92 | audit screen | 25 | +3 | 154/275 | 65 | 590 |  |
| 93 | audit 0 min | 0 | 0 | 26/31 | 53 | 845 |  |
| 94 | audit 1 min | 0 | 0 | 1082/1249 | 113 | 1052 | 80 errors |
| 95 | audit 3 min | 0 | 0 | 819/917 | 117 | 1091 | 80 errors |
| 96 | audit 4 min | 0 | 0 | 390/446 | 105 | 1159 | 80 errors |
| 97 | audit 5 min | 0 | 0 | 886/1013 | 113 | 1200 | 80 errors |
| 98 | audit 7 min | 0 | 0 | 510/565 | 121 | 1179 | 80 errors |
| 99 | audit 9 min | 0 | 0 | 936/1079 | 109 | 1358 | 80 errors |
| 100 | audit 10 min | 0 | 0 | 981/1138 | 109 | 1388 | 80 errors |
| 101 | audit 12 min | 0 | 0 | 350/401 | 109 | 1271 | 80 errors |
| 102 | audit 13 min | 0 |  | 100/123 | 38 | 1284 |  |
| 103 | audit 14 min | 0 | 0 | 114/133 | 38 | 1294 |  |
| 104 | audit 16 min | 0 | 0 | 66/79 | 61 | 1298 |  |
| 105 | audit finished | 0 | 0 | 106/172 | 73 | 1302 |  |
| 106 | audit result 1 | 0 | 0 |  |  | 1291 |  |
| 107 | audit result 2 | 0 | 0 |  |  | 1294 |  |
| 108 | audit result 3 | 0 | 0 |  |  | 1292 |  |
| 109 | audit result 4 | 0 | 0 |  |  | 1295 |  |
| 110 | audit result 5 | 0 | 0 |  |  | 1292 |  |
| 111 | audit result 6 | 0 | 0 |  |  | 1292 |  |
| 112 | audit result 7 | 0 | 0 |  |  | 1295 |  |
| 113 | audit result 8 | 0 | 0 |  |  | 1293 |  |
| 114 | audit result 9 | 0 | 0 |  |  | 1295 |  |
| 115 | audit result 10 | 0 | 0 |  |  | 1294 |  |
| 116 | audit result 11 | 0 | 0 |  |  | 1296 |  |
| 117 | audit result 12 | 0 | 0 |  |  | 1297 |  |
| 118 | about for debug log | 3344 | +161 | 23/33 | 81 | 1344 |  |
| 119 | debug log screen | 0 | 0 | 116/209 | 65 | 1337 |  |
| 120 | debug log uploaded | 0 | 0 | 24/30 | 105 | 1457 |  |

## Errors

### 1 open app
```
11-27 21:46:45.948 E/australianrates(11295): Not starting debugger since process cannot load the jdwp agent.
```

### 35 search Macquarie
```
11-27 21:53:08.524 E/FrameTracker(11295): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 43 verify fixed was not applied
```
11-27 21:54:12.189 E/FrameTracker(11295): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 start save from rates
```
11-27 21:54:29.918 E/FrameTracker(11295): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 open unsaved rate
```
11-27 21:54:35.856 E/ImeBackDispatcher(11295): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 107010450
```

### 47 save a rate
```
11-27 21:54:46.303 E/FrameTracker(11295): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 49 restart with a saved rate
```
11-27 21:55:02.364 E/australianrates(16742): Not starting debugger since process cannot load the jdwp agent.
11-27 21:55:08.306 E/SurfaceSyncGroup(16742): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-27 21:55:08.311 E/SurfaceSyncGroup(16742): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 61 cold start
```
11-27 21:57:26.321 E/australianrates(18305): Not starting debugger since process cannot load the jdwp agent.
11-27 21:57:30.606 E/SurfaceSyncGroup(18305): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-27 21:57:30.606 E/SurfaceSyncGroup(18305): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 90 cold relaunch
```
11-27 22:01:22.142 E/australianrates(21467): Not starting debugger since process cannot load the jdwp agent.
11-27 22:01:26.102 E/SurfaceSyncGroup(21467): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-27 22:01:26.102 E/SurfaceSyncGroup(21467): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 94 audit 1 min
```
11-27 22:02:46.905 E/ReactNativeJS(21467): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwzj1p9w-97e1eb543685fe89","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":9772.5,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":277,"liveStage:dates-index:fetched:ms":217.3,"liveStage:revision:verified:ms":62.7,"liveStage:Core asset:downloaded:ms":245.9,"liveStage:Core asset:hash-verified:ms":6.7,"liveStage:Core asset:native-inflated-and-text-decoded:ms":183.4,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":360.2,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":616.3,"liveStage:Details asset:downloaded:ms":1449.8,"liveStage:Details asset:hash-verified:ms":34,"liveStage:…
11-27 22:02:46.907 E/unknown:ReactNative(21467): ?anon_0_@1:3707499
11-27 22:02:46.907 E/unknown:ReactNative(21467): ?anon_0_@1:3713299
11-27 22:02:46.907 E/unknown:ReactNative(21467): SyntheticError@1:163172
11-27 22:02:46.907 E/unknown:ReactNative(21467): Wrapper@1:163687
11-27 22:02:46.907 E/unknown:ReactNative(21467): _callSuper@1:148560
11-27 22:02:46.907 E/unknown:ReactNative(21467): _construct@1:164035
11-27 22:02:46.907 E/unknown:ReactNative(21467): _next@1:595023
```

### 95 audit 3 min
```
11-27 22:04:46.158 E/ReactNativeJS(21467): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwzj1p9w-97e1eb543685fe89","check":{"id":"deep-first-pass.route.rates.search.compare.mode","label":"route.rates: search.compare.mode (first-pass)","kind":"journey","status":"fail","durationMs":1017.2,"metrics":{"journeyId":"route.rates.search.compare.mode","journeyLabel":"route.rates: search.compare.mode","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.compare.mode","depth":2,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":7,"actionRevisionAfter":8,"renderRevisionBefore":"state-37","renderRevisionAfter":"state-40","actionMs":273.5,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backt…
11-27 22:04:46.159 E/unknown:ReactNative(21467): ?anon_0_@1:3707499
11-27 22:04:46.159 E/unknown:ReactNative(21467): ?anon_0_@1:3713299
11-27 22:04:46.159 E/unknown:ReactNative(21467): SyntheticError@1:163172
11-27 22:04:46.159 E/unknown:ReactNative(21467): Wrapper@1:163687
11-27 22:04:46.159 E/unknown:ReactNative(21467): _callSuper@1:148560
11-27 22:04:46.159 E/unknown:ReactNative(21467): _construct@1:164035
11-27 22:04:46.159 E/unknown:ReactNative(21467): _next@1:595023
```

### 96 audit 4 min
```
11-27 22:06:25.607 E/ReactNativeJS(21467): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwzj1p9w-97e1eb543685fe89","check":{"id":"deep-first-pass.sample.catalogue.0.product.lender.open","label":"sample.catalogue.0: product.lender.open (first-pass)","kind":"journey","status":"fail","durationMs":2292.2,"metrics":{"journeyId":"sample.catalogue.0.product.lender.open","journeyLabel":"sample.catalogue.0: product.lender.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.0","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/Horizon%20Bank","expectedPath":"/bank/Horizon%20Bank","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"actionResultEvidence":"{\"expectedPath\":\"/bank/Horizon%20Bank\"}","actionMs":817.4,"preActionWaitMs":2.4,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedAction…
11-27 22:06:25.609 E/unknown:ReactNative(21467): ?anon_0_@1:3707499
11-27 22:06:25.609 E/unknown:ReactNative(21467): ?anon_0_@1:3713299
11-27 22:06:25.609 E/unknown:ReactNative(21467): SyntheticError@1:163172
11-27 22:06:25.609 E/unknown:ReactNative(21467): Wrapper@1:163687
11-27 22:06:25.609 E/unknown:ReactNative(21467): _callSuper@1:148560
11-27 22:06:25.609 E/unknown:ReactNative(21467): _construct@1:164035
11-27 22:06:25.609 E/unknown:ReactNative(21467): _next@1:595023
```

### 97 audit 5 min
```
11-27 22:07:06.458 E/ReactNativeJS(21467): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwzj1p9w-97e1eb543685fe89","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":1517.3,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-28:5b24f9c481f0…:state-8","renderRevisionAfter":"2026-11-28:5b24f9c481f0…:state-9","actionResultEvidence":"{\"applied\":…
11-27 22:07:06.461 E/unknown:ReactNative(21467): ?anon_0_@1:3707499
11-27 22:07:06.461 E/unknown:ReactNative(21467): ?anon_0_@1:3713299
11-27 22:07:06.461 E/unknown:ReactNative(21467): SyntheticError@1:163172
11-27 22:07:06.461 E/unknown:ReactNative(21467): Wrapper@1:163687
11-27 22:07:06.461 E/unknown:ReactNative(21467): _callSuper@1:148560
11-27 22:07:06.461 E/unknown:ReactNative(21467): _construct@1:164035
11-27 22:07:06.461 E/unknown:ReactNative(21467): _next@1:595023
```

### 98 audit 7 min
```
11-27 22:08:47.691 E/ReactNativeJS(21467): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwzj1p9w-97e1eb543685fe89","check":{"id":"deep-first-pass.redirect.onboarding.redirect.onboarding.verify","label":"redirect.onboarding: redirect.onboarding.verify (first-pass)","kind":"journey","status":"fail","durationMs":1571.8,"metrics":{"journeyId":"redirect.onboarding.redirect.onboarding.verify","journeyLabel":"redirect.onboarding: redirect.onboarding.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.onboarding","semanticActionId":"redirect.onboarding.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":67.6,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":310.2,"forwardWorkMs":310.2,"navigationC…
11-27 22:08:47.692 E/unknown:ReactNative(21467): ?anon_0_@1:3707499
11-27 22:08:47.692 E/unknown:ReactNative(21467): ?anon_0_@1:3713299
11-27 22:08:47.692 E/unknown:ReactNative(21467): SyntheticError@1:163172
11-27 22:08:47.692 E/unknown:ReactNative(21467): Wrapper@1:163687
11-27 22:08:47.692 E/unknown:ReactNative(21467): _callSuper@1:148560
11-27 22:08:47.692 E/unknown:ReactNative(21467): _construct@1:164035
11-27 22:08:47.692 E/unknown:ReactNative(21467): _next@1:595023
```

### 99 audit 9 min
```
11-27 22:10:19.190 E/ReactNativeJS(21467): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwzj1p9w-97e1eb543685fe89","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.mortgage.scope.clear","label":"route.rates-mortgage-scope: search.mortgage.scope.clear (repeat)","kind":"journey","status":"fail","durationMs":9951.8,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.clear","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.clear","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.clear","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":43,"actionRevisionAfter":44,"renderRevisionBefore":"state-20","renderRevisionAfter":"state-26","actionMs":188.4,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQuietWindo…
11-27 22:10:19.191 E/unknown:ReactNative(21467): ?anon_0_@1:3707499
11-27 22:10:19.191 E/unknown:ReactNative(21467): ?anon_0_@1:3713299
11-27 22:10:19.191 E/unknown:ReactNative(21467): SyntheticError@1:163172
11-27 22:10:19.191 E/unknown:ReactNative(21467): Wrapper@1:163687
11-27 22:10:19.191 E/unknown:ReactNative(21467): _callSuper@1:148560
11-27 22:10:19.191 E/unknown:ReactNative(21467): _construct@1:164035
11-27 22:10:19.191 E/unknown:ReactNative(21467): _next@1:595023
```

### 100 audit 10 min
```
11-27 22:11:37.188 E/ReactNativeJS(21467): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwzj1p9w-97e1eb543685fe89","check":{"id":"deep-repeat.sample.catalogue.5.product.lender.open","label":"sample.catalogue.5: product.lender.open (repeat)","kind":"journey","status":"fail","durationMs":2206,"metrics":{"journeyId":"sample.catalogue.5.product.lender.open","journeyLabel":"sample.catalogue.5: product.lender.open","iteration":"warm","passId":"repeat","scenarioId":"sample.catalogue.5","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/HSBC%20Bank%20Australia%20Limited%20%E2%80%93%20Wholesale%20Banking","expectedPath":"/bank/HSBC%20Bank%20Australia%20Limited%20%E2%80%93%20Wholesale%20Banking","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":23,"actionRevisionAfter":24,"actionResultEvidence":"{\"expectedPath\":\"/bank/HSBC%20Bank%20Australia%20Limited%20%E2%80%93%20Wholesale…
11-27 22:11:37.231 E/unknown:ReactNative(21467): ?anon_0_@1:3707499
11-27 22:11:37.231 E/unknown:ReactNative(21467): ?anon_0_@1:3713299
11-27 22:11:37.231 E/unknown:ReactNative(21467): SyntheticError@1:163172
11-27 22:11:37.231 E/unknown:ReactNative(21467): Wrapper@1:163687
11-27 22:11:37.231 E/unknown:ReactNative(21467): _callSuper@1:148560
11-27 22:11:37.231 E/unknown:ReactNative(21467): _construct@1:164035
11-27 22:11:37.231 E/unknown:ReactNative(21467): _next@1:595023
```

### 101 audit 12 min
```
11-27 22:13:43.891 E/ReactNativeJS(21467): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwzj1p9w-97e1eb543685fe89","check":{"id":"deep-repeat.redirect.onboarding.redirect.onboarding.verify","label":"redirect.onboarding: redirect.onboarding.verify (repeat)","kind":"journey","status":"fail","durationMs":1325.9,"metrics":{"journeyId":"redirect.onboarding.redirect.onboarding.verify","journeyLabel":"redirect.onboarding: redirect.onboarding.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.onboarding","semanticActionId":"redirect.onboarding.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":118.3,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":547.5,"forwardWorkMs":547.5,"navigationCommitMs":37…
11-27 22:13:43.893 E/unknown:ReactNative(21467): ?anon_0_@1:3707499
11-27 22:13:43.893 E/unknown:ReactNative(21467): ?anon_0_@1:3713299
11-27 22:13:43.893 E/unknown:ReactNative(21467): SyntheticError@1:163172
11-27 22:13:43.893 E/unknown:ReactNative(21467): Wrapper@1:163687
11-27 22:13:43.893 E/unknown:ReactNative(21467): _callSuper@1:148560
11-27 22:13:43.893 E/unknown:ReactNative(21467): _construct@1:164035
11-27 22:13:43.893 E/unknown:ReactNative(21467): _next@1:595023
```
