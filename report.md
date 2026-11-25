# App explorer: 1.0.375 (431)

**Real-use session ATTENTION vs 1.0.374: 0 broken, 25 friction, 4 slower**

- Friction: No reaction for 3.5 s after "scroll rates 1"
- Friction: No reaction for 3.0 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.2 s after "scroll lenders"
- Friction: No reaction for 4.5 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.4 s after "open filters"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.2 s after "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 5.2 s after "open term deposits"
- Friction: No reaction for 3.7 s after "verify term deposit rates"
- Friction: No reaction for 9.0 s after "search Macquarie"
- Friction: No reaction for 3.3 s after "return from savings search"
- Friction: No reaction for 3.7 s after "open mortgage filter draft"
- Friction: No reaction for 3.7 s after "verify fixed was not applied"
- Friction: No reaction for 4.2 s after "open unsaved rate"
- Friction: Nothing to read for 7.1 s on "restart with a saved rate"
- Friction: No reaction for 5.5 s after "open product from saved rates"
- Friction: No reaction for 3.2 s after "remove saved rate"
- Friction: No reaction for 11.1 s after "leave removed product"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: No reaction for 3.4 s after "follow browse rates recovery"
- Friction: No reaction for 3.3 s after "open two-rate comparison"
- Slower: Dropped frames 68% to 100% on "discard unsaved filter draft"
- Slower: Dropped frames 66% to 81% on "verify saved rate after restart"
- Slower: "open product from saved rates" content 3.4 s to 5.5 s
- Slower: "open product from saved rates" reaction 3.4 s to 5.5 s

**Initial Rates readiness:** 41.5 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-26

