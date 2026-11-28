# App explorer: 1.0.398 (454)

**Real-use session FAIL vs 1.0.397: 1 broken, 24 friction, 26 slower**

- Broken: "leave removed product" failed: Back destination was not observed
- Friction: No reaction for 3.3 s after "scroll rates 1"
- Friction: No reaction for 3.5 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "open product"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.0 s after "scroll product sources"
- Friction: No reaction for 4.6 s after "switch to savings"
- Friction: No reaction for 3.7 s after "switch to home loans"
- Friction: No reaction for 3.3 s after "open filters"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 4.7 s after "start category switch"
- Friction: No reaction for 4.8 s after "open term deposits"
- Friction: No reaction for 3.6 s after "verify term deposit rates"
- Friction: No reaction for 3.4 s after "restore home loans"
- Friction: No reaction for 6.7 s after "search Macquarie"
- Friction: No reaction for 3.7 s after "return from savings search"
- Friction: No reaction for 3.0 s after "open mortgage filter draft"
- Friction: No reaction for 3.8 s after "verify fixed was not applied"
- Friction: No reaction for 3.8 s after "open unsaved rate"
- Friction: No reaction for 3.1 s after "verify saved rate after restart"
- Friction: No reaction for 3.3 s after "open product from saved rates"
- Friction: No reaction for 20.0 s after "leave removed product"
- Slower: Dropped frames 56% to 75% on "open app"
- Slower: Dropped frames 53% to 72% on "scroll rates 1"
- Slower: Dropped frames 51% to 71% on "scroll rates 2"
- Slower: Dropped frames 53% to 73% on "open product"
- Slower: Dropped frames 47% to 64% on "scroll product"
- Slower: Dropped frames 41% to 64% on "expand product facts"
- Slower: Dropped frames 38% to 74% on "scroll product fees"
- Slower: Dropped frames 45% to 76% on "scroll product eligibility"
- Slower: Dropped frames 57% to 76% on "expand eligibility"
- Slower: Dropped frames 40% to 62% on "back to rates"
- Slower: Dropped frames 36% to 57% on "switch to home loans"
- Slower: Dropped frames 54% to 86% on "open rba"
- Slower: Dropped frames 35% to 58% on "scroll rba"
- Slower: Dropped frames 27% to 60% on "back from rba"
- Slower: Dropped frames 50% to 68% on "open saved"
- Slower: Dropped frames 38% to 59% on "return to rates"
- Slower: Dropped frames 48% to 71% on "open term deposits"
- Slower: Dropped frames 47% to 64% on "verify term deposit rates"
- Slower: Dropped frames 74% to 91% on "search Macquarie"
- Slower: Dropped frames 60% to 78% on "open unsaved rate"
- Slower: Dropped frames 57% to 74% on "restart with a saved rate"
- Slower: Dropped frames 51% to 70% on "verify saved rate after restart"
- Slower: "remove saved rate" content 0.0 s to 2.6 s
- Slower: "leave removed product" content 0.0 s to 20.2 s
- Slower: "leave removed product" reaction 2.2 s to 20.0 s
- Slower: Dropped frames 52% to 77% on "return from two-rate comparison"

**Initial Rates readiness:** 42.3 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 8 passed, 1 failed, 1 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode full | 119 steps | crashes 0 | step failures 1 | settle timeouts 1 | steps with JS/native errors 17
Baseline 1.0.397
**Audit live: outcome failed | 1023 s | audit log 859030 bytes (audit-log.txt) https://paste.c-net.org/cdd8f09e-195c-29c8-b791-029d4ed7f933 | debug log 5683605 bytes read from host https://paste.c-net.org/f21f95f1-45b2-78a4-7018-0fbbc171d158**

