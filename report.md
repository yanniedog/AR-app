# App explorer: 1.0.390 (446)

**Real-use session FAIL vs 1.0.389: 1 broken, 23 friction, 17 slower**

- Broken: "follow browse rates recovery" failed: UI assertion failed: app hierarchy unavailable
- Friction: No reaction for 3.9 s after "scroll rates 1"
- Friction: No reaction for 3.4 s after "scroll rates 2"
- Friction: No reaction for 4.2 s after "open product"
- Friction: No reaction for 3.1 s after "scroll product fees"
- Friction: No reaction for 3.3 s after "scroll product eligibility"
- Friction: No reaction for 4.4 s after "scroll product sources"
- Friction: No reaction for 4.9 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 5.1 s after "open term deposits"
- Friction: No reaction for 3.5 s after "verify term deposit rates"
- Friction: No reaction for 3.1 s after "open savings search"
- Friction: No reaction for 8.3 s after "search Macquarie"
- Friction: No reaction for 3.2 s after "return from savings search"
- Friction: No reaction for 3.8 s after "open mortgage filter draft"
- Friction: No reaction for 3.9 s after "verify fixed was not applied"
- Friction: No reaction for 3.6 s after "open unsaved rate"
- Friction: No reaction for 3.5 s after "open product from saved rates"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: "No saved rates" shown on "follow browse rates recovery"
- Friction: No reaction for 3.4 s after "open two-rate comparison"
- Slower: "open app" content 24.1 s to 37.8 s
- Slower: "open app" reaction 24.1 s to 37.8 s
- Slower: Dropped frames 47% to 65% on "scroll rates 2"
- Slower: Dropped frames 49% to 64% on "expand product facts"
- Slower: "expand product facts" content 0.0 s to 2.3 s
- Slower: "scroll product fees" content 0.7 s to 3.1 s
- Slower: "scroll product eligibility" content 0.7 s to 3.3 s
- Slower: Dropped frames 59% to 76% on "expand eligibility"
- Slower: "scroll product sources" content 2.9 s to 4.4 s
- Slower: "scroll product sources" reaction 2.9 s to 4.4 s
- Slower: Dropped frames 46% to 65% on "back to rates"
- Slower: Dropped frames 61% to 78% on "switch to savings"
- Slower: Dropped frames 45% to 62% on "return to rates"
- Slower: Dropped frames 59% to 74% on "restart with a saved rate"
- Slower: Dropped frames 48% to 72% on "verify saved rate after restart"
- Slower: "remove saved rate" content 0.0 s to 2.5 s
- Slower: "start compare from rates" content 0.0 s to 2.1 s

**Initial Rates readiness:** 42.7 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 9 passed, 1 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3752 bytes, latest published run date 2026-11-27

