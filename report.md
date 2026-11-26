# App explorer: 1.0.388 (444)

**Real-use session FAIL vs 1.0.387: 1 broken, 26 friction, 3 slower**

- Broken: Screen never settled on "leave removed product"
- Friction: No reaction for 3.9 s after "scroll rates 1"
- Friction: No reaction for 3.3 s after "scroll rates 2"
- Friction: No reaction for 4.0 s after "open product"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 5.0 s after "expand visible fees"
- Friction: No reaction for 3.2 s after "scroll product fees"
- Friction: No reaction for 3.1 s after "scroll product eligibility"
- Friction: No reaction for 3.2 s after "scroll product sources"
- Friction: No reaction for 5.0 s after "open lenders"
- Friction: No reaction for 3.2 s after "scroll lenders"
- Friction: No reaction for 4.6 s after "switch to savings"
- Friction: No reaction for 3.0 s after "switch to home loans"
- Friction: No reaction for 3.6 s after "open filters"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 4.9 s after "open term deposits"
- Friction: No reaction for 4.0 s after "verify term deposit rates"
- Friction: No reaction for 6.7 s after "search Macquarie"
- Friction: No reaction for 3.1 s after "return from savings search"
- Friction: No reaction for 3.7 s after "open mortgage filter draft"
- Friction: No reaction for 3.6 s after "verify fixed was not applied"
- Friction: No reaction for 3.5 s after "open unsaved rate"
- Friction: No reaction for 3.4 s after "open product from saved rates"
- Friction: No reaction for 20.0 s after "leave removed product"
- Friction: "No saved rates" shown on "leave removed product"
- Slower: "expand eligibility" content 0.0 s to 2.4 s
- Slower: "open lenders" content 2.9 s to 5.0 s
- Slower: "open lenders" reaction 2.9 s to 5.0 s

**Initial Rates readiness:** 42.3 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 8 passed, 1 failed, 1 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3752 bytes, latest published run date 2026-11-27

