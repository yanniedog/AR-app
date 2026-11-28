# App explorer: 1.0.394 (450)

**Real-use session FAIL vs 1.0.393: 1 broken, 26 friction, 9 slower**

- Broken: "leave removed product" failed: Back destination was not observed
- Friction: No reaction for 4.1 s after "scroll rates 1"
- Friction: No reaction for 3.4 s after "scroll rates 2"
- Friction: No reaction for 4.0 s after "open product"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 4.9 s after "expand visible fees"
- Friction: No reaction for 3.2 s after "scroll product sources"
- Friction: No reaction for 3.1 s after "open lenders"
- Friction: No reaction for 5.4 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.0 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 3.3 s after "return to rates"
- Friction: No reaction for 5.3 s after "open term deposits"
- Friction: No reaction for 4.1 s after "verify term deposit rates"
- Friction: No reaction for 8.2 s after "search Macquarie"
- Friction: No reaction for 3.4 s after "return from savings search"
- Friction: No reaction for 3.8 s after "open mortgage filter draft"
- Friction: No reaction for 3.0 s after "select fixed in draft"
- Friction: No reaction for 3.8 s after "verify fixed was not applied"
- Friction: No reaction for 3.7 s after "open unsaved rate"
- Friction: No reaction for 3.5 s after "open product from saved rates"
- Friction: No reaction for 15.9 s after "leave removed product"
- Friction: "No saved rates" shown on "start compare from rates"
- Friction: No reaction for 3.2 s after "open two-rate comparison"
- Slower: Dropped frames 62% to 83% on "scroll rates 2"
- Slower: "open product" reaction 2.6 s to 4.0 s
- Slower: "expand visible fees" content 2.4 s to 4.9 s
- Slower: "expand visible fees" reaction 2.4 s to 4.9 s
- Slower: Dropped frames 46% to 83% on "scroll product fees"
- Slower: Dropped frames 67% to 83% on "scroll product eligibility"
- Slower: Dropped frames 68% to 90% on "clear query and restore results"
- Slower: Dropped frames 70% to 87% on "discard unsaved filter draft"
- Slower: "leave removed product" content 11.4 s to 20.2 s

**Initial Rates readiness:** no complete boot trace captured

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 8 passed, 1 failed, 1 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-28

