# App explorer: 1.0.374 (430)

**Real-use session ATTENTION vs 1.0.372: 0 broken, 23 friction, 0 slower**

- Friction: No reaction for 3.7 s after "scroll rates 1"
- Friction: No reaction for 3.1 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 3.0 s after "open lenders"
- Friction: No reaction for 3.4 s after "scroll lenders"
- Friction: No reaction for 4.6 s after "switch to savings"
- Friction: No reaction for 3.2 s after "switch to home loans"
- Friction: No reaction for 3.5 s after "open filters"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 5.2 s after "open term deposits"
- Friction: No reaction for 3.5 s after "verify term deposit rates"
- Friction: No reaction for 8.1 s after "search Macquarie"
- Friction: No reaction for 3.3 s after "return from savings search"
- Friction: No reaction for 3.5 s after "open mortgage filter draft"
- Friction: No reaction for 3.6 s after "verify fixed was not applied"
- Friction: No reaction for 4.1 s after "open unsaved rate"
- Friction: No reaction for 3.4 s after "open product from saved rates"
- Friction: No reaction for 11.1 s after "leave removed product"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: No reaction for 4.4 s after "follow browse rates recovery"

**Initial Rates readiness:** 43.8 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode full | 115 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 18
Baseline 1.0.372
**Audit live: outcome failed | 1047 s | audit log 859281 bytes (audit-log.txt) https://paste.c-net.org/1950f7bc-e64d-9dea-71d9-100f2b649cb1 | debug log fetch failed (Hosted log exceeds the upload byte limit) https://paste.rs/qkSBw**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2908 | -51841 | 709/964 | 85 | 497 | 1 errors; start 2862ms |
| 2 | scroll rates 1 | 747 | +30 | 35/54 | 81 | 491 | boot js-start 458799, layout-mounted 459338, cache-read 459732, hydrated 459990, splash-hide 459990, manifest 461032, resolved 461681, core-fetched 467360, core-saved 468303, search-index-idle 468593, leading-requested 468593, details-start 469081, leading-scoped 469249, pricing-ready 475553, details-fetched 481097, rows-prepared 488929, detail-filters-idle 488929, last-pricing 488929, suitability-built 490668, post-refresh-wait 491389, leading-page 493335, last-rows 502421, rates-ready 502598, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 205, pricing-scope-ms 18382, leading-gated 1, filter-runs 2, filter-rows 31742, filter-yields 6, filter-ms 147, sort-runs 4, sort-rows 1177, sort-yields 4, sort-ms 155 |
| 3 | scroll rates 2 | 694 | -59 | 22/28 | 113 | 652 |  |
| 4 | scroll rates back | 677 | -41 |  |  | 562 |  |
| 5 | open product | 5469 | -3246 | 33/55 | 85 | 643 |  |
| 6 | scroll product | 714 | +18 | 31/49 | 89 | 659 |  |
| 7 | back to rates | 30 | +5 | 14/23 | 65 | 646 |  |
| 8 | open lenders | 29 | +5 | 20/24 | 300 | 635 |  |
| 9 | scroll lenders | 805 | +89 | 22/26 | 129 | 633 |  |
| 10 | back from lenders | 22 | -3 | 9/10 | 150 | 634 |  |
| 11 | switch to savings | 24 | +1 | 62/86 | 77 | 648 |  |
| 12 | switch to home loans | 24 | 0 | 18/31 | 65 | 665 |  |
| 13 | open filters | 23 | -1 | 20/28 | 117 | 668 |  |
| 14 | close filters | 22 | -6 | 8/9 | 150 | 663 |  |
| 15 | open market | 22 | -3 | 18/33 | 73 | 672 |  |
| 16 | open rba | 2714 | -248 | 65/84 | 61 | 681 |  |
| 17 | scroll rba | 724 | -7 | 32/52 | 69 | 673 |  |
| 18 | back from rba | 23 | -1 | 10/20 | 53 | 674 |  |
| 19 | scroll market | 743 | +41 | 26/39 | 77 | 673 |  |
| 20 | open saved | 23 | -3 | 12/19 | 89 | 676 |  |
| 21 | return to rates | 24 | -1 | 17/29 | 81 | 678 |  |
| 22 | start category switch | 28 | -3 |  |  | 677 |  |
| 23 | open term deposits | 24 | +1 | 70/96 | 89 | 695 |  |
| 24 | verify term deposit rates | 716 | -9 | 37/55 | 77 | 698 |  |
| 25 | restore home loans | 25 | +2 | 15/27 | 61 | 705 |  |
| 26 | start search from rates | 25 | -10 |  |  | 698 |  |
| 27 | open savings search | 22 | -6 | 15/27 | 73 | 720 |  |
| 28 | search Macquarie | 2315 | -62 | 79/84 | 150 | 732 |  |
| 29 | verify Macquarie result | 0 | -1 | 12/15 | 16 | 723 |  |
| 30 | clear query and restore results | 22 | -2 | 19/21 | 32 | 739 |  |
| 31 | return from savings search | 22 | -4 | 33/42 | 85 | 765 |  |
| 32 | start filter rollback | 35 | +4 | 15/15 | 16 | 749 |  |
| 33 | open mortgage filter draft | 23 | -16 | 28/31 | 150 | 766 |  |
| 34 | select fixed in draft | 24 | -2 | 12/13 | 150 | 768 |  |
| 35 | discard unsaved filter draft | 23 | -1 | 15/22 | 77 | 771 |  |
| 36 | verify fixed was not applied | 23 | -2 | 26/29 | 150 | 785 | 1 errors |
| 37 | close verified filter draft | 21 | -3 | 20/22 | 77 | 785 |  |
| 38 | start save from rates | 34 | -13 | 11/16 | 16 | 782 | 1 errors |
| 39 | open unsaved rate | 22 | -26 | 106/148 | 85 | 833 | 1 errors |
| 40 | save a rate | 30 | +4 | 9/15 | 81 | 817 | 1 errors |
| 41 | leave saved product | 22 | -3 | 15/22 | 89 | 821 |  |
| 42 | restart with a saved rate | 20600 | +2495 | 260/367 | 85 | 677 | 1 errors; start 6509ms; boot js-start 876713, layout-mounted 877374, hydrated 878212, cache-read 879152, core-ready 879924, rows-prepared 880083, search-index-idle 880083, detail-filters-idle 880083, leading-requested 880083, last-pricing 880083, splash-hide 880085, manifest 884406, leading-scoped 886092, leading-page 886092, resolved 886977, pricing-ready 890084, last-rows 890084, rates-ready 890273, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 28, pricing-scope-ms 5248, filter-runs 1, filter-rows 6888, filter-yields 4, filter-ms 104, sort-runs 1, sort-rows 1177, sort-yields 1, sort-ms 17 |
| 43 | verify saved rate after restart | 31 | -1 | 19/29 | 85 | 622 |  |
| 44 | open product from saved rates | 22 | -4 | 40/60 | 81 | 776 |  |
| 45 | remove saved rate | 37 | +10 | 13/21 | 81 | 514 |  |
| 46 | leave removed product | 8930 | -120 | 9/10 | 73 | 677 |  |
| 47 | follow browse rates recovery | 2248 | +18 | 15/24 | 89 | 714 |  |
| 48 | start compare from rates | 33 | 0 | 2/2 | 32 | 713 |  |
| 49 | enter selection mode | 24 | -1 | 9/12 | 77 | 727 |  |
| 50 | select first comparison rate | 26 | +2 | 10/14 | 53 | 719 |  |
| 51 | select second comparison rate | 23 | -1 | 9/14 | 57 | 724 |  |
| 52 | open two-rate comparison | 22 | -4 | 22/31 | 150 | 732 |  |
| 53 | return from two-rate comparison | 24 | -4 | 19/28 | 97 | 732 |  |
| 54 | cold start | 10095 |  | 25/31 | 200 | 581 | 3 errors; start 4390ms; boot js-start 1011560, layout-mounted 1011748, hydrated 1011880, cache-read 1013054, core-ready 1013812, rows-prepared 1013961, search-index-idle 1013961, detail-filters-idle 1013961, leading-requested 1013961, last-pricing 1013961, splash-hide 1013962, manifest 1015837, leading-scoped 1016323, leading-page 1016323, resolved 1016819, pricing-ready 1017645, last-rows 1017645, rates-ready 1017844, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 23, pricing-scope-ms 1731, filter-runs 1, filter-rows 6888, filter-yields 4, filter-ms 107, sort-runs 1, sort-rows 1177, sort-yields 1, sort-ms 15 |
| 55 | /browse | 4463 |  | 2/2 | 32 | 424 |  |
| 56 | /watchlist | 29 |  | 2/3 | 36 | 430 |  |
| 57 | /market | 40 |  | 13/20 | 69 | 507 |  |
| 58 | /tools | 33 |  | 15/20 | 250 | 571 |  |
| 59 | /trends | 33 |  | 3/4 | 46 | 621 |  |
| 60 | /search | 40 |  | 36/50 | 101 | 636 |  |
| 61 | /banks | 30 |  | 29/38 | 101 | 644 |  |
| 62 | /bank-rates | 30 |  | 18/26 | 81 | 653 |  |
| 63 | /categories | 25 |  | 34/45 | 101 | 668 |  |
| 64 | /catalogue | 28 |  | 32/43 | 97 | 698 |  |
| 65 | /compare | 32 |  | 11/13 | 109 | 674 |  |
| 66 | /matches | 27 |  | 36/49 | 93 | 694 |  |
| 67 | /calculator | 35 |  | 16/24 | 73 | 690 |  |
| 68 | /projections | 27 |  | 20/32 | 101 | 683 |  |
| 69 | /profile | 31 |  | 17/25 | 73 | 687 |  |
| 70 | /research | 25 |  | 19/28 | 73 | 695 |  |
| 71 | /rba | 31 |  | 16/25 | 101 | 709 |  |
| 72 | /rba-response | 33 |  | 26/36 | 65 | 709 |  |
| 73 | /settings | 26 |  | 12/22 | 69 | 716 |  |
| 74 | /about | 25 |  | 10/22 | 77 | 715 |  |
| 75 | /terms | 27 |  | 14/22 | 69 | 717 |  |
| 76 | /privacy | 27 |  |  |  | 716 |  |
| 77 | /third-party-notices | 37 |  | 13/23 | 65 | 719 |  |
| 78 | /node | 29 |  | 30/42 | 93 | 750 |  |
| 79 | /passthrough | 31 |  | 33/44 | 89 | 721 |  |
| 80 | /calculation-receipt | 29 |  | 17/23 | 77 | 714 |  |
| 81 | /rate-receipt | 35 |  | 6/10 | 85 | 715 |  |
| 82 | warm resume | 706 |  | 4/5 | 133 | 713 | start 369ms |
| 83 | cold relaunch | 10517 |  | 31/37 | 150 | 576 | 3 errors; start 4390ms; boot js-start 1245318, layout-mounted 1245535, hydrated 1245570, cache-read 1246913, core-ready 1247702, rows-prepared 1247861, search-index-idle 1247861, detail-filters-idle 1247861, leading-requested 1247861, last-pricing 1247861, splash-hide 1247863, manifest 1250175, leading-scoped 1250578, leading-page 1250578, resolved 1250990, pricing-ready 1251921, last-rows 1251921, rates-ready 1252101, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 24, pricing-scope-ms 1624, filter-runs 1, filter-rows 6888, filter-yields 4, filter-ms 98, sort-runs 1, sort-rows 1177, sort-yields 1, sort-ms 14 |
| 84 | about | 44 |  | 11/20 | 300 | 397 |  |
| 85 | audit screen | 25 |  | 118/200 | 69 | 612 |  |
| 86 | audit 0 min | 0 |  | 32/33 | 65 | 847 |  |
| 87 | audit 2 min | 0 |  | 1154/1320 | 109 | 975 | 80 errors |
| 88 | audit 3 min | 0 |  | 728/805 | 109 | 1090 | 80 errors |
| 89 | audit 5 min | 0 |  | 448/541 | 101 | 1145 | 80 errors |
| 90 | audit 6 min | 0 |  | 710/824 | 101 | 1223 | 80 errors |
| 91 | audit 7 min | 0 |  | 518/570 | 121 | 1140 | 80 errors |
| 92 | audit 8 min | 0 |  | 225/243 | 117 | 1274 | 80 errors |
| 93 | audit 10 min | 0 |  | 966/1112 | 109 | 1264 | 80 errors |
| 94 | audit 11 min | 0 |  | 698/813 | 105 | 1350 | 80 errors |
| 95 | audit 12 min | 0 |  | 461/515 | 121 | 1362 | 80 errors |
| 96 | audit 13 min | 0 |  | 146/167 | 34 | 1384 | 80 errors |
| 97 | audit 15 min | 0 |  | 148/179 | 40 | 1407 |  |
| 98 | audit 16 min | 0 |  | 56/66 | 34 | 1417 |  |
| 99 | audit 17 min | 0 |  | 92/106 | 73 | 1389 |  |
| 100 | audit finished | 0 |  | 99/169 | 73 | 1429 |  |
| 101 | audit result 1 | 0 |  |  |  | 1423 |  |
| 102 | audit result 2 | 0 |  |  |  | 1420 |  |
| 103 | audit result 3 | 0 |  |  |  | 1423 |  |
| 104 | audit result 4 | 0 |  |  |  | 1422 |  |
| 105 | audit result 5 | 0 |  |  |  | 1423 |  |
| 106 | audit result 6 | 0 |  |  |  | 1426 |  |
| 107 | audit result 7 | 0 |  |  |  | 1423 |  |
| 108 | audit result 8 | 0 |  |  |  | 1426 |  |
| 109 | audit result 9 | 0 |  |  |  | 1425 |  |
| 110 | audit result 10 | 0 |  |  |  | 1426 |  |
| 111 | audit result 11 | 0 |  |  |  | 1428 |  |
| 112 | audit result 12 | 0 |  |  |  | 1426 |  |
| 113 | about for debug log | 3199 |  | 21/35 | 73 | 1311 |  |
| 114 | debug log screen | 0 |  | 111/210 | 61 | 1297 |  |
| 115 | debug log uploaded | 0 |  | 20/28 | 125 | 1518 |  |