Mode full | 114 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 21
Baseline 1.0.374
**Audit live: outcome failed | 1052 s | audit log 854389 bytes (audit-log.txt) https://paste.c-net.org/23461394-686b-25d7-153f-fe1ba6f58713 | debug log fetch failed (Hosted log exceeds the upload byte limit) https://paste.rs/pSzgb**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2965 | +57 | 666/915 | 85 | 494 | 1 errors; start 2922ms |
| 2 | scroll rates 1 | 700 | -47 | 35/50 | 89 | 485 | boot js-start 452944, layout-mounted 453591, cache-read 453710, hydrated 453924, splash-hide 453924, manifest 454671, resolved 455473, core-fetched 460985, core-saved 461938, search-index-idle 462202, leading-requested 462202, details-start 462556, leading-scoped 463150, pricing-ready 468573, details-fetched 472150, rows-prepared 480421, detail-filters-idle 480421, last-pricing 480421, suitability-built 482004, post-refresh-wait 482650, leading-page 485268, last-rows 494230, rates-ready 494406, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 187, pricing-scope-ms 18720, leading-gated 1, filter-runs 2, filter-rows 31602, filter-yields 6, filter-ms 139, sort-runs 4, sort-rows 1183, sort-yields 4, sort-ms 196 |
| 3 | scroll rates 2 | 692 | -2 | 17/24 | 61 | 651 |  |
| 4 | scroll rates back | 678 | +1 |  |  | 564 |  |
| 5 | open product | 26 | -5443 | 31/45 | 85 | 644 | 3 errors |
| 6 | scroll product | 704 | -10 | 36/52 | 73 | 639 |  |
| 7 | back to rates | 24 | -6 | 14/22 | 73 | 641 |  |
| 8 | open lenders | 23 | -6 | 22/24 | 200 | 631 |  |
| 9 | scroll lenders | 735 | -70 | 17/18 | 150 | 628 |  |
| 10 | back from lenders | 23 | +1 | 7/8 | 150 | 629 |  |
| 11 | switch to savings | 28 | +4 | 52/72 | 85 | 641 |  |
| 12 | switch to home loans | 23 | -1 | 16/29 | 65 | 656 |  |
| 13 | open filters | 30 | +7 | 22/27 | 129 | 662 |  |
| 14 | close filters | 23 | +1 | 6/8 | 117 | 653 |  |
| 15 | open market | 26 | +4 | 16/30 | 73 | 659 |  |
| 16 | open rba | 2480 | -234 | 54/65 | 65 | 672 |  |
| 17 | scroll rba | 691 | -33 | 31/53 | 65 | 666 |  |
| 18 | back from rba | 30 | +7 | 11/19 | 65 | 667 |  |
| 19 | scroll market | 699 | -44 | 20/35 | 85 | 666 |  |
| 20 | open saved | 24 | +1 | 15/23 | 85 | 669 |  |
| 21 | return to rates | 22 | -2 | 16/28 | 77 | 671 |  |
| 22 | start category switch | 29 | +1 |  |  | 670 |  |
| 23 | open term deposits | 26 | +2 | 73/99 | 85 | 693 |  |
| 24 | verify term deposit rates | 686 | -30 | 32/49 | 89 | 693 |  |
| 25 | restore home loans | 23 | -2 | 17/30 | 65 | 704 |  |
| 26 | start search from rates | 33 | +8 |  |  | 699 |  |
| 27 | open savings search | 25 | +3 | 20/29 | 69 | 720 |  |
| 28 | search Macquarie | 2020 | -295 | 87/98 | 150 | 728 | 1 errors |
| 29 | verify Macquarie result | 0 | 0 | 14/15 | 19 | 721 |  |
| 30 | clear query and restore results | 24 | +2 | 16/20 | 48 | 736 |  |
| 31 | return from savings search | 24 | +2 | 34/42 | 89 | 757 |  |
| 32 | start filter rollback | 32 | -3 | 13/15 | 16 | 749 |  |
| 33 | open mortgage filter draft | 26 | +3 | 27/29 | 129 | 766 |  |
| 34 | select fixed in draft | 24 | 0 | 14/14 | 117 | 768 |  |
| 35 | discard unsaved filter draft | 24 | +1 | 20/20 | 105 | 770 |  |
| 36 | verify fixed was not applied | 28 | +5 | 30/31 | 129 | 784 | 1 errors |
| 37 | close verified filter draft | 24 | +3 | 19/22 | 89 | 783 |  |
| 38 | start save from rates | 28 | -6 | 12/16 | 16 | 782 | 1 errors |
| 39 | open unsaved rate | 41 | +19 | 149/214 | 81 | 821 | 2 errors |
| 40 | save a rate | 33 | +3 | 12/16 | 81 | 824 | 1 errors |
| 41 | leave saved product | 29 | +7 | 13/23 | 69 | 824 |  |
| 42 | restart with a saved rate | 14133 | -6467 | 160/220 | 93 | 585 | 19 errors; start 6538ms; boot js-start 865424, layout-mounted 866268, hydrated 867133, cache-read 868085, core-ready 868898, rows-prepared 869072, search-index-idle 869072, detail-filters-idle 869072, leading-requested 869072, last-pricing 869072, splash-hide 869073, leading-scoped 873452, leading-page 873452, pricing-ready 874163, last-rows 874163, rates-ready 874375, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 14, pricing-scope-ms 2272, filter-runs 1, filter-rows 6864, filter-yields 5, filter-ms 127, sort-runs 1, sort-rows 1183, sort-yields 1, sort-ms 16 |
| 43 | verify saved rate after restart | 24 | -7 | 29/36 | 89 | 618 |  |
| 44 | open product from saved rates | 28 | +6 | 44/71 | 81 | 527 |  |
| 45 | remove saved rate | 30 | -7 | 11/20 | 65 | 567 | 2 errors |
| 46 | leave removed product | 9071 | +141 | 7/12 | 65 | 627 | 1 errors |
| 47 | follow browse rates recovery | 23 | -2225 | 16/30 | 65 | 636 |  |
| 48 | start compare from rates | 27 | -6 | 2/2 | 32 | 659 |  |
| 49 | enter selection mode | 24 | 0 | 9/16 | 69 | 688 |  |
| 50 | select first comparison rate | 24 | -2 | 9/14 | 69 | 670 |  |
| 51 | select second comparison rate | 23 | 0 | 10/14 | 65 | 671 |  |
| 52 | open two-rate comparison | 22 | 0 | 22/31 | 150 | 680 |  |
| 53 | return from two-rate comparison | 21 | -3 | 21/29 | 97 | 679 |  |
| 54 | cold start | 10450 | +355 | 29/36 | 133 | 576 | 3 errors; start 4590ms; boot js-start 997256, layout-mounted 997446, hydrated 997586, cache-read 998874, core-ready 999643, rows-prepared 999784, search-index-idle 999784, detail-filters-idle 999784, leading-requested 999784, last-pricing 999784, splash-hide 999785, manifest 1002025, leading-scoped 1002397, leading-page 1002397, resolved 1002912, pricing-ready 1003683, last-rows 1003683, rates-ready 1003876, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 24, pricing-scope-ms 1543, filter-runs 1, filter-rows 6864, filter-yields 4, filter-ms 104, sort-runs 1, sort-rows 1183, sort-yields 1, sort-ms 16 |
| 55 | /browse | 4481 | +18 | 2/2 | 32 | 428 |  |
| 56 | /watchlist | 24 | -5 | 4/4 | 32 | 436 |  |
| 57 | /market | 34 | -6 | 13/20 | 77 | 511 |  |
| 58 | /tools | 30 | -3 | 12/21 | 97 | 576 |  |
| 59 | /trends | 37 | +4 |  |  | 619 |  |
| 60 | /search | 30 | -10 | 36/47 | 133 | 628 |  |
| 61 | /banks | 31 | +1 | 32/43 | 105 | 638 |  |
| 62 | /bank-rates | 31 | +1 | 15/25 | 73 | 650 |  |
| 63 | /categories | 30 | +5 | 36/49 | 89 | 677 |  |
| 64 | /catalogue | 35 | +7 | 32/41 | 93 | 694 |  |
| 65 | /compare | 43 | +11 | 12/13 | 113 | 668 |  |
| 66 | /matches | 30 | +3 | 36/48 | 97 | 688 |  |
| 67 | /calculator | 23 | -12 | 18/25 | 73 | 673 |  |
| 68 | /projections | 23 | -4 | 25/34 | 93 | 677 |  |
| 69 | /profile | 24 | -7 | 17/25 | 69 | 682 |  |
| 70 | /research | 26 | +1 | 15/29 | 81 | 690 |  |
| 71 | /rba | 29 | -2 | 16/24 | 81 | 704 |  |
| 72 | /rba-response | 30 | -3 | 16/30 | 85 | 705 |  |
| 73 | /settings | 27 | +1 | 18/27 | 89 | 709 |  |
| 74 | /about | 29 | +4 | 17/23 | 73 | 710 |  |
| 75 | /terms | 24 | -3 | 13/24 | 81 | 711 |  |
| 76 | /privacy | 31 | +4 |  |  | 711 |  |
| 77 | /third-party-notices | 30 | -7 | 14/23 | 73 | 715 |  |
| 78 | /node | 30 | +1 | 27/37 | 113 | 753 |  |
| 79 | /passthrough | 32 | +1 | 33/49 | 89 | 735 |  |
| 80 | /calculation-receipt | 31 | +2 | 14/23 | 69 | 711 |  |
| 81 | /rate-receipt | 29 | -6 | 7/9 | 101 | 712 |  |
| 82 | warm resume | 892 | +186 | 4/5 | 93 | 711 |  |
| 83 | cold relaunch | 10231 | -286 | 27/35 | 200 | 574 | 3 errors; start 4327ms; boot js-start 1231544, layout-mounted 1231733, hydrated 1231868, cache-read 1233085, core-ready 1233860, rows-prepared 1233974, search-index-idle 1233974, detail-filters-idle 1233974, leading-requested 1233974, last-pricing 1233974, splash-hide 1233976, manifest 1236228, leading-scoped 1236610, leading-page 1236610, resolved 1237131, pricing-ready 1237900, last-rows 1237900, rates-ready 1238089, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 20, pricing-scope-ms 1558, filter-runs 1, filter-rows 6864, filter-yields 4, filter-ms 103, sort-runs 1, sort-rows 1183, sort-yields 1, sort-ms 14 |
| 84 | about | 32 | -12 | 11/21 | 97 | 603 |  |
| 85 | audit screen | 21 | -4 | 115/199 | 65 | 609 |  |
| 86 | audit 0 min | 0 | 0 | 4/6 | 200 | 610 |  |
| 87 | audit 1 min | 0 |  | 1026/1163 | 113 | 910 | 80 errors |
| 88 | audit 2 min | 0 | 0 | 125/144 | 117 | 947 | 76 errors |
| 89 | audit 4 min | 0 |  | 1163/1317 | 109 | 1140 | 80 errors |
| 90 | audit 6 min | 0 | 0 | 702/826 | 101 | 1203 | 80 errors |
| 91 | audit 7 min | 0 | 0 | 490/557 | 121 | 1115 | 80 errors |
| 92 | audit 8 min | 0 | 0 | 544/591 | 121 | 1195 | 80 errors |
| 93 | audit 10 min | 0 | 0 | 632/738 | 101 | 1288 | 80 errors |
| 94 | audit 11 min | 0 | 0 | 729/826 | 105 | 1320 | 80 errors |
| 95 | audit 13 min | 0 | 0 | 581/655 | 117 | 1348 | 80 errors |
| 96 | audit 15 min | 0 | 0 | 156/182 | 46 | 1366 |  |
| 97 | audit 16 min | 0 | 0 | 106/125 | 36 | 1253 |  |
| 98 | audit 17 min | 0 | 0 | 48/62 | 81 | 1360 |  |
| 99 | audit finished | 0 | 0 | 101/173 | 77 | 1425 |  |
| 100 | audit result 1 | 0 | 0 |  |  | 1372 |  |
| 101 | audit result 2 | 0 | 0 |  |  | 1371 |  |
| 102 | audit result 3 | 0 | 0 |  |  | 1374 |  |
| 103 | audit result 4 | 0 | 0 |  |  | 1372 |  |
| 104 | audit result 5 | 0 | 0 |  |  | 1376 |  |
| 105 | audit result 6 | 0 | 0 |  |  | 1374 |  |
| 106 | audit result 7 | 0 | 0 |  |  | 1376 |  |
| 107 | audit result 8 | 0 | 0 |  |  | 1378 |  |
| 108 | audit result 9 | 0 | 0 |  |  | 1376 |  |
| 109 | audit result 10 | 0 | 0 |  |  | 1376 |  |
| 110 | audit result 11 | 0 | 0 |  |  | 1378 |  |
| 111 | audit result 12 | 0 | 0 |  |  | 1376 |  |
| 112 | about for debug log | 36 | -3163 | 23/35 | 69 | 1386 |  |
| 113 | debug log screen | 1 | +1 | 115/221 | 65 | 1398 |  |
| 114 | debug log uploaded | 0 | 0 | 26/31 | 121 | 1454 |  |

