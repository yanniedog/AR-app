# App explorer: 1.0.385 (441)

**Real-use session FAIL vs 1.0.380: 1 broken, 23 friction, 4 slower**

- Broken: "leave removed product" failed: Back destination was not observed
- Friction: No reaction for 3.5 s after "scroll rates 1"
- Friction: No reaction for 3.3 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll product fees"
- Friction: No reaction for 3.1 s after "scroll product eligibility"
- Friction: No reaction for 3.2 s after "scroll product sources"
- Friction: No reaction for 3.1 s after "scroll lenders"
- Friction: No reaction for 4.6 s after "switch to savings"
- Friction: No reaction for 3.0 s after "switch to home loans"
- Friction: No reaction for 3.5 s after "open filters"
- Friction: No reaction for 3.0 s after "open market"
- Friction: No reaction for 3.0 s after "scroll rba"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 4.7 s after "open term deposits"
- Friction: No reaction for 3.8 s after "verify term deposit rates"
- Friction: No reaction for 8.0 s after "search Macquarie"
- Friction: No reaction for 3.2 s after "return from savings search"
- Friction: No reaction for 3.5 s after "open mortgage filter draft"
- Friction: No reaction for 3.6 s after "verify fixed was not applied"
- Friction: No reaction for 3.5 s after "open unsaved rate"
- Friction: No reaction for 3.4 s after "open product from saved rates"
- Friction: No reaction for 17.9 s after "leave removed product"
- Friction: "No saved rates" shown on "start compare from rates"
- Slower: Dropped frames 65% to 80% on "remove saved rate"
- Slower: "leave removed product" content 0.0 s to 20.2 s
- Slower: "leave removed product" reaction 2.3 s to 17.9 s
- Slower: "select first comparison rate" content 0.0 s to 2.7 s

**Initial Rates readiness:** 41.6 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 8 passed, 1 failed, 1 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3752 bytes, latest published run date 2026-11-27

