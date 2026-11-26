# App explorer: 1.0.379 (435)

**Real-use session FAIL vs 1.0.378: 1 broken, 24 friction, 5 slower**

- Broken: "leave removed product" failed: Back destination was not observed
- Friction: No reaction for 3.5 s after "scroll rates 1"
- Friction: No reaction for 3.2 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll product fees"
- Friction: No reaction for 3.1 s after "scroll product eligibility"
- Friction: No reaction for 3.2 s after "scroll product sources"
- Friction: No reaction for 3.2 s after "scroll lenders"
- Friction: No reaction for 5.6 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.4 s after "open filters"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.0 s after "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 5.1 s after "open term deposits"
- Friction: No reaction for 3.5 s after "verify term deposit rates"
- Friction: No reaction for 7.9 s after "search Macquarie"
- Friction: No reaction for 3.2 s after "return from savings search"
- Friction: No reaction for 3.8 s after "open mortgage filter draft"
- Friction: No reaction for 3.7 s after "verify fixed was not applied"
- Friction: No reaction for 3.7 s after "open unsaved rate"
- Friction: No reaction for 3.4 s after "open product from saved rates"
- Friction: No reaction for 17.6 s after "leave removed product"
- Friction: "No saved rates" shown on "start compare from rates"
- Slower: Dropped frames 52% to 68% on "scroll product eligibility"
- Slower: Dropped frames 54% to 72% on "scroll product sources"
- Slower: Dropped frames 45% to 65% on "open savings search"
- Slower: "leave removed product" content 0.0 s to 20.2 s
- Slower: "leave removed product" reaction 2.2 s to 17.6 s

**Initial Rates readiness:** 41.0 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 8 passed, 1 failed, 1 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-26