## Errors

### 1 open app
```
11-25 22:54:20.354 E/australianrates(11113): Not starting debugger since process cannot load the jdwp agent.
```

### 5 open product
```
11-25 22:55:32.344 W/ReactNativeJS(11113): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-25 22:55:32.976 W/ReactNativeJS(11113): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-25 22:55:33.780 W/ReactNativeJS(11113): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
```

### 28 search Macquarie
```
11-25 22:59:16.228 E/FrameTracker(11113): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 36 verify fixed was not applied
```
11-25 23:00:21.214 E/FrameTracker(11113): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 38 start save from rates
```
11-25 23:00:38.729 E/FrameTracker(11113): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 39 open unsaved rate
```
11-25 23:00:45.449 E/ImeBackDispatcher(11113): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 106591324
11-25 23:00:49.792 W/ReactNativeJS(11113): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
```

### 40 save a rate
```
11-25 23:00:55.965 E/FrameTracker(11113): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 42 restart with a saved rate
```
11-25 23:01:13.265 E/australianrates(15600): Not starting debugger since process cannot load the jdwp agent.
11-25 23:01:19.237 E/SurfaceSyncGroup(15600): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-25 23:01:19.238 E/SurfaceSyncGroup(15600): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-25 23:01:20.681 W/ReactNativeJS(15600): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-25 23:01:22.743 W/ReactNativeJS(15600): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-25 23:01:23.891 E/ReactNativeJS(15600): [AR error] store: refresh failed: asset HTTP 502
11-25 23:01:23.891 W/ReactNativeJS(15600): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-25 23:01:23.910 E/unknown:ReactNative(15600): ?anon_0_@1:2027142
```

