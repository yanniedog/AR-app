# App explorer: 1.0.396 (452)

**Real-use session FAIL vs 1.0.395: 1 broken, 24 friction, 28 slower**

- Broken: "follow browse rates recovery" failed: UI assertion failed: app hierarchy unavailable
- Friction: No reaction for 3.2 s after "scroll rates 1"
- Friction: No reaction for 3.3 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 7.3 s after "expand visible fees"
- Friction: No reaction for 3.1 s after "scroll product eligibility"
- Friction: No reaction for 3.0 s after "scroll product sources"
- Friction: No reaction for 4.7 s after "switch to savings"
- Friction: No reaction for 3.0 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 5.4 s after "open term deposits"
- Friction: No reaction for 3.5 s after "verify term deposit rates"
- Friction: No reaction for 3.0 s after "open savings search"
- Friction: No reaction for 8.6 s after "search Macquarie"
- Friction: No reaction for 3.1 s after "return from savings search"
- Friction: No reaction for 3.1 s after "open mortgage filter draft"
- Friction: No reaction for 3.0 s after "verify fixed was not applied"
- Friction: No reaction for 4.4 s after "open unsaved rate"
- Friction: No reaction for 3.3 s after "verify saved rate after restart"
- Friction: No reaction for 3.3 s after "open product from saved rates"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: "No saved rates" shown on "follow browse rates recovery"
- Slower: Dropped frames 52% to 75% on "open app"
- Slower: Dropped frames 45% to 70% on "scroll rates 1"
- Slower: Dropped frames 41% to 74% on "scroll rates 2"
- Slower: Dropped frames 49% to 67% on "open product"
- Slower: Dropped frames 43% to 62% on "scroll product"
- Slower: "expand visible fees" content 2.3 s to 7.3 s
- Slower: "expand visible fees" reaction 2.3 s to 7.3 s
- Slower: Dropped frames 44% to 62% on "expand product facts"
- Slower: "expand product facts" content 0.0 s to 2.3 s
- Slower: "scroll product fees" content 0.7 s to 3.0 s
- Slower: "scroll product eligibility" content 0.7 s to 3.1 s
- Slower: Dropped frames 50% to 70% on "expand eligibility"
- Slower: Dropped frames 49% to 69% on "scroll product sources"
- Slower: Dropped frames 42% to 68% on "back to rates"
- Slower: Dropped frames 64% to 92% on "open lenders"
- Slower: Dropped frames 55% to 77% on "switch to savings"
- Slower: Dropped frames 44% to 61% on "switch to home loans"
- Slower: Dropped frames 57% to 87% on "open rba"
- Slower: Dropped frames 45% to 66% on "scroll market"
- Slower: Dropped frames 48% to 67% on "open saved"
- Slower: Dropped frames 46% to 70% on "open term deposits"
- Slower: Dropped frames 43% to 70% on "verify term deposit rates"
- Slower: Dropped frames 38% to 57% on "restore home loans"
- Slower: Dropped frames 52% to 74% on "open unsaved rate"
- Slower: Dropped frames 50% to 72% on "restart with a saved rate"
- Slower: Dropped frames 46% to 67% on "verify saved rate after restart"
- Slower: "remove saved rate" content 0.0 s to 2.5 s
- Slower: "start compare from rates" content 0.0 s to 2.3 s

**Initial Rates readiness:** 36.9 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 9 passed, 1 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-28