Mode full | 120 steps | crashes 0 | step failures 1 | settle timeouts 1 | steps with JS/native errors 19
Baseline 1.0.378
**Audit live: outcome failed | 1075 s | audit log 855009 bytes (audit-log.txt) https://paste.c-net.org/0411e154-2731-0d67-fff2-ef5131f0cac0 | debug log fetch failed (Hosted log exceeds the upload byte limit) https://paste.rs/CyJU5**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3110 | +335 | 668/901 | 85 | 494 | 1 errors; start 3042ms |
| 2 | scroll rates 1 | 681 | -12 | 30/48 | 93 | 590 | boot js-start 466564, layout-mounted 467182, cache-read 467345, hydrated 467610, splash-hide 467610, manifest 469269, resolved 469799, core-fetched 474270, core-saved 475391, search-index-idle 475875, leading-requested 475875, details-start 476542, leading-scoped 476668, pricing-ready 477983, details-fetched 487546, rows-prepared 494405, detail-filters-idle 494405, last-pricing 494405, suitability-built 495617, post-refresh-wait 496280, leading-page 498541, last-rows 507356, rates-ready 507540, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 202, pricing-scope-ms 13703, leading-gated 1, filter-runs 2, filter-rows 31602, filter-yields 9, filter-ms 3956, sort-runs 4, sort-rows 1183, sort-yields 4, sort-ms 46 |
| 3 | scroll rates 2 | 713 | +23 | 20/31 | 77 | 658 |  |
| 4 | scroll rates back | 680 | +1 |  |  | 556 |  |
| 5 | open product | 5915 | +5894 | 40/57 | 81 | 655 |  |
| 6 | scroll product | 700 | -21 | 33/50 | 65 | 659 |  |
| 7 | expand product facts | 22 | +4 | 40/67 | 81 | 666 |  |
| 8 | scroll product fees | 723 | +31 | 31/52 | 85 | 657 |  |
| 9 | scroll product eligibility | 732 | +25 | 26/38 | 85 | 648 |  |
| 10 | expand eligibility | 0 | 0 | 209/292 | 85 | 646 |  |
| 11 | expand constraints | 21 | -4459 | 10/15 | 69 | 646 |  |
| 12 | scroll product sources | 722 | +28 | 23/32 | 93 | 651 |  |
| 13 | back to rates | 29 | +5 | 15/24 | 85 | 649 |  |
| 14 | open lenders | 23 | +3 | 22/24 | 250 | 654 |  |
| 15 | scroll lenders | 713 | -59 | 19/23 | 150 | 652 |  |
| 16 | back from lenders | 22 | +2 | 7/9 | 200 | 652 |  |
| 17 | switch to savings | 25 | +6 | 78/99 | 97 | 665 |  |
| 18 | switch to home loans | 24 | +3 | 14/29 | 65 | 680 |  |
| 19 | open filters | 24 | +6 | 23/27 | 125 | 678 |  |
| 20 | close filters | 23 | +5 | 7/8 | 150 | 677 |  |
| 21 | open market | 23 | +4 | 21/34 | 73 | 679 |  |
| 22 | open rba | 2664 | +247 | 88/105 | 65 | 697 |  |
| 23 | scroll rba | 708 | +2 | 32/52 | 69 | 689 |  |
| 24 | back from rba | 23 | -3 | 13/20 | 69 | 690 |  |
| 25 | scroll market | 688 | -30 | 25/40 | 85 | 688 |  |
| 26 | open saved | 22 | +2 | 9/17 | 73 | 693 |  |
| 27 | return to rates | 24 | +5 | 18/29 | 77 | 694 |  |
| 28 | start category switch | 28 | +2 |  |  | 693 |  |
| 29 | open term deposits | 23 | +3 | 66/100 | 81 | 716 |  |
| 30 | verify term deposit rates | 724 | +42 | 33/50 | 85 | 718 |  |
| 31 | restore home loans | 23 | +5 | 15/25 | 65 | 728 |  |
| 32 | start search from rates | 26 | +3 |  |  | 722 |  |
| 33 | open savings search | 23 | +3 | 20/31 | 65 | 735 |  |
| 34 | search Macquarie | 2342 | +256 | 74/83 | 150 | 738 | 1 errors |
| 35 | verify Macquarie result | 1 | +1 | 12/15 | 17 | 730 |  |
| 36 | clear query and restore results | 26 | +6 | 15/19 | 32 | 742 |  |
| 37 | return from savings search | 24 | +2 | 35/42 | 81 | 754 |  |
| 38 | start filter rollback | 67 | +40 | 10/15 | 16 | 746 |  |
| 39 | open mortgage filter draft | 22 | -16 | 25/29 | 150 | 756 |  |
| 40 | select fixed in draft | 21 | +2 | 12/13 | 129 | 755 |  |
| 41 | discard unsaved filter draft | 21 | +2 | 18/21 | 101 | 757 |  |
| 42 | verify fixed was not applied | 23 | +1 | 28/32 | 125 | 768 | 1 errors |
| 43 | close verified filter draft | 22 | +4 | 17/22 | 81 | 769 |  |
| 44 | start save from rates | 29 | +1 | 13/15 | 16 | 766 | 1 errors |
| 45 | open unsaved rate | 24 | +4 | 121/170 | 81 | 796 | 1 errors |
| 46 | save a rate | 23 | +3 | 8/15 | 73 | 800 | 1 errors |
| 47 | leave saved product | 24 | +3 | 15/23 | 85 | 805 |  |
| 48 | restart with a saved rate | 17741 | +3794 | 215/285 | 93 | 591 | 3 errors; start 6249ms; boot js-start 978751, layout-mounted 979340, hydrated 980037, cache-read 981417, core-ready 982196, rows-prepared 982360, search-index-idle 982360, detail-filters-idle 982360, leading-requested 982360, last-pricing 982360, splash-hide 982362, manifest 984780, leading-scoped 985983, leading-page 985983, resolved 986742, pricing-ready 989788, last-rows 989788, rates-ready 989979, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 27, pricing-scope-ms 4818, filter-runs 1, filter-rows 6864, filter-yields 4, filter-ms 103, sort-runs 1, sort-rows 1183, sort-yields 1, sort-ms 14 |
| 49 | verify saved rate after restart | 23 | +1 | 20/30 | 85 | 417 |  |
| 50 | open product from saved rates | 30 | -2207 | 38/61 | 85 | 536 |  |
| 51 | remove saved rate | 30 | +9 | 10/19 | 81 | 601 |  |
| 52 | leave removed product | 20151 | +20128 | 5/10 | 69 | 629 | no settle; Back destination was not observed |
| 53 | start compare from rates | 28 | +1 |  |  | 656 |  |
| 54 | enter selection mode | 4811 | +4792 | 21/32 | 69 | 705 |  |
| 55 | select first comparison rate | 23 | +4 | 7/14 | 57 | 699 |  |
| 56 | select second comparison rate | 22 | +3 | 9/13 | 61 | 690 |  |
| 57 | open two-rate comparison | 21 | +1 | 19/29 | 150 | 700 |  |
| 58 | return from two-rate comparison | 23 | -1 | 22/29 | 97 | 702 |  |
| 59 | cold start | 10689 | +1608 | 33/45 | 101 | 580 | 1 errors; start 4255ms; boot js-start 1114661, layout-mounted 1114863, hydrated 1114976, cache-read 1116251, core-ready 1117033, rows-prepared 1117143, search-index-idle 1117143, detail-filters-idle 1117143, leading-requested 1117143, last-pricing 1117143, splash-hide 1117143, manifest 1119457, leading-scoped 1119819, leading-page 1119819, resolved 1120329, pricing-ready 1121108, last-rows 1121108, rates-ready 1121289, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 22, pricing-scope-ms 1543, filter-runs 1, filter-rows 6864, filter-yields 4, filter-ms 102, sort-runs 1, sort-rows 1183, sort-yields 1, sort-ms 14 |
| 60 | /browse | 4525 | +2307 | 1/2 | 32 | 432 |  |
| 61 | /watchlist | 34 | +4 | 3/4 | 32 | 440 |  |
| 62 | /market | 34 | +5 | 11/20 | 73 | 516 |  |
| 63 | /tools | 28 | +2 | 14/21 | 101 | 580 |  |
| 64 | /trends | 27 | -2168 |  |  | 624 |  |
| 65 | /search | 2340 | +2310 | 43/58 | 101 | 633 |  |
| 66 | /banks | 25 | -6 | 30/37 | 109 | 657 |  |
| 67 | /bank-rates | 25 | +6 | 16/24 | 69 | 661 |  |
| 68 | /categories | 30 | +6 | 34/45 | 93 | 686 |  |
| 69 | /catalogue | 29 | +6 | 35/43 | 109 | 705 |  |
| 70 | /compare | 33 | +7 | 11/14 | 121 | 712 |  |
| 71 | /matches | 36 | +15 | 33/43 | 97 | 701 |  |
| 72 | /calculator | 31 | +5 | 15/21 | 81 | 692 |  |
| 73 | /projections | 29 | +1 | 22/30 | 121 | 696 |  |
| 74 | /profile | 30 | +8 | 17/25 | 69 | 700 |  |
| 75 | /research | 28 | +3 | 20/29 | 93 | 708 |  |
| 76 | /rba | 25 | +5 | 11/23 | 69 | 721 |  |
| 77 | /rba-response | 31 | +4 | 18/31 | 77 | 721 |  |
| 78 | /settings | 25 | 0 | 20/27 | 81 | 727 |  |
| 79 | /about | 31 | +3 | 12/21 | 61 | 727 |  |
| 80 | /terms | 36 | +9 | 13/22 | 81 | 728 |  |
| 81 | /privacy | 32 | +9 |  |  | 728 |  |
| 82 | /third-party-notices | 29 | 0 | 15/22 | 65 | 731 |  |
| 83 | /node | 27 | +3 | 32/45 | 105 | 764 |  |
| 84 | /passthrough | 33 | +8 | 29/44 | 101 | 740 |  |
| 85 | /calculation-receipt | 32 | +4 | 13/24 | 77 | 725 |  |
| 86 | /rate-receipt | 24 | -3 | 7/9 | 85 | 726 |  |
| 87 | warm resume | 675 | +24 | 4/5 | 150 | 725 |  |
| 88 | cold relaunch | 10126 | +978 | 27/36 | 200 | 581 | 3 errors; start 4198ms; boot js-start 1352869, layout-mounted 1353072, hydrated 1353176, cache-read 1354463, core-ready 1355267, rows-prepared 1355397, search-index-idle 1355397, detail-filters-idle 1355397, leading-requested 1355397, last-pricing 1355397, splash-hide 1355398, manifest 1357615, leading-scoped 1358008, leading-page 1358008, resolved 1358391, pricing-ready 1359301, last-rows 1359301, rates-ready 1359480, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 20, pricing-scope-ms 1574, filter-runs 1, filter-rows 6864, filter-yields 4, filter-ms 102, sort-runs 1, sort-rows 1183, sort-yields 1, sort-ms 14 |
| 89 | about | 29 | +3 | 14/20 | 250 | 607 |  |
| 90 | audit screen | 21 | -3 | 145/251 | 65 | 578 |  |
| 91 | audit 0 min | 0 | 0 | 7/8 | 200 | 615 |  |
| 92 | audit 1 min | 0 |  | 952/1095 | 113 | 921 | 80 errors |
| 93 | audit 2 min | 0 | 0 | 135/153 | 113 | 1028 | 80 errors |
| 94 | audit 4 min | 0 |  | 793/880 | 117 | 1128 | 80 errors |
| 95 | audit 6 min | 0 | 0 | 1109/1289 | 105 | 1166 | 80 errors |
| 96 | audit 7 min | 0 | 0 | 497/556 | 121 | 1214 | 80 errors |
| 97 | audit 8 min | 0 | 0 | 503/549 | 117 | 1285 | 80 errors |
| 98 | audit 10 min | 0 | 0 | 713/840 | 105 | 1370 | 80 errors |
| 99 | audit 11 min | 0 |  | 713/833 | 101 | 1393 | 80 errors |
| 100 | audit 12 min | 0 | 0 | 386/428 | 121 | 1252 | 80 errors |
| 101 | audit 13 min | 0 | 0 | 188/223 | 81 | 1263 | 80 errors |
| 102 | audit 15 min | 0 | 0 | 90/113 | 34 | 1281 |  |
| 103 | audit 16 min | 0 |  | 159/188 | 48 | 1304 |  |
| 104 | audit 17 min | 0 |  | 32/43 | 73 | 1345 |  |
| 105 | audit finished | 0 | 0 | 100/172 | 69 | 1295 |  |
| 106 | audit result 1 | 0 | 0 |  |  | 1291 |  |
| 107 | audit result 2 | 0 | 0 |  |  | 1289 |  |
| 108 | audit result 3 | 0 | 0 |  |  | 1289 |  |
| 109 | audit result 4 | 0 | 0 |  |  | 1292 |  |
| 110 | audit result 5 | 0 | 0 |  |  | 1290 |  |
| 111 | audit result 6 | 0 | 0 |  |  | 1292 |  |
| 112 | audit result 7 | 0 | 0 |  |  | 1290 |  |
| 113 | audit result 8 | 0 | 0 |  |  | 1293 |  |
| 114 | audit result 9 | 0 | 0 |  |  | 1294 |  |
| 115 | audit result 10 | 0 | 0 |  |  | 1292 |  |
| 116 | audit result 11 | 0 | 0 |  |  | 1294 |  |
| 117 | audit result 12 | 0 | 0 |  |  | 1293 |  |
| 118 | about for debug log | 3180 | +148 | 22/32 | 77 | 1343 |  |
| 119 | debug log screen | 0 | 0 | 110/213 | 65 | 1335 |  |
| 120 | debug log uploaded | 0 | 0 | 25/32 | 117 | 1462 |  |