### 45 remove saved rate
```
11-25 23:02:07.877 W/ReactNativeJS(15600): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-25 23:02:08.835 W/ReactNativeJS(15600): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
```

### 46 leave removed product
```
11-25 23:02:18.742 W/ReactNativeJS(15600): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
```

### 54 cold start
```
11-25 23:03:25.540 E/australianrates(17069): Not starting debugger since process cannot load the jdwp agent.
11-25 23:03:29.970 E/SurfaceSyncGroup(17069): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-25 23:03:29.970 E/SurfaceSyncGroup(17069): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 83 cold relaunch
```
11-25 23:07:20.012 E/australianrates(20207): Not starting debugger since process cannot load the jdwp agent.
11-25 23:07:24.151 E/SurfaceSyncGroup(20207): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-25 23:07:24.151 E/SurfaceSyncGroup(20207): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 87 audit 1 min
```
11-25 23:08:38.414 E/ReactNativeJS(20207): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwwqim4o-2ac69091c45ed807","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":5297.1,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":269,"liveStage:dates-index:fetched:ms":210.6,"liveStage:revision:verified:ms":86,"liveStage:Core asset:downloaded:ms":438.6,"liveStage:Core asset:hash-verified:ms":3,"liveStage:Core asset:native-inflated-and-text-decoded:ms":157.9,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":240.1,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":601.9,"liveStage:Details asset:downloaded:ms":1311.9,"liveStage:Details asset:hash-verified:ms":30.9,"liveStage:De…
11-25 23:08:38.417 E/unknown:ReactNative(20207): ?anon_0_@1:3692680
11-25 23:08:38.417 E/unknown:ReactNative(20207): ?anon_0_@1:3698480
11-25 23:08:38.417 E/unknown:ReactNative(20207): SyntheticError@1:163016
11-25 23:08:38.417 E/unknown:ReactNative(20207): Wrapper@1:163531
11-25 23:08:38.417 E/unknown:ReactNative(20207): _callSuper@1:148404
11-25 23:08:38.417 E/unknown:ReactNative(20207): _construct@1:163879
11-25 23:08:38.417 E/unknown:ReactNative(20207): _next@1:594867
```