Mode full | 122 steps | crashes 0 | step failures 1 | settle timeouts 0 | steps with JS/native errors 20
Baseline 1.0.395
**Audit live: outcome failed | 1071 s | audit log 858829 bytes (audit-log.txt) https://paste.c-net.org/d8d176df-8e8f-c8f1-b88d-76b6e19b5bfb | debug log 5715672 bytes read from host https://paste.c-net.org/b95f1835-0f6b-63c3-7bf3-72536279ac55**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3103 | -22437 | 568/755 | 85 | 469 | 1 errors; start 3036ms |
| 2 | scroll rates 1 | 739 | +25 | 23/33 | 69 | 566 | boot js-start 495088, layout-mounted 495822, cache-read 495954, hydrated 496189, splash-hide 496189, manifest 497440, resolved 497850, core-fetched 502914, core-saved 503807, pricing-wait-suitability 504189, search-index-idle 504189, details-start 504578, details-fetched 513595, rows-prepared 518331, detail-filters-idle 518331, leading-requested 518331, last-pricing 518331, suitability-built 519686, post-refresh-wait 520245, leading-scoped 522750, leading-page 522750, pricing-ready 531785, last-rows 531785, rates-ready 532009, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 167, pricing-scope-ms 12324, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 134, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 24 |
| 3 | scroll rates 2 | 719 | +12 | 37/50 | 85 | 652 |  |
| 4 | scroll rates back | 681 | +11 |  |  | 531 |  |
| 5 | open product | 25 | -6452 | 38/57 | 81 | 608 |  |
| 6 | scroll product | 711 | -5 | 33/53 | 85 | 690 |  |
| 7 | expand visible fees | 4523 | +4505 | 10/15 | 61 | 648 |  |
| 8 | expand product facts | 22 | +21 | 107/172 | 85 | 643 |  |
| 9 | scroll product fees | 695 | -15 | 15/29 | 77 | 650 |  |
| 10 | scroll product eligibility | 720 | +1 | 24/45 | 81 | 665 |  |
| 11 | expand eligibility | 0 | 0 | 202/290 | 85 | 642 |  |
| 12 | expand constraints | 23 | +8 | 8/14 | 53 | 651 |  |
| 13 | scroll product sources | 698 | +1 | 22/32 | 81 | 649 |  |
| 14 | back to rates | 30 | +10 | 15/22 | 77 | 644 |  |
| 15 | open lenders | 26 | +9 | 24/26 | 250 | 650 |  |
| 16 | scroll lenders | 760 | -13 | 20/21 | 150 | 649 |  |
| 17 | back from lenders | 23 | +7 | 7/9 | 121 | 647 |  |
| 18 | switch to savings | 22 | +4 | 64/83 | 81 | 660 |  |
| 19 | switch to home loans | 25 | +9 | 17/28 | 69 | 676 |  |
| 20 | open filters | 32 | +9 | 22/26 | 150 | 676 |  |
| 21 | close filters | 25 | +8 | 7/10 | 200 | 667 |  |
| 22 | open market | 22 | +5 | 17/31 | 73 | 670 |  |
| 23 | open rba | 2737 | +2718 | 97/112 | 65 | 689 |  |
| 24 | scroll rba | 700 | +12 | 32/53 | 77 | 680 |  |
| 25 | back from rba | 24 | +3 | 10/20 | 65 | 681 |  |
| 26 | scroll market | 711 | +14 | 27/41 | 81 | 680 |  |
| 27 | open saved | 21 | +4 | 16/24 | 73 | 684 |  |
| 28 | return to rates | 21 | +3 | 17/33 | 57 | 685 |  |
| 29 | start category switch | 33 | 0 |  |  | 685 |  |
| 30 | open term deposits | 22 | +2 | 70/100 | 81 | 707 |  |
| 31 | verify term deposit rates | 708 | +22 | 38/54 | 81 | 707 |  |
| 32 | restore home loans | 24 | +5 | 16/28 | 65 | 716 |  |
| 33 | start search from rates | 31 | +9 |  |  | 712 |  |
| 34 | open savings search | 23 | +4 | 17/31 | 81 | 730 |  |
| 35 | search Macquarie | 2475 | +510 | 95/105 | 150 | 728 | 1 errors |
| 36 | verify Macquarie result | 0 | 0 | 14/15 | 16 | 720 |  |
| 37 | clear query and restore results | 28 | +2 | 23/25 | 42 | 732 |  |
| 38 | return from savings search | 24 | 0 | 34/41 | 93 | 754 |  |
| 39 | start filter rollback | 30 | +5 | 16/16 | 32 | 746 |  |
| 40 | open mortgage filter draft | 22 | +2 | 26/30 | 150 | 741 |  |
| 41 | select fixed in draft | 23 | +1 | 13/16 | 121 | 739 |  |
| 42 | discard unsaved filter draft | 22 | +3 | 17/22 | 81 | 741 |  |
| 43 | verify fixed was not applied | 22 | +2 | 24/30 | 150 | 745 | 1 errors |
| 44 | close verified filter draft | 22 | -1 | 18/22 | 93 | 743 |  |
| 45 | start save from rates | 28 | +2 | 13/16 | 16 | 742 | 1 errors |
| 46 | open unsaved rate | 45 | +9 | 110/149 | 81 | 785 | 1 errors |
| 47 | save a rate | 23 | -10 | 10/16 | 65 | 769 | 1 errors |
| 48 | leave saved product | 27 | +1 | 13/22 | 81 | 772 |  |
| 49 | restart with a saved rate | 17700 | +5645 | 220/305 | 89 | 587 | 3 errors; start 6269ms; boot js-start 1017942, layout-mounted 1018685, hydrated 1018927, cache-read 1020233, core-ready 1021025, rows-prepared 1021189, search-index-idle 1021189, detail-filters-idle 1021189, leading-requested 1021189, last-pricing 1021189, splash-hide 1021190, manifest 1023496, leading-scoped 1025457, leading-page 1025457, resolved 1026096, pricing-ready 1028616, last-rows 1028616, rates-ready 1028789, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 24, pricing-scope-ms 4521, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 99, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 14 |
| 50 | verify saved rate after restart | 65 | +41 | 24/36 | 89 | 412 |  |
| 51 | open product from saved rates | 23 | -3 | 36/59 | 97 | 499 |  |
| 52 | remove saved rate | 24 | -1 | 11/19 | 65 | 553 |  |
| 53 | leave removed product | 29 | +5 | 7/9 | 117 | 656 |  |
| 54 | follow browse rates recovery | 23 | -6782 |  |  | 602 | UI assertion failed: app hierarchy unavailable |
| 55 | start compare from rates | 34 | +5 | 18/28 | 85 | 610 |  |
| 56 | enter selection mode | 32 | +13 | 12/16 | 65 | 640 |  |
| 57 | select first comparison rate | 23 | +1 | 10/15 | 69 | 693 |  |
| 58 | select second comparison rate | 31 | +13 |  |  | 696 |  |
| 59 | open two-rate comparison | 23 | +4 | 28/45 | 125 | 706 |  |
| 60 | return from two-rate comparison | 22 | -6 | 19/25 | 101 | 702 |  |
| 61 | cold start | 10105 | +1499 | 24/32 | 117 | 583 | 1 errors; start 4199ms; boot js-start 1153925, layout-mounted 1154123, hydrated 1154241, cache-read 1155415, core-ready 1156195, rows-prepared 1156312, search-index-idle 1156312, detail-filters-idle 1156312, leading-requested 1156312, last-pricing 1156312, splash-hide 1156313, manifest 1158603, leading-scoped 1159038, leading-page 1159038, resolved 1159387, pricing-ready 1160155, last-rows 1160155, rates-ready 1160334, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 19, pricing-scope-ms 1439, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 100, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 15 |
| 62 | /browse | 4476 | +4448 | 1/2 | 32 | 434 |  |
| 63 | /watchlist | 31 | +1 | 2/3 | 32 | 441 |  |
| 64 | /market | 24 | +1 | 10/21 | 48 | 524 |  |
| 65 | /tools | 28 | +2 | 15/20 | 97 | 583 |  |
| 66 | /trends | 31 | +1 |  |  | 614 |  |
| 67 | /search | 4476 | +4451 | 39/50 | 133 | 626 |  |
| 68 | /banks | 33 | +9 | 30/37 | 121 | 645 |  |
| 69 | /bank-rates | 34 | +9 | 15/26 | 69 | 658 |  |
| 70 | /categories | 26 | +2 | 30/41 | 97 | 686 |  |
| 71 | /catalogue | 26 | -26 | 31/39 | 129 | 690 |  |
| 72 | /compare | 26 | -5 | 11/15 | 117 | 677 |  |
| 73 | /matches | 23 | -3 | 33/49 | 97 | 698 |  |
| 74 | /calculator | 27 | -6 | 16/22 | 85 | 689 |  |
| 75 | /projections | 25 | 0 | 27/37 | 85 | 688 |  |
| 76 | /profile | 30 | 0 | 17/27 | 73 | 687 |  |
| 77 | /research | 24 | -6 | 21/31 | 81 | 697 |  |
| 78 | /rba | 30 | +2 | 15/22 | 97 | 710 |  |
| 79 | /rba-response | 23 | +1 | 20/33 | 65 | 711 |  |
| 80 | /settings | 28 | +6 | 17/27 | 81 | 717 |  |
| 81 | /about | 27 | +4 | 15/22 | 77 | 716 |  |
| 82 | /terms | 25 | -1 | 13/23 | 77 | 717 |  |
| 83 | /privacy | 32 | +7 |  |  | 716 |  |
| 84 | /third-party-notices | 25 | -1 | 15/22 | 85 | 721 |  |
| 85 | /node | 33 | +6 | 35/43 | 85 | 762 |  |
| 86 | /passthrough | 38 | +3 | 32/45 | 97 | 732 |  |
| 87 | /calculation-receipt | 28 | +7 | 11/25 | 69 | 726 |  |
| 88 | /rate-receipt | 28 | +5 | 6/10 | 65 | 727 |  |
| 89 | warm resume | 658 | +17 | 5/5 | 150 | 726 | start 287ms |
| 90 | cold relaunch | 9998 | +1884 | 25/30 | 400 | 582 | 3 errors; start 4388ms; boot js-start 1391551, layout-mounted 1391754, hydrated 1391871, cache-read 1393072, core-ready 1393845, rows-prepared 1393979, search-index-idle 1393979, detail-filters-idle 1393979, leading-requested 1393979, last-pricing 1393979, splash-hide 1393981, manifest 1395809, leading-scoped 1396267, leading-page 1396267, resolved 1396700, pricing-ready 1397565, last-rows 1397565, rates-ready 1397740, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 19, pricing-scope-ms 1776, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 97, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 14 |
| 91 | about | 38 | +14 | 13/19 | 200 | 609 |  |
| 92 | audit screen | 24 | +6 | 156/272 | 65 | 589 |  |
| 93 | audit 0 min | 0 | 0 | 5/6 | 200 | 617 |  |
| 94 | audit 1 min | 0 |  | 952/1100 | 109 | 1075 | 80 errors |
| 95 | audit 2 min | 0 | 0 | 412/456 | 105 | 1097 | 80 errors |
| 96 | audit 4 min | 0 | 0 | 755/861 | 109 | 1076 | 80 errors |
| 97 | audit 5 min | 0 | 0 | 316/361 | 101 | 1254 | 80 errors |
| 98 | audit 6 min | 0 | 0 | 704/813 | 101 | 1254 | 80 errors |
| 99 | audit 7 min | 0 |  | 470/528 | 121 | 1128 | 80 errors |
| 100 | audit 8 min | 0 | 0 | 264/285 | 105 | 1166 | 80 errors |
| 101 | audit 9 min | 0 | 0 | 636/719 | 113 | 1284 | 80 errors |
| 102 | audit 11 min | 0 | 0 | 1041/1213 | 105 | 1315 | 80 errors |
| 103 | audit 12 min | 0 | 0 | 413/467 | 117 | 1351 | 80 errors |
| 104 | audit 14 min | 0 | 0 | 156/180 | 38 | 1382 | 19 errors |
| 105 | audit 16 min | 0 |  | 151/178 | 36 | 1257 |  |
| 106 | audit 17 min | 0 |  | 55/66 | 69 | 1257 |  |
| 107 | audit finished | 0 | 0 | 112/191 | 69 | 1414 |  |
| 108 | audit result 1 | 0 | 0 |  |  | 1404 |  |
| 109 | audit result 2 | 0 | 0 |  |  | 1408 |  |
| 110 | audit result 3 | 0 | 0 |  |  | 1407 |  |
| 111 | audit result 4 | 0 | 0 |  |  | 1408 |  |
| 112 | audit result 5 | 0 | 0 |  |  | 1410 |  |
| 113 | audit result 6 | 0 | 0 |  |  | 1408 |  |
| 114 | audit result 7 | 0 | 0 |  |  | 1411 |  |
| 115 | audit result 8 | 0 | 0 |  |  | 1410 |  |
| 116 | audit result 9 | 0 | 0 |  |  | 1411 |  |
| 117 | audit result 10 | 0 | 0 |  |  | 1412 |  |
| 118 | audit result 11 | 0 | 0 |  |  | 1410 |  |
| 119 | audit result 12 | 0 | 0 |  |  | 1413 |  |
| 120 | about for debug log | 3212 | +31 | 22/30 | 89 | 1284 |  |
| 121 | debug log screen | 1 | +1 | 117/209 | 69 | 1268 |  |
| 122 | debug log uploaded | 0 | 0 | 29/32 | 150 | 1361 |  |

