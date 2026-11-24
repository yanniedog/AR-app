# App explorer: 1.0.370 (426)

**Real-use session FAIL vs 1.0.369: 1 broken, 24 friction, 3 slower**

- Broken: 96% dropped frames on "scroll lenders"
- Friction: No reaction for 3.7 s after "scroll rates 1"
- Friction: No reaction for 3.2 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.5 s after "scroll lenders"
- Friction: No reaction for 5.2 s after "switch to savings"
- Friction: No reaction for 3.2 s after "switch to home loans"
- Friction: No reaction for 3.5 s after "open filters"
- Friction: No reaction for 3.0 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.0 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 4.8 s after "open term deposits"
- Friction: No reaction for 3.5 s after "verify term deposit rates"
- Friction: No reaction for 3.1 s after "open savings search"
- Friction: No reaction for 7.5 s after "search Macquarie"
- Friction: No reaction for 3.5 s after "return from savings search"
- Friction: No reaction for 3.9 s after "open mortgage filter draft"
- Friction: No reaction for 3.7 s after "verify fixed was not applied"
- Friction: No reaction for 3.8 s after "open unsaved rate"
- Friction: No reaction for 3.2 s after "verify saved rate after restart"
- Friction: No reaction for 3.4 s after "open product from saved rates"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: No reaction for 6.9 s after "follow browse rates recovery"
- Friction: No reaction for 4.3 s after "select first comparison rate"
- Slower: Dropped frames 52% to 68% on "back to rates"
- Slower: "select first comparison rate" content 2.6 s to 4.3 s
- Slower: "select first comparison rate" reaction 2.6 s to 4.3 s