## Errors

### 1 open app
```
11-26 09:01:10.197 E/australianrates(11452): Not starting debugger since process cannot load the jdwp agent.
```

### 34 search Macquarie
```
11-26 09:07:49.324 E/FrameTracker(11452): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 42 verify fixed was not applied
```
11-26 09:08:53.240 E/FrameTracker(11452): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 44 start save from rates
```
11-26 09:09:11.006 E/FrameTracker(11452): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 open unsaved rate
```
11-26 09:09:16.962 E/ImeBackDispatcher(11452): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 59075065
```

### 46 save a rate
```
11-26 09:09:27.534 E/FrameTracker(11452): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 48 restart with a saved rate
```
11-26 09:09:42.852 E/australianrates(16988): Not starting debugger since process cannot load the jdwp agent.
11-26 09:09:48.801 E/SurfaceSyncGroup(16988): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-26 09:09:48.801 E/SurfaceSyncGroup(16988): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 59 cold start
```
11-26 09:11:59.516 E/australianrates(18507): Not starting debugger since process cannot load the jdwp agent.
```

### 88 cold relaunch
```
11-26 09:15:57.845 E/australianrates(21694): Not starting debugger since process cannot load the jdwp agent.
11-26 09:16:01.839 E/SurfaceSyncGroup(21694): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-26 09:16:01.839 E/SurfaceSyncGroup(21694): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 92 audit 1 min
```
11-26 09:17:24.068 E/ReactNativeJS(21694): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxc9fob-586481a381a0c3ff","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":8038.6,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":184.3,"liveStage:dates-index:fetched:ms":167.4,"liveStage:revision:verified:ms":56.5,"liveStage:Core asset:downloaded:ms":251.2,"liveStage:Core asset:hash-verified:ms":16,"liveStage:Core asset:native-inflated-and-text-decoded:ms":206.9,"liveStage:Core asset:inflated:ms":0.2,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":269.8,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":585.3,"liveStage:Details asset:downloaded:ms":1384.4,"liveStage:Details asset:hash-verified:ms":42.3,"liveS…
11-26 09:17:24.070 E/unknown:ReactNative(21694): ?anon_0_@1:3697085
11-26 09:17:24.070 E/unknown:ReactNative(21694): ?anon_0_@1:3702885
11-26 09:17:24.070 E/unknown:ReactNative(21694): SyntheticError@1:163048
11-26 09:17:24.070 E/unknown:ReactNative(21694): Wrapper@1:163563
11-26 09:17:24.070 E/unknown:ReactNative(21694): _callSuper@1:148436
11-26 09:17:24.070 E/unknown:ReactNative(21694): _construct@1:163911
11-26 09:17:24.070 E/unknown:ReactNative(21694): _next@1:594899
```