## Errors

### 1 open app
```
11-28 13:46:14.191 E/australianrates(11649): Not starting debugger since process cannot load the jdwp agent.
```

### 35 search Macquarie
```
11-28 13:53:03.312 E/FrameTracker(11649): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 43 verify fixed was not applied
```
11-28 13:54:07.184 E/FrameTracker(11649): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 start save from rates
```
11-28 13:54:24.182 E/FrameTracker(11649): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 open unsaved rate
```
11-28 13:54:30.046 E/ImeBackDispatcher(11649): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 66101466
```

### 47 save a rate
```
11-28 13:54:40.593 E/FrameTracker(11649): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 49 restart with a saved rate
```
11-28 13:54:56.653 E/australianrates(17387): Not starting debugger since process cannot load the jdwp agent.
11-28 13:55:02.770 E/SurfaceSyncGroup(17387): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-28 13:55:02.770 E/SurfaceSyncGroup(17387): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 61 cold start
```
11-28 13:57:13.897 E/australianrates(19055): Not starting debugger since process cannot load the jdwp agent.
```

### 90 cold relaunch
```
11-28 14:01:11.490 E/australianrates(22220): Not starting debugger since process cannot load the jdwp agent.
11-28 14:01:15.570 E/SurfaceSyncGroup(22220): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-28 14:01:15.570 E/SurfaceSyncGroup(22220): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 94 audit 1 min
```
11-28 14:02:42.872 E/ReactNativeJS(22220): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0hc0ox-d937e3d527f91699","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":9210.1,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":175.8,"liveStage:dates-index:fetched:ms":154,"liveStage:revision:verified:ms":56.6,"liveStage:Core asset:downloaded:ms":201.9,"liveStage:Core asset:hash-verified:ms":7,"liveStage:Core asset:native-inflated-and-text-decoded:ms":173.2,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":228.2,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":605.4,"liveStage:Details asset:downloaded:ms":1440.1,"liveStage:Details asset:hash-verified:ms":30.3,"liveStage:…
11-28 14:02:42.873 E/unknown:ReactNative(22220): ?anon_0_@1:3710195
11-28 14:02:42.873 E/unknown:ReactNative(22220): ?anon_0_@1:3715995
11-28 14:02:42.873 E/unknown:ReactNative(22220): SyntheticError@1:163204
11-28 14:02:42.873 E/unknown:ReactNative(22220): Wrapper@1:163719
11-28 14:02:42.873 E/unknown:ReactNative(22220): _callSuper@1:148592
11-28 14:02:42.873 E/unknown:ReactNative(22220): _construct@1:164067
11-28 14:02:42.873 E/unknown:ReactNative(22220): _next@1:595055
```