Mode full | 121 steps | crashes 0 | step failures 0 | settle timeouts 1 | steps with JS/native errors 20
Baseline 1.0.387
**Audit live: outcome failed | 1038 s | audit log 861077 bytes (audit-log.txt) https://paste.c-net.org/d43fd282-0973-4e6b-eea8-208a74ec512d | debug log 5814296 bytes read from host https://paste.c-net.org/612831b5-7237-ccbb-0c98-6e8fd6d80b67**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3032 | -15 | 680/914 | 89 | 512 | 1 errors; start 2974ms |
| 2 | scroll rates 1 | 707 | -7 | 34/55 | 85 | 545 | boot js-start 463651, layout-mounted 464316, cache-read 464529, hydrated 464701, splash-hide 464701, manifest 465821, resolved 466259, core-fetched 471335, core-saved 472292, search-index-idle 472738, leading-requested 472738, details-start 473274, leading-scoped 473373, pricing-ready 475034, details-fetched 484214, rows-prepared 492079, detail-filters-idle 492079, last-pricing 492079, suitability-built 493395, post-refresh-wait 494738, leading-page 496903, last-rows 505783, rates-ready 505955, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 204, pricing-scope-ms 14241, leading-gated 1, filter-runs 2, filter-rows 31912, filter-yields 7, filter-ms 209, sort-runs 4, sort-rows 1191, sort-yields 4, sort-ms 58 |
| 3 | scroll rates 2 | 690 | -1 | 22/31 | 85 | 717 |  |
| 4 | scroll rates back | 681 | +6 |  |  | 635 |  |
| 5 | open product | 22 | -6593 | 36/58 | 85 | 638 |  |
| 6 | scroll product | 720 | +20 | 31/55 | 81 | 649 |  |
| 7 | expand visible fees | 2268 |  | 8/15 | 65 | 655 |  |
| 8 | expand product facts | 20 | -2 | 76/112 | 97 | 636 |  |
| 9 | scroll product fees | 772 | +68 | 34/53 | 85 | 651 |  |
| 10 | scroll product eligibility | 727 | -7 | 29/54 | 73 | 657 |  |
| 11 | expand eligibility | 25 | +25 | 9/15 | 65 | 636 |  |
| 12 | expand constraints | 27 | +3 | 8/16 | 73 | 638 |  |
| 13 | scroll product sources | 722 | -27 | 26/38 | 81 | 645 |  |
| 14 | back to rates | 33 | +6 | 13/23 | 81 | 647 |  |
| 15 | open lenders | 2286 | +2262 | 19/22 | 250 | 646 |  |
| 16 | scroll lenders | 749 | +56 | 15/20 | 150 | 649 |  |
| 17 | back from lenders | 23 | +1 | 7/9 | 150 | 646 |  |
| 18 | switch to savings | 26 | 0 | 61/83 | 81 | 659 |  |
| 19 | switch to home loans | 23 | -3 | 15/27 | 65 | 672 |  |
| 20 | open filters | 21 | -1 | 21/24 | 150 | 676 |  |
| 21 | close filters | 21 | -1 | 8/9 | 200 | 677 |  |
| 22 | open market | 22 | -1 | 17/28 | 73 | 683 |  |
| 23 | open rba | 2544 | -96 | 53/69 | 85 | 705 |  |
| 24 | scroll rba | 700 | +5 | 33/50 | 81 | 697 |  |
| 25 | back from rba | 25 | +1 | 10/20 | 57 | 698 |  |
| 26 | scroll market | 733 | -8 | 23/36 | 85 | 697 |  |
| 27 | open saved | 21 | -3 | 12/18 | 93 | 701 |  |
| 28 | return to rates | 20 | -3 | 23/40 | 81 | 707 |  |
| 29 | start category switch | 29 | 0 |  |  | 708 |  |
| 30 | open term deposits | 22 | -2 | 61/87 | 89 | 738 |  |
| 31 | verify term deposit rates | 683 | -33 | 44/60 | 81 | 744 |  |
| 32 | restore home loans | 22 | -2 | 16/29 | 65 | 763 |  |
| 33 | start search from rates | 30 | +2 |  |  | 759 |  |
| 34 | open savings search | 22 | 0 | 17/29 | 61 | 781 |  |
| 35 | search Macquarie | 2104 | +16 | 62/71 | 150 | 786 |  |
| 36 | verify Macquarie result | 0 | 0 | 12/15 | 16 | 778 | 1 errors |
| 37 | clear query and restore results | 23 | -3 | 15/20 | 32 | 794 |  |
| 38 | return from savings search | 29 | +6 | 32/39 | 93 | 827 |  |
| 39 | start filter rollback | 33 | +4 | 14/15 | 16 | 818 |  |
| 40 | open mortgage filter draft | 23 | 0 | 23/29 | 150 | 830 |  |
| 41 | select fixed in draft | 23 | -1 | 12/13 | 150 | 832 |  |
| 42 | discard unsaved filter draft | 21 | -3 | 16/22 | 101 | 835 |  |
| 43 | verify fixed was not applied | 28 | +2 | 25/30 | 200 | 848 | 1 errors |
| 44 | close verified filter draft | 21 | -1 | 15/21 | 77 | 840 |  |
| 45 | start save from rates | 32 | 0 | 12/16 | 16 | 839 | 1 errors |
| 46 | open unsaved rate | 24 | +1 | 46/62 | 89 | 874 | 1 errors |
| 47 | save a rate | 27 | +3 | 9/15 | 77 | 871 | 1 errors |
| 48 | leave saved product | 27 | -3 | 13/23 | 69 | 876 |  |
| 49 | restart with a saved rate | 18646 | +358 | 209/270 | 93 | 590 | 3 errors; start 6528ms; boot js-start 951730, layout-mounted 952443, hydrated 952721, cache-read 954145, core-ready 954940, rows-prepared 955078, search-index-idle 955078, detail-filters-idle 955078, leading-requested 955078, last-pricing 955078, splash-hide 955079, manifest 957617, leading-scoped 959088, leading-page 959088, resolved 959841, pricing-ready 962663, last-rows 962663, rates-ready 962840, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 2, pricing-yields 24, pricing-scope-ms 4578, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 100, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 14 |
| 50 | verify saved rate after restart | 28 | -2 | 25/35 | 101 | 622 |  |
| 51 | open product from saved rates | 28 | +4 | 43/59 | 89 | 566 |  |
| 52 | remove saved rate | 23 | -7 | 12/22 | 65 | 596 |  |
| 53 | leave removed product | 20106 | -46 | 6/9 | 97 | 629 | no settle |
| 54 | start compare from rates | 26 | -3 | 14/20 | 129 | 639 |  |
| 55 | enter selection mode | 23 | 0 | 12/16 | 65 | 650 |  |
| 56 | select first comparison rate | 32 | +7 | 7/16 | 53 | 688 |  |
| 57 | select second comparison rate | 28 | +3 |  |  | 715 |  |
| 58 | open two-rate comparison | 22 | -2 | 27/46 | 89 | 711 |  |
| 59 | return from two-rate comparison | 22 | -1 | 20/28 | 93 | 717 |  |
| 60 | cold start | 10264 | -2498 | 31/41 | 109 | 580 | 3 errors; start 4188ms; boot js-start 1085624, layout-mounted 1085853, hydrated 1085854, cache-read 1087239, core-ready 1088004, rows-prepared 1088119, search-index-idle 1088119, detail-filters-idle 1088119, leading-requested 1088119, last-pricing 1088119, splash-hide 1088121, manifest 1090355, leading-scoped 1090747, leading-page 1090747, resolved 1091236, pricing-ready 1092098, last-rows 1092098, rates-ready 1092276, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 24, pricing-scope-ms 1630, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 96, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 14 |
| 61 | /browse | 4480 | +4446 | 1/2 | 32 | 425 |  |
| 62 | /watchlist | 26 | +1 | 1/4 | 36 | 432 |  |
| 63 | /market | 28 | -2512 | 13/21 | 65 | 508 |  |
| 64 | /tools | 26 | 0 | 13/20 | 150 | 571 |  |
| 65 | /trends | 38 | +7 |  |  | 615 |  |
| 66 | /search | 4409 | -199 | 39/51 | 101 | 630 |  |
| 67 | /banks | 30 | +5 | 31/39 | 133 | 643 |  |
| 68 | /bank-rates | 30 | -1 | 16/25 | 81 | 657 |  |
| 69 | /categories | 25 | -5 | 39/48 | 101 | 685 |  |
| 70 | /catalogue | 33 | +5 | 29/39 | 117 | 704 |  |
| 71 | /compare | 26 | -1 | 12/16 | 125 | 675 |  |
| 72 | /matches | 24 | -5 | 31/43 | 101 | 696 |  |
| 73 | /calculator | 24 | -6 | 17/26 | 77 | 697 |  |
| 74 | /projections | 13631 | +13604 | 30/46 | 81 | 699 |  |
| 75 | /profile | 26 | +2 | 14/23 | 85 | 692 |  |
| 76 | /research | 35 | +10 | 18/30 | 97 | 702 |  |
| 77 | /rba | 26 | 0 | 15/24 | 69 | 715 |  |
| 78 | /rba-response | 28 | -5 | 16/30 | 65 | 716 |  |
| 79 | /settings | 32 | +6 | 20/38 | 69 | 724 |  |
| 80 | /about | 34 | 0 | 14/23 | 73 | 724 |  |
| 81 | /terms | 34 | +5 | 10/22 | 69 | 726 |  |
| 82 | /privacy | 31 | 0 |  |  | 726 |  |
| 83 | /third-party-notices | 30 | -6 | 13/23 | 65 | 731 |  |
| 84 | /node | 27 | -5 | 40/48 | 77 | 802 |  |
| 85 | /passthrough | 36 | 0 | 26/42 | 85 | 794 |  |
| 86 | /calculation-receipt | 46 | +15 | 15/24 | 61 | 776 |  |
| 87 | /rate-receipt | 28 | -4 | 6/9 | 85 | 751 |  |
| 88 | warm resume | 349 | -379 | 5/5 | 200 | 750 |  |
| 89 | cold relaunch | 10562 | -2212 | 33/44 | 113 | 576 | 1 errors; start 4487ms; boot js-start 1337432, layout-mounted 1337623, hydrated 1337723, cache-read 1339062, core-ready 1339836, rows-prepared 1339963, search-index-idle 1339963, detail-filters-idle 1339963, leading-requested 1339963, last-pricing 1339963, splash-hide 1339965, manifest 1342209, leading-scoped 1342579, leading-page 1342579, resolved 1343076, pricing-ready 1343800, last-rows 1343800, rates-ready 1343990, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 21, pricing-scope-ms 1476, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 110, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 14 |
| 90 | about | 27 | -23 | 13/20 | 300 | 606 |  |
| 91 | audit screen | 23 | -6 | 157/278 | 61 | 576 |  |
| 92 | audit 0 min | 0 | 0 | 6/10 | 250 | 602 |  |
| 93 | audit 1 min | 0 |  | 977/1114 | 113 | 897 | 80 errors |
| 94 | audit 2 min | 0 | 0 | 169/191 | 113 | 1024 | 80 errors |
| 95 | audit 4 min | 0 |  | 907/1021 | 109 | 1107 | 80 errors |
| 96 | audit 5 min | 0 | 0 | 265/313 | 101 | 1051 | 80 errors |
| 97 | audit 6 min | 0 |  | 706/816 | 101 | 1250 | 80 errors |
| 98 | audit 7 min | 0 | 0 | 481/520 | 125 | 1161 | 80 errors |
| 99 | audit 8 min | 0 | 0 | 190/209 | 109 | 1176 | 80 errors |
| 100 | audit 9 min | 0 |  | 995/1129 | 109 | 1311 | 80 errors |
| 101 | audit 11 min | 0 | 0 | 715/837 | 101 | 1379 | 80 errors |
| 102 | audit 12 min | 0 | 0 | 495/555 | 117 | 1240 | 80 errors |
| 103 | audit 14 min | 0 | 0 | 130/148 | 36 | 1243 | 19 errors |
| 104 | audit 15 min | 0 | 0 | 155/191 | 36 | 1271 |  |
| 105 | audit 16 min | 0 | 0 | 48/53 | 85 | 1279 |  |
| 106 | audit finished | 0 | 0 | 126/204 | 69 | 1318 |  |
| 107 | audit result 1 | 0 | 0 |  |  | 1284 |  |
| 108 | audit result 2 | 0 | 0 |  |  | 1283 |  |
| 109 | audit result 3 | 0 | 0 |  |  | 1284 |  |
| 110 | audit result 4 | 0 | 0 |  |  | 1285 |  |
| 111 | audit result 5 | 0 | 0 |  |  | 1283 |  |
| 112 | audit result 6 | 0 | 0 |  |  | 1283 |  |
| 113 | audit result 7 | 0 | 0 |  |  | 1286 |  |
| 114 | audit result 8 | 0 | 0 |  |  | 1284 |  |
| 115 | audit result 9 | 0 | 0 |  |  | 1287 |  |
| 116 | audit result 10 | 0 | 0 |  |  | 1284 |  |
| 117 | audit result 11 | 0 | 0 |  |  | 1284 |  |
| 118 | audit result 12 | 0 | 0 |  |  | 1287 |  |
| 119 | about for debug log | 3358 | +117 | 23/34 | 69 | 1333 |  |
| 120 | debug log screen | 0 | -1 | 106/203 | 61 | 1328 |  |
| 121 | debug log uploaded | 0 | 0 | 24/31 | 101 | 1404 |  |

