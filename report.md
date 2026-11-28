# App explorer: 1.0.392 (448)

**Real-use session ATTENTION vs 1.0.391: 0 broken, 25 friction, 3 slower**

- Friction: No reaction for 3.4 s after "scroll rates 1"
- Friction: No reaction for 3.4 s after "scroll rates 2"
- Friction: No reaction for 4.1 s after "open product"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 5.3 s after "expand visible fees"
- Friction: No reaction for 3.2 s after "scroll product fees"
- Friction: No reaction for 3.1 s after "scroll product sources"
- Friction: No reaction for 9.2 s after "back to rates"
- Friction: No reaction for 4.8 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 5.1 s after "open term deposits"
- Friction: No reaction for 3.8 s after "verify term deposit rates"
- Friction: No reaction for 7.2 s after "search Macquarie"
- Friction: No reaction for 3.4 s after "return from savings search"
- Friction: No reaction for 3.6 s after "open mortgage filter draft"
- Friction: No reaction for 3.2 s after "verify fixed was not applied"
- Friction: No reaction for 3.9 s after "open unsaved rate"
- Friction: No reaction for 3.3 s after "open product from saved rates"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: "No saved rates" shown on "follow browse rates recovery"
- Friction: No reaction for 7.3 s after "start compare from rates"
- Slower: Dropped frames 48% to 68% on "scroll product eligibility"
- Slower: "start compare from rates" content 2.1 s to 7.3 s
- Slower: "start compare from rates" reaction 2.1 s to 7.3 s

**Initial Rates readiness:** 39.0 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-28