### 95 audit 2 min
```
11-28 14:04:17.460 E/ReactNativeJS(22220): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0hc0ox-d937e3d527f91699","check":{"id":"journey-product-warm","label":"Product details (warm)","kind":"journey","status":"fail","durationMs":1648.9,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":682.2,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"product","journeyLabel":"Product details","iteration":"warm","expectedPath":"/product/Queensland%20Country%20Bank%7C30%7CRESIDENTIAL_MORTGAGES%7CHome%20Loan-Fixed","expectedSurface":"product.details","navigationKind":"stack","forwardMs":682.2,"firstReadyFrameObserved":true,"firstReadyFrameMs":478.21257800003514,"backgroundSettleMs":487,"destinationReadinessMs":478.2,"backgroundTasks":"Bank response analysis","backMs":33.2,"firstBackMs":33.2,"firstBackDes…
11-28 14:04:17.477 E/unknown:ReactNative(22220): ?anon_0_@1:3710195
11-28 14:04:17.477 E/unknown:ReactNative(22220): ?anon_0_@1:3715995
11-28 14:04:17.477 E/unknown:ReactNative(22220): SyntheticError@1:163204
11-28 14:04:17.477 E/unknown:ReactNative(22220): Wrapper@1:163719
11-28 14:04:17.477 E/unknown:ReactNative(22220): _callSuper@1:148592
11-28 14:04:17.477 E/unknown:ReactNative(22220): _construct@1:164067
11-28 14:04:17.477 E/unknown:ReactNative(22220): _next@1:595055
```