## Errors

### 1 open app
```
11-26 22:47:48.802 E/australianrates(10693): Not starting debugger since process cannot load the jdwp agent.
```

### 36 verify Macquarie result
```
11-26 22:54:05.623 E/FrameTracker(10693): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 43 verify fixed was not applied
```
11-26 22:55:08.342 E/FrameTracker(10693): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 start save from rates
```
11-26 22:55:25.819 E/FrameTracker(10693): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 open unsaved rate
```
11-26 22:55:31.803 E/ImeBackDispatcher(10693): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 142861340
```

### 47 save a rate
```
11-26 22:55:42.319 E/FrameTracker(10693): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 49 restart with a saved rate
```
11-26 22:55:56.573 E/australianrates(16032): Not starting debugger since process cannot load the jdwp agent.
11-26 22:56:03.030 E/SurfaceSyncGroup(16032): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-26 22:56:03.030 E/SurfaceSyncGroup(16032): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 60 cold start
```
11-26 22:58:12.061 E/australianrates(17497): Not starting debugger since process cannot load the jdwp agent.
11-26 22:58:16.074 E/SurfaceSyncGroup(17497): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-26 22:58:16.075 E/SurfaceSyncGroup(17497): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 89 cold relaunch
```
11-26 23:02:23.341 E/australianrates(20853): Not starting debugger since process cannot load the jdwp agent.
```