Mode full | 120 steps | crashes 0 | step failures 1 | settle timeouts 1 | steps with JS/native errors 16
Baseline 1.0.393
**Audit live: outcome failed | 994 s | audit log 857361 bytes (audit-log.txt) https://paste.c-net.org/b2d8b7c9-9537-c02b-70c7-aca2ccc51055 | debug log 5694074 bytes read from host https://paste.c-net.org/6a65d08f-641e-5185-2256-f966d0056ef6**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3279 | +365 | 859/1066 | 101 | 486 | 33 errors; start 3167ms; boot js-start 480442, layout-mounted 480865, cache-read 480981, hydrated 481232, splash-hide 481232, load-failed 484284 |
| 2 | scroll rates 1 | 707 | -29 | 43/53 | 89 | 593 |  |
| 3 | scroll rates 2 | 731 | +10 | 25/30 | 109 | 678 |  |
| 4 | scroll rates back | 699 | +14 |  |  | 539 |  |
| 5 | open product | 28 | 0 | 39/51 | 113 | 624 |  |
| 6 | scroll product | 709 | -4 | 30/49 | 93 | 672 |  |
| 7 | expand visible fees | 2392 | +2366 | 9/11 | 81 | 665 |  |
| 8 | expand product facts | 0 | -26 | 259/335 | 93 | 653 |  |
| 9 | scroll product fees | 741 | +30 | 24/29 | 89 | 635 |  |
| 10 | scroll product eligibility | 728 | +37 | 24/29 | 93 | 635 |  |
| 11 | expand eligibility | 0 | -24 | 202/262 | 93 | 649 |  |
| 12 | expand constraints | 26 | +1 | 11/14 | 85 | 640 |  |
| 13 | scroll product sources | 751 | +28 | 22/31 | 101 | 642 |  |
| 14 | back to rates | 35 | +7 | 16/23 | 65 | 639 |  |
| 15 | open lenders | 27 | -5 | 20/23 | 250 | 647 |  |
| 16 | scroll lenders | 761 | -1 | 21/21 | 133 | 644 |  |
| 17 | back from lenders | 27 | -3 | 7/8 | 200 | 646 |  |
| 18 | switch to savings | 27 | -2 | 74/96 | 93 | 655 |  |
| 19 | switch to home loans | 28 | -2 | 16/26 | 69 | 668 |  |
| 20 | open filters | 28 | +2 | 21/24 | 150 | 667 |  |
| 21 | close filters | 27 | +1 | 7/9 | 200 | 666 |  |
| 22 | open market | 25 | 0 | 20/30 | 77 | 666 |  |
| 23 | open rba | 2776 | +73 | 82/95 | 69 | 683 |  |
| 24 | scroll rba | 691 | -31 | 33/49 | 81 | 675 |  |
| 25 | back from rba | 32 | +1 | 12/17 | 69 | 675 |  |
| 26 | scroll market | 687 | -100 | 16/23 | 61 | 675 |  |
| 27 | open saved | 28 | +4 | 13/21 | 101 | 678 |  |
| 28 | return to rates | 28 | +1 | 27/45 | 77 | 681 |  |
| 29 | start category switch | 33 | -5 |  |  | 680 |  |
| 30 | open term deposits | 26 | -6 | 77/90 | 101 | 701 |  |
| 31 | verify term deposit rates | 726 | -35 | 38/58 | 85 | 704 |  |
| 32 | restore home loans | 27 | 0 | 14/22 | 65 | 718 |  |
| 33 | start search from rates | 31 | 0 |  |  | 708 |  |
| 34 | open savings search | 27 | +1 | 17/25 | 89 | 721 |  |
| 35 | search Macquarie | 2332 | -725 | 74/83 | 150 | 724 | 1 errors |
| 36 | verify Macquarie result | 0 | -1 | 11/16 | 16 | 715 |  |
| 37 | clear query and restore results | 55 | +28 | 19/21 | 46 | 728 |  |
| 38 | return from savings search | 50 | +25 | 34/42 | 93 | 751 |  |
| 39 | start filter rollback | 33 | -1 | 12/16 | 34 | 746 |  |
| 40 | open mortgage filter draft | 26 | +1 | 25/27 | 200 | 759 |  |
| 41 | select fixed in draft | 28 | +2 | 13/14 | 129 | 750 |  |
| 42 | discard unsaved filter draft | 26 | +1 | 20/23 | 125 | 753 |  |
| 43 | verify fixed was not applied | 27 | -1 | 25/27 | 150 | 764 |  |
| 44 | close verified filter draft | 27 | +4 | 21/23 | 121 | 764 |  |
| 45 | start save from rates | 39 | +9 | 12/16 | 16 | 761 | 1 errors |
| 46 | open unsaved rate | 27 | +1 | 120/158 | 89 | 832 | 1 errors |
| 47 | save a rate | 28 | +3 | 10/16 | 57 | 797 | 1 errors |
| 48 | leave saved product | 27 | -5 | 16/21 | 77 | 801 |  |
| 49 | restart with a saved rate | 19842 | +4696 | 191/249 | 97 | 685 | 3 errors; start 6985ms; boot js-start 1059707, layout-mounted 1060441, hydrated 1061146, cache-read 1062187, core-ready 1062921, rows-prepared 1063182, search-index-idle 1063182, detail-filters-idle 1063182, leading-requested 1063182, last-pricing 1063182, splash-hide 1063184, manifest 1065340, leading-scoped 1066692, leading-page 1066692, resolved 1067382, pricing-ready 1070512, last-rows 1070512, rates-ready 1070679, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 23, pricing-scope-ms 4513, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 96, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 13 |
| 50 | verify saved rate after restart | 29 | +3 | 22/30 | 117 | 630 |  |
| 51 | open product from saved rates | 35 | +5 | 39/57 | 101 | 506 |  |
| 52 | remove saved rate | 35 | +6 | 12/17 | 69 | 549 |  |
| 53 | leave removed product | 20152 | +8747 | 5/8 | 85 | 712 | no settle; Back destination was not observed |
| 54 | start compare from rates | 37 | -2274 |  |  | 724 |  |
| 55 | enter selection mode | 5000 | +4973 | 22/33 | 81 | 731 |  |
| 56 | select first comparison rate | 33 | +7 | 11/15 | 57 | 733 |  |
| 57 | select second comparison rate | 29 | +1 | 7/13 | 69 | 727 |  |
| 58 | open two-rate comparison | 27 | +1 | 21/28 | 150 | 740 |  |
| 59 | return from two-rate comparison | 26 | +2 | 19/27 | 150 | 738 |  |
| 60 | cold start | 13890 | +3906 | 44/51 | 150 | 605 | 17 errors; start 3989ms; boot js-start 1198095, layout-mounted 1198300, hydrated 1198429, cache-read 1199734, core-ready 1200406, rows-prepared 1200559, search-index-idle 1200559, detail-filters-idle 1200559, leading-requested 1200559, last-pricing 1200559, splash-hide 1200561, leading-scoped 1203182, leading-page 1203182, pricing-ready 1203821, last-rows 1203821, rates-ready 1204035, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 13, pricing-scope-ms 1029, filter-runs 1, filter-rows 6944, filter-yields 5, filter-ms 122, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 14 |
| 61 | /browse | 36 | -2276 | 2/2 | 48 | 430 |  |
| 62 | /watchlist | 34 | +3 | 5/5 | 48 | 490 |  |
| 63 | /market | 34 | +3 | 16/22 | 77 | 563 |  |
| 64 | /tools | 36 | +3 |  |  | 613 |  |
| 65 | /trends | 2325 | +14 | 22/35 | 89 | 631 |  |
| 66 | /search | 29 | -2 | 28/35 | 117 | 655 |  |
| 67 | /banks | 33 | +5 | 36/40 | 150 | 669 |  |
| 68 | /bank-rates | 35 | +5 | 20/27 | 89 | 673 |  |
| 69 | /categories | 30 | +4 | 32/44 | 97 | 700 |  |
| 70 | /catalogue | 40 | +6 | 31/41 | 117 | 719 |  |
| 71 | /compare | 38 | +3 | 12/14 | 129 | 727 |  |
| 72 | /matches | 30 | +2 | 31/43 | 101 | 716 |  |
| 73 | /calculator | 31 | -1 | 14/22 | 89 | 710 |  |
| 74 | /projections | 30 | -5 | 23/31 | 129 | 712 |  |
| 75 | /profile | 33 | +4 | 18/23 | 97 | 713 |  |
| 76 | /research | 36 | +9 | 20/27 | 105 | 721 |  |
| 77 | /rba | 30 | -2 | 14/21 | 85 | 734 |  |
| 78 | /rba-response | 33 | +1 | 22/32 | 65 | 735 |  |
| 79 | /settings | 36 | +7 | 14/22 | 101 | 741 |  |
| 80 | /about | 36 | 0 | 14/21 | 89 | 741 |  |
| 81 | /terms | 40 | +10 | 18/24 | 81 | 743 |  |
| 82 | /privacy | 35 | +3 |  |  | 742 |  |
| 83 | /third-party-notices | 36 | +3 | 16/21 | 85 | 747 |  |
| 84 | /node | 35 | +2 | 36/45 | 101 | 782 |  |
| 85 | /passthrough | 30 | -6 | 34/41 | 93 | 747 |  |
| 86 | /calculation-receipt | 36 | +8 | 17/23 | 97 | 741 |  |
| 87 | /rate-receipt | 36 | +5 | 7/9 | 73 | 742 |  |
| 88 | warm resume | 920 | +50 | 4/5 | 93 | 740 |  |
| 89 | cold relaunch | 10554 | +189 | 33/39 | 117 | 586 | 1 errors; start 4548ms; boot js-start 1441868, layout-mounted 1442064, hydrated 1442161, cache-read 1443550, core-ready 1444238, rows-prepared 1444418, search-index-idle 1444418, detail-filters-idle 1444418, leading-requested 1444418, last-pricing 1444418, splash-hide 1444419, manifest 1446604, leading-scoped 1447032, leading-page 1447032, resolved 1447489, pricing-ready 1448360, last-rows 1448360, rates-ready 1448526, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 23, pricing-scope-ms 1646, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 91, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 14 |
| 90 | about | 31 | -33 | 12/19 | 300 | 414 |  |
| 91 | audit screen | 26 | +1 | 143/214 | 77 | 617 |  |
| 92 | audit 0 min | 0 | 0 | 26/29 | 97 | 860 |  |
| 93 | audit 2 min | 0 |  | 1176/1305 | 125 | 1141 | 80 errors |
| 94 | audit 3 min | 0 | 0 | 917/1013 | 125 | 1145 | 80 errors |
| 95 | audit 4 min | 0 | 0 | 125/136 | 117 | 1190 | 76 errors |
| 96 | audit 5 min | 0 | 0 | 887/1011 | 125 | 1230 | 80 errors |
| 97 | audit 7 min | 0 | 0 | 418/460 | 129 | 1170 | 80 errors |
| 98 | audit 8 min | 0 | 0 | 974/1093 | 117 | 1406 | 80 errors |
| 99 | audit 9 min | 0 |  | 39/44 | 53 | 1222 |  |
| 100 | audit 11 min | 0 |  | 1102/1244 | 129 | 1243 | 80 errors |
| 101 | audit 12 min | 0 | 0 | 122/139 | 44 | 1257 | 19 errors |
| 102 | audit 14 min | 0 | 0 | 122/141 | 42 | 1266 |  |
| 103 | audit 15 min | 0 | 0 | 122/140 | 65 | 1290 |  |
| 104 | audit 16 min | 0 |  | 21/23 | 89 | 1302 |  |
| 105 | audit finished | 0 | 0 | 88/130 | 73 | 1273 |  |
| 106 | audit result 1 | 0 | 0 |  |  | 1271 |  |
| 107 | audit result 2 | 0 | 0 |  |  | 1269 |  |
| 108 | audit result 3 | 0 | 0 |  |  | 1269 |  |
| 109 | audit result 4 | 0 | 0 |  |  | 1271 |  |
| 110 | audit result 5 | 0 | 0 |  |  | 1270 |  |
| 111 | audit result 6 | 0 | 0 |  |  | 1269 |  |
| 112 | audit result 7 | 0 | 0 |  |  | 1272 |  |
| 113 | audit result 8 | 0 | 0 |  |  | 1270 |  |
| 114 | audit result 9 | 0 | 0 |  |  | 1273 |  |
| 115 | audit result 10 | 0 | 0 |  |  | 1273 |  |
| 116 | audit result 11 | 0 | 0 |  |  | 1272 |  |
| 117 | audit result 12 | 0 | 0 |  |  | 1274 |  |
| 118 | about for debug log | 3354 | +166 | 25/32 | 77 | 1312 |  |
| 119 | debug log screen | 0 | -1 | 123/193 | 73 | 1312 |  |
| 120 | debug log uploaded | 0 | 0 | 25/30 | 150 | 1450 |  |