### 88 audit 2 min
```
11-25 23:10:19.852 E/ReactNativeJS(20207): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwwqim4o-2ac69091c45ed807","check":{"id":"journey-compare-warm","label":"Product comparison (warm)","kind":"journey","status":"fail","durationMs":2175.2,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":1331.7,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"compare","journeyLabel":"Product comparison","iteration":"warm","expectedPath":"/compare","expectedSurface":"compare.table","navigationKind":"stack","forwardMs":1331.7,"firstReadyFrameObserved":true,"firstReadyFrameMs":465.57200499996543,"backgroundSettleMs":632.1,"destinationReadinessMs":465.6,"backMs":59.1,"firstBackMs":59.1,"firstBackDestination":"/performance-audit","originReadinessMs":0.3,"backDestination":"/performance-audit","backChangedPath":…
11-25 23:10:19.857 E/unknown:ReactNative(20207): ?anon_0_@1:3692680
11-25 23:10:19.857 E/unknown:ReactNative(20207): ?anon_0_@1:3698480
11-25 23:10:19.857 E/unknown:ReactNative(20207): SyntheticError@1:163016
11-25 23:10:19.857 E/unknown:ReactNative(20207): Wrapper@1:163531
11-25 23:10:19.857 E/unknown:ReactNative(20207): _callSuper@1:148404
11-25 23:10:19.857 E/unknown:ReactNative(20207): _construct@1:163879
11-25 23:10:19.857 E/unknown:ReactNative(20207): _next@1:594867
```