### 93 audit 1 min
```
11-26 23:03:54.968 E/ReactNativeJS(20853): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy5sb1m-1e9dbb3910a7860d","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":9198.4,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":260.5,"liveStage:dates-index:fetched:ms":199.7,"liveStage:revision:verified:ms":56.5,"liveStage:Core asset:downloaded:ms":218.4,"liveStage:Core asset:hash-verified:ms":7.4,"liveStage:Core asset:native-inflated-and-text-decoded:ms":158.3,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":266,"liveStage:core:history-sealed:ms":0,"liveStage:core:normalized:ms":590.9,"liveStage:Details asset:downloaded:ms":1476.4,"liveStage:Details asset:hash-verified:ms":31,"liveStage:…
11-26 23:03:54.970 E/unknown:ReactNative(20853): ?anon_0_@1:3699674
11-26 23:03:54.970 E/unknown:ReactNative(20853): ?anon_0_@1:3705474
11-26 23:03:54.970 E/unknown:ReactNative(20853): SyntheticError@1:163048
11-26 23:03:54.970 E/unknown:ReactNative(20853): Wrapper@1:163563
11-26 23:03:54.970 E/unknown:ReactNative(20853): _callSuper@1:148436
11-26 23:03:54.970 E/unknown:ReactNative(20853): _construct@1:163911
11-26 23:03:54.970 E/unknown:ReactNative(20853): _next@1:594899
```