**Initial Rates readiness:** 42.6 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode full | 112 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 19
Baseline 1.0.369
**Audit live: outcome failed | 976 s | audit log 852673 bytes (audit-log.txt) https://paste.c-net.org/0529a9e5-82fc-0e1d-996c-6e6fb7919c0f | debug log Upload and copy link not found**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2889 | -51474 | 673/905 | 89 | 494 | 3 errors; start 2846ms |
| 2 | scroll rates 1 | 704 | -45 | 34/47 | 89 | 483 | boot js-start 433553, layout-mounted 434097, cache-read 434208, hydrated 434392, splash-hide 434392, manifest 435530, resolved 436222, core-fetched 441408, core-saved 442144, rows-prepared 442779, search-index-idle 442779, leading-requested 442779, details-start 443314, leading-scoped 443775, pricing-ready 446040, last-gate 450442, details-fetched 458118, detail-filters-idle 463215, last-pricing 463215, suitability-built 465241, post-refresh-wait 465416, leading-page 467054, last-rows 475994, rates-ready 476171, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 188, pricing-scope-ms 13723, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 3, filter-rows 38533, filter-yields 7, filter-ms 3975, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 172 |
| 3 | scroll rates 2 | 784 | +32 | 20/33 | 93 | 648 |  |
| 4 | scroll rates back | 689 | -23 |  |  | 573 |  |
| 5 | open product | 5990 | -1692 | 35/55 | 93 | 637 |  |
| 6 | scroll product | 705 | -15 | 34/51 | 93 | 630 |  |
| 7 | back to rates | 28 | -8 | 17/25 | 73 | 635 |  |
| 8 | open lenders | 23 | -2 | 20/24 | 250 | 629 |  |
| 9 | scroll lenders | 773 | +28 | 24/25 | 150 | 627 |  |
| 10 | back from lenders | 22 | +1 | 9/10 | 150 | 627 |  |
| 11 | switch to savings | 21 | -2 | 70/101 | 85 | 641 |  |
| 12 | switch to home loans | 23 | 0 | 16/29 | 65 | 659 |  |
| 13 | open filters | 23 | +2 | 24/28 | 113 | 661 |  |
| 14 | close filters | 21 | 0 | 8/9 | 150 | 650 |  |
| 15 | open market | 24 | +2 | 18/31 | 65 | 657 |  |
| 16 | open rba | 2612 | -22 | 60/71 | 69 | 670 |  |
| 17 | scroll rba | 720 | +28 | 33/54 | 77 | 662 |  |
| 18 | back from rba | 29 | +5 | 9/18 | 61 | 665 |  |
| 19 | scroll market | 702 | -8 | 29/39 | 81 | 665 |  |
| 20 | open saved | 21 | -4 | 19/29 | 89 | 668 |  |
| 21 | return to rates | 22 | 0 | 16/31 | 65 | 670 |  |
| 22 | start category switch | 25 | -13 |  |  | 669 |  |
| 23 | open term deposits | 21 | -1 | 60/84 | 85 | 690 |  |
| 24 | verify term deposit rates | 730 | +7 | 38/51 | 73 | 693 |  |
| 25 | restore home loans | 22 | -4 | 16/29 | 61 | 707 |  |
| 26 | start search from rates | 25 | -3 |  |  | 702 |  |
| 27 | open savings search | 24 | 0 | 21/32 | 61 | 733 |  |
| 28 | search Macquarie | 1900 | -48 | 77/85 | 125 | 754 | 1 errors |
| 29 | verify Macquarie result | 0 | 0 | 15/15 | 16 | 736 |  |
| 30 | clear query and restore results | 27 | +5 | 21/23 | 53 | 742 |  |
| 31 | return from savings search | 21 | -5 | 31/39 | 93 | 765 |  |
| 32 | start filter rollback | 32 | +6 | 14/16 | 16 | 754 |  |
| 33 | open mortgage filter draft | 22 | -1 | 26/30 | 125 | 770 |  |
| 34 | select fixed in draft | 25 | +2 | 12/13 | 109 | 773 |  |
| 35 | discard unsaved filter draft | 21 | -1 | 20/23 | 117 | 775 |  |
| 36 | verify fixed was not applied | 21 | -3 | 26/31 | 150 | 788 | 1 errors |
| 37 | close verified filter draft | 21 | -1 | 19/21 | 113 | 789 |  |
| 38 | start save from rates | 25 | -15 | 16/16 | 19 | 786 | 1 errors |
| 39 | open unsaved rate | 23 | +1 | 136/192 | 81 | 822 | 1 errors |
| 40 | save a rate | 28 | +4 | 9/16 | 61 | 821 | 1 errors |
| 41 | leave saved product | 26 | +3 | 11/21 | 73 | 825 |  |
| 42 | restart with a saved rate | 18088 | -2871 | 197/272 | 93 | 584 | 3 errors; start 6384ms; boot js-start 848101, layout-mounted 848652, hydrated 849581, cache-read 850584, core-ready 851369, rows-prepared 851534, search-index-idle 851534, detail-filters-idle 851534, leading-requested 851534, last-pricing 851534, splash-hide 851536, manifest 854179, leading-scoped 855608, leading-page 855608, resolved 856410, pricing-ready 859213, last-rows 859213, rates-ready 859397, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 25, pricing-scope-ms 4486, filter-runs 1, filter-rows 6861, filter-yields 4, filter-ms 104, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 16 |
| 43 | verify saved rate after restart | 54 | +23 | 24/31 | 89 | 612 |  |
| 44 | open product from saved rates | 32 | -2 | 42/60 | 89 | 509 |  |
| 45 | remove saved rate | 23 | -6 | 12/16 | 65 | 554 |  |
| 46 | leave removed product | 22 | -2 | 8/13 | 81 | 660 |  |
| 47 | follow browse rates recovery | 4441 |  | 12/20 | 81 | 642 |  |
| 48 | start compare from rates | 32 | +4 | 1/2 | 21 | 648 |  |
| 49 | enter selection mode | 28 | +5 | 11/18 | 69 | 708 |  |
| 50 | select first comparison rate | 2210 | +2188 | 9/15 | 61 | 705 |  |
| 51 | select second comparison rate | 23 | -2310 | 9/13 | 57 | 700 |  |
| 52 | open two-rate comparison | 24 | +3 | 19/28 | 150 | 709 |  |
| 53 | return from two-rate comparison | 21 | +1 | 21/27 | 105 | 710 |  |
| 54 | cold start | 10224 |  | 26/33 | 500 | 576 | 3 errors; start 4077ms; boot js-start 977843, layout-mounted 978030, hydrated 978145, cache-read 979354, core-ready 980128, rows-prepared 980260, search-index-idle 980260, detail-filters-idle 980260, leading-requested 980260, last-pricing 980260, splash-hide 980262, manifest 982469, leading-scoped 982909, leading-page 982909, resolved 983519, pricing-ready 984366, last-rows 984366, rates-ready 984553, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 20, pricing-scope-ms 1864, filter-runs 1, filter-rows 6861, filter-yields 4, filter-ms 104, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 17 |
| 55 | /browse | 4578 |  | 2/2 | 32 | 422 |  |
| 56 | /watchlist | 24 |  | 4/4 | 32 | 431 |  |
| 57 | /market | 35 |  | 14/20 | 65 | 508 |  |
| 58 | /tools | 25 |  | 14/23 | 89 | 567 |  |
| 59 | /trends | 28 |  |  |  | 620 |  |
| 60 | /search | 25 |  | 42/58 | 117 | 633 |  |
| 61 | /banks | 29 |  | 29/37 | 109 | 641 |  |
| 62 | /bank-rates | 26 |  | 18/29 | 97 | 655 |  |
| 63 | /categories | 24 |  | 37/48 | 101 | 672 |  |
| 64 | /catalogue | 45 |  | 33/44 | 105 | 686 |  |
| 65 | /compare | 43 |  | 11/14 | 125 | 673 |  |
| 66 | /matches | 25 |  | 34/49 | 89 | 693 |  |
| 67 | /calculator | 24 |  | 11/19 | 93 | 686 |  |
| 68 | /projections | 30 |  | 27/36 | 97 | 679 |  |
| 69 | /profile | 26 |  | 17/24 | 77 | 685 |  |
| 70 | /research | 22 |  | 19/30 | 65 | 693 |  |
| 71 | /rba | 30 |  | 12/21 | 81 | 706 |  |
| 72 | /rba-response | 33 |  | 22/34 | 73 | 707 |  |
| 73 | /settings | 32 |  | 13/22 | 97 | 713 |  |
| 74 | /about | 34 |  | 13/22 | 65 | 713 |  |
| 75 | /terms | 28 |  | 14/26 | 73 | 714 |  |
| 76 | /privacy | 34 |  |  |  | 713 |  |
| 77 | /third-party-notices | 32 |  | 14/26 | 85 | 717 |  |
| 78 | /node | 31 |  | 32/48 | 85 | 741 |  |
| 79 | /passthrough | 35 |  | 33/45 | 93 | 718 |  |
| 80 | /calculation-receipt | 26 |  | 15/23 | 65 | 712 |  |
| 81 | /rate-receipt | 34 |  | 6/8 | 93 | 713 |  |
| 82 | warm resume | 617 |  | 5/5 | 150 | 712 |  |
| 83 | cold relaunch | 10137 |  | 31/41 | 117 | 576 | 1 errors; start 4210ms; boot js-start 1210362, layout-mounted 1210567, hydrated 1210677, cache-read 1211961, core-ready 1212710, rows-prepared 1212855, search-index-idle 1212855, detail-filters-idle 1212855, leading-requested 1212855, last-pricing 1212855, splash-hide 1212856, manifest 1215033, leading-scoped 1215400, leading-page 1215400, resolved 1215882, pricing-ready 1216694, last-rows 1216694, rates-ready 1216878, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 23, pricing-scope-ms 1541, filter-runs 1, filter-rows 6861, filter-yields 4, filter-ms 101, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 15 |
| 84 | about | 29 |  | 12/19 | 250 | 605 |  |
| 85 | audit screen | 21 |  | 115/206 | 61 | 590 |  |
| 86 | audit 0 min | 0 |  | 29/30 | 69 | 779 | 19 errors |
| 87 | audit 1 min | 0 |  | 1063/1211 | 113 | 1003 | 80 errors |
| 88 | audit 3 min | 0 |  | 911/1018 | 117 | 1085 | 80 errors |
| 89 | audit 4 min | 0 |  | 230/273 | 101 | 1136 | 80 errors |
| 90 | audit 6 min | 0 |  | 988/1116 | 113 | 1246 | 80 errors |
| 91 | audit 7 min | 0 |  | 398/439 | 117 | 1181 | 80 errors |
| 92 | audit 8 min | 0 |  | 502/564 | 117 | 1266 | 80 errors |
| 93 | audit 9 min | 0 |  | 464/524 | 101 | 1274 | 80 errors |
| 94 | audit 11 min | 0 |  | 913/1044 | 113 | 1486 | 80 errors |
| 95 | audit 12 min | 0 |  | 273/316 | 105 | 1267 | 80 errors |
| 96 | audit 13 min | 0 |  | 151/169 | 42 | 1279 |  |
| 97 | audit 15 min | 0 |  | 132/151 | 48 | 1308 |  |
| 98 | audit finished | 0 |  | 121/193 | 69 | 1306 |  |
| 99 | audit result 1 | 0 |  |  |  | 1298 |  |
| 100 | audit result 2 | 0 |  |  |  | 1301 |  |
| 101 | audit result 3 | 0 |  |  |  | 1299 |  |
| 102 | audit result 4 | 0 |  |  |  | 1302 |  |
| 103 | audit result 5 | 0 |  |  |  | 1300 |  |
| 104 | audit result 6 | 0 |  |  |  | 1300 |  |
| 105 | audit result 7 | 0 |  |  |  | 1302 |  |
| 106 | audit result 8 | 0 |  |  |  | 1300 |  |
| 107 | audit result 9 | 0 |  |  |  | 1303 |  |
| 108 | audit result 10 | 0 |  |  |  | 1301 |  |
| 109 | audit result 11 | 0 |  |  |  | 1302 |  |
| 110 | audit result 12 | 0 |  |  |  | 1304 |  |
| 111 | about for debug log | 3273 |  | 21/34 | 69 | 1337 |  |
| 112 | debug log screen | 0 |  | 103/203 | 65 | 1350 |  |