## Errors

### 1 open app
```
11-25 05:33:09.855 E/australianrates(11143): Not starting debugger since process cannot load the jdwp agent.
```

### 36 verify fixed was not applied
```
11-25 05:39:16.993 E/FrameTracker(11143): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 38 start save from rates
```
11-25 05:39:34.459 E/FrameTracker(11143): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 39 open unsaved rate
```
11-25 05:39:40.220 E/ImeBackDispatcher(11143): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 178686409
```

### 40 save a rate
```
11-25 05:39:50.763 E/FrameTracker(11143): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 42 restart with a saved rate
```
11-25 05:40:07.236 E/australianrates(15675): Not starting debugger since process cannot load the jdwp agent.
```

### 54 cold start
```
11-25 05:42:23.180 E/australianrates(17197): Not starting debugger since process cannot load the jdwp agent.
11-25 05:42:27.510 E/SurfaceSyncGroup(17197): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-25 05:42:27.510 E/SurfaceSyncGroup(17197): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 83 cold relaunch
```
11-25 05:46:17.186 E/australianrates(20339): Not starting debugger since process cannot load the jdwp agent.
11-25 05:46:21.416 E/SurfaceSyncGroup(20339): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-25 05:46:21.418 E/SurfaceSyncGroup(20339): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 87 audit 2 min
```
11-25 05:47:34.138 E/ReactNativeJS(20339): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvpbtrl-568c2eb31f4af0be","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":5356.3,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":255,"liveStage:dates-index:fetched:ms":217.4,"liveStage:revision:verified:ms":56.6,"liveStage:Core asset:downloaded:ms":241.6,"liveStage:Core asset:hash-verified:ms":17.2,"liveStage:Core asset:native-inflated-and-text-decoded:ms":158.8,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":237.8,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":597.3,"liveStage:Details asset:downloaded:ms":1379.5,"liveStage:Details asset:hash-verified:ms":72.6,"liveSta…
11-25 05:47:34.140 E/unknown:ReactNative(20339): ?anon_0_@1:3694813
11-25 05:47:34.140 E/unknown:ReactNative(20339): ?anon_0_@1:3700613
11-25 05:47:34.140 E/unknown:ReactNative(20339): SyntheticError@1:163016
11-25 05:47:34.140 E/unknown:ReactNative(20339): Wrapper@1:163531
11-25 05:47:34.140 E/unknown:ReactNative(20339): _callSuper@1:148404
11-25 05:47:34.140 E/unknown:ReactNative(20339): _construct@1:163879
11-25 05:47:34.140 E/unknown:ReactNative(20339): _next@1:594867
```

### 88 audit 3 min
```
11-25 05:49:34.640 E/ReactNativeJS(20339): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvpbtrl-568c2eb31f4af0be","check":{"id":"deep-first-pass.route.rates.search.filters.open","label":"route.rates: search.filters.open (first-pass)","kind":"journey","status":"fail","durationMs":5147.4,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRevisionAfter":4,"renderRevisionBefore":"state-21","renderRevisionAfter":"state-24","actionMs":0.2,"preActionWaitMs":1.1,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtra…
11-25 05:49:34.641 E/unknown:ReactNative(20339): ?anon_0_@1:3694813
11-25 05:49:34.641 E/unknown:ReactNative(20339): ?anon_0_@1:3700613
11-25 05:49:34.641 E/unknown:ReactNative(20339): SyntheticError@1:163016
11-25 05:49:34.641 E/unknown:ReactNative(20339): Wrapper@1:163531
11-25 05:49:34.641 E/unknown:ReactNative(20339): _callSuper@1:148404
11-25 05:49:34.641 E/unknown:ReactNative(20339): _construct@1:163879
11-25 05:49:34.641 E/unknown:ReactNative(20339): _next@1:594867
```

### 89 audit 5 min
```
11-25 05:51:11.687 E/ReactNativeJS(20339): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvpbtrl-568c2eb31f4af0be","check":{"id":"deep-first-pass.route.lender.product.lender.open","label":"route.lender: product.lender.open (first-pass)","kind":"journey","status":"fail","durationMs":2129.5,"metrics":{"journeyId":"route.lender.product.lender.open","journeyLabel":"route.lender: product.lender.open","iteration":"cold","passId":"first-pass","scenarioId":"route.lender","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/Zeus","expectedPath":"/bank/Zeus","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":4,"actionRevisionAfter":5,"actionResultEvidence":"{\"expectedPath\":\"/bank/Zeus\"}","actionMs":820.3,"preActionWaitMs":1.9,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,…
11-25 05:51:11.688 E/unknown:ReactNative(20339): ?anon_0_@1:3694813
11-25 05:51:11.688 E/unknown:ReactNative(20339): ?anon_0_@1:3700613
11-25 05:51:11.688 E/unknown:ReactNative(20339): SyntheticError@1:163016
11-25 05:51:11.688 E/unknown:ReactNative(20339): Wrapper@1:163531
11-25 05:51:11.688 E/unknown:ReactNative(20339): _callSuper@1:148404
11-25 05:51:11.688 E/unknown:ReactNative(20339): _construct@1:163879
11-25 05:51:11.688 E/unknown:ReactNative(20339): _next@1:594867
```

### 90 audit 6 min
```
11-25 05:52:00.924 E/ReactNativeJS(20339): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvpbtrl-568c2eb31f4af0be","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":4738.2,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-25:87b4c2940688…:state-7","renderRevisionAfter":"2026-11-25:87b4c2940688…:state-8","actionResultEvidence":"{\"applied\":…
11-25 05:52:00.926 E/unknown:ReactNative(20339): ?anon_0_@1:3694813
11-25 05:52:00.926 E/unknown:ReactNative(20339): ?anon_0_@1:3700613
11-25 05:52:00.926 E/unknown:ReactNative(20339): SyntheticError@1:163016
11-25 05:52:00.926 E/unknown:ReactNative(20339): Wrapper@1:163531
11-25 05:52:00.926 E/unknown:ReactNative(20339): _callSuper@1:148404
11-25 05:52:00.926 E/unknown:ReactNative(20339): _construct@1:163879
11-25 05:52:00.926 E/unknown:ReactNative(20339): _next@1:594867
```

### 91 audit 7 min
```
11-25 05:53:46.754 E/ReactNativeJS(20339): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvpbtrl-568c2eb31f4af0be","check":{"id":"deep-first-pass.route.not-found.not-found.home","label":"route.not-found: not-found.home (first-pass)","kind":"journey","status":"fail","durationMs":9828.4,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"cold","passId":"first-pass","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":0,"actionRevisionAfter":1,"renderRevisionBefore":"not-found-v1","actionMs":106,"preActionWaitMs":0.6,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"sc…
11-25 05:53:46.755 E/unknown:ReactNative(20339): ?anon_0_@1:3694813
11-25 05:53:46.755 E/unknown:ReactNative(20339): ?anon_0_@1:3700613
11-25 05:53:46.755 E/unknown:ReactNative(20339): SyntheticError@1:163016
11-25 05:53:46.755 E/unknown:ReactNative(20339): Wrapper@1:163531
11-25 05:53:46.755 E/unknown:ReactNative(20339): _callSuper@1:148404
11-25 05:53:46.755 E/unknown:ReactNative(20339): _construct@1:163879
11-25 05:53:46.755 E/unknown:ReactNative(20339): _next@1:594867
```

### 92 audit 8 min
```
11-25 05:54:35.988 E/ReactNativeJS(20339): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvpbtrl-568c2eb31f4af0be","check":{"id":"deep-repeat.route.rates.search.filters.open","label":"route.rates: search.filters.open (repeat)","kind":"journey","status":"fail","durationMs":5552.2,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":26,"actionRevisionAfter":27,"renderRevisionBefore":"state-22","renderRevisionAfter":"state-25","actionMs":0.2,"preActionWaitMs":1.1,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"re…
11-25 05:54:35.990 E/unknown:ReactNative(20339): ?anon_0_@1:3694813
11-25 05:54:35.990 E/unknown:ReactNative(20339): ?anon_0_@1:3700613
11-25 05:54:35.990 E/unknown:ReactNative(20339): SyntheticError@1:163016
11-25 05:54:35.990 E/unknown:ReactNative(20339): Wrapper@1:163531
11-25 05:54:35.990 E/unknown:ReactNative(20339): _callSuper@1:148404
11-25 05:54:35.990 E/unknown:ReactNative(20339): _construct@1:163879
11-25 05:54:35.990 E/unknown:ReactNative(20339): _next@1:594867
```

### 93 audit 10 min
```
11-25 05:55:26.207 E/ReactNativeJS(20339): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvpbtrl-568c2eb31f4af0be","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.mortgage.scope.apply.1","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.1 (repeat)","kind":"journey","status":"fail","durationMs":9338,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.1","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.1","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.1","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":44,"actionRevisionAfter":45,"renderRevisionBefore":"state-12","renderRevisionAfter":"state-18","actionMs":133.6,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQu…
11-25 05:55:26.208 E/unknown:ReactNative(20339): ?anon_0_@1:3694813
11-25 05:55:26.208 E/unknown:ReactNative(20339): ?anon_0_@1:3700613
11-25 05:55:26.208 E/unknown:ReactNative(20339): SyntheticError@1:163016
11-25 05:55:26.208 E/unknown:ReactNative(20339): Wrapper@1:163531
11-25 05:55:26.208 E/unknown:ReactNative(20339): _callSuper@1:148404
11-25 05:55:26.208 E/unknown:ReactNative(20339): _construct@1:163879
11-25 05:55:26.208 E/unknown:ReactNative(20339): _next@1:594867
```

### 94 audit 11 min
```
11-25 05:57:18.453 E/ReactNativeJS(20339): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvpbtrl-568c2eb31f4af0be","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1649.8,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Zeus%7CZeus_Build%7CRESIDENTIAL_MORTGAGES%7CZeus%20Build","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"renderRevisionBefore":"2026-11-25:87b4c2940…
11-25 05:57:18.454 E/unknown:ReactNative(20339): ?anon_0_@1:3694813
11-25 05:57:18.454 E/unknown:ReactNative(20339): ?anon_0_@1:3700613
11-25 05:57:18.454 E/unknown:ReactNative(20339): SyntheticError@1:163016
11-25 05:57:18.454 E/unknown:ReactNative(20339): Wrapper@1:163531
11-25 05:57:18.454 E/unknown:ReactNative(20339): _callSuper@1:148404
11-25 05:57:18.454 E/unknown:ReactNative(20339): _construct@1:163879
11-25 05:57:18.454 E/unknown:ReactNative(20339): _next@1:594867
```

### 95 audit 12 min
```
11-25 05:58:47.983 E/ReactNativeJS(20339): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvpbtrl-568c2eb31f4af0be","check":{"id":"deep-repeat.route.not-found.not-found.home","label":"route.not-found: not-found.home (repeat)","kind":"journey","status":"fail","durationMs":10077.5,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"warm","passId":"repeat","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":1,"actionRevisionAfter":2,"renderRevisionBefore":"not-found-v1","actionMs":111.6,"preActionWaitMs":0.8,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetou…
11-25 05:58:47.985 E/unknown:ReactNative(20339): ?anon_0_@1:3694813
11-25 05:58:47.985 E/unknown:ReactNative(20339): ?anon_0_@1:3700613
11-25 05:58:47.985 E/unknown:ReactNative(20339): SyntheticError@1:163016
11-25 05:58:47.985 E/unknown:ReactNative(20339): Wrapper@1:163531
11-25 05:58:47.985 E/unknown:ReactNative(20339): _callSuper@1:148404
11-25 05:58:47.985 E/unknown:ReactNative(20339): _construct@1:163879
11-25 05:58:47.985 E/unknown:ReactNative(20339): _next@1:594867
```

### 96 audit 13 min
```
11-25 05:59:27.021 E/ReactNativeJS(20339): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvpbtrl-568c2eb31f4af0be","check":{"id":"external-link-28","kind":"network","status":"fail","durationMs":0.7722389998380095,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"fail","browserHandler":"unknown","httpReachability":"unknown","handlerAttempted":false,"httpAttempted":false,"httpSelected":true,"handlerResolution":"unresolved","host":"qrco.de","destinationPath":"/bgD4D4"},"error":"This website is not approved for this type of source.","canonicalMetrics":true}}
11-25 05:59:27.023 E/unknown:ReactNative(20339): ?anon_0_@1:3694813
11-25 05:59:27.023 E/unknown:ReactNative(20339): ?anon_0_@1:3704174
11-25 05:59:27.023 E/unknown:ReactNative(20339): SyntheticError@1:163016
11-25 05:59:27.023 E/unknown:ReactNative(20339): Wrapper@1:163531
11-25 05:59:27.023 E/unknown:ReactNative(20339): _callSuper@1:148404
11-25 05:59:27.023 E/unknown:ReactNative(20339): _construct@1:163879
11-25 05:59:27.023 E/unknown:ReactNative(20339): _next@1:594867
```