Collection: complete | Coverage: incomplete | Details: incomplete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3033 | -22850 | 596/798 | 89 | 499 | 1 errors; start 2969ms |
| 2 | scroll rates 1 | 3492 | +2751 | 49/68 | 85 | 531 | boot js-start 494520, layout-mounted 495175, cache-read 495317, hydrated 495493, splash-hide 495493, manifest 496757, resolved 497358, core-fetched 502433, core-saved 503522, pricing-wait-suitability 503754, search-index-idle 503754, details-start 503980, details-fetched 512560, rows-prepared 518265, detail-filters-idle 518265, leading-requested 518265, last-pricing 518265, suitability-built 519746, post-refresh-wait 520615, leading-scoped 524275, leading-page 524275, pricing-ready 536498, last-rows 536498, rates-ready 536809, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 308, pricing-scope-ms 16847, filter-runs 2, filter-rows 37735, filter-yields 10, filter-ms 199, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 23 |
| 3 | scroll rates 2 | 687 | -2619 | 24/34 | 105 | 696 |  |
| 4 | scroll rates back | 684 | 0 |  |  | 616 |  |
| 5 | open product | 24 | -6 | 37/51 | 101 | 644 |  |
| 6 | scroll product | 690 | +4 | 41/64 | 77 | 632 |  |
| 7 | expand visible fees | 24 | +4 | 8/13 | 81 | 628 |  |
| 8 | expand product facts | 0 | -18 | 229/357 | 85 | 663 |  |
| 9 | scroll product fees | 733 | +14 | 23/31 | 81 | 627 |  |
| 10 | scroll product eligibility | 734 | +35 | 25/33 | 89 | 627 |  |
| 11 | expand eligibility | 0 | 0 | 208/275 | 89 | 639 |  |
| 12 | expand constraints | 22 | +3 | 8/15 | 77 | 632 |  |
| 13 | scroll product sources | 713 | -32 | 21/32 | 85 | 636 |  |
| 14 | back to rates | 30 | +10 | 13/21 | 77 | 632 |  |
| 15 | open lenders | 21 | +2 | 18/22 | 250 | 635 |  |
| 16 | scroll lenders | 691 | -36 | 19/20 | 150 | 633 |  |
| 17 | back from lenders | 25 | +6 | 7/8 | 250 | 634 |  |
| 18 | switch to savings | 24 | +5 | 50/78 | 85 | 651 |  |
| 19 | switch to home loans | 21 | +2 | 17/30 | 65 | 669 |  |
| 20 | open filters | 21 | +2 | 22/26 | 200 | 667 |  |
| 21 | close filters | 20 | +2 | 7/9 | 129 | 669 |  |
| 22 | open market | 22 | +3 | 20/32 | 65 | 675 |  |
| 23 | open rba | 2637 | +127 | 79/92 | 69 | 697 |  |
| 24 | scroll rba | 682 | -6 | 29/50 | 73 | 690 |  |
| 25 | back from rba | 30 | +9 | 12/20 | 69 | 691 |  |
| 26 | scroll market | 701 | +9 | 23/38 | 77 | 690 |  |
| 27 | open saved | 29 | +10 | 17/25 | 81 | 695 |  |
| 28 | return to rates | 22 | +2 | 19/32 | 69 | 700 |  |
| 29 | start category switch | 13233 | -898 | 18/27 | 65 | 709 |  |
| 30 | open term deposits | 27 | +9 | 57/80 | 97 | 736 |  |
| 31 | verify term deposit rates | 712 | +27 | 35/55 | 81 | 746 |  |
| 32 | restore home loans | 21 | +1 | 14/29 | 69 | 768 |  |
| 33 | start search from rates | 29 | +4 |  |  | 768 |  |
| 34 | open savings search | 21 | +1 | 18/30 | 73 | 791 |  |
| 35 | search Macquarie | 1609 | +209 | 61/67 | 150 | 813 | 1 errors |
| 36 | verify Macquarie result | 0 | 0 | 14/15 | 16 | 796 |  |
| 37 | clear query and restore results | 22 | +1 | 16/20 | 32 | 808 |  |
| 38 | return from savings search | 22 | +3 | 35/44 | 85 | 774 |  |
| 39 | start filter rollback | 38 | +8 | 13/15 | 16 | 762 |  |
| 40 | open mortgage filter draft | 22 | -12 | 22/26 | 150 | 766 |  |
| 41 | select fixed in draft | 22 | +4 | 11/13 | 105 | 756 |  |
| 42 | discard unsaved filter draft | 21 | +2 | 20/22 | 65 | 758 |  |
| 43 | verify fixed was not applied | 26 | +7 | 25/31 | 129 | 760 | 1 errors |
| 44 | close verified filter draft | 22 | +5 | 19/21 | 69 | 760 |  |
| 45 | start save from rates | 33 | +9 | 12/16 | 16 | 758 | 1 errors |
| 46 | open unsaved rate | 25 | -21 | 111/142 | 89 | 786 | 1 errors |
| 47 | save a rate | 22 | +3 | 9/16 | 57 | 777 | 1 errors |
| 48 | leave saved product | 32 | +10 | 12/23 | 77 | 779 |  |
| 49 | restart with a saved rate | 20908 | +1656 | 435/588 | 89 | 607 | 1 errors; start 6467ms; boot js-start 1054503, layout-mounted 1055242, hydrated 1055475, cache-read 1056782, core-ready 1057558, rows-prepared 1057723, search-index-idle 1057723, detail-filters-idle 1057723, leading-requested 1057723, last-pricing 1057723, splash-hide 1057724, manifest 1061169, resolved 1062153, leading-scoped 1068008, leading-page 1068008, pricing-ready 1069277, last-rows 1069277, rates-ready 1069665, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 124, pricing-scope-ms 7774, filter-runs 2, filter-rows 37735, filter-yields 12, filter-ms 238, sort-runs 1, sort-rows 2150, sort-yields 2, sort-ms 66 |
| 50 | verify saved rate after restart | 32 | +7 | 30/43 | 85 | 421 |  |
| 51 | open product from saved rates | 32 | +11 | 37/57 | 85 | 549 |  |
| 52 | remove saved rate | 30 | +4 | 13/20 | 101 | 610 |  |
| 53 | leave removed product | 20152 | +20130 | 7/9 | 89 | 637 | no settle; Back destination was not observed |
| 54 | start compare from rates | 25 | +2 | 20/29 | 69 | 634 |  |
| 55 | enter selection mode | 2678 | +2651 | 10/18 | 48 | 665 |  |
| 56 | select first comparison rate | 23 | +4 | 9/16 | 53 | 735 |  |
| 57 | select second comparison rate | 30 | +11 |  |  | 715 |  |
| 58 | open two-rate comparison | 22 | +4 | 28/42 | 133 | 708 |  |
| 59 | return from two-rate comparison | 28 | +9 | 24/31 | 89 | 713 |  |
| 60 | cold start | 15394 | +3609 | 31/42 | 85 | 366 | 1 errors; start 3839ms; boot js-start 1202304, layout-mounted 1202518, hydrated 1202555, cache-read 1203851, core-ready 1204626, rows-prepared 1204763, search-index-idle 1204763, detail-filters-idle 1204763, leading-requested 1204763, last-pricing 1204763, splash-hide 1204764, manifest 1206975, resolved 1207242, leading-scoped 1208455, leading-page 1208455, pricing-ready 1209840, last-rows 1209840, rates-ready 1210209, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 70, pricing-scope-ms 2774, filter-runs 2, filter-rows 37735, filter-yields 10, filter-ms 255, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 25 |
| 61 | /browse | 2278 | +2254 | 1/2 | 32 | 412 |  |
| 62 | /watchlist | 27 | +7 | 2/3 | 32 | 413 |  |
| 63 | /market | 29 | +7 |  |  | 424 |  |
| 64 | /tools | 24 | -2132 |  |  | 415 |  |
| 65 | /trends | 4056 | +4035 | 23/33 | 109 | 435 |  |
| 66 | /search | 29 | -4295 |  |  | 436 |  |
| 67 | /banks | 31 | -4 | 50/60 | 125 | 488 |  |
| 68 | /bank-rates | 26 | +3 | 15/26 | 73 | 478 |  |
| 69 | /categories | 26 | -4 | 34/47 | 101 | 479 |  |
| 70 | /catalogue | 25 | 0 | 28/43 | 101 | 502 |  |
| 71 | /compare | 24 | -6 | 14/18 | 121 | 477 |  |
| 72 | /matches | 30 | +9 | 36/48 | 89 | 506 |  |
| 73 | /calculator | 27 | +2 | 15/24 | 81 | 485 |  |
| 74 | /projections | 32 | +11 | 25/36 | 93 | 491 |  |
| 75 | /profile | 29 | +6 | 14/25 | 53 | 494 |  |
| 76 | /research | 32 | +7 | 17/31 | 65 | 501 |  |
| 77 | /rba | 29 | +2 | 15/24 | 69 | 516 |  |
| 78 | /rba-response | 23 | -2 | 20/29 | 81 | 517 |  |
| 79 | /settings | 25 | +3 | 24/40 | 65 | 524 |  |
| 80 | /about | 28 | +3 | 14/24 | 61 | 525 |  |
| 81 | /terms | 27 | +2 | 13/20 | 77 | 527 |  |
| 82 | /privacy | 31 | +4 |  |  | 527 |  |
| 83 | /third-party-notices | 28 | +3 | 12/21 | 85 | 531 |  |
| 84 | /node | 32 | +7 | 34/47 | 97 | 560 |  |
| 85 | /passthrough | 31 | -5 | 37/48 | 113 | 536 |  |
| 86 | /calculation-receipt | 31 | +5 | 14/25 | 81 | 528 |  |
| 87 | /rate-receipt | 25 | -2 | 8/9 | 101 | 529 |  |
| 88 | warm resume | 955 | +704 | 5/5 | 57 | 528 | start 570ms |
| 89 | cold relaunch | 15978 | +5087 | 33/42 | 133 | 542 | 3 errors; start 4348ms; boot js-start 1439125, layout-mounted 1439360, hydrated 1439360, cache-read 1440683, core-ready 1441475, rows-prepared 1441621, search-index-idle 1441621, detail-filters-idle 1441621, leading-requested 1441621, last-pricing 1441621, splash-hide 1441622, manifest 1443907, resolved 1444254, leading-scoped 1445525, leading-page 1445525, pricing-ready 1447177, last-rows 1447177, rates-ready 1447473, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 79, pricing-scope-ms 3154, filter-runs 2, filter-rows 37735, filter-yields 8, filter-ms 200, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 25 |
| 90 | about | 36 | +7 | 12/21 | 150 | 430 |  |
| 91 | audit screen | 21 | +3 | 117/198 | 65 | 410 |  |
| 92 | audit 0 min | 0 | 0 | 31/35 | 101 | 678 |  |
| 93 | audit 2 min | 0 | 0 | 1294/1476 | 117 | 841 | 80 errors |
| 94 | audit 4 min | 0 | 0 | 724/830 | 117 | 924 | 80 errors |
| 95 | audit 5 min | 0 | 0 | 367/423 | 109 | 880 | 80 errors |
| 96 | audit 6 min | 0 | 0 | 851/988 | 113 | 948 | 80 errors |
| 97 | audit 7 min | 0 |  | 477/531 | 121 | 1014 | 80 errors |
| 98 | audit 9 min | 0 | 0 | 964/1129 | 113 | 1021 | 80 errors |
| 99 | audit 10 min | 0 |  | 848/1015 | 113 | 1082 | 80 errors |
| 100 | audit 12 min | 0 | 0 | 252/290 | 113 | 1096 | 80 errors |
| 101 | audit 13 min | 0 |  | 159/184 | 36 | 1126 |  |
| 102 | audit 15 min | 0 | 0 | 148/179 | 34 | 1159 |  |
| 103 | audit 16 min | 0 |  | 48/55 | 73 | 1192 |  |
| 104 | audit finished | 0 | 0 | 128/204 | 69 | 1239 |  |
| 105 | audit result 1 | 0 | 0 |  |  | 1240 |  |
| 106 | audit result 2 | 0 | 0 |  |  | 1239 |  |
| 107 | audit result 3 | 0 | 0 |  |  | 1240 |  |
| 108 | audit result 4 | 0 | 0 |  |  | 1242 |  |
| 109 | audit result 5 | 0 | 0 |  |  | 1239 |  |
| 110 | audit result 6 | 0 | 0 |  |  | 1239 |  |
| 111 | audit result 7 | 0 | 0 |  |  | 1242 |  |
| 112 | audit result 8 | 0 | 0 |  |  | 1240 |  |
| 113 | audit result 9 | 0 | 0 |  |  | 1243 |  |
| 114 | audit result 10 | 0 | 0 |  |  | 1243 |  |
| 115 | audit result 11 | 0 | 0 |  |  | 1241 |  |
| 116 | audit result 12 | 0 | 0 |  |  | 1244 |  |
| 117 | about for debug log | 3349 | +3323 | 24/36 | 61 | 1089 |  |
| 118 | debug log screen | 0 | 0 | 115/213 | 61 | 1096 |  |
| 119 | debug log uploaded | 0 | 0 | 22/30 | 121 | 1146 |  |