## Fatal lines
```
1 W/ReactNativeJS(10422): [AR warn] degrade: store.ensureFailed fn=ensureDetails error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
1 W/ReactNativeJS(10422): [AR warn] store: ensureDetails failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
```

## Errors

### 1 open app
```
11-24 04:50:59.099 E/australianrates(10422): Not starting debugger since process cannot load the jdwp agent.
11-24 04:51:17.559 W/ReactNativeJS(10422): [AR warn] degrade: store.ensureFailed fn=ensureDetails error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
11-24 04:51:17.559 W/ReactNativeJS(10422): [AR warn] store: ensureDetails failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
```

### 28 search Macquarie
```
11-24 04:56:00.124 E/FrameTracker(10422): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 36 verify fixed was not applied
```
11-24 04:57:04.028 E/FrameTracker(10422): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 38 start save from rates
```
11-24 04:57:21.583 E/FrameTracker(10422): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 39 open unsaved rate
```
11-24 04:57:27.566 E/ImeBackDispatcher(10422): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 186359853
```

### 40 save a rate
```
11-24 04:57:38.029 E/FrameTracker(10422): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 42 restart with a saved rate
```
11-24 04:57:53.486 E/australianrates(14689): Not starting debugger since process cannot load the jdwp agent.
11-24 04:57:59.773 E/SurfaceSyncGroup(14689): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-24 04:57:59.773 E/SurfaceSyncGroup(14689): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 54 cold start
```
11-24 05:00:04.567 E/australianrates(16239): Not starting debugger since process cannot load the jdwp agent.
11-24 05:00:08.500 E/SurfaceSyncGroup(16239): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-24 05:00:08.500 E/SurfaceSyncGroup(16239): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 83 cold relaunch
```
11-24 05:03:57.202 E/australianrates(19235): Not starting debugger since process cannot load the jdwp agent.
```