### 94 audit 2 min
```
11-26 23:05:32.734 E/ReactNativeJS(20853): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy5sb1m-1e9dbb3910a7860d","check":{"id":"journey-lender-warm","label":"Lender details (warm)","kind":"journey","status":"fail","durationMs":2290.5,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1049.3,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"lender","journeyLabel":"Lender details","iteration":"warm","expectedPath":"/bank/Mortgage%20Mart","expectedSurface":"lender.details","navigationKind":"stack","forwardMs":1049.3,"firstReadyFrameObserved":true,"firstReadyFrameMs":300.3920760001056,"backgroundSettleMs":773.3,"destinationReadinessMs":300.4,"backgroundTasks":"Bank response analysis","backMs":35.2,"firstBackMs":35.2,"firstBackDestination":"/performance-audit","originReadinessMs":0.4,"backDestin…
11-26 23:05:32.740 E/unknown:ReactNative(20853): ?anon_0_@1:3699674
11-26 23:05:32.740 E/unknown:ReactNative(20853): ?anon_0_@1:3705474
11-26 23:05:32.740 E/unknown:ReactNative(20853): SyntheticError@1:163048
11-26 23:05:32.740 E/unknown:ReactNative(20853): Wrapper@1:163563
11-26 23:05:32.740 E/unknown:ReactNative(20853): _callSuper@1:148436
11-26 23:05:32.740 E/unknown:ReactNative(20853): _construct@1:163911
11-26 23:05:32.740 E/unknown:ReactNative(20853): _next@1:594899
```