## Errors

### 1 open app
```
11-28 12:08:15.785 E/australianrates(11071): Not starting debugger since process cannot load the jdwp agent.
11-28 12:08:19.538 W/ReactNativeJS(11071): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-28 12:08:20.107 W/ReactNativeJS(11071): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-28 12:08:21.419 W/ReactNativeJS(11071): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-28 12:08:21.420 E/ReactNativeJS(11071): [AR error] store: refresh failed: asset HTTP 502
11-28 12:08:21.423 E/unknown:ReactNative(11071): ?anon_0_@1:2035305
11-28 12:08:21.423 E/unknown:ReactNative(11071): SyntheticError@1:163172
11-28 12:08:21.423 E/unknown:ReactNative(11071): Wrapper@1:163687
```

### 35 search Macquarie
```
11-28 12:15:56.230 E/FrameTracker(11071): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 start save from rates
```
11-28 12:17:21.394 E/FrameTracker(11071): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 open unsaved rate
```
11-28 12:17:28.064 E/ImeBackDispatcher(11071): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 203823111
```

### 47 save a rate
```
11-28 12:17:38.513 E/FrameTracker(11071): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 49 restart with a saved rate
```
11-28 12:17:54.790 E/australianrates(16951): Not starting debugger since process cannot load the jdwp agent.
11-28 12:18:01.512 E/SurfaceSyncGroup(16951): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-28 12:18:01.512 E/SurfaceSyncGroup(16951): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 60 cold start
```
11-28 12:20:14.813 E/australianrates(18509): Not starting debugger since process cannot load the jdwp agent.
11-28 12:20:19.965 W/ReactNativeJS(18509): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-28 12:20:20.830 W/ReactNativeJS(18509): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-28 12:20:22.106 E/ReactNativeJS(18509): [AR error] store: refresh failed: asset HTTP 502
11-28 12:20:22.106 W/ReactNativeJS(18509): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-28 12:20:22.125 E/unknown:ReactNative(18509): ?anon_0_@1:2035305
11-28 12:20:22.125 E/unknown:ReactNative(18509): SyntheticError@1:163172
11-28 12:20:22.125 E/unknown:ReactNative(18509): Wrapper@1:163687
```