### 86 audit 0 min
```
11-24 05:05:06.669 E/ReactNativeJS(19235): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu8dinc-d8c0bc204096fbb3","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":5248.3,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":167.9,"liveStage:dates-index:fetched:ms":167.4,"liveStage:revision:verified:ms":77.2,"liveStage:Core asset:downloaded:ms":277,"liveStage:Core asset:hash-verified:ms":11.2,"liveStage:Core asset:native-inflated-and-text-decoded:ms":164.8,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":272.3,"liveStage:core:history-sealed:ms":0,"liveStage:core:normalized:ms":622.5,"liveStage:Details asset:downloaded:ms":1335.3,"liveStage:Details asset:hash-verified:ms":31.7,"liveStage…
11-24 05:05:06.670 E/unknown:ReactNative(19235): ?anon_0_@1:3694919
11-24 05:05:06.670 E/unknown:ReactNative(19235): ?anon_0_@1:3700719
11-24 05:05:06.670 E/unknown:ReactNative(19235): SyntheticError@1:163016
11-24 05:05:06.670 E/unknown:ReactNative(19235): Wrapper@1:163531
11-24 05:05:06.670 E/unknown:ReactNative(19235): _callSuper@1:148404
11-24 05:05:06.670 E/unknown:ReactNative(19235): _construct@1:163879
11-24 05:05:06.670 E/unknown:ReactNative(19235): _next@1:594867
```