### 96 audit 4 min
```
11-28 14:05:25.073 E/ReactNativeJS(22220): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0hc0ox-d937e3d527f91699","check":{"id":"deep-first-pass.route.rates-sheets.search.section.next","label":"route.rates-sheets: search.section.next (first-pass)","kind":"journey","status":"fail","durationMs":1563.2,"metrics":{"journeyId":"route.rates-sheets.search.section.next","journeyLabel":"route.rates-sheets: search.section.next","iteration":"cold","passId":"first-pass","scenarioId":"route.rates-sheets","semanticActionId":"search.section.next","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":19,"actionRevisionAfter":20,"renderRevisionBefore":"state-23","renderRevisionAfter":"state-29","actionMs":99,"preActionWaitMs":1.2,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retrie…
11-28 14:05:25.074 E/unknown:ReactNative(22220): ?anon_0_@1:3710195
11-28 14:05:25.074 E/unknown:ReactNative(22220): ?anon_0_@1:3715995
11-28 14:05:25.074 E/unknown:ReactNative(22220): SyntheticError@1:163204
11-28 14:05:25.074 E/unknown:ReactNative(22220): Wrapper@1:163719
11-28 14:05:25.074 E/unknown:ReactNative(22220): _callSuper@1:148592
11-28 14:05:25.074 E/unknown:ReactNative(22220): _construct@1:164067
11-28 14:05:25.074 E/unknown:ReactNative(22220): _next@1:595055
```