Mode full | 120 steps | crashes 0 | step failures 1 | settle timeouts 1 | steps with JS/native errors 19
Baseline 1.0.380
**Audit live: outcome failed | 1033 s | audit log 860045 bytes (audit-log.txt) https://paste.c-net.org/3aa3bfc0-dbde-b2ad-a4eb-25efa48024c4 | debug log 5821393 bytes read from host https://paste.c-net.org/2a223877-ce6b-5c8a-041f-367217d61277**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 3121 | +164 | 657/876 | 89 | 542 | 1 errors; start 3065ms |
| 2 | scroll rates 1 | 716 | -11 | 36/54 | 77 | 534 | boot js-start 472564, layout-mounted 473332, cache-read 473444, hydrated 473636, splash-hide 473636, manifest 474873, resolved 475546, core-fetched 481431, core-saved 482308, search-index-idle 482615, leading-requested 482615, details-start 483256, leading-scoped 483740, pricing-ready 489296, details-fetched 494362, rows-prepared 501441, detail-filters-idle 501442, last-pricing 501442, suitability-built 502565, post-refresh-wait 503034, leading-page 504482, last-rows 513913, rates-ready 514135, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 203, pricing-scope-ms 17439, leading-gated 1, filter-runs 2, filter-rows 31912, filter-yields 8, filter-ms 221, sort-runs 4, sort-rows 1191, sort-yields 4, sort-ms 60 |
| 3 | scroll rates 2 | 713 | +17 | 34/51 | 85 | 723 |  |
| 4 | scroll rates back | 677 | -10 |  |  | 649 |  |
| 5 | open product | 22 | -5298 | 42/58 | 81 | 612 |  |
| 6 | scroll product | 713 | +7 | 34/54 | 81 | 633 |  |
| 7 | expand product facts | 20 | -2 | 41/62 | 85 | 619 |  |
| 8 | scroll product fees | 688 | -46 | 32/55 | 81 | 623 |  |
| 9 | scroll product eligibility | 718 | 0 | 21/37 | 101 | 612 |  |
| 10 | expand eligibility | 0 | 0 | 211/284 | 89 | 617 |  |
| 11 | expand constraints | 19 | -3 | 8/14 | 69 | 624 |  |
| 12 | scroll product sources | 765 | +25 | 20/29 | 93 | 622 |  |
| 13 | back to rates | 29 | +5 | 14/23 | 65 | 626 |  |
| 14 | open lenders | 23 | -1 | 21/23 | 200 | 640 |  |
| 15 | scroll lenders | 706 | -86 | 15/20 | 113 | 635 |  |
| 16 | back from lenders | 23 | +2 | 7/9 | 150 | 637 |  |
| 17 | switch to savings | 25 | +2 | 55/74 | 89 | 660 |  |
| 18 | switch to home loans | 23 | +1 | 14/31 | 61 | 683 |  |
| 19 | open filters | 21 | 0 | 21/26 | 121 | 696 |  |
| 20 | close filters | 21 | -1 | 6/7 | 121 | 688 |  |
| 21 | open market | 24 | +3 | 17/34 | 53 | 694 |  |
| 22 | open rba | 2604 | +5 | 69/83 | 65 | 717 |  |
| 23 | scroll rba | 700 | +4 | 31/52 | 69 | 709 |  |
| 24 | back from rba | 25 | +2 | 9/18 | 65 | 710 |  |
| 25 | scroll market | 698 | -26 | 17/33 | 69 | 709 |  |
| 26 | open saved | 27 | +4 | 16/23 | 93 | 717 |  |
| 27 | return to rates | 24 | +2 | 17/30 | 81 | 719 |  |
| 28 | start category switch | 33 | +1 |  |  | 720 |  |
| 29 | open term deposits | 23 | -1 | 58/87 | 89 | 752 |  |
| 30 | verify term deposit rates | 721 | +22 | 37/51 | 85 | 758 |  |
| 31 | restore home loans | 21 | -2 | 15/26 | 61 | 775 |  |
| 32 | start search from rates | 24 | -5 |  |  | 771 |  |
| 33 | open savings search | 21 | -1 | 15/29 | 81 | 789 |  |
| 34 | search Macquarie | 1876 | +601 | 82/98 | 129 | 803 | 1 errors |
| 35 | verify Macquarie result | 0 | -2 | 15/16 | 17 | 793 |  |
| 36 | clear query and restore results | 27 | +4 | 19/25 | 42 | 794 |  |
| 37 | return from savings search | 22 | -1 | 34/42 | 89 | 760 |  |
| 38 | start filter rollback | 50 | +20 | 12/15 | 16 | 750 |  |
| 39 | open mortgage filter draft | 24 | -1 | 24/28 | 250 | 757 |  |
| 40 | select fixed in draft | 22 | +2 | 11/13 | 150 | 747 |  |
| 41 | discard unsaved filter draft | 22 | -1 | 19/21 | 73 | 749 |  |
| 42 | verify fixed was not applied | 21 | -1 | 24/27 | 200 | 755 | 1 errors |
| 43 | close verified filter draft | 22 | +1 | 19/21 | 65 | 753 |  |
| 44 | start save from rates | 24 | -5 | 15/16 | 32 | 751 | 1 errors |
| 45 | open unsaved rate | 23 | -6 | 44/60 | 85 | 767 | 1 errors |
| 46 | save a rate | 23 | -1 | 10/17 | 93 | 766 | 1 errors |
| 47 | leave saved product | 21 | -4 | 14/23 | 81 | 767 |  |
| 48 | restart with a saved rate | 17754 | -647 | 214/306 | 89 | 593 | 1 errors; start 6111ms; boot js-start 975127, layout-mounted 975701, hydrated 976894, cache-read 977866, core-ready 978672, rows-prepared 978836, search-index-idle 978836, detail-filters-idle 978836, leading-requested 978836, last-pricing 978836, splash-hide 978837, manifest 981296, leading-scoped 982401, leading-page 982402, resolved 983272, pricing-ready 986490, last-rows 986490, rates-ready 986686, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 22, pricing-scope-ms 4747, filter-runs 1, filter-rows 6944, filter-yields 5, filter-ms 117, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 17 |
| 49 | verify saved rate after restart | 27 | +4 | 28/37 | 89 | 625 |  |
| 50 | open product from saved rates | 26 | +2 | 40/60 | 85 | 538 |  |
| 51 | remove saved rate | 28 | -6 | 16/20 | 65 | 601 |  |
| 52 | leave removed product | 20151 | +20125 | 7/11 | 65 | 645 | no settle; Back destination was not observed |
| 53 | start compare from rates | 33 | -4431 |  |  | 646 |  |
| 54 | enter selection mode | 4954 | +4931 | 25/38 | 69 | 715 |  |
| 55 | select first comparison rate | 23 | -6 | 8/17 | 57 | 708 |  |
| 56 | select second comparison rate | 23 | 0 | 12/17 | 65 | 701 |  |
| 57 | open two-rate comparison | 21 | -4 | 18/26 | 150 | 713 |  |
| 58 | return from two-rate comparison | 23 | -3 | 21/29 | 105 | 709 |  |
| 59 | cold start | 10241 | -6402 | 28/34 | 150 | 583 | 3 errors; start 4296ms; boot js-start 1114460, layout-mounted 1114677, hydrated 1114817, cache-read 1116007, core-ready 1116801, rows-prepared 1116919, search-index-idle 1116919, detail-filters-idle 1116919, leading-requested 1116919, last-pricing 1116919, splash-hide 1116921, manifest 1119187, leading-scoped 1119572, leading-page 1119572, resolved 1120041, pricing-ready 1120814, last-rows 1120814, rates-ready 1120997, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 20, pricing-scope-ms 1543, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 100, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 15 |
| 60 | /browse | 4504 | +2140 | 1/2 | 32 | 434 |  |
| 61 | /watchlist | 36 | +8 | 3/3 | 65 | 442 |  |
| 62 | /market | 28 | -15 | 13/24 | 61 | 517 |  |
| 63 | /tools | 33 | -4 | 15/21 | 109 | 582 |  |
| 64 | /trends | 22 | -7 |  |  | 620 |  |
| 65 | /search | 2230 | -2236 | 33/47 | 105 | 631 |  |
| 66 | /banks | 27 | +1 | 28/40 | 113 | 656 |  |
| 67 | /bank-rates | 26 | -8 | 22/30 | 89 | 660 |  |
| 68 | /categories | 23 | -10 | 33/46 | 97 | 686 |  |
| 69 | /catalogue | 30 | +2 | 30/41 | 93 | 704 |  |
| 70 | /compare | 25 | -1 | 14/15 | 113 | 715 |  |
| 71 | /matches | 25 | -16 | 27/36 | 101 | 706 |  |
| 72 | /calculator | 27 | -9 | 11/21 | 81 | 695 |  |
| 73 | /projections | 24 | -4 | 17/26 | 85 | 695 |  |
| 74 | /profile | 23 | -5 | 19/25 | 77 | 698 |  |
| 75 | /research | 23 | -13 | 20/28 | 81 | 707 |  |
| 76 | /rba | 26 | -3 | 14/22 | 101 | 719 |  |
| 77 | /rba-response | 25 | -4 | 20/30 | 73 | 719 |  |
| 78 | /settings | 26 | -3 | 15/24 | 89 | 725 |  |
| 79 | /about | 32 | -1 | 13/23 | 61 | 725 |  |
| 80 | /terms | 34 | -1 | 17/25 | 73 | 727 |  |
| 81 | /privacy | 31 | -2 |  |  | 727 |  |
| 82 | /third-party-notices | 30 | -2 | 14/25 | 89 | 733 |  |
| 83 | /node | 31 | +4 | 30/41 | 97 | 772 |  |
| 84 | /passthrough | 30 | 0 | 28/40 | 93 | 746 |  |
| 85 | /calculation-receipt | 31 | +4 | 18/26 | 73 | 735 |  |
| 86 | /rate-receipt | 33 | +5 | 5/8 | 77 | 737 |  |
| 87 | warm resume | 153 | -435 | 3/4 | 32 | 736 |  |
| 88 | cold relaunch | 10239 | -199 | 32/41 | 89 | 583 | 1 errors; start 4302ms; boot js-start 1350965, layout-mounted 1351188, hydrated 1351231, cache-read 1352573, core-ready 1353367, rows-prepared 1353506, search-index-idle 1353506, detail-filters-idle 1353506, leading-requested 1353506, last-pricing 1353506, splash-hide 1353507, manifest 1355584, leading-scoped 1355968, leading-page 1355968, resolved 1356366, pricing-ready 1357171, last-rows 1357171, rates-ready 1357371, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 33, pricing-yields 19, pricing-scope-ms 1483, filter-runs 1, filter-rows 6944, filter-yields 5, filter-ms 117, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 16 |
| 89 | about | 30 | -1 | 14/19 | 300 | 409 |  |
| 90 | audit screen | 20 | -3 | 145/246 | 69 | 614 |  |
| 91 | audit 0 min | 0 | 0 | 26/31 | 57 | 749 |  |
| 92 | audit 1 min | 0 |  | 1040/1194 | 109 | 938 | 80 errors |
| 93 | audit 2 min | 0 | 0 | 267/287 | 105 | 1136 | 80 errors |
| 94 | audit 4 min | 0 | 0 | 945/1076 | 109 | 1183 | 80 errors |
| 95 | audit 6 min | 0 |  | 705/831 | 109 | 1293 | 80 errors |
| 96 | audit 7 min | 0 | 0 | 481/541 | 121 | 1174 | 80 errors |
| 97 | audit 8 min | 0 |  | 187/206 | 105 | 1332 | 80 errors |
| 98 | audit 9 min | 0 | 0 | 964/1100 | 113 | 1351 | 80 errors |
| 99 | audit 10 min | 0 | 0 | 445/514 | 105 | 1324 | 80 errors |
| 100 | audit 12 min | 0 | 0 | 505/571 | 113 | 1396 | 80 errors |
| 101 | audit 13 min | 0 |  | 276/314 | 113 | 1419 | 80 errors |
| 102 | audit 14 min | 0 | 0 | 155/193 | 36 | 1454 |  |
| 103 | audit 16 min | 0 |  | 90/105 | 42 | 1282 |  |
| 104 | audit 17 min | 0 |  | 101/123 | 77 | 1438 |  |
| 105 | audit finished | 0 | 0 | 108/180 | 73 | 1465 |  |
| 106 | audit result 1 | 0 | 0 |  |  | 1446 |  |
| 107 | audit result 2 | 0 | 0 |  |  | 1447 |  |
| 108 | audit result 3 | 0 | 0 |  |  | 1449 |  |
| 109 | audit result 4 | 0 | 0 |  |  | 1446 |  |
| 110 | audit result 5 | 0 | 0 |  |  | 1450 |  |
| 111 | audit result 6 | 0 | 0 |  |  | 1449 |  |
| 112 | audit result 7 | 0 | 0 |  |  | 1450 |  |
| 113 | audit result 8 | 0 | 0 |  |  | 1452 |  |
| 114 | audit result 9 | 0 | 0 |  |  | 1450 |  |
| 115 | audit result 10 | 0 | 0 |  |  | 1450 |  |
| 116 | audit result 11 | 0 | 0 |  |  | 1453 |  |
| 117 | audit result 12 | 0 | 0 |  |  | 1451 |  |
| 118 | about for debug log | 3232 | -1 | 23/33 | 65 | 1308 |  |
| 119 | debug log screen | 0 | 0 | 98/161 | 65 | 1311 |  |
| 120 | debug log uploaded | 0 | 0 | 27/30 | 125 | 1370 |  |