### 87 audit 1 min
```
11-24 05:05:19.175 E/ReactNativeJS(19235): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu8dinc-d8c0bc204096fbb3","check":{"id":"journey-rates-cold","label":"Rates (cold)","kind":"journey","status":"fail","durationMs":10237.7,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":9431.1,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates","journeyLabel":"Rates","iteration":"cold","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":9431.1,"firstReadyFrameObserved":true,"firstReadyFrameMs":9203.623327000067,"backgroundSettleMs":593.9,"destinationReadinessMs":9203.6,"backgroundTasks":"Product details, Search index availability","backMs":32.8,"firstBackMs":32.8,"firstBackDestination":"/performance-audit","or…
11-24 05:05:19.187 E/unknown:ReactNative(19235): ?anon_0_@1:3694919
11-24 05:05:19.187 E/unknown:ReactNative(19235): ?anon_0_@1:3700719
11-24 05:05:19.187 E/unknown:ReactNative(19235): SyntheticError@1:163016
11-24 05:05:19.187 E/unknown:ReactNative(19235): Wrapper@1:163531
11-24 05:05:19.187 E/unknown:ReactNative(19235): _callSuper@1:148404
11-24 05:05:19.187 E/unknown:ReactNative(19235): _construct@1:163879
11-24 05:05:19.187 E/unknown:ReactNative(19235): _next@1:594867
```

### 88 audit 3 min
```
11-24 05:06:56.276 E/ReactNativeJS(19235): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu8dinc-d8c0bc204096fbb3","check":{"id":"deep-first-pass.route.rates.search.sort.next","label":"route.rates: search.sort.next (first-pass)","kind":"journey","status":"fail","durationMs":1672.6,"metrics":{"journeyId":"route.rates.search.sort.next","journeyLabel":"route.rates: search.sort.next","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.sort.next","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":2,"actionRevisionAfter":3,"renderRevisionBefore":"state-17","renderRevisionAfter":"state-23","actionMs":101.9,"preActionWaitMs":1,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeate…
11-24 05:06:56.277 E/unknown:ReactNative(19235): ?anon_0_@1:3694919
11-24 05:06:56.277 E/unknown:ReactNative(19235): ?anon_0_@1:3700719
11-24 05:06:56.277 E/unknown:ReactNative(19235): SyntheticError@1:163016
11-24 05:06:56.277 E/unknown:ReactNative(19235): Wrapper@1:163531
11-24 05:06:56.277 E/unknown:ReactNative(19235): _callSuper@1:148404
11-24 05:06:56.277 E/unknown:ReactNative(19235): _construct@1:163879
11-24 05:06:56.277 E/unknown:ReactNative(19235): _next@1:594867
```

### 89 audit 4 min
```
11-24 05:08:36.714 E/ReactNativeJS(19235): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu8dinc-d8c0bc204096fbb3","check":{"id":"deep-first-pass.sample.catalogue.3.product.open","label":"sample.catalogue.3: product.open (first-pass)","kind":"journey","status":"fail","durationMs":2186.3,"metrics":{"journeyId":"sample.catalogue.3.product.open","journeyLabel":"sample.catalogue.3: product.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.3","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Police%20Bank%7Cba32620e-c1d1-4e90-ad0d-ec03d4d06a85%7CTRANS_AND_SAVINGS_ACCOUNTS%7CU30%20SUPER%20CHARGE%20Account","expectedPath":"/product/Police%20Bank%7Cba32620e-c1d1-4e90-ad0d-ec03d4d06a85%7CTRANS_AND_SAVINGS_ACCOUNTS%7CU30%20SUPER%20CHARGE%20Account","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":781.4,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"r…
11-24 05:08:36.716 E/unknown:ReactNative(19235): ?anon_0_@1:3694919
11-24 05:08:36.716 E/unknown:ReactNative(19235): ?anon_0_@1:3700719
11-24 05:08:36.716 E/unknown:ReactNative(19235): SyntheticError@1:163016
11-24 05:08:36.716 E/unknown:ReactNative(19235): Wrapper@1:163531
11-24 05:08:36.716 E/unknown:ReactNative(19235): _callSuper@1:148404
11-24 05:08:36.716 E/unknown:ReactNative(19235): _construct@1:163879
11-24 05:08:36.716 E/unknown:ReactNative(19235): _next@1:594867
```