### 89 cold relaunch
```
11-28 12:24:18.551 E/australianrates(21603): Not starting debugger since process cannot load the jdwp agent.
```

### 93 audit 2 min
```
11-28 12:25:36.577 E/ReactNativeJS(21603): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0dvbzm-82cf9f283ff3ce4f","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":8898.4,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":249.2,"liveStage:dates-index:fetched:ms":183.6,"liveStage:revision:verified:ms":38.7,"liveStage:Core asset:downloaded:ms":216,"liveStage:Core asset:hash-verified:ms":21.8,"liveStage:Core asset:native-inflated-and-text-decoded:ms":216,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0.1,"liveStage:Core asset:decoded:ms":236.7,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":667.5,"liveStage:Details asset:downloaded:ms":1026.1,"liveStage:Details asset:hash-verified:ms":35.1,"liveS…
11-28 12:25:36.579 E/unknown:ReactNative(21603): ?anon_0_@1:3707775
11-28 12:25:36.579 E/unknown:ReactNative(21603): ?anon_0_@1:3713575
11-28 12:25:36.579 E/unknown:ReactNative(21603): SyntheticError@1:163172
11-28 12:25:36.579 E/unknown:ReactNative(21603): Wrapper@1:163687
11-28 12:25:36.579 E/unknown:ReactNative(21603): _callSuper@1:148560
11-28 12:25:36.579 E/unknown:ReactNative(21603): _construct@1:164035
11-28 12:25:36.579 E/unknown:ReactNative(21603): _next@1:595023
```