### 97 audit 5 min
```
11-28 14:06:48.603 E/ReactNativeJS(22220): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0hc0ox-d937e3d527f91699","check":{"id":"deep-first-pass.sample.catalogue.2.product.open","label":"sample.catalogue.2: product.open (first-pass)","kind":"journey","status":"fail","durationMs":2430,"metrics":{"journeyId":"sample.catalogue.2.product.open","journeyLabel":"sample.catalogue.2: product.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.2","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Alex.Bank%7C086e30f2-dbbb-4252-a3a6-73848456b2cb%7CTRANS_AND_SAVINGS_ACCOUNTS%7CSavings","expectedPath":"/product/Alex.Bank%7C086e30f2-dbbb-4252-a3a6-73848456b2cb%7CTRANS_AND_SAVINGS_ACCOUNTS%7CSavings","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":771.5,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeate…
11-28 14:06:48.605 E/unknown:ReactNative(22220): ?anon_0_@1:3710195
11-28 14:06:48.605 E/unknown:ReactNative(22220): ?anon_0_@1:3715995
11-28 14:06:48.605 E/unknown:ReactNative(22220): SyntheticError@1:163204
11-28 14:06:48.605 E/unknown:ReactNative(22220): Wrapper@1:163719
11-28 14:06:48.605 E/unknown:ReactNative(22220): _callSuper@1:148592
11-28 14:06:48.605 E/unknown:ReactNative(22220): _construct@1:164067
11-28 14:06:48.605 E/unknown:ReactNative(22220): _next@1:595055
```

### 98 audit 6 min
```
11-28 14:07:29.660 E/ReactNativeJS(22220): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0hc0ox-d937e3d527f91699","check":{"id":"deep-first-pass.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (first-pass)","kind":"journey","status":"fail","durationMs":1465.8,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Queensland%20Country%20Bank%7C30%7CRESIDENTIAL_MORTGAGES%7CHome%20Loan-Fixed","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":7,"actionRevisionAfter":8,"renderRevisio…
11-28 14:07:29.662 E/unknown:ReactNative(22220): ?anon_0_@1:3710195
11-28 14:07:29.662 E/unknown:ReactNative(22220): ?anon_0_@1:3715995
11-28 14:07:29.662 E/unknown:ReactNative(22220): SyntheticError@1:163204
11-28 14:07:29.662 E/unknown:ReactNative(22220): Wrapper@1:163719
11-28 14:07:29.662 E/unknown:ReactNative(22220): _callSuper@1:148592
11-28 14:07:29.662 E/unknown:ReactNative(22220): _construct@1:164067
11-28 14:07:29.662 E/unknown:ReactNative(22220): _next@1:595055
```

