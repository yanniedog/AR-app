# App explorer: 1.0.387 (443)

**Real-use session FAIL vs 1.0.386: 1 broken, 25 friction, 39 slower**

- Broken: "leave removed product" failed: Back destination was not observed
- Friction: No reaction for 3.1 s after "scroll rates 1"
- Friction: No reaction for 3.7 s after "scroll rates 2"
- Friction: No reaction for 3.3 s after "open product"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll product fees"
- Friction: No reaction for 3.1 s after "scroll product eligibility"
- Friction: No reaction for 3.2 s after "scroll product sources"
- Friction: No reaction for 3.2 s after "scroll lenders"
- Friction: No reaction for 4.1 s after "switch to savings"
- Friction: No reaction for 3.0 s after "switch to home loans"
- Friction: No reaction for 3.5 s after "open filters"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 5.2 s after "open term deposits"
- Friction: No reaction for 3.8 s after "verify term deposit rates"
- Friction: No reaction for 7.8 s after "search Macquarie"
- Friction: No reaction for 3.4 s after "return from savings search"
- Friction: No reaction for 3.5 s after "open mortgage filter draft"
- Friction: No reaction for 3.6 s after "verify fixed was not applied"
- Friction: No reaction for 3.5 s after "open unsaved rate"
- Friction: No reaction for 3.3 s after "open product from saved rates"
- Friction: No reaction for 20.0 s after "leave removed product"
- Friction: No reaction for 3.0 s after "enter selection mode"
- Slower: Dropped frames 42% to 75% on "open app"
- Slower: "open app" content 21.2 s to 37.8 s
- Slower: "open app" reaction 21.2 s to 37.8 s
- Slower: Dropped frames 40% to 64% on "scroll rates 1"
- Slower: Dropped frames 36% to 64% on "scroll rates 2"
- Slower: Dropped frames 36% to 64% on "open product"
- Slower: Dropped frames 31% to 56% on "scroll product"
- Slower: Dropped frames 31% to 60% on "expand product facts"
- Slower: Dropped frames 22% to 56% on "scroll product fees"
- Slower: Dropped frames 25% to 65% on "scroll product eligibility"
- Slower: Dropped frames 31% to 83% on "scroll product sources"
- Slower: Dropped frames 38% to 63% on "back to rates"
- Slower: Dropped frames 62% to 87% on "open lenders"
- Slower: Dropped frames 64% to 92% on "scroll lenders"
- Slower: Dropped frames 37% to 78% on "switch to savings"
- Slower: Dropped frames 34% to 66% on "switch to home loans"
- Slower: Dropped frames 43% to 59% on "open market"
- Slower: Dropped frames 42% to 78% on "open rba"
- Slower: Dropped frames 28% to 64% on "scroll rba"
- Slower: Dropped frames 31% to 74% on "scroll market"
- Slower: Dropped frames 30% to 63% on "return to rates"
- Slower: Dropped frames 48% to 76% on "open term deposits"
- Slower: Dropped frames 39% to 65% on "verify term deposit rates"
- Slower: Dropped frames 30% to 57% on "restore home loans"
- Slower: "search Macquarie" content 4.7 s to 7.8 s
- Slower: "search Macquarie" reaction 4.7 s to 7.8 s
- Slower: Dropped frames 57% to 76% on "return from savings search"
- Slower: Dropped frames 70% to 91% on "close verified filter draft"
- Slower: Dropped frames 46% to 69% on "open unsaved rate"
- Slower: Dropped frames 41% to 70% on "restart with a saved rate"
- Slower: "restart with a saved rate" content 10.3 s to 15.7 s
- Slower: "restart with a saved rate" reaction 10.3 s to 15.7 s
- Slower: Dropped frames 41% to 61% on "verify saved rate after restart"
- Slower: Dropped frames 41% to 65% on "open product from saved rates"
- Slower: "leave removed product" content 2.2 s to 20.2 s
- Slower: "leave removed product" reaction 5.0 s to 20.0 s
- Slower: "start compare from rates" content 0.0 s to 2.4 s
- Slower: Dropped frames 44% to 72% on "open two-rate comparison"
- Slower: Dropped frames 40% to 78% on "return from two-rate comparison"