Mode full | 119 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 16
Baseline 1.0.391
**Audit live: outcome failed | 972 s | audit log 852553 bytes (audit-log.txt) https://paste.c-net.org/6e315287-4c2c-8138-ea6f-41f3f8267bd6 | debug log 5646358 bytes read from host https://paste.c-net.org/28ac1ba2-02b6-ea79-450d-b769fb18e44f**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2961 | +21 | 613/841 | 81 | 482 | 1 errors; start 2913ms |
| 2 | scroll rates 1 | 708 | +19 | 37/55 | 77 | 578 | boot js-start 473266, layout-mounted 474103, cache-read 474236, hydrated 474420, splash-hide 474420, manifest 475590, resolved 476249, core-fetched 481109, core-saved 482464, pricing-wait-suitability 482779, search-index-idle 482779, details-start 483211, details-fetched 493485, rows-prepared 499758, detail-filters-idle 499758, leading-requested 499758, last-pricing 499758, suitability-built 500808, post-refresh-wait 501313, leading-scoped 503182, leading-page 503182, pricing-ready 512090, last-rows 512090, rates-ready 512271, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 162, pricing-scope-ms 11412, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 101, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 14 |
| 3 | scroll rates 2 | 727 | +34 | 23/33 | 85 | 646 |  |
| 4 | scroll rates back | 682 | +3 |  |  | 532 |  |
| 5 | open product | 24 | +2 | 38/57 | 89 | 623 |  |
| 6 | scroll product | 737 | +41 | 33/55 | 85 | 652 |  |
| 7 | expand visible fees | 2283 | +21 | 10/16 | 65 | 627 |  |
| 8 | expand product facts | 20 | -2 | 76/124 | 85 | 658 |  |
| 9 | scroll product fees | 682 | -77 | 32/55 | 73 | 664 |  |
| 10 | scroll product eligibility | 739 | +51 | 19/28 | 69 | 637 |  |
| 11 | expand eligibility | 20 | 0 | 8/16 | 69 | 633 |  |
| 12 | expand constraints | 20 | -3 | 42/73 | 81 | 676 |  |
| 13 | scroll product sources | 773 | +53 | 21/34 | 89 | 651 |  |
| 14 | back to rates | 6839 | +2275 | 14/24 | 65 | 635 |  |
| 15 | open lenders | 21 | -2 | 20/24 | 200 | 645 |  |
| 16 | scroll lenders | 706 | -70 | 20/21 | 150 | 643 |  |
| 17 | back from lenders | 21 | -1 | 7/8 | 200 | 639 |  |
| 18 | switch to savings | 21 | -1 | 61/87 | 89 | 655 |  |
| 19 | switch to home loans | 24 | -2 | 20/28 | 65 | 667 |  |
| 20 | open filters | 21 | -4 | 24/27 | 125 | 672 |  |
| 21 | close filters | 21 | -2 | 9/10 | 101 | 662 |  |
| 22 | open market | 21 | 0 | 19/31 | 65 | 664 |  |
| 23 | open rba | 2469 | -54 | 47/61 | 69 | 681 |  |
| 24 | scroll rba | 711 | -12 | 32/55 | 65 | 673 |  |
| 25 | back from rba | 21 | -2 | 13/19 | 65 | 673 |  |
| 26 | scroll market | 698 | -22 | 27/41 | 81 | 672 |  |
| 27 | open saved | 20 | -6 | 9/16 | 69 | 676 |  |
| 28 | return to rates | 21 | -1 | 17/32 | 65 | 678 |  |
| 29 | start category switch | 27 | -1 |  |  | 677 |  |
| 30 | open term deposits | 21 | -1 | 67/104 | 77 | 700 |  |
| 31 | verify term deposit rates | 704 | -85 | 41/57 | 73 | 701 |  |
| 32 | restore home loans | 21 | -3 | 16/23 | 101 | 710 |  |
| 33 | start search from rates | 24 | -12 |  |  | 705 |  |
| 34 | open savings search | 21 | -2 | 20/31 | 65 | 721 |  |
| 35 | search Macquarie | 1490 | -494 | 70/81 | 133 | 719 | 1 errors |
| 36 | verify Macquarie result | 0 | 0 | 13/15 | 16 | 710 |  |
| 37 | clear query and restore results | 25 | +2 | 17/21 | 32 | 721 |  |
| 38 | return from savings search | 20 | -4 | 35/43 | 97 | 755 |  |
| 39 | start filter rollback | 35 | +9 | 14/15 | 16 | 747 |  |
| 40 | open mortgage filter draft | 20 | -2 | 25/28 | 150 | 751 |  |
| 41 | select fixed in draft | 23 | -2 | 10/14 | 101 | 750 |  |
| 42 | discard unsaved filter draft | 20 | -3 | 17/21 | 93 | 754 |  |
| 43 | verify fixed was not applied | 30 | +6 | 27/28 | 150 | 764 | 1 errors |
| 44 | close verified filter draft | 20 | -4 | 20/21 | 93 | 765 |  |
| 45 | start save from rates | 33 | 0 | 13/15 | 16 | 762 | 1 errors |
| 46 | open unsaved rate | 25 | +4 | 133/187 | 77 | 793 | 1 errors |
| 47 | save a rate | 21 | -4 | 10/16 | 61 | 799 | 1 errors |
| 48 | leave saved product | 26 | +2 | 15/24 | 65 | 802 |  |
| 49 | restart with a saved rate | 21343 | +1529 | 278/394 | 89 | 594 | 3 errors; start 6176ms; boot js-start 963876, layout-mounted 964590, hydrated 964638, cache-read 966102, core-ready 966912, rows-prepared 967094, search-index-idle 967094, detail-filters-idle 967094, leading-requested 967094, last-pricing 967094, splash-hide 967095, manifest 970919, leading-scoped 973240, leading-page 973240, resolved 973993, pricing-ready 977323, last-rows 977323, rates-ready 977498, pricing-starts 2, pricing-cand-ms 30, pricing-resolve-ms 0, pricing-yields 21, pricing-scope-ms 6132, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 102, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 15 |
| 50 | verify saved rate after restart | 21 | -13 | 24/38 | 77 | 427 |  |
| 51 | open product from saved rates | 34 | -1 | 37/61 | 77 | 530 |  |
| 52 | remove saved rate | 25 | -5 | 4/15 | 77 | 580 |  |
| 53 | leave removed product | 29 | +5 | 9/12 | 73 | 623 |  |
| 54 | follow browse rates recovery | 27 | +1 |  |  | 614 |  |
| 55 | start compare from rates | 4537 | -49 | 18/26 | 69 | 655 |  |
| 56 | enter selection mode | 28 | -2 | 8/15 | 61 | 700 |  |
| 57 | select first comparison rate | 37 | +11 |  |  | 717 |  |
| 58 | select second comparison rate | 25 | +2 | 17/28 | 57 | 710 |  |
| 59 | open two-rate comparison | 21 | -2 | 20/30 | 150 | 722 |  |
| 60 | return from two-rate comparison | 21 | -1 | 19/27 | 101 | 719 |  |
| 61 | cold start | 10052 | -319 | 31/37 | 150 | 583 | 3 errors; start 4338ms; boot js-start 1105433, layout-mounted 1105618, hydrated 1105723, cache-read 1106930, core-ready 1107741, rows-prepared 1107877, search-index-idle 1107877, detail-filters-idle 1107877, leading-requested 1107877, last-pricing 1107877, splash-hide 1107878, manifest 1109936, leading-scoped 1110386, leading-page 1110386, resolved 1110831, pricing-ready 1111652, last-rows 1111652, rates-ready 1111831, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 23, pricing-scope-ms 1617, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 100, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 14 |
| 62 | /browse | 4480 | +4447 | 2/2 | 32 | 426 |  |
| 63 | /watchlist | 39 | +12 | 4/4 | 32 | 433 |  |
| 64 | /market | 31 | -2269 | 13/21 | 53 | 512 |  |
| 65 | /tools | 32 | +5 | 15/21 | 117 | 575 |  |
| 66 | /trends | 37 | +8 |  |  | 624 |  |
| 67 | /search | 4548 | +64 | 45/59 | 101 | 636 |  |
| 68 | /banks | 26 | -7 | 32/39 | 109 | 661 |  |
| 69 | /bank-rates | 28 | 0 | 18/29 | 73 | 665 |  |
| 70 | /categories | 37 | +11 | 39/45 | 85 | 690 |  |
| 71 | /catalogue | 37 | +13 | 31/42 | 97 | 709 |  |
| 72 | /compare | 31 | -2 | 12/14 | 133 | 718 |  |
| 73 | /matches | 26 | -1 | 32/41 | 85 | 706 |  |
| 74 | /calculator | 30 | +3 | 16/23 | 85 | 696 |  |
| 75 | /projections | 29 | +5 | 22/36 | 85 | 699 |  |
| 76 | /profile | 26 | 0 | 15/24 | 97 | 698 |  |
| 77 | /research | 29 | 0 | 21/31 | 77 | 709 |  |
| 78 | /rba | 29 | +2 | 19/27 | 85 | 721 |  |
| 79 | /rba-response | 31 | +4 | 22/32 | 81 | 722 |  |
| 80 | /settings | 24 | -1 | 16/28 | 89 | 728 |  |
| 81 | /about | 31 | -2 | 11/22 | 77 | 728 |  |
| 82 | /terms | 32 | +4 | 14/23 | 77 | 729 |  |
| 83 | /privacy | 24 | -8 |  |  | 728 |  |
| 84 | /third-party-notices | 29 | 0 | 14/22 | 73 | 733 |  |
| 85 | /node | 24 | -8 | 36/47 | 93 | 767 |  |
| 86 | /passthrough | 28 | -3 | 27/41 | 97 | 733 |  |
| 87 | /calculation-receipt | 28 | -1 | 16/26 | 69 | 727 |  |
| 88 | /rate-receipt | 33 | +8 | 6/8 | 57 | 727 |  |
| 89 | warm resume | 700 | +399 | 3/4 | 65 | 726 |  |
| 90 | cold relaunch | 10163 | -132 | 28/41 | 89 | 582 | 3 errors; start 4482ms; boot js-start 1341900, layout-mounted 1342099, hydrated 1342185, cache-read 1343437, core-ready 1344226, rows-prepared 1344356, search-index-idle 1344356, detail-filters-idle 1344356, leading-requested 1344356, last-pricing 1344356, splash-hide 1344358, manifest 1346075, leading-scoped 1346735, leading-page 1346735, resolved 1347254, pricing-ready 1348087, last-rows 1348087, rates-ready 1348272, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 21, pricing-scope-ms 1916, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 101, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 17 |
| 91 | about | 33 | +3 | 14/21 | 65 | 610 |  |
| 92 | audit screen | 20 | -5 | 154/271 | 65 | 592 |  |
| 93 | audit 0 min | 0 | 0 | 28/30 | 105 | 842 |  |
| 94 | audit 2 min | 0 |  | 1178/1339 | 109 | 1088 | 80 errors |
| 95 | audit 4 min | 0 | 0 | 1111/1285 | 113 | 1158 | 80 errors |
| 96 | audit 5 min | 0 | 0 | 879/1021 | 113 | 1194 | 80 errors |
| 97 | audit 7 min | 0 | 0 | 671/761 | 117 | 1206 | 80 errors |
| 98 | audit 9 min | 0 | 0 | 743/869 | 105 | 1336 | 80 errors |
| 99 | audit 10 min | 0 | 0 | 862/1010 | 113 | 1346 | 80 errors |
| 100 | audit 11 min | 0 |  | 274/318 | 113 | 1428 | 80 errors |
| 101 | audit 13 min | 0 | 0 | 156/188 | 34 | 1268 |  |
| 102 | audit 15 min | 0 |  | 173/206 | 53 | 1277 |  |
| 103 | audit 16 min | 0 | 0 | 21/29 | 85 | 1445 |  |
| 104 | audit finished | 0 | 0 | 100/172 | 69 | 1454 |  |
| 105 | audit result 1 | 0 | 0 |  |  | 1418 |  |
| 106 | audit result 2 | 0 | 0 |  |  | 1421 |  |
| 107 | audit result 3 | 0 | 0 |  |  | 1420 |  |
| 108 | audit result 4 | 0 | 0 |  |  | 1422 |  |
| 109 | audit result 5 | 0 | 0 |  |  | 1423 |  |
| 110 | audit result 6 | 0 | 0 |  |  | 1421 |  |
| 111 | audit result 7 | 0 | 0 |  |  | 1424 |  |
| 112 | audit result 8 | 0 | 0 |  |  | 1423 |  |
| 113 | audit result 9 | 0 | 0 |  |  | 1425 |  |
| 114 | audit result 10 | 0 | 0 |  |  | 1427 |  |
| 115 | audit result 11 | 0 | 0 |  |  | 1424 |  |
| 116 | audit result 12 | 0 | 0 |  |  | 1424 |  |
| 117 | about for debug log | 3247 | -97 | 21/35 | 69 | 1296 |  |
| 118 | debug log screen | 0 | 0 | 117/203 | 69 | 1287 |  |
| 119 | debug log uploaded | 0 | 0 | 28/31 | 117 | 1325 |  |