### 99 audit 7 min
```
11-28 14:09:09.376 E/ReactNativeJS(22220): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0hc0ox-d937e3d527f91699","check":{"id":"deep-first-pass.redirect.search.redirect.search.verify","label":"redirect.search: redirect.search.verify (first-pass)","kind":"journey","status":"fail","durationMs":2913.1,"metrics":{"journeyId":"redirect.search.redirect.search.verify","journeyLabel":"redirect.search: redirect.search.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.search","semanticActionId":"redirect.search.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":57.9,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":2169,"forwardWorkMs":2169,"navigationCommitMs":1906.8,"firstReadyFrameMs":262.2,…
11-28 14:09:09.378 E/unknown:ReactNative(22220): ?anon_0_@1:3710195
11-28 14:09:09.378 E/unknown:ReactNative(22220): ?anon_0_@1:3715995
11-28 14:09:09.378 E/unknown:ReactNative(22220): SyntheticError@1:163204
11-28 14:09:09.378 E/unknown:ReactNative(22220): Wrapper@1:163719
11-28 14:09:09.378 E/unknown:ReactNative(22220): _callSuper@1:148592
11-28 14:09:09.378 E/unknown:ReactNative(22220): _construct@1:164067
11-28 14:09:09.378 E/unknown:ReactNative(22220): _next@1:595055
```

### 100 audit 8 min
```
11-28 14:09:54.144 E/ReactNativeJS(22220): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0hc0ox-d937e3d527f91699","check":{"id":"deep-repeat.route.rates.search.filters.open","label":"route.rates: search.filters.open (repeat)","kind":"journey","status":"fail","durationMs":5788.3,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":26,"actionRevisionAfter":27,"renderRevisionBefore":"state-24","renderRevisionAfter":"state-27","actionMs":0.2,"preActionWaitMs":0.7,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"re…
11-28 14:09:54.145 E/unknown:ReactNative(22220): ?anon_0_@1:3710195
11-28 14:09:54.145 E/unknown:ReactNative(22220): ?anon_0_@1:3715995
11-28 14:09:54.145 E/unknown:ReactNative(22220): SyntheticError@1:163204
11-28 14:09:54.145 E/unknown:ReactNative(22220): Wrapper@1:163719
11-28 14:09:54.145 E/unknown:ReactNative(22220): _callSuper@1:148592
11-28 14:09:54.145 E/unknown:ReactNative(22220): _construct@1:164067
11-28 14:09:54.145 E/unknown:ReactNative(22220): _next@1:595055
```

### 101 audit 9 min
```
11-28 14:10:58.420 E/ReactNativeJS(22220): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0hc0ox-d937e3d527f91699","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.mortgage.scope.clear","label":"route.rates-mortgage-scope: search.mortgage.scope.clear (repeat)","kind":"journey","status":"fail","durationMs":9236.2,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.clear","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.clear","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.clear","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":45,"actionRevisionAfter":46,"renderRevisionBefore":"state-21","renderRevisionAfter":"state-27","actionMs":157.8,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQuietWindo…
11-28 14:10:58.421 E/unknown:ReactNative(22220): ?anon_0_@1:3710195
11-28 14:10:58.421 E/unknown:ReactNative(22220): ?anon_0_@1:3715995
11-28 14:10:58.421 E/unknown:ReactNative(22220): SyntheticError@1:163204
11-28 14:10:58.421 E/unknown:ReactNative(22220): Wrapper@1:163719
11-28 14:10:58.421 E/unknown:ReactNative(22220): _callSuper@1:148592
11-28 14:10:58.421 E/unknown:ReactNative(22220): _construct@1:164067
11-28 14:10:58.421 E/unknown:ReactNative(22220): _next@1:595055
```