### 90 audit 6 min
```
11-24 05:09:03.274 E/ReactNativeJS(19235): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu8dinc-d8c0bc204096fbb3","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":2116.7,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-24:b2751ce01c21…:state-8","renderRevisionAfter":"2026-11-24:b2751ce01c21…:state-9","actionResultEvidence":"{\"applied\":…
11-24 05:09:03.275 E/unknown:ReactNative(19235): ?anon_0_@1:3694919
11-24 05:09:03.275 E/unknown:ReactNative(19235): ?anon_0_@1:3700719
11-24 05:09:03.275 E/unknown:ReactNative(19235): SyntheticError@1:163016
11-24 05:09:03.275 E/unknown:ReactNative(19235): Wrapper@1:163531
11-24 05:09:03.275 E/unknown:ReactNative(19235): _callSuper@1:148404
11-24 05:09:03.275 E/unknown:ReactNative(19235): _construct@1:163879
11-24 05:09:03.275 E/unknown:ReactNative(19235): _next@1:594867
```

### 91 audit 7 min
```
11-24 05:10:59.854 E/ReactNativeJS(19235): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu8dinc-d8c0bc204096fbb3","check":{"id":"deep-first-pass.redirect.changes.redirect.changes.verify","label":"redirect.changes: redirect.changes.verify (first-pass)","kind":"journey","status":"fail","durationMs":1408.8,"metrics":{"journeyId":"redirect.changes.redirect.changes.verify","journeyLabel":"redirect.changes: redirect.changes.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.changes","semanticActionId":"redirect.changes.verify","depth":1,"plannedExpectedPath":"/market","expectedPath":"/market","expectedSurface":"market.overview","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":52,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":693.2,"forwardWorkMs":693.2,"navigationCommitMs":328.1,"firstReadyFram…
11-24 05:10:59.857 E/unknown:ReactNative(19235): ?anon_0_@1:3694919
11-24 05:10:59.857 E/unknown:ReactNative(19235): ?anon_0_@1:3700719
11-24 05:10:59.857 E/unknown:ReactNative(19235): SyntheticError@1:163016
11-24 05:10:59.857 E/unknown:ReactNative(19235): Wrapper@1:163531
11-24 05:10:59.857 E/unknown:ReactNative(19235): _callSuper@1:148404
11-24 05:10:59.857 E/unknown:ReactNative(19235): _construct@1:163879
11-24 05:10:59.857 E/unknown:ReactNative(19235): _next@1:594867
```

### 92 audit 8 min
```
11-24 05:12:06.065 E/ReactNativeJS(19235): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu8dinc-d8c0bc204096fbb3","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.mortgage.scope.apply.1","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.1 (repeat)","kind":"journey","status":"fail","durationMs":9512,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.1","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.1","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.1","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":42,"actionRevisionAfter":43,"renderRevisionBefore":"state-14","renderRevisionAfter":"state-20","actionMs":134.8,"preActionWaitMs":1,"preActionQuietWindowReused":true,"preActionQuie…
11-24 05:12:06.067 E/unknown:ReactNative(19235): ?anon_0_@1:3694919
11-24 05:12:06.067 E/unknown:ReactNative(19235): ?anon_0_@1:3700719
11-24 05:12:06.067 E/unknown:ReactNative(19235): SyntheticError@1:163016
11-24 05:12:06.067 E/unknown:ReactNative(19235): Wrapper@1:163531
11-24 05:12:06.067 E/unknown:ReactNative(19235): _callSuper@1:148404
11-24 05:12:06.067 E/unknown:ReactNative(19235): _construct@1:163879
11-24 05:12:06.067 E/unknown:ReactNative(19235): _next@1:594867
```