### 95 audit 4 min
```
11-26 23:05:52.639 E/ReactNativeJS(20853): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy5sb1m-1e9dbb3910a7860d","check":{"id":"deep-first-pass.route.rates.search.filters.open","label":"route.rates: search.filters.open (first-pass)","kind":"journey","status":"fail","durationMs":5269.2,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRevisionAfter":4,"renderRevisionBefore":"state-24","renderRevisionAfter":"state-27","actionMs":0.2,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtra…
11-26 23:05:52.641 E/unknown:ReactNative(20853): ?anon_0_@1:3699674
11-26 23:05:52.641 E/unknown:ReactNative(20853): ?anon_0_@1:3705474
11-26 23:05:52.641 E/unknown:ReactNative(20853): SyntheticError@1:163048
11-26 23:05:52.641 E/unknown:ReactNative(20853): Wrapper@1:163563
11-26 23:05:52.641 E/unknown:ReactNative(20853): _callSuper@1:148436
11-26 23:05:52.641 E/unknown:ReactNative(20853): _construct@1:163911
11-26 23:05:52.641 E/unknown:ReactNative(20853): _next@1:594899
```

### 96 audit 5 min
```
11-26 23:07:57.481 E/ReactNativeJS(20853): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy5sb1m-1e9dbb3910a7860d","check":{"id":"deep-first-pass.sample.catalogue.1.product.lender.open","label":"sample.catalogue.1: product.lender.open (first-pass)","kind":"journey","status":"fail","durationMs":2400.7,"metrics":{"journeyId":"sample.catalogue.1.product.lender.open","journeyLabel":"sample.catalogue.1: product.lender.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.1","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/Health%20Professionals%20Bank","expectedPath":"/bank/Health%20Professionals%20Bank","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":6,"actionRevisionAfter":7,"actionResultEvidence":"{\"expectedPath\":\"/bank/Health%20Professionals%20Bank\"}","actionMs":1032.5,"preActionWaitMs":1.5,"preActionQuietWindowReused":true,"preActionQui…
11-26 23:07:57.483 E/unknown:ReactNative(20853): ?anon_0_@1:3699674
11-26 23:07:57.483 E/unknown:ReactNative(20853): ?anon_0_@1:3705474
11-26 23:07:57.483 E/unknown:ReactNative(20853): SyntheticError@1:163048
11-26 23:07:57.483 E/unknown:ReactNative(20853): Wrapper@1:163563
11-26 23:07:57.483 E/unknown:ReactNative(20853): _callSuper@1:148436
11-26 23:07:57.483 E/unknown:ReactNative(20853): _construct@1:163911
11-26 23:07:57.483 E/unknown:ReactNative(20853): _next@1:594899
```

### 97 audit 6 min
```
11-26 23:08:30.290 E/ReactNativeJS(20853): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy5sb1m-1e9dbb3910a7860d","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":1939.5,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-27:02500ce424dd…:state-7","renderRevisionAfter":"2026-11-27:02500ce424dd…:state-8","actionResultEvidence":"{\"applied\":…
11-26 23:08:30.292 E/unknown:ReactNative(20853): ?anon_0_@1:3699674
11-26 23:08:30.292 E/unknown:ReactNative(20853): ?anon_0_@1:3705474
11-26 23:08:30.292 E/unknown:ReactNative(20853): SyntheticError@1:163048
11-26 23:08:30.292 E/unknown:ReactNative(20853): Wrapper@1:163563
11-26 23:08:30.292 E/unknown:ReactNative(20853): _callSuper@1:148436
11-26 23:08:30.292 E/unknown:ReactNative(20853): _construct@1:163911
11-26 23:08:30.292 E/unknown:ReactNative(20853): _next@1:594899
```