### 93 audit 2 min
```
11-26 09:19:01.618 E/ReactNativeJS(21694): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxc9fob-586481a381a0c3ff","check":{"id":"journey-lender-warm","label":"Lender details (warm)","kind":"journey","status":"fail","durationMs":2171.5,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":842.6,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"lender","journeyLabel":"Lender details","iteration":"warm","expectedPath":"/bank/Australian%20Military%20Bank","expectedSurface":"lender.details","navigationKind":"stack","forwardMs":842.6,"firstReadyFrameObserved":true,"firstReadyFrameMs":58.306509000016376,"backgroundSettleMs":861,"destinationReadinessMs":58.3,"backgroundTasks":"Bank response analysis","backMs":168.2,"firstBackMs":168.2,"firstBackDestination":"/performance-audit","originReadinessMs":0.3,…
11-26 09:19:01.620 E/unknown:ReactNative(21694): ?anon_0_@1:3697085
11-26 09:19:01.620 E/unknown:ReactNative(21694): ?anon_0_@1:3702885
11-26 09:19:01.620 E/unknown:ReactNative(21694): SyntheticError@1:163048
11-26 09:19:01.620 E/unknown:ReactNative(21694): Wrapper@1:163563
11-26 09:19:01.620 E/unknown:ReactNative(21694): _callSuper@1:148436
11-26 09:19:01.620 E/unknown:ReactNative(21694): _construct@1:163911
11-26 09:19:01.620 E/unknown:ReactNative(21694): _next@1:594899
```