### 94 audit 3 min
```
11-28 12:27:51.326 E/ReactNativeJS(21603): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0dvbzm-82cf9f283ff3ce4f","check":{"id":"deep-first-pass.route.rates-sheets.search.section.next","label":"route.rates-sheets: search.section.next (first-pass)","kind":"journey","status":"fail","durationMs":1300.7,"metrics":{"journeyId":"route.rates-sheets.search.section.next","journeyLabel":"route.rates-sheets: search.section.next","iteration":"cold","passId":"first-pass","scenarioId":"route.rates-sheets","semanticActionId":"search.section.next","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":18,"actionRevisionAfter":19,"renderRevisionBefore":"state-25","renderRevisionAfter":"state-28","actionMs":439.9,"preActionWaitMs":1.1,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"ret…
11-28 12:27:51.328 E/unknown:ReactNative(21603): ?anon_0_@1:3707775
11-28 12:27:51.328 E/unknown:ReactNative(21603): ?anon_0_@1:3713575
11-28 12:27:51.328 E/unknown:ReactNative(21603): SyntheticError@1:163172
11-28 12:27:51.328 E/unknown:ReactNative(21603): Wrapper@1:163687
11-28 12:27:51.328 E/unknown:ReactNative(21603): _callSuper@1:148560
11-28 12:27:51.328 E/unknown:ReactNative(21603): _construct@1:164035
11-28 12:27:51.328 E/unknown:ReactNative(21603): _next@1:595023
```