### 98 audit 7 min
```
11-26 23:10:13.455 E/ReactNativeJS(20853): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy5sb1m-1e9dbb3910a7860d","check":{"id":"deep-first-pass.redirect.search.redirect.search.verify","label":"redirect.search: redirect.search.verify (first-pass)","kind":"journey","status":"fail","durationMs":3277.9,"metrics":{"journeyId":"redirect.search.redirect.search.verify","journeyLabel":"redirect.search: redirect.search.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.search","semanticActionId":"redirect.search.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":306.2,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":2235.7,"forwardWorkMs":2235.7,"navigationCommitMs":1964.1,"firstReadyFrameMs":2…
11-26 23:10:13.457 E/unknown:ReactNative(20853): ?anon_0_@1:3699674
11-26 23:10:13.457 E/unknown:ReactNative(20853): ?anon_0_@1:3705474
11-26 23:10:13.457 E/unknown:ReactNative(20853): SyntheticError@1:163048
11-26 23:10:13.457 E/unknown:ReactNative(20853): Wrapper@1:163563
11-26 23:10:13.457 E/unknown:ReactNative(20853): _callSuper@1:148436
11-26 23:10:13.457 E/unknown:ReactNative(20853): _construct@1:163911
11-26 23:10:13.457 E/unknown:ReactNative(20853): _next@1:594899
```

### 99 audit 8 min
```
11-26 23:10:58.518 E/ReactNativeJS(20853): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy5sb1m-1e9dbb3910a7860d","check":{"id":"deep-repeat.route.rates.search.filters.open","label":"route.rates: search.filters.open (repeat)","kind":"journey","status":"fail","durationMs":5955,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":26,"actionRevisionAfter":27,"renderRevisionBefore":"state-25","renderRevisionAfter":"state-28","actionMs":0.2,"preActionWaitMs":0.8,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repe…
11-26 23:10:58.519 E/unknown:ReactNative(20853): ?anon_0_@1:3699674
11-26 23:10:58.519 E/unknown:ReactNative(20853): ?anon_0_@1:3705474
11-26 23:10:58.519 E/unknown:ReactNative(20853): SyntheticError@1:163048
11-26 23:10:58.519 E/unknown:ReactNative(20853): Wrapper@1:163563
11-26 23:10:58.519 E/unknown:ReactNative(20853): _callSuper@1:148436
11-26 23:10:58.519 E/unknown:ReactNative(20853): _construct@1:163911
11-26 23:10:58.519 E/unknown:ReactNative(20853): _next@1:594899
```

### 100 audit 9 min
```
11-26 23:11:44.246 E/ReactNativeJS(20853): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy5sb1m-1e9dbb3910a7860d","check":{"id":"deep-repeat.route.rates-sheets.search.section.next","label":"route.rates-sheets: search.section.next (repeat)","kind":"journey","status":"fail","durationMs":1524.3,"metrics":{"journeyId":"route.rates-sheets.search.section.next","journeyLabel":"route.rates-sheets: search.section.next","iteration":"warm","passId":"repeat","scenarioId":"route.rates-sheets","semanticActionId":"search.section.next","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":42,"actionRevisionAfter":43,"renderRevisionBefore":"state-24","renderRevisionAfter":"state-30","actionMs":80.1,"preActionWaitMs":1,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"valida…
11-26 23:11:44.252 E/unknown:ReactNative(20853): ?anon_0_@1:3699674
11-26 23:11:44.252 E/unknown:ReactNative(20853): ?anon_0_@1:3705474
11-26 23:11:44.252 E/unknown:ReactNative(20853): SyntheticError@1:163048
11-26 23:11:44.252 E/unknown:ReactNative(20853): Wrapper@1:163563
11-26 23:11:44.252 E/unknown:ReactNative(20853): _callSuper@1:148436
11-26 23:11:44.252 E/unknown:ReactNative(20853): _construct@1:163911
11-26 23:11:44.252 E/unknown:ReactNative(20853): _next@1:594899
```