### 94 audit 4 min
```
11-26 09:19:23.990 E/ReactNativeJS(21694): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxc9fob-586481a381a0c3ff","check":{"id":"deep-first-pass.route.rates.search.filters.apply","label":"route.rates: search.filters.apply (first-pass)","kind":"journey","status":"fail","durationMs":1548.6,"metrics":{"journeyId":"route.rates.search.filters.apply","journeyLabel":"route.rates: search.filters.apply","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.filters.apply","depth":2,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"state-27","renderRevisionAfter":"state-33","actionMs":194.3,"preActionWaitMs":1.6,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"…
11-26 09:19:23.991 E/unknown:ReactNative(21694): ?anon_0_@1:3697085
11-26 09:19:23.991 E/unknown:ReactNative(21694): ?anon_0_@1:3702885
11-26 09:19:23.991 E/unknown:ReactNative(21694): SyntheticError@1:163048
11-26 09:19:23.991 E/unknown:ReactNative(21694): Wrapper@1:163563
11-26 09:19:23.991 E/unknown:ReactNative(21694): _callSuper@1:148436
11-26 09:19:23.991 E/unknown:ReactNative(21694): _construct@1:163911
11-26 09:19:23.991 E/unknown:ReactNative(21694): _next@1:594899
```

### 95 audit 6 min
```
11-26 09:21:18.235 E/ReactNativeJS(21694): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxc9fob-586481a381a0c3ff","check":{"id":"deep-first-pass.sample.catalogue.0.product.open","label":"sample.catalogue.0: product.open (first-pass)","kind":"journey","status":"fail","durationMs":1594.4,"metrics":{"journeyId":"sample.catalogue.0.product.open","journeyLabel":"sample.catalogue.0: product.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.0","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Australian%20Military%20Bank%7C1fb57016-8792-4c85-baef-f628f9128a57%7CRESIDENTIAL_MORTGAGES%7C5%20Year%20Fixed%20Rate%20Home%20Loan","expectedPath":"/product/Australian%20Military%20Bank%7C1fb57016-8792-4c85-baef-f628f9128a57%7CRESIDENTIAL_MORTGAGES%7C5%20Year%20Fixed%20Rate%20Home%20Loan","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":353.6,"avoidableWaitMs":0,"minimumJustifie…
11-26 09:21:18.236 E/unknown:ReactNative(21694): ?anon_0_@1:3697085
11-26 09:21:18.236 E/unknown:ReactNative(21694): ?anon_0_@1:3702885
11-26 09:21:18.236 E/unknown:ReactNative(21694): SyntheticError@1:163048
11-26 09:21:18.236 E/unknown:ReactNative(21694): Wrapper@1:163563
11-26 09:21:18.236 E/unknown:ReactNative(21694): _callSuper@1:148436
11-26 09:21:18.236 E/unknown:ReactNative(21694): _construct@1:163911
11-26 09:21:18.236 E/unknown:ReactNative(21694): _next@1:594899
```