### 95 audit 4 min
```
11-28 12:29:31.010 E/ReactNativeJS(21603): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0dvbzm-82cf9f283ff3ce4f","check":{"id":"deep-first-pass.sample.catalogue.4.product.lender.open","label":"sample.catalogue.4: product.lender.open (first-pass)","kind":"journey","status":"fail","durationMs":2614.9,"metrics":{"journeyId":"sample.catalogue.4.product.lender.open","journeyLabel":"sample.catalogue.4: product.lender.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.4","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/First%20Option%20Bank","expectedPath":"/bank/First%20Option%20Bank","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":9,"actionRevisionAfter":10,"actionResultEvidence":"{\"expectedPath\":\"/bank/First%20Option%20Bank\"}","actionMs":1033.6,"preActionWaitMs":1.2,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,…
11-28 12:29:31.016 E/unknown:ReactNative(21603): ?anon_0_@1:3707775
11-28 12:29:31.016 E/unknown:ReactNative(21603): ?anon_0_@1:3713575
11-28 12:29:31.016 E/unknown:ReactNative(21603): SyntheticError@1:163172
11-28 12:29:31.016 E/unknown:ReactNative(21603): Wrapper@1:163687
11-28 12:29:31.016 E/unknown:ReactNative(21603): _callSuper@1:148560
11-28 12:29:31.016 E/unknown:ReactNative(21603): _construct@1:164035
11-28 12:29:31.016 E/unknown:ReactNative(21603): _next@1:595023
```

### 96 audit 5 min
```
11-28 12:29:51.593 E/ReactNativeJS(21603): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0dvbzm-82cf9f283ff3ce4f","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":1394.1,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-28:5b24f9c481f0…:state-8","renderRevisionAfter":"2026-11-28:5b24f9c481f0…:state-9","actionResultEvidence":"{\"applied\":…
11-28 12:29:51.595 E/unknown:ReactNative(21603): ?anon_0_@1:3707775
11-28 12:29:51.595 E/unknown:ReactNative(21603): ?anon_0_@1:3713575
11-28 12:29:51.595 E/unknown:ReactNative(21603): SyntheticError@1:163172
11-28 12:29:51.595 E/unknown:ReactNative(21603): Wrapper@1:163687
11-28 12:29:51.595 E/unknown:ReactNative(21603): _callSuper@1:148560
11-28 12:29:51.595 E/unknown:ReactNative(21603): _construct@1:164035
11-28 12:29:51.595 E/unknown:ReactNative(21603): _next@1:595023
```

### 97 audit 7 min
```
11-28 12:31:41.778 E/unknown:StateWrapperImpl(21603): Race between StateWrapperImpl destruction and updateState
11-28 12:31:43.010 E/ReactNativeJS(21603): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0dvbzm-82cf9f283ff3ce4f","check":{"id":"deep-first-pass.redirect.projections.redirect.projections.verify","label":"redirect.projections: redirect.projections.verify (first-pass)","kind":"journey","status":"fail","durationMs":1533.9,"metrics":{"journeyId":"redirect.projections.redirect.projections.verify","journeyLabel":"redirect.projections: redirect.projections.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.projections","semanticActionId":"redirect.projections.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"projections.inputs","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":452.8,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":329.7,"forwardWo…
11-28 12:31:43.011 E/unknown:ReactNative(21603): ?anon_0_@1:3707775
11-28 12:31:43.011 E/unknown:ReactNative(21603): ?anon_0_@1:3713575
11-28 12:31:43.011 E/unknown:ReactNative(21603): SyntheticError@1:163172
11-28 12:31:43.011 E/unknown:ReactNative(21603): Wrapper@1:163687
11-28 12:31:43.011 E/unknown:ReactNative(21603): _callSuper@1:148560
11-28 12:31:43.011 E/unknown:ReactNative(21603): _construct@1:164035
```