### 101 audit 11 min
```
11-26 23:13:49.039 E/ReactNativeJS(20853): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy5sb1m-1e9dbb3910a7860d","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1593.3,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Mortgage%20Mart%7CExpat_Standard_Home_Loan%7CRESIDENTIAL_MORTGAGES%7CExpat%20Standard%20Home%20Loan","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"…
11-26 23:13:49.040 E/unknown:ReactNative(20853): ?anon_0_@1:3699674
11-26 23:13:49.040 E/unknown:ReactNative(20853): ?anon_0_@1:3705474
11-26 23:13:49.040 E/unknown:ReactNative(20853): SyntheticError@1:163048
11-26 23:13:49.040 E/unknown:ReactNative(20853): Wrapper@1:163563
11-26 23:13:49.040 E/unknown:ReactNative(20853): _callSuper@1:148436
11-26 23:13:49.040 E/unknown:ReactNative(20853): _construct@1:163911
11-26 23:13:49.040 E/unknown:ReactNative(20853): _next@1:594899
```

### 102 audit 12 min
```
11-26 23:15:16.448 E/ReactNativeJS(20853): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy5sb1m-1e9dbb3910a7860d","check":{"id":"deep-repeat.route.not-found.not-found.home","label":"route.not-found: not-found.home (repeat)","kind":"journey","status":"fail","durationMs":9985.6,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"warm","passId":"repeat","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":1,"actionRevisionAfter":2,"renderRevisionBefore":"not-found-v1","actionMs":117,"preActionWaitMs":0.6,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours"…
11-26 23:15:16.450 E/unknown:ReactNative(20853): ?anon_0_@1:3699674
11-26 23:15:16.450 E/unknown:ReactNative(20853): ?anon_0_@1:3705474
11-26 23:15:16.450 E/unknown:ReactNative(20853): SyntheticError@1:163048
11-26 23:15:16.450 E/unknown:ReactNative(20853): Wrapper@1:163563
11-26 23:15:16.450 E/unknown:ReactNative(20853): _callSuper@1:148436
11-26 23:15:16.450 E/unknown:ReactNative(20853): _construct@1:163911
11-26 23:15:16.450 E/unknown:ReactNative(20853): _next@1:594899
```

### 103 audit 14 min
```
11-26 23:16:32.195 E/ReactNativeJS(20853): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy5sb1m-1e9dbb3910a7860d","check":{"id":"external-link-379","kind":"network","status":"fail","durationMs":1297.0625410000794,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"pass","browserHandler":"pass","httpReachability":"fail","statusCode":404,"handlerAttempted":true,"httpAttempted":true,"httpSelected":true,"handlerResolution":"pass","host":"www.defencebank.com.au","destinationPath":"/banking/home-loans/essentials-home-loan---ultimate-package-investor-interest-only/"},"error":"HTTP 404: the destination is missing or unavailable.","canonicalMetrics":true}}
11-26 23:16:32.196 E/unknown:ReactNative(20853): ?anon_0_@1:3699674
11-26 23:16:32.196 E/unknown:ReactNative(20853): ?anon_0_@1:3709035
11-26 23:16:32.196 E/unknown:ReactNative(20853): SyntheticError@1:163048
11-26 23:16:32.196 E/unknown:ReactNative(20853): Wrapper@1:163563
11-26 23:16:32.196 E/unknown:ReactNative(20853): _callSuper@1:148436
11-26 23:16:32.196 E/unknown:ReactNative(20853): _construct@1:163911
11-26 23:16:32.196 E/unknown:ReactNative(20853): _next@1:594899
```