### 96 audit 7 min
```
11-26 09:23:42.699 E/ReactNativeJS(21694): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxc9fob-586481a381a0c3ff","check":{"id":"deep-first-pass.route.not-found.not-found.home","label":"route.not-found: not-found.home (first-pass)","kind":"journey","status":"fail","durationMs":9503.2,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"cold","passId":"first-pass","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":0,"actionRevisionAfter":1,"renderRevisionBefore":"not-found-v1","actionMs":97.3,"preActionWaitMs":0.8,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"s…
11-26 09:23:42.701 E/unknown:ReactNative(21694): ?anon_0_@1:3697085
11-26 09:23:42.701 E/unknown:ReactNative(21694): ?anon_0_@1:3702885
11-26 09:23:42.701 E/unknown:ReactNative(21694): SyntheticError@1:163048
11-26 09:23:42.701 E/unknown:ReactNative(21694): Wrapper@1:163563
11-26 09:23:42.701 E/unknown:ReactNative(21694): _callSuper@1:148436
11-26 09:23:42.701 E/unknown:ReactNative(21694): _construct@1:163911
11-26 09:23:42.701 E/unknown:ReactNative(21694): _next@1:594899
```

### 97 audit 8 min
```
11-26 09:24:31.524 E/ReactNativeJS(21694): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxc9fob-586481a381a0c3ff","check":{"id":"deep-repeat.route.rates.search.filters.open","label":"route.rates: search.filters.open (repeat)","kind":"journey","status":"fail","durationMs":5712,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":26,"actionRevisionAfter":27,"renderRevisionBefore":"state-24","renderRevisionAfter":"state-27","actionMs":0.2,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repe…
11-26 09:24:31.526 E/unknown:ReactNative(21694): ?anon_0_@1:3697085
11-26 09:24:31.526 E/unknown:ReactNative(21694): ?anon_0_@1:3702885
11-26 09:24:31.526 E/unknown:ReactNative(21694): SyntheticError@1:163048
11-26 09:24:31.526 E/unknown:ReactNative(21694): Wrapper@1:163563
11-26 09:24:31.526 E/unknown:ReactNative(21694): _callSuper@1:148436
11-26 09:24:31.526 E/unknown:ReactNative(21694): _construct@1:163911
11-26 09:24:31.526 E/unknown:ReactNative(21694): _next@1:594899
```