### 98 audit 8 min
```
11-28 12:32:52.573 E/ReactNativeJS(21603): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0dvbzm-82cf9f283ff3ce4f","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.mortgage.scope.apply.1","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.1 (repeat)","kind":"journey","status":"fail","durationMs":8744.5,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.1","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.1","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.1","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":42,"actionRevisionAfter":43,"renderRevisionBefore":"state-14","renderRevisionAfter":"state-20","actionMs":167.6,"preActionWaitMs":2.9,"preActionQuietWindowReused":true,"preAction…
11-28 12:32:52.575 E/unknown:ReactNative(21603): ?anon_0_@1:3707775
11-28 12:32:52.575 E/unknown:ReactNative(21603): ?anon_0_@1:3713575
11-28 12:32:52.575 E/unknown:ReactNative(21603): SyntheticError@1:163172
11-28 12:32:52.575 E/unknown:ReactNative(21603): Wrapper@1:163687
11-28 12:32:52.575 E/unknown:ReactNative(21603): _callSuper@1:148560
11-28 12:32:52.575 E/unknown:ReactNative(21603): _construct@1:164035
11-28 12:32:52.575 E/unknown:ReactNative(21603): _next@1:595023
```

### 100 audit 11 min
```
11-28 12:34:49.101 E/ReactNativeJS(21603): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0dvbzm-82cf9f283ff3ce4f","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1738.7,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/ORANGE%20CREDIT%20UNION%20LTD%7CONLINE_SAVER%7CTRANS_AND_SAVINGS_ACCOUNTS%7CONLINE%20SAVER","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"renderRev…
11-28 12:34:49.108 E/unknown:ReactNative(21603): ?anon_0_@1:3707775
11-28 12:34:49.108 E/unknown:ReactNative(21603): ?anon_0_@1:3713575
11-28 12:34:49.108 E/unknown:ReactNative(21603): SyntheticError@1:163172
11-28 12:34:49.108 E/unknown:ReactNative(21603): Wrapper@1:163687
11-28 12:34:49.108 E/unknown:ReactNative(21603): _callSuper@1:148560
11-28 12:34:49.108 E/unknown:ReactNative(21603): _construct@1:164035
11-28 12:34:49.108 E/unknown:ReactNative(21603): _next@1:595023
```

### 101 audit 12 min
```
11-28 12:37:24.077 E/ReactNativeJS(21603): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0dvbzm-82cf9f283ff3ce4f","check":{"id":"external-link-374","kind":"network","status":"fail","durationMs":1299.6491719996557,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"pass","browserHandler":"pass","httpReachability":"fail","statusCode":404,"handlerAttempted":true,"httpAttempted":true,"httpSelected":true,"handlerResolution":"pass","host":"www.defencebank.com.au","destinationPath":"/banking/home-loans/essentials-home-loan---ultimate-package-investor-interest-only/"},"error":"HTTP 404: the destination is missing or unavailable.","canonicalMetrics":true}}
11-28 12:37:24.079 E/unknown:ReactNative(21603): ?anon_0_@1:3707775
11-28 12:37:24.079 E/unknown:ReactNative(21603): ?anon_0_@1:3717136
11-28 12:37:24.079 E/unknown:ReactNative(21603): SyntheticError@1:163172
11-28 12:37:24.079 E/unknown:ReactNative(21603): Wrapper@1:163687
11-28 12:37:24.079 E/unknown:ReactNative(21603): _callSuper@1:148560
11-28 12:37:24.079 E/unknown:ReactNative(21603): _construct@1:164035
11-28 12:37:24.079 E/unknown:ReactNative(21603): _next@1:595023
```