Mode full | 121 steps | crashes 0 | step failures 1 | settle timeouts 0 | steps with JS/native errors 18
Baseline 1.0.389
**Audit live: outcome failed | 1005 s | audit log 853449 bytes (audit-log.txt) https://paste.c-net.org/383bf2bd-bff6-e123-2123-b62f29c0af61 | debug log 5673160 bytes read from host https://paste.c-net.org/adbb542c-041e-29de-8520-cbdb8d323f7a**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3123 | -23364 | 671/935 | 85 | 496 | 1 errors; start 3079ms |
| 2 | scroll rates 1 | 727 | -17 | 36/54 | 89 | 603 | boot js-start 476139, layout-mounted 476735, cache-read 476893, hydrated 477145, splash-hide 477145, manifest 478220, resolved 478824, core-fetched 484480, core-saved 485264, search-index-idle 485549, leading-requested 485549, details-start 485954, leading-scoped 486361, pricing-ready 491852, details-fetched 497054, rows-prepared 504954, detail-filters-idle 504954, last-pricing 504954, suitability-built 506188, post-refresh-wait 507007, leading-page 509406, last-rows 518703, rates-ready 518882, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 201, pricing-scope-ms 18344, leading-gated 1, filter-runs 2, filter-rows 31912, filter-yields 9, filter-ms 324, sort-runs 4, sort-rows 1191, sort-yields 4, sort-ms 193 |
| 3 | scroll rates 2 | 696 | +2 | 22/34 | 105 | 659 |  |
| 4 | scroll rates back | 693 | +13 |  |  | 537 |  |
| 5 | open product | 28 | -6142 | 36/60 | 93 | 626 |  |
| 6 | scroll product | 681 | -21 | 15/27 | 81 | 669 |  |
| 7 | expand visible fees | 0 | -22 |  |  | 658 |  |
| 8 | expand product facts | 21 | +21 | 77/120 | 89 | 678 |  |
| 9 | scroll product fees | 731 | -7 | 33/54 | 81 | 691 |  |
| 10 | scroll product eligibility | 723 | +4 | 29/53 | 81 | 689 |  |
| 11 | expand eligibility | 0 | 0 | 215/284 | 85 | 667 |  |
| 12 | expand constraints | 21 | +2 | 9/16 | 61 | 662 |  |
| 13 | scroll product sources | 753 | +68 | 30/49 | 77 | 673 |  |
| 14 | back to rates | 25 | +4 | 15/23 | 65 | 663 |  |
| 15 | open lenders | 24 | +4 | 18/23 | 250 | 668 |  |
| 16 | scroll lenders | 811 | +97 | 19/20 | 133 | 666 |  |
| 17 | back from lenders | 22 | +1 | 5/8 | 150 | 665 |  |
| 18 | switch to savings | 23 | +2 | 67/86 | 89 | 672 |  |
| 19 | switch to home loans | 25 | +3 | 14/29 | 61 | 687 |  |
| 20 | open filters | 25 | +2 | 23/26 | 117 | 689 |  |
| 21 | close filters | 22 | +2 | 6/8 | 200 | 686 |  |
| 22 | open market | 25 | +5 | 19/31 | 85 | 689 |  |
| 23 | open rba | 2846 | +369 | 81/99 | 69 | 705 |  |
| 24 | scroll rba | 704 | +15 | 14/25 | 77 | 698 |  |
| 25 | back from rba | 23 | -2 | 11/19 | 65 | 698 |  |
| 26 | scroll market | 693 | +4 | 25/39 | 85 | 697 |  |
| 27 | open saved | 24 | +4 | 12/17 | 73 | 701 |  |
| 28 | return to rates | 23 | +5 | 26/42 | 69 | 703 |  |
| 29 | start category switch | 31 | +7 |  |  | 702 |  |
| 30 | open term deposits | 25 | +6 | 61/89 | 85 | 721 |  |
| 31 | verify term deposit rates | 717 | +6 | 33/51 | 85 | 721 |  |
| 32 | restore home loans | 22 | +1 | 15/28 | 65 | 731 |  |
| 33 | start search from rates | 27 | +1 |  |  | 727 |  |
| 34 | open savings search | 24 | +3 | 18/30 | 77 | 745 |  |
| 35 | search Macquarie | 2284 | +287 | 84/97 | 150 | 743 | 1 errors |
| 36 | verify Macquarie result | 0 | 0 | 12/15 | 16 | 739 |  |
| 37 | clear query and restore results | 22 | +2 | 18/20 | 36 | 748 |  |
| 38 | return from savings search | 22 | -1 | 29/41 | 77 | 768 |  |
| 39 | start filter rollback | 28 | -20 | 14/15 | 16 | 761 |  |
| 40 | open mortgage filter draft | 24 | +4 | 27/29 | 150 | 763 |  |
| 41 | select fixed in draft | 23 | +4 | 10/12 | 113 | 760 |  |
| 42 | discard unsaved filter draft | 23 | +5 | 17/22 | 150 | 762 |  |
| 43 | verify fixed was not applied | 24 | -5 | 26/32 | 133 | 768 | 1 errors |
| 44 | close verified filter draft | 21 | +3 | 16/22 | 105 | 765 |  |
| 45 | start save from rates | 27 | +4 | 15/17 | 16 | 763 | 1 errors |
| 46 | open unsaved rate | 22 | +3 | 127/179 | 81 | 793 | 1 errors |
| 47 | save a rate | 33 | +14 | 11/16 | 69 | 792 | 1 errors |
| 48 | leave saved product | 29 | +7 | 15/23 | 89 | 796 |  |
| 49 | restart with a saved rate | 17995 | +6725 | 190/257 | 97 | 592 | 3 errors; start 6636ms; boot js-start 1001905, layout-mounted 1002670, hydrated 1002871, cache-read 1004329, core-ready 1005121, rows-prepared 1005317, search-index-idle 1005317, detail-filters-idle 1005317, leading-requested 1005317, last-pricing 1005317, splash-hide 1005319, manifest 1007663, leading-scoped 1009305, leading-page 1009305, resolved 1010089, pricing-ready 1012465, last-rows 1012465, rates-ready 1012643, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 22, pricing-scope-ms 4196, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 101, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 14 |
| 50 | verify saved rate after restart | 32 | +8 | 26/36 | 89 | 624 |  |
| 51 | open product from saved rates | 23 | +2 |  |  | 521 |  |
| 52 | remove saved rate | 25 | -2 | 12/19 | 81 | 571 |  |
| 53 | leave removed product | 24 | +1 | 8/8 | 93 | 638 |  |
| 54 | follow browse rates recovery | 50 | -7156 |  |  | 645 | UI assertion failed: app hierarchy unavailable |
| 55 | start compare from rates | 4540 | +4511 | 20/29 | 61 | 673 |  |
| 56 | enter selection mode | 24 | +3 | 12/17 | 65 | 689 |  |
| 57 | select first comparison rate | 48 | +28 |  |  | 718 |  |
| 58 | select second comparison rate | 22 | 0 | 19/29 | 57 | 729 |  |
| 59 | open two-rate comparison | 23 | +2 | 19/30 | 150 | 745 |  |
| 60 | return from two-rate comparison | 22 | -1 | 19/29 | 89 | 747 |  |
| 61 | cold start | 10141 | +1802 | 24/29 | 400 | 580 | 3 errors; start 4248ms; boot js-start 1141233, layout-mounted 1141428, hydrated 1141556, cache-read 1142737, core-ready 1143522, rows-prepared 1143656, search-index-idle 1143656, detail-filters-idle 1143656, leading-requested 1143656, last-pricing 1143656, splash-hide 1143657, manifest 1145622, leading-scoped 1146097, leading-page 1146097, resolved 1146581, pricing-ready 1147390, last-rows 1147390, rates-ready 1147584, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 25, pricing-scope-ms 1714, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 105, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 15 |
| 62 | /browse | 4497 | +4472 | 2/2 | 32 | 430 |  |
| 63 | /watchlist | 30 | -5 | 2/3 | 32 | 438 |  |
| 64 | /market | 32 | +4 | 13/19 | 48 | 513 |  |
| 65 | /tools | 28 | +4 | 13/21 | 97 | 575 |  |
| 66 | /trends | 28 | +6 |  |  | 613 |  |
| 67 | /search | 4599 | +4575 | 45/54 | 129 | 619 |  |
| 68 | /banks | 25 | 0 | 33/41 | 117 | 635 |  |
| 69 | /bank-rates | 33 | +7 | 18/24 | 109 | 647 |  |
| 70 | /categories | 28 | +3 | 32/46 | 97 | 675 |  |
| 71 | /catalogue | 27 | +6 | 32/40 | 113 | 693 |  |
| 72 | /compare | 30 | +7 | 14/16 | 117 | 663 |  |
| 73 | /matches | 33 | +2 | 35/46 | 93 | 684 |  |
| 74 | /calculator | 27 | 0 | 16/23 | 77 | 666 |  |
| 75 | /projections | 25 | -2 | 23/36 | 93 | 672 |  |
| 76 | /profile | 29 | +6 | 16/27 | 77 | 673 |  |
| 77 | /research | 30 | +7 | 18/28 | 109 | 682 |  |
| 78 | /rba | 26 | +3 | 13/22 | 150 | 696 |  |
| 79 | /rba-response | 26 | -2 | 15/27 | 81 | 696 |  |
| 80 | /settings | 33 | +7 | 18/27 | 73 | 702 |  |
| 81 | /about | 24 | -4 | 13/23 | 77 | 702 |  |
| 82 | /terms | 30 | +6 | 13/23 | 81 | 703 |  |
| 83 | /privacy | 27 | -3 |  |  | 702 |  |
| 84 | /third-party-notices | 35 | +15 | 13/22 | 93 | 707 |  |
| 85 | /node | 31 | +7 | 35/44 | 97 | 745 |  |
| 86 | /passthrough | 36 | +4 | 31/42 | 89 | 734 |  |
| 87 | /calculation-receipt | 32 | +8 | 17/25 | 77 | 709 |  |
| 88 | /rate-receipt | 26 | -1 | 6/9 | 77 | 711 |  |
| 89 | warm resume | 930 | +308 | 5/5 | 81 | 710 |  |
| 90 | cold relaunch | 10426 | +1769 | 28/37 | 105 | 577 | 3 errors; start 4319ms; boot js-start 1379545, layout-mounted 1379751, hydrated 1379841, cache-read 1381209, core-ready 1381988, rows-prepared 1382133, search-index-idle 1382133, detail-filters-idle 1382133, leading-requested 1382133, last-pricing 1382133, splash-hide 1382135, manifest 1384461, leading-scoped 1384907, leading-page 1384907, resolved 1385301, pricing-ready 1386134, last-rows 1386134, rates-ready 1386318, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 21, pricing-scope-ms 1563, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 107, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 15 |
| 91 | about | 30 | -4 | 13/21 | 73 | 405 |  |
| 92 | audit screen | 22 | +3 | 156/275 | 61 | 611 |  |
| 93 | audit 0 min | 0 | 0 | 30/33 | 61 | 849 |  |
| 94 | audit 1 min | 0 |  | 1069/1223 | 113 | 916 | 80 errors |
| 95 | audit 3 min | 0 | 0 | 706/790 | 117 | 1147 | 80 errors |
| 96 | audit 4 min | 0 | 0 | 521/587 | 105 | 1144 | 80 errors |
| 97 | audit 5 min | 0 |  | 878/1024 | 109 | 1183 | 80 errors |
| 98 | audit 7 min | 0 | 0 | 412/468 | 117 | 1347 | 80 errors |
| 99 | audit 8 min | 0 | 0 | 748/863 | 105 | 1274 | 80 errors |
| 100 | audit 9 min | 0 |  | 280/335 | 105 | 1281 | 80 errors |
| 101 | audit 10 min | 0 | 0 | 945/1083 | 109 | 1390 | 80 errors |
| 102 | audit 12 min | 0 | 0 | 282/328 | 105 | 1364 | 80 errors |
| 103 | audit 14 min | 0 |  | 153/187 | 34 | 1388 |  |
| 104 | audit 15 min | 0 |  | 128/150 | 53 | 1432 |  |
| 105 | audit 16 min | 0 |  | 25/36 | 73 | 1435 |  |
| 106 | audit finished | 0 | 0 | 98/166 | 65 | 1405 |  |
| 107 | audit result 1 | 0 | 0 |  |  | 1402 |  |
| 108 | audit result 2 | 0 | 0 |  |  | 1405 |  |
| 109 | audit result 3 | 0 | 0 |  |  | 1404 |  |
| 110 | audit result 4 | 0 | 0 |  |  | 1403 |  |
| 111 | audit result 5 | 0 | 0 |  |  | 1406 |  |
| 112 | audit result 6 | 0 | 0 |  |  | 1404 |  |
| 113 | audit result 7 | 0 | 0 |  |  | 1407 |  |
| 114 | audit result 8 | 0 | 0 |  |  | 1407 |  |
| 115 | audit result 9 | 0 | 0 |  |  | 1408 |  |
| 116 | audit result 10 | 0 | 0 |  |  | 1409 |  |
| 117 | audit result 11 | 0 | 0 |  |  | 1407 |  |
| 118 | audit result 12 | 0 | 0 |  |  | 1410 |  |
| 119 | about for debug log | 3183 | +88 | 20/29 | 105 | 1278 |  |
| 120 | debug log screen | 0 | -1 | 111/205 | 65 | 1275 |  |
| 121 | debug log uploaded | 0 | 0 | 23/29 | 125 | 1497 |  |