### 98 audit 10 min
```
11-26 09:26:01.488 E/ReactNativeJS(21694): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxc9fob-586481a381a0c3ff","check":{"id":"deep-repeat.route.compare.compare.dismiss","label":"route.compare: compare.dismiss (repeat)","kind":"journey","status":"fail","durationMs":2685.9,"metrics":{"journeyId":"route.compare.compare.dismiss","journeyLabel":"route.compare: compare.dismiss","iteration":"warm","passId":"repeat","scenarioId":"route.compare","semanticActionId":"compare.dismiss","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"compare.table","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":4,"actionRevisionAfter":5,"renderRevisionBefore":"2026-11-26:1#Australian Military Bank|1fb57016-8792-4c85-baef-f628f9128a57|RESIDENTIAL_MORTGAGES|5 Year Fixed Rate Home Loan|58#Macquarie Bank Limited|LN001MBLBAS001|RESIDENTIAL_MORTGAGES|Macquarie Basic Home Loan","actionMs":1113.1,"preActionWaitMs":7.3,"preActi…
11-26 09:26:01.490 E/unknown:ReactNative(21694): ?anon_0_@1:3697085
11-26 09:26:01.490 E/unknown:ReactNative(21694): ?anon_0_@1:3702885
11-26 09:26:01.490 E/unknown:ReactNative(21694): SyntheticError@1:163048
11-26 09:26:01.490 E/unknown:ReactNative(21694): Wrapper@1:163563
11-26 09:26:01.490 E/unknown:ReactNative(21694): _callSuper@1:148436
11-26 09:26:01.490 E/unknown:ReactNative(21694): _construct@1:163911
11-26 09:26:01.490 E/unknown:ReactNative(21694): _next@1:594899
```