### 89 audit 4 min
```
11-25 23:10:37.383 E/ReactNativeJS(20207): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwwqim4o-2ac69091c45ed807","check":{"id":"deep-first-pass.route.rates.search.filters.open","label":"route.rates: search.filters.open (first-pass)","kind":"journey","status":"fail","durationMs":5743.7,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRevisionAfter":4,"renderRevisionBefore":"state-24","renderRevisionAfter":"state-28","actionMs":0.2,"preActionWaitMs":0.8,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtra…
11-25 23:10:37.388 E/unknown:ReactNative(20207): ?anon_0_@1:3692680
11-25 23:10:37.388 E/unknown:ReactNative(20207): ?anon_0_@1:3698480
11-25 23:10:37.388 E/unknown:ReactNative(20207): SyntheticError@1:163016
11-25 23:10:37.388 E/unknown:ReactNative(20207): Wrapper@1:163531
11-25 23:10:37.388 E/unknown:ReactNative(20207): _callSuper@1:148404
11-25 23:10:37.388 E/unknown:ReactNative(20207): _construct@1:163879
11-25 23:10:37.388 E/unknown:ReactNative(20207): _next@1:594867
```

### 90 audit 6 min
```
11-25 23:13:11.824 E/ReactNativeJS(20207): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwwqim4o-2ac69091c45ed807","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":1733.9,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-26:0e55e66b7edb…:state-7","renderRevisionAfter":"2026-11-26:0e55e66b7edb…:state-8","actionResultEvidence":"{\"applied\":…
11-25 23:13:13.804 E/unknown:ReactNative(20207): ?anon_0_@1:3692680
11-25 23:13:13.804 E/unknown:ReactNative(20207): ?anon_0_@1:3698480
11-25 23:13:13.804 E/unknown:ReactNative(20207): SyntheticError@1:163016
11-25 23:13:13.804 E/unknown:ReactNative(20207): Wrapper@1:163531
11-25 23:13:13.804 E/unknown:ReactNative(20207): _callSuper@1:148404
11-25 23:13:13.804 E/unknown:ReactNative(20207): _construct@1:163879
11-25 23:13:13.804 E/unknown:ReactNative(20207): _next@1:594867
```

### 91 audit 7 min
```
11-25 23:14:54.701 E/ReactNativeJS(20207): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwwqim4o-2ac69091c45ed807","check":{"id":"deep-first-pass.route.not-found.not-found.home","label":"route.not-found: not-found.home (first-pass)","kind":"journey","status":"fail","durationMs":9694.7,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"cold","passId":"first-pass","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":0,"actionRevisionAfter":1,"renderRevisionBefore":"not-found-v1","actionMs":100.9,"preActionWaitMs":0.5,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"…
11-25 23:14:54.702 E/unknown:ReactNative(20207): ?anon_0_@1:3692680
11-25 23:14:54.702 E/unknown:ReactNative(20207): ?anon_0_@1:3698480
11-25 23:14:54.702 E/unknown:ReactNative(20207): SyntheticError@1:163016
11-25 23:14:54.702 E/unknown:ReactNative(20207): Wrapper@1:163531
11-25 23:14:54.702 E/unknown:ReactNative(20207): _callSuper@1:148404
11-25 23:14:54.702 E/unknown:ReactNative(20207): _construct@1:163879
11-25 23:14:54.702 E/unknown:ReactNative(20207): _next@1:594867
```

### 92 audit 8 min
```
11-25 23:15:43.691 E/ReactNativeJS(20207): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwwqim4o-2ac69091c45ed807","check":{"id":"deep-repeat.route.rates.search.filters.open","label":"route.rates: search.filters.open (repeat)","kind":"journey","status":"fail","durationMs":5543,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":26,"actionRevisionAfter":27,"renderRevisionBefore":"state-25","renderRevisionAfter":"state-28","actionMs":0.2,"preActionWaitMs":0.8,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repe…
11-25 23:15:43.692 E/unknown:ReactNative(20207): ?anon_0_@1:3692680
11-25 23:15:43.692 E/unknown:ReactNative(20207): ?anon_0_@1:3698480
11-25 23:15:43.692 E/unknown:ReactNative(20207): SyntheticError@1:163016
11-25 23:15:43.692 E/unknown:ReactNative(20207): Wrapper@1:163531
11-25 23:15:43.692 E/unknown:ReactNative(20207): _callSuper@1:148404
11-25 23:15:43.692 E/unknown:ReactNative(20207): _construct@1:163879
11-25 23:15:43.692 E/unknown:ReactNative(20207): _next@1:594867
```