## Errors

### 1 open app
```
11-26 16:50:57.181 E/australianrates(11095): Not starting debugger since process cannot load the jdwp agent.
```

### 34 search Macquarie
```
11-26 16:57:28.010 E/FrameTracker(11095): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 42 verify fixed was not applied
```
11-26 16:58:32.136 E/FrameTracker(11095): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 44 start save from rates
```
11-26 16:58:49.603 E/FrameTracker(11095): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 open unsaved rate
```
11-26 16:58:55.655 E/ImeBackDispatcher(11095): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 14822566
```

### 46 save a rate
```
11-26 16:59:06.103 E/FrameTracker(11095): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 48 restart with a saved rate
```
11-26 16:59:20.425 E/australianrates(16569): Not starting debugger since process cannot load the jdwp agent.
```

### 59 cold start
```
11-26 17:01:40.183 E/australianrates(18095): Not starting debugger since process cannot load the jdwp agent.
11-26 17:01:44.325 E/SurfaceSyncGroup(18095): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-26 17:01:44.325 E/SurfaceSyncGroup(18095): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 88 cold relaunch
```
11-26 17:05:36.704 E/australianrates(21275): Not starting debugger since process cannot load the jdwp agent.
```

### 92 audit 1 min
```
11-26 17:07:03.099 E/ReactNativeJS(21275): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxt1fkg-65147e7f47062db9","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":8503.9,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":252.1,"liveStage:dates-index:fetched:ms":234.3,"liveStage:revision:verified:ms":73.3,"liveStage:Core asset:downloaded:ms":246.9,"liveStage:Core asset:hash-verified:ms":11.9,"liveStage:Core asset:native-inflated-and-text-decoded:ms":157.2,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":282.3,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":600.4,"liveStage:Details asset:downloaded:ms":1505.2,"liveStage:Details asset:hash-verified:ms":35.2,"liveS…
11-26 17:07:03.101 E/unknown:ReactNative(21275): ?anon_0_@1:3699198
11-26 17:07:03.101 E/unknown:ReactNative(21275): ?anon_0_@1:3704998
11-26 17:07:03.101 E/unknown:ReactNative(21275): SyntheticError@1:163048
11-26 17:07:03.101 E/unknown:ReactNative(21275): Wrapper@1:163563
11-26 17:07:03.101 E/unknown:ReactNative(21275): _callSuper@1:148436
11-26 17:07:03.101 E/unknown:ReactNative(21275): _construct@1:163911
11-26 17:07:03.101 E/unknown:ReactNative(21275): _next@1:594899
```

### 93 audit 2 min
```
11-26 17:08:50.162 E/ReactNativeJS(21275): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxt1fkg-65147e7f47062db9","check":{"id":"deep-first-pass.route.rates.search.open","label":"route.rates: search.open (first-pass)","kind":"journey","status":"fail","durationMs":2382.8,"metrics":{"journeyId":"route.rates.search.open","journeyLabel":"route.rates: search.open","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.open","depth":0,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":86.6,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1359.2,"forwardWorkMs":1359.2,"navigationCommitMs":1014.8,"firstReadyFrameMs":344.4,"firstReadyFrameObserved":true,"readinessMs":344.4,"backgroundSettleMs"…
11-26 17:08:50.165 E/unknown:ReactNative(21275): ?anon_0_@1:3699198
11-26 17:08:50.165 E/unknown:ReactNative(21275): ?anon_0_@1:3704998
11-26 17:08:50.165 E/unknown:ReactNative(21275): SyntheticError@1:163048
11-26 17:08:50.165 E/unknown:ReactNative(21275): Wrapper@1:163563
11-26 17:08:50.165 E/unknown:ReactNative(21275): _callSuper@1:148436
11-26 17:08:50.165 E/unknown:ReactNative(21275): _construct@1:163911
11-26 17:08:50.165 E/unknown:ReactNative(21275): _next@1:594899
```

### 94 audit 4 min
```
11-26 17:09:42.479 E/ReactNativeJS(21275): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxt1fkg-65147e7f47062db9","check":{"id":"deep-first-pass.route.rates-sheets.search.section.next","label":"route.rates-sheets: search.section.next (first-pass)","kind":"journey","status":"fail","durationMs":1628.4,"metrics":{"journeyId":"route.rates-sheets.search.section.next","journeyLabel":"route.rates-sheets: search.section.next","iteration":"cold","passId":"first-pass","scenarioId":"route.rates-sheets","semanticActionId":"search.section.next","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":19,"actionRevisionAfter":20,"renderRevisionBefore":"state-23","renderRevisionAfter":"state-29","actionMs":83.3,"preActionWaitMs":1,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retrie…
11-26 17:09:42.481 E/unknown:ReactNative(21275): ?anon_0_@1:3699198
11-26 17:09:42.481 E/unknown:ReactNative(21275): ?anon_0_@1:3704998
11-26 17:09:42.481 E/unknown:ReactNative(21275): SyntheticError@1:163048
11-26 17:09:42.481 E/unknown:ReactNative(21275): Wrapper@1:163563
11-26 17:09:42.481 E/unknown:ReactNative(21275): _callSuper@1:148436
11-26 17:09:42.481 E/unknown:ReactNative(21275): _construct@1:163911
11-26 17:09:42.481 E/unknown:ReactNative(21275): _next@1:594899
```

### 95 audit 6 min
```
11-26 17:11:30.154 E/ReactNativeJS(21275): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxt1fkg-65147e7f47062db9","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":3504.9,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-27:02500ce424dd…:state-7","renderRevisionAfter":"2026-11-27:02500ce424dd…:state-8","actionResultEvidence":"{\"applied\":…
11-26 17:11:30.155 E/unknown:ReactNative(21275): ?anon_0_@1:3699198
11-26 17:11:30.155 E/unknown:ReactNative(21275): ?anon_0_@1:3704998
11-26 17:11:30.155 E/unknown:ReactNative(21275): SyntheticError@1:163048
11-26 17:11:30.155 E/unknown:ReactNative(21275): Wrapper@1:163563
11-26 17:11:30.155 E/unknown:ReactNative(21275): _callSuper@1:148436
11-26 17:11:30.155 E/unknown:ReactNative(21275): _construct@1:163911
11-26 17:11:30.155 E/unknown:ReactNative(21275): _next@1:594899
```

### 96 audit 7 min
```
11-26 17:13:11.933 E/ReactNativeJS(21275): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxt1fkg-65147e7f47062db9","check":{"id":"deep-first-pass.route.not-found.not-found.home","label":"route.not-found: not-found.home (first-pass)","kind":"journey","status":"fail","durationMs":10001.1,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"cold","passId":"first-pass","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":0,"actionRevisionAfter":1,"renderRevisionBefore":"not-found-v1","actionMs":120.9,"preActionWaitMs":0.7,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,…
11-26 17:13:11.934 E/unknown:ReactNative(21275): ?anon_0_@1:3699198
11-26 17:13:11.934 E/unknown:ReactNative(21275): ?anon_0_@1:3704998
11-26 17:13:11.934 E/unknown:ReactNative(21275): SyntheticError@1:163048
11-26 17:13:11.934 E/unknown:ReactNative(21275): Wrapper@1:163563
11-26 17:13:11.934 E/unknown:ReactNative(21275): _callSuper@1:148436
11-26 17:13:11.934 E/unknown:ReactNative(21275): _construct@1:163911
11-26 17:13:11.934 E/unknown:ReactNative(21275): _next@1:594899
```

### 97 audit 8 min
```
11-26 17:13:59.830 E/ReactNativeJS(21275): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxt1fkg-65147e7f47062db9","check":{"id":"deep-repeat.route.rates.search.filters.open","label":"route.rates: search.filters.open (repeat)","kind":"journey","status":"fail","durationMs":6191.4,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":26,"actionRevisionAfter":27,"renderRevisionBefore":"state-25","renderRevisionAfter":"state-28","actionMs":0.2,"preActionWaitMs":0.8,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"re…
11-26 17:13:59.831 E/unknown:ReactNative(21275): ?anon_0_@1:3699198
11-26 17:13:59.831 E/unknown:ReactNative(21275): ?anon_0_@1:3704998
11-26 17:13:59.831 E/unknown:ReactNative(21275): SyntheticError@1:163048
11-26 17:13:59.831 E/unknown:ReactNative(21275): Wrapper@1:163563
11-26 17:13:59.831 E/unknown:ReactNative(21275): _callSuper@1:148436
11-26 17:13:59.831 E/unknown:ReactNative(21275): _construct@1:163911
11-26 17:13:59.831 E/unknown:ReactNative(21275): _next@1:594899
```

### 98 audit 9 min
```
11-26 17:14:40.963 E/ReactNativeJS(21275): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxt1fkg-65147e7f47062db9","check":{"id":"deep-repeat.route.rates-sheets.search.section.next","label":"route.rates-sheets: search.section.next (repeat)","kind":"journey","status":"fail","durationMs":1608.9,"metrics":{"journeyId":"route.rates-sheets.search.section.next","journeyLabel":"route.rates-sheets: search.section.next","iteration":"warm","passId":"repeat","scenarioId":"route.rates-sheets","semanticActionId":"search.section.next","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":42,"actionRevisionAfter":43,"renderRevisionBefore":"state-24","renderRevisionAfter":"state-30","actionMs":116,"preActionWaitMs":1,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validat…
11-26 17:14:40.964 E/unknown:ReactNative(21275): ?anon_0_@1:3699198
11-26 17:14:40.964 E/unknown:ReactNative(21275): ?anon_0_@1:3704998
11-26 17:14:40.964 E/unknown:ReactNative(21275): SyntheticError@1:163048
11-26 17:14:40.964 E/unknown:ReactNative(21275): Wrapper@1:163563
11-26 17:14:40.964 E/unknown:ReactNative(21275): _callSuper@1:148436
11-26 17:14:40.964 E/unknown:ReactNative(21275): _construct@1:163911
11-26 17:14:40.964 E/unknown:ReactNative(21275): _next@1:594899
```

### 99 audit 10 min
```
11-26 17:16:21.313 E/ReactNativeJS(21275): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxt1fkg-65147e7f47062db9","check":{"id":"deep-repeat.route.calculator.calculator.open","label":"route.calculator: calculator.open (repeat)","kind":"journey","status":"fail","durationMs":3760.5,"metrics":{"journeyId":"route.calculator.calculator.open","journeyLabel":"route.calculator: calculator.open","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.open","depth":0,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":243.6,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":136.3,"forwardWorkMs":136.3,"navigationCommitMs":0,"firstReadyFrameMs":136.2,"firstReadyFrameObserved":true,…
11-26 17:16:21.314 E/unknown:ReactNative(21275): ?anon_0_@1:3699198
11-26 17:16:21.314 E/unknown:ReactNative(21275): ?anon_0_@1:3704998
11-26 17:16:21.314 E/unknown:ReactNative(21275): SyntheticError@1:163048
11-26 17:16:21.314 E/unknown:ReactNative(21275): Wrapper@1:163563
11-26 17:16:21.314 E/unknown:ReactNative(21275): _callSuper@1:148436
11-26 17:16:21.314 E/unknown:ReactNative(21275): _construct@1:163911
11-26 17:16:21.314 E/unknown:ReactNative(21275): _next@1:594899
```

### 100 audit 12 min
```
11-26 17:17:32.462 E/ReactNativeJS(21275): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxt1fkg-65147e7f47062db9","check":{"id":"deep-repeat.route.saved.saved.compare.dismiss","label":"route.saved: saved.compare.dismiss (repeat)","kind":"journey","status":"fail","durationMs":1466.1,"metrics":{"journeyId":"route.saved.saved.compare.dismiss","journeyLabel":"route.saved: saved.compare.dismiss","iteration":"warm","passId":"repeat","scenarioId":"route.saved","semanticActionId":"saved.compare.dismiss","depth":1,"plannedExpectedPath":"/watchlist","expectedPath":"/watchlist","expectedSurface":"saved.list","actionSource":"compare.table","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-27:13#MA Money|f5ef09f3-f721-41f3-b22e-46104d50088d|RESIDENTIAL_MORTGAGES|Expat Home Loan – Prime (≤$2.5m)|1#Bluestone Home Loans|Bluestone SMSF Residential Loan|RESIDENTIAL_MORTGAGES|SMSF Residential Loan","actionMs":102.9,"preActi…
11-26 17:17:32.464 E/unknown:ReactNative(21275): ?anon_0_@1:3699198
11-26 17:17:32.464 E/unknown:ReactNative(21275): ?anon_0_@1:3704998
11-26 17:17:32.464 E/unknown:ReactNative(21275): SyntheticError@1:163048
11-26 17:17:32.464 E/unknown:ReactNative(21275): Wrapper@1:163563
11-26 17:17:32.464 E/unknown:ReactNative(21275): _callSuper@1:148436
11-26 17:17:32.464 E/unknown:ReactNative(21275): _construct@1:163911
11-26 17:17:32.464 E/unknown:ReactNative(21275): _next@1:594899
```

### 101 audit 13 min
```
11-26 17:18:34.529 E/ReactNativeJS(21275): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxt1fkg-65147e7f47062db9","check":{"id":"deep-repeat.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (repeat)","kind":"journey","status":"fail","durationMs":4445.6,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":64.8,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1101.3,"forwardWorkMs":1101.3,"navigationCommitMs":1100.8,"firstReadyFrameMs":0.5,"firstR…
11-26 17:18:34.530 E/unknown:ReactNative(21275): ?anon_0_@1:3699198
11-26 17:18:34.530 E/unknown:ReactNative(21275): ?anon_0_@1:3704998
11-26 17:18:34.530 E/unknown:ReactNative(21275): SyntheticError@1:163048
11-26 17:18:34.530 E/unknown:ReactNative(21275): Wrapper@1:163563
11-26 17:18:34.530 E/unknown:ReactNative(21275): _callSuper@1:148436
11-26 17:18:34.530 E/unknown:ReactNative(21275): _construct@1:163911
11-26 17:18:34.530 E/unknown:ReactNative(21275): _next@1:594899
```