**Initial Rates readiness:** 43.3 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 8 passed, 1 failed, 1 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3752 bytes, latest published run date 2026-11-27

Mode full | 118 steps | crashes 0 | step failures 1 | settle timeouts 1 | steps with JS/native errors 21
Baseline 1.0.386
**Audit live: outcome failed | 969 s | audit log 854545 bytes (audit-log.txt) https://paste.c-net.org/6b778267-8fc1-612f-55e7-0a8c7d5341c4 | debug log 5754168 bytes read from host https://paste.c-net.org/b06f00be-4d93-283c-a02a-361cf1d9ef86**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3047 | -20462 | 686/920 | 89 | 494 | 1 errors; start 2978ms |
| 2 | scroll rates 1 | 714 | -4586 | 18/28 | 65 | 585 | boot js-start 468084, layout-mounted 468615, cache-read 468963, hydrated 469156, splash-hide 469156, manifest 470447, resolved 471131, core-fetched 476858, core-saved 477755, search-index-idle 478159, leading-requested 478159, leading-scoped 478733, details-start 478744, pricing-ready 480972, details-fetched 489388, rows-prepared 496770, detail-filters-idle 496770, last-pricing 496770, suitability-built 498159, post-refresh-wait 498883, leading-page 501713, last-rows 511086, rates-ready 511343, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 53, pricing-yields 208, pricing-scope-ms 15257, leading-gated 1, filter-runs 2, filter-rows 31912, filter-yields 8, filter-ms 193, sort-runs 4, sort-rows 1191, sort-yields 4, sort-ms 111 |
| 3 | scroll rates 2 | 691 | +10 | 34/53 | 73 | 658 |  |
| 4 | scroll rates back | 675 | -6 |  |  | 543 |  |
| 5 | open product | 6615 | +897 | 37/58 | 81 | 655 |  |
| 6 | scroll product | 700 | -25 | 29/52 | 81 | 667 |  |
| 7 | expand product facts | 22 | +6 | 41/68 | 93 | 669 |  |
| 8 | scroll product fees | 704 | +17 | 31/55 | 77 | 665 |  |
| 9 | scroll product eligibility | 734 | +49 | 22/34 | 85 | 656 |  |
| 10 | expand eligibility | 0 | -15 | 204/291 | 85 | 655 |  |
| 11 | expand constraints | 24 | +9 | 9/16 | 65 | 661 |  |
| 12 | scroll product sources | 749 | +36 | 20/24 | 97 | 655 |  |
| 13 | back to rates | 27 | +10 | 15/24 | 73 | 652 |  |
| 14 | open lenders | 24 | +8 | 20/23 | 200 | 662 |  |
| 15 | scroll lenders | 693 | -8 | 23/25 | 125 | 658 |  |
| 16 | back from lenders | 22 | +7 | 9/10 | 150 | 658 |  |
| 17 | switch to savings | 26 | +9 | 49/63 | 89 | 673 |  |
| 18 | switch to home loans | 26 | +7 | 19/29 | 61 | 687 |  |
| 19 | open filters | 22 | +6 | 20/27 | 150 | 687 |  |
| 20 | close filters | 22 | +5 | 8/9 | 129 | 685 |  |
| 21 | open market | 23 | +7 | 19/32 | 69 | 689 |  |
| 22 | open rba | 2640 | +212 | 69/89 | 65 | 704 |  |
| 23 | scroll rba | 695 | -11 | 34/53 | 73 | 698 |  |
| 24 | back from rba | 24 | +6 | 9/20 | 61 | 698 |  |
| 25 | scroll market | 741 | +47 | 29/39 | 81 | 697 |  |
| 26 | open saved | 24 | +9 | 10/16 | 65 | 700 |  |
| 27 | return to rates | 23 | +7 | 19/30 | 85 | 703 |  |
| 28 | start category switch | 29 | +11 |  |  | 702 |  |
| 29 | open term deposits | 24 | +8 | 71/93 | 85 | 723 |  |
| 30 | verify term deposit rates | 716 | +15 | 34/52 | 69 | 725 |  |
| 31 | restore home loans | 24 | +9 | 16/28 | 61 | 733 |  |
| 32 | start search from rates | 28 | +9 |  |  | 728 |  |
| 33 | open savings search | 22 | +6 | 14/26 | 65 | 741 |  |
| 34 | search Macquarie | 2088 | +973 | 75/84 | 150 | 744 | 1 errors |
| 35 | verify Macquarie result | 0 | -1 | 12/15 | 18 | 742 |  |
| 36 | clear query and restore results | 26 | +10 | 16/19 | 32 | 745 |  |
| 37 | return from savings search | 23 | +6 | 31/41 | 69 | 759 |  |
| 38 | start filter rollback | 29 | +9 | 12/16 | 24 | 749 |  |
| 39 | open mortgage filter draft | 23 | +7 | 24/26 | 250 | 758 |  |
| 40 | select fixed in draft | 24 | +8 | 9/11 | 150 | 759 |  |
| 41 | discard unsaved filter draft | 24 | +9 | 18/23 | 129 | 760 |  |
| 42 | verify fixed was not applied | 26 | +10 | 24/29 | 200 | 768 | 1 errors |
| 43 | close verified filter draft | 22 | +7 | 20/22 | 101 | 767 |  |
| 44 | start save from rates | 32 | +13 | 13/16 | 32 | 763 | 1 errors |
| 45 | open unsaved rate | 23 | +7 | 42/61 | 93 | 794 | 1 errors |
| 46 | save a rate | 24 | +8 | 11/15 | 61 | 792 | 1 errors |
| 47 | leave saved product | 30 | +14 | 13/23 | 69 | 797 |  |
| 48 | restart with a saved rate | 18288 | +7837 | 187/266 | 93 | 594 | 3 errors; start 6474ms; boot js-start 981709, layout-mounted 982465, hydrated 982662, cache-read 984106, core-ready 984906, rows-prepared 985117, search-index-idle 985117, detail-filters-idle 985117, leading-requested 985117, last-pricing 985117, splash-hide 985118, manifest 987618, leading-scoped 989065, leading-page 989065, resolved 989959, pricing-ready 992843, last-rows 992843, rates-ready 993036, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 39, pricing-scope-ms 4649, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 111, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 16 |
| 49 | verify saved rate after restart | 30 | +13 | 19/31 | 89 | 628 |  |
| 50 | open product from saved rates | 24 | +8 | 37/57 | 93 | 542 |  |
| 51 | remove saved rate | 30 | -4253 | 11/20 | 129 | 601 |  |
| 52 | leave removed product | 20152 | +17978 | 8/10 | 97 | 643 | no settle; Back destination was not observed |
| 53 | start compare from rates | 29 | +10 | 13/20 | 101 | 637 |  |
| 54 | enter selection mode | 23 | +7 | 9/14 | 65 | 650 |  |
| 55 | select first comparison rate | 25 | +10 | 11/17 | 57 | 696 |  |
| 56 | select second comparison rate | 25 | +10 |  |  | 711 |  |
| 57 | open two-rate comparison | 24 | +8 | 33/46 | 125 | 712 |  |
| 58 | return from two-rate comparison | 23 | +5 | 21/27 | 109 | 714 |  |
| 59 | cold start | 12762 | -238 | 28/41 | 81 | 578 | 3 errors; start 4732ms; boot js-start 1117367, layout-mounted 1117587, hydrated 1117718, cache-read 1119030, core-ready 1119832, rows-prepared 1119968, search-index-idle 1119968, detail-filters-idle 1119968, leading-requested 1119968, last-pricing 1119968, splash-hide 1119970, manifest 1121982, leading-scoped 1122400, leading-page 1122400, resolved 1122913, pricing-ready 1123824, last-rows 1123824, rates-ready 1124036, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 21, pricing-scope-ms 1777, filter-runs 1, filter-rows 6944, filter-yields 5, filter-ms 119, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 18 |
| 60 | /browse | 34 | +14 | 2/2 | 32 | 413 |  |
| 61 | /watchlist | 25 | +4 | 3/4 | 32 | 418 |  |
| 62 | /market | 2540 | +2516 | 11/21 | 65 | 498 |  |
| 63 | /tools | 26 | +6 | 15/21 | 150 | 567 |  |
| 64 | /trends | 31 | +5 |  |  | 612 |  |
| 65 | /search | 4608 | +2460 | 32/45 | 150 | 626 |  |
| 66 | /banks | 25 | +4 | 30/35 | 121 | 646 |  |
| 67 | /bank-rates | 31 | +14 | 19/29 | 81 | 648 |  |
| 68 | /categories | 30 | +10 | 35/46 | 109 | 671 |  |
| 69 | /catalogue | 28 | +2 | 30/41 | 97 | 693 |  |
| 70 | /compare | 27 | +10 | 11/13 | 150 | 665 |  |
| 71 | /matches | 29 | +11 | 31/45 | 93 | 686 |  |
| 72 | /calculator | 30 | +12 | 14/19 | 97 | 665 |  |
| 73 | /projections | 27 | +3 | 24/35 | 105 | 669 |  |
| 74 | /profile | 24 | +5 | 13/20 | 121 | 674 | 13 errors |
| 75 | /research | 25 | -1 | 20/29 | 69 | 683 | 13 errors |
| 76 | /rba | 26 | +6 | 15/24 | 93 | 696 | 13 errors |
| 77 | /rba-response | 33 | +10 | 19/31 | 57 | 696 | 13 errors |
| 78 | /settings | 26 | +5 | 16/27 | 61 | 703 |  |
| 79 | /about | 34 | +11 | 13/22 | 65 | 703 |  |
| 80 | /terms | 29 | +12 | 16/23 | 77 | 703 |  |
| 81 | /privacy | 31 | +14 |  |  | 702 |  |
| 82 | /third-party-notices | 36 | +15 | 14/22 | 69 | 706 |  |
| 83 | /node | 32 | +11 | 36/50 | 93 | 747 |  |
| 84 | /passthrough | 36 | +17 | 32/44 | 101 | 726 |  |
| 85 | /calculation-receipt | 31 | +14 | 18/26 | 69 | 715 |  |
| 86 | /rate-receipt | 32 | +14 | 6/9 | 77 | 717 |  |
| 87 | warm resume | 728 | +306 | 4/5 | 133 | 716 | start 422ms |
| 88 | cold relaunch | 12774 | +5149 | 23/32 | 200 | 575 | 3 errors; start 4711ms; boot js-start 1356013, layout-mounted 1356226, hydrated 1356337, cache-read 1357617, core-ready 1358414, rows-prepared 1358579, search-index-idle 1358579, detail-filters-idle 1358579, leading-requested 1358579, last-pricing 1358579, splash-hide 1358581, manifest 1360637, leading-scoped 1361040, leading-page 1361040, resolved 1361576, pricing-ready 1362494, last-rows 1362494, rates-ready 1362694, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 22, pricing-scope-ms 1733, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 110, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 14 |
| 89 | about | 50 | +23 | 10/20 | 250 | 603 |  |
| 90 | audit screen | 29 | +15 | 200/325 | 65 | 589 |  |
| 91 | audit 0 min | 0 | 0 | 28/32 | 65 | 839 |  |
| 92 | audit 2 min | 0 | 0 | 1267/1452 | 113 | 994 | 80 errors |
| 93 | audit 3 min | 0 | 0 | 539/613 | 117 | 1075 | 80 errors |
| 94 | audit 5 min | 0 | 0 | 1289/1474 | 109 | 1229 | 80 errors |
| 95 | audit 7 min | 0 |  | 748/836 | 121 | 1240 | 80 errors |
| 96 | audit 8 min | 0 | 0 | 673/783 | 101 | 1292 | 80 errors |
| 97 | audit 10 min | 0 |  | 891/1038 | 113 | 1329 | 80 errors |
| 98 | audit 11 min | 0 | 0 | 243/269 | 117 | 1348 | 80 errors |
| 99 | audit 12 min | 0 | 0 | 164/194 | 38 | 1371 | 19 errors |
| 100 | audit 14 min | 0 |  | 70/84 | 34 | 1385 |  |
| 101 | audit 15 min | 0 |  | 93/117 | 34 | 1253 |  |
| 102 | audit 16 min | 0 |  | 59/75 | 77 | 1382 |  |
| 103 | audit finished | 0 | 0 | 91/158 | 73 | 1385 |  |
| 104 | audit result 1 | 0 | 0 |  |  | 1377 |  |
| 105 | audit result 2 | 0 | 0 |  |  | 1380 |  |
| 106 | audit result 3 | 0 | 0 |  |  | 1378 |  |
| 107 | audit result 4 | 0 | 0 |  |  | 1378 |  |
| 108 | audit result 5 | 0 | 0 |  |  | 1381 |  |
| 109 | audit result 6 | 0 | 0 |  |  | 1379 |  |
| 110 | audit result 7 | 0 | 0 |  |  | 1379 |  |
| 111 | audit result 8 | 0 | 0 |  |  | 1383 |  |
| 112 | audit result 9 | 0 | 0 |  |  | 1380 |  |
| 113 | audit result 10 | 0 | 0 |  |  | 1383 |  |
| 114 | audit result 11 | 0 | 0 |  |  | 1381 |  |
| 115 | audit result 12 | 0 | 0 |  |  | 1381 |  |
| 116 | about for debug log | 3241 | +3220 | 22/34 | 77 | 1266 |  |
| 117 | debug log screen | 1 | +1 | 110/202 | 65 | 1254 |  |
| 118 | debug log uploaded | 0 | 0 | 20/30 | 113 | 1283 |  |