### 93 audit 9 min
```
11-24 05:13:01.239 E/ReactNativeJS(19235): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu8dinc-d8c0bc204096fbb3","check":{"id":"deep-repeat.sample.catalogue.0.product.open","label":"sample.catalogue.0: product.open (repeat)","kind":"journey","status":"fail","durationMs":1838.4,"metrics":{"journeyId":"sample.catalogue.0.product.open","journeyLabel":"sample.catalogue.0: product.open","iteration":"warm","passId":"repeat","scenarioId":"sample.catalogue.0","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Macquarie%20Bank%20Limited%7CTD001MBLTDA002%7CTERM_DEPOSITS%7CMacquarie%20Digital%20Term%20Deposit","expectedPath":"/product/Macquarie%20Bank%20Limited%7CTD001MBLTDA002%7CTERM_DEPOSITS%7CMacquarie%20Digital%20Term%20Deposit","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":594.4,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks…
11-24 05:13:01.242 E/unknown:ReactNative(19235): ?anon_0_@1:3694919
11-24 05:13:01.242 E/unknown:ReactNative(19235): ?anon_0_@1:3700719
11-24 05:13:01.242 E/unknown:ReactNative(19235): SyntheticError@1:163016
11-24 05:13:01.242 E/unknown:ReactNative(19235): Wrapper@1:163531
11-24 05:13:01.242 E/unknown:ReactNative(19235): _callSuper@1:148404
11-24 05:13:01.242 E/unknown:ReactNative(19235): _construct@1:163879
11-24 05:13:01.242 E/unknown:ReactNative(19235): _next@1:594867
```

### 94 audit 11 min
```
11-24 05:14:07.444 E/ReactNativeJS(19235): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu8dinc-d8c0bc204096fbb3","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1572.9,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Macquarie%20Bank%20Limited%7CTD001MBLTDA002%7CTERM_DEPOSITS%7CMacquarie%20Digital%20Term%20Deposit","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"r…
11-24 05:14:07.445 E/unknown:ReactNative(19235): ?anon_0_@1:3694919
11-24 05:14:07.445 E/unknown:ReactNative(19235): ?anon_0_@1:3700719
11-24 05:14:07.445 E/unknown:ReactNative(19235): SyntheticError@1:163016
11-24 05:14:07.445 E/unknown:ReactNative(19235): Wrapper@1:163531
11-24 05:14:07.445 E/unknown:ReactNative(19235): _callSuper@1:148404
11-24 05:14:07.445 E/unknown:ReactNative(19235): _construct@1:163879
11-24 05:14:07.445 E/unknown:ReactNative(19235): _next@1:594867
```

### 95 audit 12 min
```
11-24 05:15:54.753 E/ReactNativeJS(19235): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu8dinc-d8c0bc204096fbb3","check":{"id":"deep-repeat.redirect.changes.redirect.changes.verify","label":"redirect.changes: redirect.changes.verify (repeat)","kind":"journey","status":"fail","durationMs":1390.9,"metrics":{"journeyId":"redirect.changes.redirect.changes.verify","journeyLabel":"redirect.changes: redirect.changes.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.changes","semanticActionId":"redirect.changes.verify","depth":1,"plannedExpectedPath":"/market","expectedPath":"/market","expectedSurface":"market.overview","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":34.1,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":687.1,"forwardWorkMs":687.1,"navigationCommitMs":321.5,"firstReadyFrameMs":365.6…
11-24 05:15:54.754 E/unknown:ReactNative(19235): ?anon_0_@1:3694919
11-24 05:15:54.754 E/unknown:ReactNative(19235): ?anon_0_@1:3700719
11-24 05:15:54.754 E/unknown:ReactNative(19235): SyntheticError@1:163016
11-24 05:15:54.754 E/unknown:ReactNative(19235): Wrapper@1:163531
11-24 05:15:54.754 E/unknown:ReactNative(19235): _callSuper@1:148404
11-24 05:15:54.754 E/unknown:ReactNative(19235): _construct@1:163879
11-24 05:15:54.754 E/unknown:ReactNative(19235): _next@1:594867
```