### 99 audit 11 min
```
11-26 09:27:01.263 E/ReactNativeJS(21694): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxc9fob-586481a381a0c3ff","check":{"id":"deep-repeat.route.calculator.calculator.open","label":"route.calculator: calculator.open (repeat)","kind":"journey","status":"fail","durationMs":4155.4,"metrics":{"journeyId":"route.calculator.calculator.open","journeyLabel":"route.calculator: calculator.open","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.open","depth":0,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":589.4,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":120.5,"forwardWorkMs":120.5,"navigationCommitMs":0,"firstReadyFrameMs":120.5,"firstReadyFrameObserved":true,…
11-26 09:27:01.264 E/unknown:ReactNative(21694): ?anon_0_@1:3697085
11-26 09:27:01.264 E/unknown:ReactNative(21694): ?anon_0_@1:3702885
11-26 09:27:01.264 E/unknown:ReactNative(21694): SyntheticError@1:163048
11-26 09:27:01.264 E/unknown:ReactNative(21694): Wrapper@1:163563
11-26 09:27:01.264 E/unknown:ReactNative(21694): _callSuper@1:148436
11-26 09:27:01.264 E/unknown:ReactNative(21694): _construct@1:163911
11-26 09:27:01.264 E/unknown:ReactNative(21694): _next@1:594899
```

### 100 audit 12 min
```
11-26 09:29:01.016 E/ReactNativeJS(21694): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxc9fob-586481a381a0c3ff","check":{"id":"deep-repeat.route.not-found.not-found.home","label":"route.not-found: not-found.home (repeat)","kind":"journey","status":"fail","durationMs":9451.8,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"warm","passId":"repeat","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":1,"actionRevisionAfter":2,"renderRevisionBefore":"not-found-v1","actionMs":101.8,"preActionWaitMs":0.4,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetour…
11-26 09:29:01.017 E/unknown:ReactNative(21694): ?anon_0_@1:3697085
11-26 09:29:01.017 E/unknown:ReactNative(21694): ?anon_0_@1:3702885
11-26 09:29:01.017 E/unknown:ReactNative(21694): SyntheticError@1:163048
11-26 09:29:01.017 E/unknown:ReactNative(21694): Wrapper@1:163563
11-26 09:29:01.017 E/unknown:ReactNative(21694): _callSuper@1:148436
11-26 09:29:01.017 E/unknown:ReactNative(21694): _construct@1:163911
11-26 09:29:01.017 E/unknown:ReactNative(21694): _next@1:594899
```

### 101 audit 13 min
```
11-26 09:29:33.318 E/ReactNativeJS(21694): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxc9fob-586481a381a0c3ff","check":{"id":"deep-repeat.redirect.tab-index.redirect.tab-index.verify","label":"redirect.tab-index: redirect.tab-index.verify (repeat)","kind":"journey","status":"fail","durationMs":2140.3,"metrics":{"journeyId":"redirect.tab-index.redirect.tab-index.verify","journeyLabel":"redirect.tab-index: redirect.tab-index.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.tab-index","semanticActionId":"redirect.tab-index.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":55.2,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1419.6,"forwardWorkMs":1419.6,"navigationCommitMs":1142,"first…
11-26 09:29:33.319 E/unknown:ReactNative(21694): ?anon_0_@1:3697085
11-26 09:29:33.319 E/unknown:ReactNative(21694): ?anon_0_@1:3702885
11-26 09:29:33.319 E/unknown:ReactNative(21694): SyntheticError@1:163048
11-26 09:29:33.319 E/unknown:ReactNative(21694): Wrapper@1:163563
11-26 09:29:33.319 E/unknown:ReactNative(21694): _callSuper@1:148436
11-26 09:29:33.319 E/unknown:ReactNative(21694): _construct@1:163911
11-26 09:29:33.319 E/unknown:ReactNative(21694): _next@1:594899
```