## Errors

### 1 open app
```
11-26 23:50:29.077 E/australianrates(11255): Not starting debugger since process cannot load the jdwp agent.
```

### 35 search Macquarie
```
11-26 23:57:19.679 E/FrameTracker(11255): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 43 verify fixed was not applied
```
11-26 23:58:23.698 E/FrameTracker(11255): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 start save from rates
```
11-26 23:58:41.597 E/FrameTracker(11255): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 open unsaved rate
```
11-26 23:58:47.980 E/ImeBackDispatcher(11255): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 26496086
```

### 47 save a rate
```
11-26 23:58:58.513 E/FrameTracker(11255): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 49 restart with a saved rate
```
11-26 23:59:14.677 E/australianrates(16897): Not starting debugger since process cannot load the jdwp agent.
11-26 23:59:21.108 E/SurfaceSyncGroup(16897): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-26 23:59:21.108 E/SurfaceSyncGroup(16897): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 61 cold start
```
11-27 00:01:35.431 E/australianrates(18480): Not starting debugger since process cannot load the jdwp agent.
11-27 00:01:39.457 E/SurfaceSyncGroup(18480): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-27 00:01:39.457 E/SurfaceSyncGroup(18480): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 90 cold relaunch
```
11-27 00:05:33.688 E/australianrates(21590): Not starting debugger since process cannot load the jdwp agent.
11-27 00:05:37.933 E/SurfaceSyncGroup(21590): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-27 00:05:37.937 E/SurfaceSyncGroup(21590): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 94 audit 1 min
```
11-27 00:06:57.847 E/ReactNativeJS(21590): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy81jwl-e799202b73671020","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":9791.6,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":184.5,"liveStage:dates-index:fetched:ms":201.3,"liveStage:revision:verified:ms":63.7,"liveStage:Core asset:downloaded:ms":227.6,"liveStage:Core asset:hash-verified:ms":7.2,"liveStage:Core asset:native-inflated-and-text-decoded:ms":172,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":267.4,"liveStage:core:history-sealed:ms":0,"liveStage:core:normalized:ms":655.6,"liveStage:Details asset:downloaded:ms":1471.3,"liveStage:Details asset:hash-verified:ms":27.5,"liveStag…
11-27 00:06:57.849 E/unknown:ReactNative(21590): ?anon_0_@1:3707460
11-27 00:06:57.849 E/unknown:ReactNative(21590): ?anon_0_@1:3713260
11-27 00:06:57.849 E/unknown:ReactNative(21590): SyntheticError@1:163172
11-27 00:06:57.849 E/unknown:ReactNative(21590): Wrapper@1:163687
11-27 00:06:57.849 E/unknown:ReactNative(21590): _callSuper@1:148560
11-27 00:06:57.849 E/unknown:ReactNative(21590): _construct@1:164035
11-27 00:06:57.849 E/unknown:ReactNative(21590): _next@1:595023
```

### 95 audit 3 min
```
11-27 00:08:47.088 E/ReactNativeJS(21590): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy81jwl-e799202b73671020","check":{"id":"deep-first-pass.route.rates.search.query.clear","label":"route.rates: search.query.clear (first-pass)","kind":"journey","status":"fail","durationMs":1298.3,"metrics":{"journeyId":"route.rates.search.query.clear","journeyLabel":"route.rates: search.query.clear","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.query.clear","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":1,"actionRevisionAfter":2,"renderRevisionBefore":"state-13","renderRevisionAfter":"state-16","actionMs":39.9,"preActionWaitMs":4.7,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks"…
11-27 00:08:47.090 E/unknown:ReactNative(21590): ?anon_0_@1:3707460
11-27 00:08:47.090 E/unknown:ReactNative(21590): ?anon_0_@1:3713260
11-27 00:08:47.090 E/unknown:ReactNative(21590): SyntheticError@1:163172
11-27 00:08:47.090 E/unknown:ReactNative(21590): Wrapper@1:163687
11-27 00:08:47.090 E/unknown:ReactNative(21590): _callSuper@1:148560
11-27 00:08:47.090 E/unknown:ReactNative(21590): _construct@1:164035
11-27 00:08:47.090 E/unknown:ReactNative(21590): _next@1:595023
```

### 96 audit 4 min
```
11-27 00:10:20.490 E/ReactNativeJS(21590): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy81jwl-e799202b73671020","check":{"id":"deep-first-pass.route.lender.product.lender.open","label":"route.lender: product.lender.open (first-pass)","kind":"journey","status":"fail","durationMs":2525,"metrics":{"journeyId":"route.lender.product.lender.open","journeyLabel":"route.lender: product.lender.open","iteration":"cold","passId":"first-pass","scenarioId":"route.lender","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/Bank%20of%20Sydney","expectedPath":"/bank/Bank%20of%20Sydney","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":4,"actionRevisionAfter":5,"actionResultEvidence":"{\"expectedPath\":\"/bank/Bank%20of%20Sydney\"}","actionMs":1018.2,"preActionWaitMs":4.5,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActio…
11-27 00:10:20.935 E/unknown:ReactNative(21590): ?anon_0_@1:3707460
11-27 00:10:20.935 E/unknown:ReactNative(21590): ?anon_0_@1:3713260
11-27 00:10:20.935 E/unknown:ReactNative(21590): SyntheticError@1:163172
11-27 00:10:20.935 E/unknown:ReactNative(21590): Wrapper@1:163687
11-27 00:10:20.935 E/unknown:ReactNative(21590): _callSuper@1:148560
11-27 00:10:20.935 E/unknown:ReactNative(21590): _construct@1:164035
11-27 00:10:20.935 E/unknown:ReactNative(21590): _next@1:595023
```

### 97 audit 5 min
```
11-27 00:11:10.527 E/ReactNativeJS(21590): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy81jwl-e799202b73671020","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":1712.7,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-27:02500ce424dd…:state-8","renderRevisionAfter":"2026-11-27:02500ce424dd…:state-9","actionResultEvidence":"{\"applied\":…
11-27 00:11:10.528 E/unknown:ReactNative(21590): ?anon_0_@1:3707460
11-27 00:11:10.528 E/unknown:ReactNative(21590): ?anon_0_@1:3713260
11-27 00:11:10.528 E/unknown:ReactNative(21590): SyntheticError@1:163172
11-27 00:11:10.528 E/unknown:ReactNative(21590): Wrapper@1:163687
11-27 00:11:10.528 E/unknown:ReactNative(21590): _callSuper@1:148560
11-27 00:11:10.528 E/unknown:ReactNative(21590): _construct@1:164035
11-27 00:11:10.528 E/unknown:ReactNative(21590): _next@1:595023
```

### 98 audit 7 min
```
11-27 00:12:54.822 E/ReactNativeJS(21590): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy81jwl-e799202b73671020","check":{"id":"deep-first-pass.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (first-pass)","kind":"journey","status":"fail","durationMs":2776.9,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":126.3,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1288.4,"forwardWorkMs":1288.4,"navigationCommitMs":1287.3,"firstReadyFrameMs…
11-27 00:12:54.823 E/unknown:ReactNative(21590): ?anon_0_@1:3707460
11-27 00:12:54.823 E/unknown:ReactNative(21590): ?anon_0_@1:3713260
11-27 00:12:54.823 E/unknown:ReactNative(21590): SyntheticError@1:163172
11-27 00:12:54.823 E/unknown:ReactNative(21590): Wrapper@1:163687
11-27 00:12:54.823 E/unknown:ReactNative(21590): _callSuper@1:148560
11-27 00:12:54.823 E/unknown:ReactNative(21590): _construct@1:164035
11-27 00:12:54.823 E/unknown:ReactNative(21590): _next@1:595023
```

### 99 audit 8 min
```
11-27 00:13:50.507 E/ReactNativeJS(21590): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy81jwl-e799202b73671020","check":{"id":"deep-repeat.route.rates-sheets.search.section.next","label":"route.rates-sheets: search.section.next (repeat)","kind":"journey","status":"fail","durationMs":9352.6,"metrics":{"journeyId":"route.rates-sheets.search.section.next","journeyLabel":"route.rates-sheets: search.section.next","iteration":"warm","passId":"repeat","scenarioId":"route.rates-sheets","semanticActionId":"search.section.next","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":40,"actionRevisionAfter":41,"renderRevisionBefore":"state-26","renderRevisionAfter":"state-32","actionMs":188,"preActionWaitMs":1.4,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"valid…
11-27 00:13:50.509 E/unknown:ReactNative(21590): ?anon_0_@1:3707460
11-27 00:13:50.509 E/unknown:ReactNative(21590): ?anon_0_@1:3713260
11-27 00:13:50.509 E/unknown:ReactNative(21590): SyntheticError@1:163172
11-27 00:13:50.509 E/unknown:ReactNative(21590): Wrapper@1:163687
11-27 00:13:50.509 E/unknown:ReactNative(21590): _callSuper@1:148560
11-27 00:13:50.509 E/unknown:ReactNative(21590): _construct@1:164035
11-27 00:13:50.509 E/unknown:ReactNative(21590): _next@1:595023
```

### 100 audit 9 min
```
11-27 00:15:19.405 E/ReactNativeJS(21590): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy81jwl-e799202b73671020","check":{"id":"deep-repeat.sample.catalogue.2.product.open","label":"sample.catalogue.2: product.open (repeat)","kind":"journey","status":"fail","durationMs":3148,"metrics":{"journeyId":"sample.catalogue.2.product.open","journeyLabel":"sample.catalogue.2: product.open","iteration":"warm","passId":"repeat","scenarioId":"sample.catalogue.2","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Dnister%7C17%7CTRANS_AND_SAVINGS_ACCOUNTS%7CiSaver","expectedPath":"/product/Dnister%7C17%7CTRANS_AND_SAVINGS_ACCOUNTS%7CiSaver","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":530.6,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":471.7,"forwardWorkMs":…
11-27 00:15:19.406 E/unknown:ReactNative(21590): ?anon_0_@1:3707460
11-27 00:15:19.406 E/unknown:ReactNative(21590): ?anon_0_@1:3713260
11-27 00:15:19.406 E/unknown:ReactNative(21590): SyntheticError@1:163172
11-27 00:15:19.406 E/unknown:ReactNative(21590): Wrapper@1:163687
11-27 00:15:19.406 E/unknown:ReactNative(21590): _callSuper@1:148560
11-27 00:15:19.406 E/unknown:ReactNative(21590): _construct@1:164035
11-27 00:15:19.406 E/unknown:ReactNative(21590): _next@1:595023
```

### 101 audit 10 min
```
11-27 00:15:57.090 E/ReactNativeJS(21590): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy81jwl-e799202b73671020","check":{"id":"deep-repeat.route.calculator.calculator.section.savings","label":"route.calculator: calculator.section.savings (repeat)","kind":"journey","status":"fail","durationMs":2949.1,"metrics":{"journeyId":"route.calculator.calculator.section.savings","journeyLabel":"route.calculator: calculator.section.savings","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.section.savings","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":13,"actionRevisionAfter":14,"renderRevisionBefore":"2026-11-27:02500ce424dd…:state-9","renderRevisionAfter":"2026-11-27:02500ce424dd…:state-10","actionResultEvidence":"{\"selectedSectionBefore\":\"Mortgage\",\"requestedSectio…
11-27 00:15:57.091 E/unknown:ReactNative(21590): ?anon_0_@1:3707460
11-27 00:15:57.091 E/unknown:ReactNative(21590): ?anon_0_@1:3713260
11-27 00:15:57.091 E/unknown:ReactNative(21590): SyntheticError@1:163172
11-27 00:15:57.091 E/unknown:ReactNative(21590): Wrapper@1:163687
11-27 00:15:57.091 E/unknown:ReactNative(21590): _callSuper@1:148560
11-27 00:15:57.091 E/unknown:ReactNative(21590): _construct@1:164035
11-27 00:15:57.091 E/unknown:ReactNative(21590): _next@1:595023
```

### 102 audit 12 min
```
11-27 00:17:45.863 E/ReactNativeJS(21590): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwy81jwl-e799202b73671020","check":{"id":"deep-repeat.redirect.projections.redirect.projections.verify","label":"redirect.projections: redirect.projections.verify (repeat)","kind":"journey","status":"fail","durationMs":5015.6,"metrics":{"journeyId":"redirect.projections.redirect.projections.verify","journeyLabel":"redirect.projections: redirect.projections.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.projections","semanticActionId":"redirect.projections.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"projections.inputs","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":953.7,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":343.7,"forwardWorkMs":343.7,…
11-27 00:17:45.867 E/unknown:ReactNative(21590): ?anon_0_@1:3707460
11-27 00:17:45.867 E/unknown:ReactNative(21590): ?anon_0_@1:3713260
11-27 00:17:45.867 E/unknown:ReactNative(21590): SyntheticError@1:163172
11-27 00:17:45.867 E/unknown:ReactNative(21590): Wrapper@1:163687
11-27 00:17:45.867 E/unknown:ReactNative(21590): _callSuper@1:148560
11-27 00:17:45.867 E/unknown:ReactNative(21590): _construct@1:164035
11-27 00:17:45.867 E/unknown:ReactNative(21590): _next@1:595023
```