## Errors

### 1 open app
```
11-26 19:50:20.866 E/australianrates(11042): Not starting debugger since process cannot load the jdwp agent.
```

### 34 search Macquarie
```
11-26 19:57:01.110 E/FrameTracker(11042): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 42 verify fixed was not applied
```
11-26 19:58:05.490 E/FrameTracker(11042): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 44 start save from rates
```
11-26 19:58:23.205 E/FrameTracker(11042): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 open unsaved rate
```
11-26 19:58:29.221 E/ImeBackDispatcher(11042): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 190234691
```

### 46 save a rate
```
11-26 19:58:39.799 E/FrameTracker(11042): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 48 restart with a saved rate
```
11-26 19:58:54.201 E/australianrates(16556): Not starting debugger since process cannot load the jdwp agent.
11-26 19:59:00.485 E/SurfaceSyncGroup(16556): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-26 19:59:00.486 E/SurfaceSyncGroup(16556): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 59 cold start
```
11-26 20:01:10.899 E/australianrates(18052): Not starting debugger since process cannot load the jdwp agent.
11-26 20:01:15.341 E/SurfaceSyncGroup(18052): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-26 20:01:15.342 E/SurfaceSyncGroup(18052): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 74 /profile
```
11-26 20:03:29.995 E/ReactNativeJS(18052): [AR error] app-update: check failed: APK manifest request timed out after 5000 ms
11-26 20:03:29.997 E/unknown:ReactNative(18052): ?anon_0_@1:2720067
11-26 20:03:29.997 E/unknown:ReactNative(18052): SyntheticError@1:163048
11-26 20:03:29.997 E/unknown:ReactNative(18052): Wrapper@1:163563
11-26 20:03:29.997 E/unknown:ReactNative(18052): _callSuper@1:148436
11-26 20:03:29.997 E/unknown:ReactNative(18052): _construct@1:163911
11-26 20:03:29.997 E/unknown:ReactNative(18052): _next@1:594899
11-26 20:03:29.997 E/unknown:ReactNative(18052): append@1:863796
```