## Errors

### 1 open app
```
11-28 15:24:40.217 E/australianrates(11494): Not starting debugger since process cannot load the jdwp agent.
```

### 35 search Macquarie
```
11-28 15:32:08.289 E/FrameTracker(11494): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 43 verify fixed was not applied
```
11-28 15:33:10.585 E/FrameTracker(11494): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 start save from rates
```
11-28 15:33:28.247 E/FrameTracker(11494): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 open unsaved rate
```
11-28 15:33:34.334 E/ImeBackDispatcher(11494): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 47172446
```

### 47 save a rate
```
11-28 15:33:44.934 E/FrameTracker(11494): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 49 restart with a saved rate
```
11-28 15:33:59.827 E/australianrates(17496): Not starting debugger since process cannot load the jdwp agent.
```

### 60 cold start
```
11-28 15:36:29.153 E/australianrates(19000): Not starting debugger since process cannot load the jdwp agent.
```

### 89 cold relaunch
```
11-28 15:40:25.674 E/australianrates(22147): Not starting debugger since process cannot load the jdwp agent.
11-28 15:40:29.963 E/SurfaceSyncGroup(22147): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-28 15:40:29.964 E/SurfaceSyncGroup(22147): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 93 audit 2 min
```
11-28 15:41:44.474 E/ReactNativeJS(22147): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0kvje7-61dda2042b34fb58","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":9434.9,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":161.5,"liveStage:dates-index:fetched:ms":133.5,"liveStage:revision:verified:ms":74.2,"liveStage:Core asset:downloaded:ms":235.6,"liveStage:Core asset:hash-verified:ms":5.7,"liveStage:Core asset:native-inflated-and-text-decoded:ms":160.8,"liveStage:Core asset:inflated:ms":0.2,"liveStage:Core asset:text-decoded:ms":0.1,"liveStage:Core asset:decoded:ms":285.2,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":637.1,"liveStage:Details asset:downloaded:ms":1421.8,"liveStage:Details asset:hash-verified:ms":30.2,"li…
11-28 15:41:44.476 E/unknown:ReactNative(22147): ?anon_0_@1:3712091
11-28 15:41:44.476 E/unknown:ReactNative(22147): ?anon_0_@1:3717891
11-28 15:41:44.476 E/unknown:ReactNative(22147): SyntheticError@1:163232
11-28 15:41:44.476 E/unknown:ReactNative(22147): Wrapper@1:163747
11-28 15:41:44.476 E/unknown:ReactNative(22147): _callSuper@1:148620
11-28 15:41:44.476 E/unknown:ReactNative(22147): _construct@1:164095
11-28 15:41:44.476 E/unknown:ReactNative(22147): _next@1:595083
```

### 94 audit 4 min
```
11-28 15:44:14.482 E/ReactNativeJS(22147): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0kvje7-61dda2042b34fb58","check":{"id":"deep-first-pass.route.rates-sheets.search.section.next","label":"route.rates-sheets: search.section.next (first-pass)","kind":"journey","status":"fail","durationMs":1083.8,"metrics":{"journeyId":"route.rates-sheets.search.section.next","journeyLabel":"route.rates-sheets: search.section.next","iteration":"cold","passId":"first-pass","scenarioId":"route.rates-sheets","semanticActionId":"search.section.next","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":18,"actionRevisionAfter":19,"renderRevisionBefore":"state-25","renderRevisionAfter":"state-28","actionMs":284.2,"preActionWaitMs":1.2,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"ret…
11-28 15:44:14.484 E/unknown:ReactNative(22147): ?anon_0_@1:3712091
11-28 15:44:14.484 E/unknown:ReactNative(22147): ?anon_0_@1:3717891
11-28 15:44:14.484 E/unknown:ReactNative(22147): SyntheticError@1:163232
11-28 15:44:14.484 E/unknown:ReactNative(22147): Wrapper@1:163747
11-28 15:44:14.484 E/unknown:ReactNative(22147): _callSuper@1:148620
11-28 15:44:14.484 E/unknown:ReactNative(22147): _construct@1:164095
11-28 15:44:14.484 E/unknown:ReactNative(22147): _next@1:595083
```

### 95 audit 5 min
```
11-28 15:45:47.831 E/ReactNativeJS(22147): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0kvje7-61dda2042b34fb58","check":{"id":"deep-first-pass.sample.catalogue.1.product.open","label":"sample.catalogue.1: product.open (first-pass)","kind":"journey","status":"fail","durationMs":2439.3,"metrics":{"journeyId":"sample.catalogue.1.product.open","journeyLabel":"sample.catalogue.1: product.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.1","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Virgin%20Money%7C36906e88-5c03-ee11-8f6e-00224814d330%7CTRANS_AND_SAVINGS_ACCOUNTS%7CVirgin%20Money%20Boost%20Saver","expectedPath":"/product/Virgin%20Money%7C36906e88-5c03-ee11-8f6e-00224814d330%7CTRANS_AND_SAVINGS_ACCOUNTS%7CVirgin%20Money%20Boost%20Saver","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":787.5,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,…
11-28 15:45:47.833 E/unknown:ReactNative(22147): ?anon_0_@1:3712091
11-28 15:45:47.833 E/unknown:ReactNative(22147): ?anon_0_@1:3717891
11-28 15:45:47.833 E/unknown:ReactNative(22147): SyntheticError@1:163232
11-28 15:45:47.833 E/unknown:ReactNative(22147): Wrapper@1:163747
11-28 15:45:47.833 E/unknown:ReactNative(22147): _callSuper@1:148620
11-28 15:45:47.833 E/unknown:ReactNative(22147): _construct@1:164095
11-28 15:45:47.833 E/unknown:ReactNative(22147): _next@1:595083
```

### 96 audit 6 min
```
11-28 15:46:25.624 E/ReactNativeJS(22147): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0kvje7-61dda2042b34fb58","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":1375.4,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-29:c7adbbc6c461…:state-8","renderRevisionAfter":"2026-11-29:c7adbbc6c461…:state-9","actionResultEvidence":"{\"applied\":…
11-28 15:46:25.625 E/unknown:ReactNative(22147): ?anon_0_@1:3712091
11-28 15:46:25.625 E/unknown:ReactNative(22147): ?anon_0_@1:3717891
11-28 15:46:25.625 E/unknown:ReactNative(22147): SyntheticError@1:163232
11-28 15:46:25.625 E/unknown:ReactNative(22147): Wrapper@1:163747
11-28 15:46:25.625 E/unknown:ReactNative(22147): _callSuper@1:148620
11-28 15:46:25.625 E/unknown:ReactNative(22147): _construct@1:164095
11-28 15:46:25.625 E/unknown:ReactNative(22147): _next@1:595083
```

### 97 audit 7 min
```
11-28 15:48:08.499 E/ReactNativeJS(22147): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0kvje7-61dda2042b34fb58","check":{"id":"deep-first-pass.redirect.onboarding.redirect.onboarding.verify","label":"redirect.onboarding: redirect.onboarding.verify (first-pass)","kind":"journey","status":"fail","durationMs":1340.6,"metrics":{"journeyId":"redirect.onboarding.redirect.onboarding.verify","journeyLabel":"redirect.onboarding: redirect.onboarding.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.onboarding","semanticActionId":"redirect.onboarding.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":105.7,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":603.9,"forwardWorkMs":603.9,"navigation…
11-28 15:48:08.500 E/unknown:ReactNative(22147): ?anon_0_@1:3712091
11-28 15:48:08.500 E/unknown:ReactNative(22147): ?anon_0_@1:3717891
11-28 15:48:08.500 E/unknown:ReactNative(22147): SyntheticError@1:163232
11-28 15:48:08.500 E/unknown:ReactNative(22147): Wrapper@1:163747
11-28 15:48:08.500 E/unknown:ReactNative(22147): _callSuper@1:148620
11-28 15:48:08.500 E/unknown:ReactNative(22147): _construct@1:164095
11-28 15:48:08.500 E/unknown:ReactNative(22147): _next@1:595083
```

### 98 audit 9 min
```
11-28 15:49:31.321 E/ReactNativeJS(22147): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0kvje7-61dda2042b34fb58","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.mortgage.scope.clear","label":"route.rates-mortgage-scope: search.mortgage.scope.clear (repeat)","kind":"journey","status":"fail","durationMs":10016.4,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.clear","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.clear","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.clear","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":43,"actionRevisionAfter":44,"renderRevisionBefore":"state-16","renderRevisionAfter":"state-19","actionMs":201.3,"preActionWaitMs":1,"preActionQuietWindowReused":true,"preActionQuietWindow…
11-28 15:49:31.323 E/unknown:ReactNative(22147): ?anon_0_@1:3712091
11-28 15:49:31.323 E/unknown:ReactNative(22147): ?anon_0_@1:3717891
11-28 15:49:31.323 E/unknown:ReactNative(22147): SyntheticError@1:163232
11-28 15:49:31.323 E/unknown:ReactNative(22147): Wrapper@1:163747
11-28 15:49:31.323 E/unknown:ReactNative(22147): _callSuper@1:148620
11-28 15:49:31.323 E/unknown:ReactNative(22147): _construct@1:164095
11-28 15:49:31.323 E/unknown:ReactNative(22147): _next@1:595083
```

### 99 audit 10 min
```
11-28 15:51:14.706 E/ReactNativeJS(22147): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0kvje7-61dda2042b34fb58","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1868.8,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/MyState%20Bank%7Cf2c94853-abb7-4c8e-ae43-66427d186380%7CTRANS_AND_SAVINGS_ACCOUNTS%7CBonus%20Saver","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"r…
11-28 15:51:14.709 E/unknown:ReactNative(22147): ?anon_0_@1:3712091
11-28 15:51:14.709 E/unknown:ReactNative(22147): ?anon_0_@1:3717891
11-28 15:51:14.709 E/unknown:ReactNative(22147): SyntheticError@1:163232
11-28 15:51:14.709 E/unknown:ReactNative(22147): Wrapper@1:163747
11-28 15:51:14.709 E/unknown:ReactNative(22147): _callSuper@1:148620
11-28 15:51:14.709 E/unknown:ReactNative(22147): _construct@1:164095
11-28 15:51:14.709 E/unknown:ReactNative(22147): _next@1:595083
```

### 100 audit 12 min
```
11-28 15:52:49.207 E/ReactNativeJS(22147): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0kvje7-61dda2042b34fb58","check":{"id":"deep-repeat.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (repeat)","kind":"journey","status":"fail","durationMs":2480.2,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":67.1,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1117.7,"forwardWorkMs":1117.7,"navigationCommitMs":1116.7,"firstReadyFrameMs":1,"firstRea…
11-28 15:52:49.248 E/unknown:ReactNative(22147): ?anon_0_@1:3712091
11-28 15:52:49.248 E/unknown:ReactNative(22147): ?anon_0_@1:3717891
11-28 15:52:49.248 E/unknown:ReactNative(22147): SyntheticError@1:163232
11-28 15:52:49.248 E/unknown:ReactNative(22147): Wrapper@1:163747
11-28 15:52:49.248 E/unknown:ReactNative(22147): _callSuper@1:148620
11-28 15:52:49.248 E/unknown:ReactNative(22147): _construct@1:164095
11-28 15:52:49.248 E/unknown:ReactNative(22147): _next@1:595083
```