## Errors

### 1 open app
```
11-28 02:45:41.351 E/australianrates(11248): Not starting debugger since process cannot load the jdwp agent.
```

### 35 search Macquarie
```
11-28 02:52:00.071 E/FrameTracker(11248): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 43 verify fixed was not applied
```
11-28 02:53:02.863 E/FrameTracker(11248): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 start save from rates
```
11-28 02:53:19.946 E/FrameTracker(11248): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 open unsaved rate
```
11-28 02:53:25.922 E/ImeBackDispatcher(11248): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 124123564
```

### 47 save a rate
```
11-28 02:53:36.434 E/FrameTracker(11248): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 49 restart with a saved rate
```
11-28 02:53:51.900 E/australianrates(16705): Not starting debugger since process cannot load the jdwp agent.
11-28 02:53:57.743 E/SurfaceSyncGroup(16705): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-28 02:53:57.743 E/SurfaceSyncGroup(16705): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 61 cold start
```
11-28 02:56:14.623 E/australianrates(18236): Not starting debugger since process cannot load the jdwp agent.
11-28 02:56:18.533 E/SurfaceSyncGroup(18236): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-28 02:56:18.533 E/SurfaceSyncGroup(18236): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 90 cold relaunch
```
11-28 03:00:11.071 E/australianrates(21448): Not starting debugger since process cannot load the jdwp agent.
11-28 03:00:15.023 E/SurfaceSyncGroup(21448): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-28 03:00:15.023 E/SurfaceSyncGroup(21448): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 94 audit 2 min
```
11-28 03:01:33.706 E/ReactNativeJS(21448): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwztpxwj-815e8c3f679c9737","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":9829.7,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":247.7,"liveStage:dates-index:fetched:ms":221.7,"liveStage:revision:verified:ms":66,"liveStage:Core asset:downloaded:ms":298.3,"liveStage:Core asset:hash-verified:ms":13.7,"liveStage:Core asset:native-inflated-and-text-decoded:ms":238.3,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0.1,"liveStage:Core asset:decoded:ms":424.8,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":641.7,"liveStage:Details asset:downloaded:ms":1382.8,"liveStage:Details asset:hash-verified:ms":29.8,"liv…
11-28 03:01:33.708 E/unknown:ReactNative(21448): ?anon_0_@1:3707775
11-28 03:01:33.708 E/unknown:ReactNative(21448): ?anon_0_@1:3713575
11-28 03:01:33.708 E/unknown:ReactNative(21448): SyntheticError@1:163172
11-28 03:01:33.708 E/unknown:ReactNative(21448): Wrapper@1:163687
11-28 03:01:33.708 E/unknown:ReactNative(21448): _callSuper@1:148560
11-28 03:01:33.708 E/unknown:ReactNative(21448): _construct@1:164035
11-28 03:01:33.708 E/unknown:ReactNative(21448): _next@1:595023
```

### 95 audit 4 min
```
11-28 03:03:38.691 E/ReactNativeJS(21448): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwztpxwj-815e8c3f679c9737","check":{"id":"deep-first-pass.route.rates.search.compare.select.1","label":"route.rates: search.compare.select.1 (first-pass)","kind":"journey","status":"fail","durationMs":1198.6,"metrics":{"journeyId":"route.rates.search.compare.select.1","journeyLabel":"route.rates: search.compare.select.1","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.compare.select.1","depth":2,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":11,"actionRevisionAfter":12,"renderRevisionBefore":"state-48","renderRevisionAfter":"state-51","actionMs":467.4,"preActionWaitMs":27.2,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"valid…
11-28 03:03:38.693 E/unknown:ReactNative(21448): ?anon_0_@1:3707775
11-28 03:03:38.693 E/unknown:ReactNative(21448): ?anon_0_@1:3713575
11-28 03:03:38.693 E/unknown:ReactNative(21448): SyntheticError@1:163172
11-28 03:03:38.693 E/unknown:ReactNative(21448): Wrapper@1:163687
11-28 03:03:38.693 E/unknown:ReactNative(21448): _callSuper@1:148560
11-28 03:03:38.693 E/unknown:ReactNative(21448): _construct@1:164035
11-28 03:03:38.693 E/unknown:ReactNative(21448): _next@1:595023
```

### 96 audit 5 min
```
11-28 03:05:49.923 E/ReactNativeJS(21448): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwztpxwj-815e8c3f679c9737","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":1517.3,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-28:5b24f9c481f0…:state-8","renderRevisionAfter":"2026-11-28:5b24f9c481f0…:state-9","actionResultEvidence":"{\"applied\":…
11-28 03:05:54.633 E/unknown:ReactNative(21448): ?anon_0_@1:3707775
11-28 03:05:54.633 E/unknown:ReactNative(21448): ?anon_0_@1:3713575
11-28 03:05:54.633 E/unknown:ReactNative(21448): SyntheticError@1:163172
11-28 03:05:54.633 E/unknown:ReactNative(21448): Wrapper@1:163687
11-28 03:05:54.633 E/unknown:ReactNative(21448): _callSuper@1:148560
11-28 03:05:54.633 E/unknown:ReactNative(21448): _construct@1:164035
11-28 03:05:54.633 E/unknown:ReactNative(21448): _next@1:595023
```

### 97 audit 7 min
```
11-28 03:07:35.473 E/ReactNativeJS(21448): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwztpxwj-815e8c3f679c9737","check":{"id":"deep-first-pass.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (first-pass)","kind":"journey","status":"fail","durationMs":2748.9,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":112.9,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1952.6,"forwardWorkMs":1952.6,"navigationCommitMs":1952.3,"firstReadyFrameMs…
11-28 03:07:35.475 E/unknown:ReactNative(21448): ?anon_0_@1:3707775
11-28 03:07:35.475 E/unknown:ReactNative(21448): ?anon_0_@1:3713575
11-28 03:07:35.475 E/unknown:ReactNative(21448): SyntheticError@1:163172
11-28 03:07:35.475 E/unknown:ReactNative(21448): Wrapper@1:163687
11-28 03:07:35.475 E/unknown:ReactNative(21448): _callSuper@1:148560
11-28 03:07:35.475 E/unknown:ReactNative(21448): _construct@1:164035
11-28 03:07:35.475 E/unknown:ReactNative(21448): _next@1:595023
```

### 98 audit 9 min
```
11-28 03:09:16.383 E/ReactNativeJS(21448): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwztpxwj-815e8c3f679c9737","check":{"id":"deep-repeat.route.compare.compare.dismiss","label":"route.compare: compare.dismiss (repeat)","kind":"journey","status":"fail","durationMs":2017.9,"metrics":{"journeyId":"route.compare.compare.dismiss","journeyLabel":"route.compare: compare.dismiss","iteration":"warm","passId":"repeat","scenarioId":"route.compare","semanticActionId":"compare.dismiss","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"compare.table","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":4,"actionRevisionAfter":5,"renderRevisionBefore":"2026-11-28:1#Newcastle Permanent|TD_termdeposit|TERM_DEPOSITS|Term Deposit|5#BankSA|BSATDBusTermDeposit|TERM_DEPOSITS|Business Term Deposit","actionMs":1023.2,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJust…
11-28 03:09:16.389 E/unknown:ReactNative(21448): ?anon_0_@1:3707775
11-28 03:09:16.389 E/unknown:ReactNative(21448): ?anon_0_@1:3713575
11-28 03:09:16.389 E/unknown:ReactNative(21448): SyntheticError@1:163172
11-28 03:09:16.389 E/unknown:ReactNative(21448): Wrapper@1:163687
11-28 03:09:16.389 E/unknown:ReactNative(21448): _callSuper@1:148560
11-28 03:09:16.389 E/unknown:ReactNative(21448): _construct@1:164035
11-28 03:09:16.389 E/unknown:ReactNative(21448): _next@1:595023
```

### 99 audit 10 min
```
11-28 03:10:43.928 E/ReactNativeJS(21448): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwztpxwj-815e8c3f679c9737","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1612.1,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Newcastle%20Permanent%7CTD_termdeposit%7CTERM_DEPOSITS%7CTerm%20Deposit","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"renderRevisionBefore":"2026-…
11-28 03:10:43.929 E/unknown:ReactNative(21448): ?anon_0_@1:3707775
11-28 03:10:43.929 E/unknown:ReactNative(21448): ?anon_0_@1:3713575
11-28 03:10:43.929 E/unknown:ReactNative(21448): SyntheticError@1:163172
11-28 03:10:43.929 E/unknown:ReactNative(21448): Wrapper@1:163687
11-28 03:10:43.929 E/unknown:ReactNative(21448): _callSuper@1:148560
11-28 03:10:43.929 E/unknown:ReactNative(21448): _construct@1:164035
11-28 03:10:43.929 E/unknown:ReactNative(21448): _next@1:595023
```

### 100 audit 11 min
```
11-28 03:12:16.023 E/ReactNativeJS(21448): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwztpxwj-815e8c3f679c9737","check":{"id":"deep-repeat.redirect.onboarding.redirect.onboarding.verify","label":"redirect.onboarding: redirect.onboarding.verify (repeat)","kind":"journey","status":"fail","durationMs":1915.9,"metrics":{"journeyId":"redirect.onboarding.redirect.onboarding.verify","journeyLabel":"redirect.onboarding: redirect.onboarding.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.onboarding","semanticActionId":"redirect.onboarding.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":306.7,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":639.9,"forwardWorkMs":639.9,"navigationCommitMs":36…
11-28 03:12:16.024 E/unknown:ReactNative(21448): ?anon_0_@1:3707775
11-28 03:12:16.024 E/unknown:ReactNative(21448): ?anon_0_@1:3713575
11-28 03:12:16.024 E/unknown:ReactNative(21448): SyntheticError@1:163172
11-28 03:12:16.024 E/unknown:ReactNative(21448): Wrapper@1:163687
11-28 03:12:16.024 E/unknown:ReactNative(21448): _callSuper@1:148560
11-28 03:12:16.024 E/unknown:ReactNative(21448): _construct@1:164035
11-28 03:12:16.024 E/unknown:ReactNative(21448): _next@1:595023
```