### 75 /research
```
11-26 20:03:37.345 E/ReactNativeJS(18052): [AR error] app-update: check failed: APK manifest request timed out after 5000 ms
11-26 20:03:37.346 E/unknown:ReactNative(18052): ?anon_0_@1:2720067
11-26 20:03:37.346 E/unknown:ReactNative(18052): SyntheticError@1:163048
11-26 20:03:37.346 E/unknown:ReactNative(18052): Wrapper@1:163563
11-26 20:03:37.346 E/unknown:ReactNative(18052): _callSuper@1:148436
11-26 20:03:37.346 E/unknown:ReactNative(18052): _construct@1:163911
11-26 20:03:37.346 E/unknown:ReactNative(18052): _next@1:594899
11-26 20:03:37.346 E/unknown:ReactNative(18052): append@1:863796
```

### 76 /rba
```
11-26 20:03:45.346 E/ReactNativeJS(18052): [AR error] app-update: check failed: APK manifest request timed out after 5000 ms
11-26 20:03:45.347 E/unknown:ReactNative(18052): ?anon_0_@1:2720067
11-26 20:03:45.347 E/unknown:ReactNative(18052): SyntheticError@1:163048
11-26 20:03:45.347 E/unknown:ReactNative(18052): Wrapper@1:163563
11-26 20:03:45.347 E/unknown:ReactNative(18052): _callSuper@1:148436
11-26 20:03:45.347 E/unknown:ReactNative(18052): _construct@1:163911
11-26 20:03:45.347 E/unknown:ReactNative(18052): _next@1:594899
11-26 20:03:45.347 E/unknown:ReactNative(18052): append@1:863796
```