### 93 audit 10 min
```
11-25 23:17:14.335 E/ReactNativeJS(20207): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwwqim4o-2ac69091c45ed807","check":{"id":"deep-repeat.route.product.product.open","label":"route.product: product.open (repeat)","kind":"journey","status":"fail","durationMs":1900.8,"metrics":{"journeyId":"route.product.product.open","journeyLabel":"route.product: product.open","iteration":"warm","passId":"repeat","scenarioId":"route.product","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Connective%20Athena%7Cconnective-max-without-offset%7CRESIDENTIAL_MORTGAGES%7CConnective%20Athena%20Prime%20Max%20(Without%20Offset)","expectedPath":"/product/Connective%20Athena%7Cconnective-max-without-offset%7CRESIDENTIAL_MORTGAGES%7CConnective%20Athena%20Prime%20Max%20(Without%20Offset)","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":535.9,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"re…
11-25 23:17:14.337 E/unknown:ReactNative(20207): ?anon_0_@1:3692680
11-25 23:17:14.337 E/unknown:ReactNative(20207): ?anon_0_@1:3698480
11-25 23:17:14.337 E/unknown:ReactNative(20207): SyntheticError@1:163016
11-25 23:17:14.337 E/unknown:ReactNative(20207): Wrapper@1:163531
11-25 23:17:14.337 E/unknown:ReactNative(20207): _callSuper@1:148404
11-25 23:17:14.337 E/unknown:ReactNative(20207): _construct@1:163879
11-25 23:17:14.337 E/unknown:ReactNative(20207): _next@1:594867
```

### 94 audit 11 min
```
11-25 23:18:10.390 E/ReactNativeJS(20207): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwwqim4o-2ac69091c45ed807","check":{"id":"deep-repeat.route.calculator.calculator.open","label":"route.calculator: calculator.open (repeat)","kind":"journey","status":"fail","durationMs":4065.7,"metrics":{"journeyId":"route.calculator.calculator.open","journeyLabel":"route.calculator: calculator.open","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.open","depth":0,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":371.3,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":24.4,"forwardWorkMs":24.4,"navigationCommitMs":0,"firstReadyFrameMs":24.4,"firstReadyFrameObserved":true,"re…
11-25 23:18:10.392 E/unknown:ReactNative(20207): ?anon_0_@1:3692680
11-25 23:18:10.392 E/unknown:ReactNative(20207): ?anon_0_@1:3698480
11-25 23:18:10.392 E/unknown:ReactNative(20207): SyntheticError@1:163016
11-25 23:18:10.392 E/unknown:ReactNative(20207): Wrapper@1:163531
11-25 23:18:10.392 E/unknown:ReactNative(20207): _callSuper@1:148404
11-25 23:18:10.392 E/unknown:ReactNative(20207): _construct@1:163879
11-25 23:18:10.392 E/unknown:ReactNative(20207): _next@1:594867
```

### 95 audit 13 min
```
11-25 23:20:01.540 E/ReactNativeJS(20207): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwwqim4o-2ac69091c45ed807","check":{"id":"deep-repeat.route.not-found.not-found.home","label":"route.not-found: not-found.home (repeat)","kind":"journey","status":"fail","durationMs":9898.6,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"warm","passId":"repeat","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":1,"actionRevisionAfter":2,"renderRevisionBefore":"not-found-v1","actionMs":106.6,"preActionWaitMs":0.6,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetour…
11-25 23:20:01.541 E/unknown:ReactNative(20207): ?anon_0_@1:3692680
11-25 23:20:01.541 E/unknown:ReactNative(20207): ?anon_0_@1:3698480
11-25 23:20:01.541 E/unknown:ReactNative(20207): SyntheticError@1:163016
11-25 23:20:01.541 E/unknown:ReactNative(20207): Wrapper@1:163531
11-25 23:20:01.541 E/unknown:ReactNative(20207): _callSuper@1:148404
11-25 23:20:01.541 E/unknown:ReactNative(20207): _construct@1:163879
11-25 23:20:01.541 E/unknown:ReactNative(20207): _next@1:594867
```