### 102 audit 11 min
```
11-28 14:11:57.663 E/ReactNativeJS(22220): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0hc0ox-d937e3d527f91699","check":{"id":"deep-repeat.sample.catalogue.1.product.lender.open","label":"sample.catalogue.1: product.lender.open (repeat)","kind":"journey","status":"fail","durationMs":2586.8,"metrics":{"journeyId":"sample.catalogue.1.product.lender.open","journeyLabel":"sample.catalogue.1: product.lender.open","iteration":"warm","passId":"repeat","scenarioId":"sample.catalogue.1","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/Zeus","expectedPath":"/bank/Zeus","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":19,"actionRevisionAfter":20,"actionResultEvidence":"{\"expectedPath\":\"/bank/Zeus\"}","actionMs":1041.6,"preActionWaitMs":18.5,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"…
11-28 14:11:57.666 E/unknown:ReactNative(22220): ?anon_0_@1:3710195
11-28 14:11:57.666 E/unknown:ReactNative(22220): ?anon_0_@1:3715995
11-28 14:11:57.666 E/unknown:ReactNative(22220): SyntheticError@1:163204
11-28 14:11:57.666 E/unknown:ReactNative(22220): Wrapper@1:163719
11-28 14:11:57.666 E/unknown:ReactNative(22220): _callSuper@1:148592
11-28 14:11:57.666 E/unknown:ReactNative(22220): _construct@1:164067
11-28 14:11:57.666 E/unknown:ReactNative(22220): _next@1:595055
```

### 103 audit 12 min
```
11-28 14:14:22.448 E/ReactNativeJS(22220): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0hc0ox-d937e3d527f91699","check":{"id":"deep-repeat.redirect.categories.redirect.categories.verify","label":"redirect.categories: redirect.categories.verify (repeat)","kind":"journey","status":"fail","durationMs":2875.7,"metrics":{"journeyId":"redirect.categories.redirect.categories.verify","journeyLabel":"redirect.categories: redirect.categories.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.categories","semanticActionId":"redirect.categories.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":94.5,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":2092.8,"forwardWorkMs":2092.8,"navigationCommitMs":1…
11-28 14:14:22.451 E/unknown:ReactNative(22220): ?anon_0_@1:3710195
11-28 14:14:22.451 E/unknown:ReactNative(22220): ?anon_0_@1:3715995
11-28 14:14:22.451 E/unknown:ReactNative(22220): SyntheticError@1:163204
11-28 14:14:22.451 E/unknown:ReactNative(22220): Wrapper@1:163719
11-28 14:14:22.451 E/unknown:ReactNative(22220): _callSuper@1:148592
11-28 14:14:22.451 E/unknown:ReactNative(22220): _construct@1:164067
11-28 14:14:22.451 E/unknown:ReactNative(22220): _next@1:595055
```

### 104 audit 14 min
```
11-28 14:15:34.426 E/ReactNativeJS(22220): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0hc0ox-d937e3d527f91699","check":{"id":"external-link-392","kind":"network","status":"fail","durationMs":2251.5277249999344,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"pass","browserHandler":"pass","httpReachability":"fail","statusCode":404,"handlerAttempted":true,"httpAttempted":true,"httpSelected":true,"handlerResolution":"pass","host":"www.defencebank.com.au","destinationPath":"/banking/home-loans/essentials-home-loan---ultimate-package-investor-interest-only/"},"error":"HTTP 404: the destination is missing or unavailable.","canonicalMetrics":true}}
11-28 14:15:34.429 E/unknown:ReactNative(22220): ?anon_0_@1:3710195
11-28 14:15:34.429 E/unknown:ReactNative(22220): ?anon_0_@1:3719556
11-28 14:15:34.429 E/unknown:ReactNative(22220): SyntheticError@1:163204
11-28 14:15:34.429 E/unknown:ReactNative(22220): Wrapper@1:163719
11-28 14:15:34.429 E/unknown:ReactNative(22220): _callSuper@1:148592
11-28 14:15:34.429 E/unknown:ReactNative(22220): _construct@1:164067
11-28 14:15:34.429 E/unknown:ReactNative(22220): _next@1:595055
```