### 77 /rba-response
```
11-26 20:03:52.662 E/ReactNativeJS(18052): [AR error] app-update: check failed: APK manifest request timed out after 5000 ms
11-26 20:03:52.663 E/unknown:ReactNative(18052): ?anon_0_@1:2720067
11-26 20:03:52.663 E/unknown:ReactNative(18052): SyntheticError@1:163048
11-26 20:03:52.663 E/unknown:ReactNative(18052): Wrapper@1:163563
11-26 20:03:52.663 E/unknown:ReactNative(18052): _callSuper@1:148436
11-26 20:03:52.663 E/unknown:ReactNative(18052): _construct@1:163911
11-26 20:03:52.663 E/unknown:ReactNative(18052): _next@1:594899
11-26 20:03:52.663 E/unknown:ReactNative(18052): append@1:863796
```

### 88 cold relaunch
```
11-26 20:05:09.545 E/australianrates(21229): Not starting debugger since process cannot load the jdwp agent.
11-26 20:05:13.939 E/SurfaceSyncGroup(21229): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-26 20:05:13.947 E/SurfaceSyncGroup(21229): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 92 audit 2 min
```
11-26 20:06:43.940 E/ReactNativeJS(21229): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxzgm33-7e195dca237ffe63","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":9753.6,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":178.7,"liveStage:dates-index:fetched:ms":199.5,"liveStage:revision:verified:ms":74.7,"liveStage:Core asset:downloaded:ms":253.8,"liveStage:Core asset:hash-verified:ms":4.8,"liveStage:Core asset:native-inflated-and-text-decoded:ms":187.4,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":335.8,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":680.6,"liveStage:Details asset:downloaded:ms":1391.8,"liveStage:Details asset:hash-verified:ms":14.9,"live…
11-26 20:06:43.942 E/unknown:ReactNative(21229): ?anon_0_@1:3699674
11-26 20:06:43.942 E/unknown:ReactNative(21229): ?anon_0_@1:3705474
11-26 20:06:43.942 E/unknown:ReactNative(21229): SyntheticError@1:163048
11-26 20:06:43.942 E/unknown:ReactNative(21229): Wrapper@1:163563
11-26 20:06:43.942 E/unknown:ReactNative(21229): _callSuper@1:148436
11-26 20:06:43.942 E/unknown:ReactNative(21229): _construct@1:163911
11-26 20:06:43.942 E/unknown:ReactNative(21229): _next@1:594899
```

### 93 audit 3 min
```
11-26 20:09:15.381 E/ReactNativeJS(21229): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxzgm33-7e195dca237ffe63","check":{"id":"deep-first-pass.route.rates-mortgage-scope.search.mortgage.scope.apply.1","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.1 (first-pass)","kind":"journey","status":"fail","durationMs":9440.7,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.1","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.1","iteration":"cold","passId":"first-pass","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.1","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":20,"actionRevisionAfter":21,"renderRevisionBefore":"state-15","renderRevisionAfter":"state-21","actionMs":142,"preActionWaitMs":1,"preActionQuietWindowReused":true,"p…
11-26 20:09:15.382 E/unknown:ReactNative(21229): ?anon_0_@1:3699674
11-26 20:09:15.382 E/unknown:ReactNative(21229): ?anon_0_@1:3705474
11-26 20:09:15.382 E/unknown:ReactNative(21229): SyntheticError@1:163048
11-26 20:09:15.382 E/unknown:ReactNative(21229): Wrapper@1:163563
11-26 20:09:15.382 E/unknown:ReactNative(21229): _callSuper@1:148436
11-26 20:09:15.382 E/unknown:ReactNative(21229): _construct@1:163911
11-26 20:09:15.382 E/unknown:ReactNative(21229): _next@1:594899
```

### 94 audit 5 min
```
11-26 20:10:06.003 E/ReactNativeJS(21229): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxzgm33-7e195dca237ffe63","check":{"id":"deep-first-pass.sample.catalogue.0.product.open","label":"sample.catalogue.0: product.open (first-pass)","kind":"journey","status":"fail","durationMs":1660.9,"metrics":{"journeyId":"sample.catalogue.0.product.open","journeyLabel":"sample.catalogue.0: product.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.0","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Bendigo%20Bank%7Ce7e9fe9a-f9e9-4316-a78f-8f00a1850daf%7CTRANS_AND_SAVINGS_ACCOUNTS%7CBendigo%20PiggySaver","expectedPath":"/product/Bendigo%20Bank%7Ce7e9fe9a-f9e9-4316-a78f-8f00a1850daf%7CTRANS_AND_SAVINGS_ACCOUNTS%7CBendigo%20PiggySaver","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":413,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validatio…
11-26 20:10:06.005 E/unknown:ReactNative(21229): ?anon_0_@1:3699674
11-26 20:10:06.005 E/unknown:ReactNative(21229): ?anon_0_@1:3705474
11-26 20:10:06.005 E/unknown:ReactNative(21229): SyntheticError@1:163048
11-26 20:10:06.005 E/unknown:ReactNative(21229): Wrapper@1:163563
11-26 20:10:06.005 E/unknown:ReactNative(21229): _callSuper@1:148436
11-26 20:10:06.005 E/unknown:ReactNative(21229): _construct@1:163911
11-26 20:10:06.005 E/unknown:ReactNative(21229): _next@1:594899
```

### 95 audit 7 min
```
11-26 20:12:34.347 E/ReactNativeJS(21229): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxzgm33-7e195dca237ffe63","check":{"id":"deep-first-pass.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (first-pass)","kind":"journey","status":"fail","durationMs":3343.6,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":244.6,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1278.4,"forwardWorkMs":1278.4,"navigationCommitMs":1277.9,"firstReadyFrameMs…
11-26 20:12:34.348 E/unknown:ReactNative(21229): ?anon_0_@1:3699674
11-26 20:12:34.348 E/unknown:ReactNative(21229): ?anon_0_@1:3705474
11-26 20:12:34.348 E/unknown:ReactNative(21229): SyntheticError@1:163048
11-26 20:12:34.348 E/unknown:ReactNative(21229): Wrapper@1:163563
11-26 20:12:34.348 E/unknown:ReactNative(21229): _callSuper@1:148436
11-26 20:12:34.348 E/unknown:ReactNative(21229): _construct@1:163911
11-26 20:12:34.348 E/unknown:ReactNative(21229): _next@1:594899
```

### 96 audit 8 min
```
11-26 20:14:20.881 E/ReactNativeJS(21229): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxzgm33-7e195dca237ffe63","check":{"id":"deep-repeat.route.product.product.receipt.open","label":"route.product: product.receipt.open (repeat)","kind":"journey","status":"fail","durationMs":1271.3,"metrics":{"journeyId":"route.product.product.receipt.open","journeyLabel":"route.product: product.receipt.open","iteration":"warm","passId":"repeat","scenarioId":"route.product","semanticActionId":"product.receipt.open","depth":1,"plannedExpectedPath":"/rate-receipt","expectedPath":"/rate-receipt","expectedSurface":"receipt.evidence","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":15,"actionRevisionAfter":16,"actionMs":287.1,"preActionWaitMs":0.8,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0…
11-26 20:14:20.882 E/unknown:ReactNative(21229): ?anon_0_@1:3699674
11-26 20:14:20.882 E/unknown:ReactNative(21229): ?anon_0_@1:3705474
11-26 20:14:20.882 E/unknown:ReactNative(21229): SyntheticError@1:163048
11-26 20:14:20.882 E/unknown:ReactNative(21229): Wrapper@1:163563
11-26 20:14:20.882 E/unknown:ReactNative(21229): _callSuper@1:148436
11-26 20:14:20.882 E/unknown:ReactNative(21229): _construct@1:163911
11-26 20:14:20.882 E/unknown:ReactNative(21229): _next@1:594899
```

### 97 audit 10 min
```
11-26 20:15:40.484 E/ReactNativeJS(21229): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxzgm33-7e195dca237ffe63","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1534.1,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Bendigo%20Bank%7Ce7e9fe9a-f9e9-4316-a78f-8f00a1850daf%7CTRANS_AND_SAVINGS_ACCOUNTS%7CBendigo%20PiggySaver","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter…
11-26 20:15:40.485 E/unknown:ReactNative(21229): ?anon_0_@1:3699674
11-26 20:15:40.485 E/unknown:ReactNative(21229): ?anon_0_@1:3705474
11-26 20:15:40.485 E/unknown:ReactNative(21229): SyntheticError@1:163048
11-26 20:15:40.485 E/unknown:ReactNative(21229): Wrapper@1:163563
11-26 20:15:40.485 E/unknown:ReactNative(21229): _callSuper@1:148436
11-26 20:15:40.485 E/unknown:ReactNative(21229): _construct@1:163911
11-26 20:15:40.485 E/unknown:ReactNative(21229): _next@1:594899
```

### 98 audit 11 min
```
11-26 20:17:16.156 E/ReactNativeJS(21229): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxzgm33-7e195dca237ffe63","check":{"id":"deep-repeat.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (repeat)","kind":"journey","status":"fail","durationMs":2590,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":87.2,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1679.2,"forwardWorkMs":1679.2,"navigationCommitMs":1678.8,"firstReadyFrameMs":0.4,"firstRea…
11-26 20:17:16.159 E/unknown:ReactNative(21229): ?anon_0_@1:3699674
11-26 20:17:16.159 E/unknown:ReactNative(21229): ?anon_0_@1:3705474
11-26 20:17:16.159 E/unknown:ReactNative(21229): SyntheticError@1:163048
11-26 20:17:16.159 E/unknown:ReactNative(21229): Wrapper@1:163563
11-26 20:17:16.159 E/unknown:ReactNative(21229): _callSuper@1:148436
11-26 20:17:16.159 E/unknown:ReactNative(21229): _construct@1:163911
11-26 20:17:16.159 E/unknown:ReactNative(21229): _next@1:594899
```

### 99 audit 12 min
```
11-26 20:18:12.614 E/ReactNativeJS(21229): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxzgm33-7e195dca237ffe63","check":{"id":"external-link-378","kind":"network","status":"fail","durationMs":1481.2921640002169,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"pass","browserHandler":"pass","httpReachability":"fail","statusCode":404,"handlerAttempted":true,"httpAttempted":true,"httpSelected":true,"handlerResolution":"pass","host":"www.defencebank.com.au","destinationPath":"/banking/home-loans/essentials-home-loan---ultimate-package-investor-interest-only/"},"error":"HTTP 404: the destination is missing or unavailable.","canonicalMetrics":true}}
11-26 20:18:12.616 E/unknown:ReactNative(21229): ?anon_0_@1:3699674
11-26 20:18:12.616 E/unknown:ReactNative(21229): ?anon_0_@1:3709035
11-26 20:18:12.616 E/unknown:ReactNative(21229): SyntheticError@1:163048
11-26 20:18:12.616 E/unknown:ReactNative(21229): Wrapper@1:163563
11-26 20:18:12.616 E/unknown:ReactNative(21229): _callSuper@1:148436
11-26 20:18:12.616 E/unknown:ReactNative(21229): _construct@1:163911
11-26 20:18:12.616 E/unknown:ReactNative(21229): _next@1:594899
```
