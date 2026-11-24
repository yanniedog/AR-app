# App explorer: 1.0.372 (428)

**Real-use session ATTENTION vs 1.0.371: 0 broken, 22 friction, 3 slower**

- Friction: No reaction for 3.6 s after "scroll rates 1"
- Friction: No reaction for 3.4 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.2 s after "scroll lenders"
- Friction: No reaction for 4.5 s after "switch to savings"
- Friction: No reaction for 3.2 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.0 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 5.0 s after "open term deposits"
- Friction: No reaction for 3.1 s after "verify term deposit rates"
- Friction: No reaction for 3.2 s after "open savings search"
- Friction: No reaction for 6.7 s after "search Macquarie"
- Friction: No reaction for 3.3 s after "return from savings search"
- Friction: No reaction for 3.8 s after "open mortgage filter draft"
- Friction: No reaction for 3.6 s after "verify fixed was not applied"
- Friction: No reaction for 3.6 s after "open unsaved rate"
- Friction: No reaction for 3.4 s after "open product from saved rates"
- Friction: No reaction for 11.2 s after "leave removed product"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: No reaction for 4.6 s after "follow browse rates recovery"
- Friction: No reaction for 3.1 s after "select second comparison rate"
- Slower: Dropped frames 61% to 76% on "open market"
- Slower: Dropped frames 76% to 95% on "discard unsaved filter draft"
- Slower: "leave removed product" content 0.0 s to 9.0 s

**Initial Rates readiness:** 43.3 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode full | 113 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 17
Baseline 1.0.371
**Audit live: outcome failed | 1064 s | audit log 864145 bytes (audit-log.txt) https://paste.c-net.org/6c0f0856-06be-094e-a653-c156851729cb | debug log Upload and copy link not found**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2911 | -64103 | 730/987 | 85 | 568 | 1 errors; start 2856ms; boot js-start 428606, layout-mounted 429013, cache-read 429192, hydrated 429364, splash-hide 429364, manifest 431034, resolved 431564, core-fetched 436738, core-saved 437460, rows-prepared 437827, search-index-idle 437827, leading-requested 437827, leading-scoped 438951, details-start 439015, pricing-ready 442116, last-gate 445122, details-fetched 450173, detail-filters-idle 458764, last-pricing 458764, suitability-built 460293, post-refresh-wait 461281, leading-page 462776, last-rows 471771, rates-ready 471955, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 210, pricing-scope-ms 15157, leading-short 1, leading-short-rows 0, leading-scope-rows 123, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 3, filter-rows 38630, filter-yields 12, filter-ms 2967, sort-runs 5, sort-rows 1177, sort-yields 5, sort-ms 120 |
| 2 | scroll rates 1 | 735 | -5283 | 35/49 | 93 | 546 |  |
| 3 | scroll rates 2 | 720 | -41 | 23/33 | 81 | 746 |  |
| 4 | scroll rates back | 685 | -45 |  |  | 643 |  |
| 5 | open product | 5516 | +135 | 40/56 | 93 | 653 |  |
| 6 | scroll product | 721 | +7 | 28/52 | 81 | 668 |  |
| 7 | back to rates | 22 | -14 | 13/24 | 85 | 631 |  |
| 8 | open lenders | 22 | -4 | 20/24 | 400 | 638 |  |
| 9 | scroll lenders | 683 | -146 | 21/24 | 133 | 637 |  |
| 10 | back from lenders | 24 | -1 | 9/10 | 101 | 637 |  |
| 11 | switch to savings | 22 | -7 | 50/75 | 89 | 651 |  |
| 12 | switch to home loans | 23 | -2 | 16/29 | 61 | 668 |  |
| 13 | open filters | 22 | -4 | 24/27 | 129 | 680 |  |
| 14 | close filters | 21 | -9 | 6/8 | 121 | 670 |  |
| 15 | open market | 21 | -6 | 22/29 | 69 | 674 |  |
| 16 | open rba | 2526 | -173 | 71/85 | 65 | 697 |  |
| 17 | scroll rba | 709 | +16 | 30/53 | 73 | 689 |  |
| 18 | back from rba | 23 | -3 | 11/20 | 61 | 692 |  |
| 19 | scroll market | 681 | -65 | 25/38 | 85 | 691 |  |
| 20 | open saved | 21 | -5 | 12/16 | 73 | 697 |  |
| 21 | return to rates | 21 | -7 | 18/30 | 77 | 702 |  |
| 22 | start category switch | 35 | -3 |  |  | 703 |  |
| 23 | open term deposits | 21 | -6 | 64/90 | 85 | 735 |  |
| 24 | verify term deposit rates | 721 | -35 | 19/32 | 69 | 742 |  |
| 25 | restore home loans | 22 | -5 | 17/27 | 65 | 762 |  |
| 26 | start search from rates | 29 | -3 |  |  | 748 |  |
| 27 | open savings search | 26 | -2 | 18/27 | 73 | 772 |  |
| 28 | search Macquarie | 1078 | -446 | 65/71 | 150 | 781 |  |
| 29 | verify Macquarie result | 0 | 0 | 12/15 | 16 | 770 |  |
| 30 | clear query and restore results | 22 | -13 | 17/19 | 32 | 786 |  |
| 31 | return from savings search | 22 | -6 | 31/41 | 81 | 811 |  |
| 32 | start filter rollback | 33 | -1 | 15/16 | 16 | 800 |  |
| 33 | open mortgage filter draft | 21 | -22 | 25/31 | 150 | 816 |  |
| 34 | select fixed in draft | 28 | 0 | 11/14 | 125 | 818 | 1 errors |
| 35 | discard unsaved filter draft | 20 | -4 | 21/22 | 65 | 821 |  |
| 36 | verify fixed was not applied | 26 | 0 | 26/30 | 150 | 835 | 1 errors |
| 37 | close verified filter draft | 20 | -3 | 19/22 | 89 | 834 |  |
| 38 | start save from rates | 27 | -5 | 15/15 | 16 | 832 | 1 errors |
| 39 | open unsaved rate | 22 | -2 | 116/164 | 81 | 861 | 1 errors |
| 40 | save a rate | 22 | -2 | 8/15 | 53 | 866 | 1 errors |
| 41 | leave saved product | 28 | +4 | 10/22 | 69 | 871 |  |
| 42 | restart with a saved rate | 14958 | -5408 | 200/288 | 85 | 584 | 3 errors; start 5948ms; boot js-start 843109, layout-mounted 843780, hydrated 844174, cache-read 845493, core-ready 846271, rows-prepared 846414, search-index-idle 846414, detail-filters-idle 846414, leading-requested 846414, last-pricing 846414, splash-hide 846415, manifest 848773, leading-scoped 849840, leading-page 849840, resolved 850921, pricing-ready 853750, last-rows 853750, rates-ready 853928, pricing-starts 2, pricing-cand-ms 3, pricing-resolve-ms 0, pricing-yields 32, pricing-scope-ms 4677, filter-runs 1, filter-rows 6888, filter-yields 4, filter-ms 101, sort-runs 1, sort-rows 1177, sort-yields 1, sort-ms 14 |
| 43 | verify saved rate after restart | 22 | -5 | 19/32 | 97 | 618 |  |
| 44 | open product from saved rates | 28 | -7 | 40/60 | 73 | 520 |  |
| 45 | remove saved rate | 29 | +3 | 14/18 | 97 | 582 |  |
| 46 | leave removed product | 8957 | +8931 | 4/9 | 93 | 653 |  |
| 47 | follow browse rates recovery | 2192 |  | 15/24 | 77 | 660 |  |
| 48 | start compare from rates | 25 | -7 | 2/2 | 17 | 668 |  |
| 49 | enter selection mode | 22 | -5 | 12/14 | 61 | 719 |  |
| 50 | select first comparison rate | 22 | -5 | 7/12 | 53 | 713 |  |
| 51 | select second comparison rate | 30 | -2349 | 11/14 | 73 | 717 |  |
| 52 | open two-rate comparison | 21 | -4 | 20/28 | 150 | 735 |  |
| 53 | return from two-rate comparison | 21 | -3 | 20/27 | 101 | 739 |  |
| 54 | cold start | 10346 |  | 28/42 | 109 | 579 | 1 errors; start 4101ms; boot js-start 975390, layout-mounted 975622, hydrated 975722, cache-read 977001, core-ready 977775, rows-prepared 977903, search-index-idle 977903, detail-filters-idle 977903, leading-requested 977903, last-pricing 977903, splash-hide 977904, manifest 980212, leading-scoped 980636, leading-page 980636, resolved 981041, pricing-ready 981876, last-rows 981876, rates-ready 982054, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 21, pricing-scope-ms 1561, filter-runs 1, filter-rows 6888, filter-yields 4, filter-ms 97, sort-runs 1, sort-rows 1177, sort-yields 1, sort-ms 14 |
| 55 | /browse | 4470 |  | 2/2 | 32 | 423 |  |
| 56 | /watchlist | 30 |  | 3/3 | 85 | 430 |  |
| 57 | /market | 38 |  | 16/26 | 65 | 507 |  |
| 58 | /tools | 32 |  | 15/22 | 105 | 570 |  |
| 59 | /trends | 27 |  |  |  | 617 |  |
| 60 | /search | 197 |  | 39/54 | 133 | 632 |  |
| 61 | /banks | 23 |  | 33/39 | 113 | 642 |  |
| 62 | /bank-rates | 26 |  | 16/25 | 150 | 652 |  |
| 63 | /categories | 24 |  | 37/48 | 89 | 667 |  |
| 64 | /catalogue | 31 |  | 29/41 | 93 | 691 |  |
| 65 | /compare | 31 |  | 12/15 | 113 | 710 |  |
| 66 | /matches | 29 |  | 30/43 | 85 | 697 |  |
| 67 | /calculator | 27 |  | 16/21 | 77 | 686 |  |
| 68 | /projections | 33 |  | 22/32 | 85 | 686 |  |
| 69 | /profile | 31 |  | 15/23 | 69 | 690 |  |
| 70 | /research | 25 |  | 15/29 | 77 | 698 |  |
| 71 | /rba | 25 |  | 14/24 | 101 | 712 |  |
| 72 | /rba-response | 33 |  | 22/33 | 77 | 712 |  |
| 73 | /settings | 26 |  | 12/22 | 89 | 719 |  |
| 74 | /about | 32 |  | 10/20 | 69 | 719 |  |
| 75 | /terms | 28 |  | 13/23 | 65 | 720 |  |
| 76 | /privacy | 34 |  |  |  | 720 |  |
| 77 | /third-party-notices | 25 |  | 13/23 | 73 | 723 |  |
| 78 | /node | 29 |  | 32/47 | 93 | 747 |  |
| 79 | /passthrough | 30 |  | 28/43 | 89 | 732 |  |
| 80 | /calculation-receipt | 30 |  | 16/28 | 81 | 717 |  |
| 81 | /rate-receipt | 29 |  | 7/9 | 73 | 718 |  |
| 82 | warm resume | 760 |  | 3/5 | 69 | 716 |  |
| 83 | cold relaunch | 10065 |  | 29/36 | 150 | 575 | 3 errors; start 4156ms; boot js-start 1209490, layout-mounted 1209688, hydrated 1209822, cache-read 1210991, core-ready 1211757, rows-prepared 1211881, search-index-idle 1211881, detail-filters-idle 1211881, leading-requested 1211881, last-pricing 1211881, splash-hide 1211882, manifest 1213905, leading-scoped 1214356, leading-page 1214356, resolved 1214851, pricing-ready 1215627, last-rows 1215627, rates-ready 1215811, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 20, pricing-scope-ms 1639, filter-runs 1, filter-rows 6888, filter-yields 4, filter-ms 102, sort-runs 1, sort-rows 1177, sort-yields 1, sort-ms 14 |
| 84 | about | 30 |  | 12/21 | 85 | 604 |  |
| 85 | audit screen | 22 |  | 120/195 | 69 | 589 |  |
| 86 | audit 0 min | 0 |  | 26/30 | 81 | 734 |  |
| 87 | audit 2 min | 0 |  | 1111/1281 | 113 | 1041 | 80 errors |
| 88 | audit 4 min | 0 |  | 1129/1280 | 109 | 1075 | 80 errors |
| 89 | audit 5 min | 0 |  | 141/164 | 101 | 1111 | 80 errors |
| 90 | audit 7 min | 0 |  | 915/1053 | 113 | 1149 | 80 errors |
| 91 | audit 8 min | 0 |  | 490/544 | 113 | 1199 | 80 errors |
| 92 | audit 10 min | 0 |  | 955/1090 | 109 | 1371 | 80 errors |
| 93 | audit 11 min | 0 |  | 682/797 | 101 | 1400 | 80 errors |
| 94 | audit 12 min | 0 |  | 473/540 | 121 | 1257 | 80 errors |
| 95 | audit 13 min | 0 |  | 49/57 | 44 | 1264 |  |
| 96 | audit 14 min | 0 |  | 143/178 | 36 | 1275 |  |
| 97 | audit 16 min | 0 |  | 94/114 | 36 | 1288 |  |
| 98 | audit 17 min | 0 |  | 92/111 | 69 | 1331 |  |
| 99 | audit finished | 0 |  | 84/144 | 73 | 1383 |  |
| 100 | audit result 1 | 0 |  |  |  | 1333 |  |
| 101 | audit result 2 | 0 |  |  |  | 1335 |  |
| 102 | audit result 3 | 0 |  |  |  | 1333 |  |
| 103 | audit result 4 | 0 |  |  |  | 1336 |  |
| 104 | audit result 5 | 0 |  |  |  | 1334 |  |
| 105 | audit result 6 | 0 |  |  |  | 1334 |  |
| 106 | audit result 7 | 0 |  |  |  | 1337 |  |
| 107 | audit result 8 | 0 |  |  |  | 1335 |  |
| 108 | audit result 9 | 0 |  |  |  | 1338 |  |
| 109 | audit result 10 | 0 |  |  |  | 1336 |  |
| 110 | audit result 11 | 0 |  |  |  | 1336 |  |
| 111 | audit result 12 | 0 |  |  |  | 1339 |  |
| 112 | about for debug log | 3207 |  | 23/36 | 69 | 1366 |  |
| 113 | debug log screen | 0 |  | 113/200 | 65 | 1388 |  |

## Errors

### 1 open app
```
11-24 22:52:40.566 E/australianrates(10799): Not starting debugger since process cannot load the jdwp agent.
```

### 34 select fixed in draft
```
11-24 22:58:29.500 E/FrameTracker(10799): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 36 verify fixed was not applied
```
11-24 22:58:46.980 E/FrameTracker(10799): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 38 start save from rates
```
11-24 22:59:04.458 E/FrameTracker(10799): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 39 open unsaved rate
```
11-24 22:59:10.113 E/ImeBackDispatcher(10799): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 131878862
```

### 40 save a rate
```
11-24 22:59:20.688 E/FrameTracker(10799): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 42 restart with a saved rate
```
11-24 22:59:35.791 E/australianrates(15337): Not starting debugger since process cannot load the jdwp agent.
11-24 22:59:41.303 E/SurfaceSyncGroup(15337): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-24 22:59:41.303 E/SurfaceSyncGroup(15337): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 54 cold start
```
11-24 23:01:48.555 E/australianrates(16862): Not starting debugger since process cannot load the jdwp agent.
```

### 83 cold relaunch
```
11-24 23:05:42.661 E/australianrates(20018): Not starting debugger since process cannot load the jdwp agent.
11-24 23:05:46.763 E/SurfaceSyncGroup(20018): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-24 23:05:46.763 E/SurfaceSyncGroup(20018): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```

### 87 audit 2 min
```
11-24 23:06:58.386 E/ReactNativeJS(20018): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvb0o58-650e9d875f74f22e","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":5209.6,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":225.4,"liveStage:dates-index:fetched:ms":167.3,"liveStage:revision:verified:ms":62.8,"liveStage:Core asset:downloaded:ms":258.3,"liveStage:Core asset:hash-verified:ms":11.1,"liveStage:Core asset:native-inflated-and-text-decoded:ms":159.8,"liveStage:Core asset:inflated:ms":0.1,"liveStage:Core asset:text-decoded:ms":0.1,"liveStage:Core asset:decoded:ms":284.1,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":641.2,"liveStage:Details asset:downloaded:ms":1417.3,"liveStage:Details asset:hash-verified:ms":27.4,"l…
11-24 23:06:58.388 E/unknown:ReactNative(20018): ?anon_0_@1:3694919
11-24 23:06:58.388 E/unknown:ReactNative(20018): ?anon_0_@1:3700719
11-24 23:06:58.388 E/unknown:ReactNative(20018): SyntheticError@1:163016
11-24 23:06:58.388 E/unknown:ReactNative(20018): Wrapper@1:163531
11-24 23:06:58.388 E/unknown:ReactNative(20018): _callSuper@1:148404
11-24 23:06:58.388 E/unknown:ReactNative(20018): _construct@1:163879
11-24 23:06:58.388 E/unknown:ReactNative(20018): _next@1:594867
```

### 88 audit 4 min
```
11-24 23:08:57.488 E/ReactNativeJS(20018): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvb0o58-650e9d875f74f22e","check":{"id":"deep-first-pass.route.rates.search.filters.open","label":"route.rates: search.filters.open (first-pass)","kind":"journey","status":"fail","durationMs":5083.9,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRevisionAfter":4,"renderRevisionBefore":"state-21","renderRevisionAfter":"state-25","actionMs":0.2,"preActionWaitMs":0.8,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtra…
11-24 23:08:57.489 E/unknown:ReactNative(20018): ?anon_0_@1:3694919
11-24 23:08:57.489 E/unknown:ReactNative(20018): ?anon_0_@1:3700719
11-24 23:08:57.489 E/unknown:ReactNative(20018): SyntheticError@1:163016
11-24 23:08:57.489 E/unknown:ReactNative(20018): Wrapper@1:163531
11-24 23:08:57.489 E/unknown:ReactNative(20018): _callSuper@1:148404
11-24 23:08:57.489 E/unknown:ReactNative(20018): _construct@1:163879
11-24 23:08:57.489 E/unknown:ReactNative(20018): _next@1:594867
```

### 89 audit 5 min
```
11-24 23:11:15.605 E/ReactNativeJS(20018): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvb0o58-650e9d875f74f22e","check":{"id":"deep-first-pass.sample.catalogue.4.product.lender.open","label":"sample.catalogue.4: product.lender.open (first-pass)","kind":"journey","status":"fail","durationMs":3410.1,"metrics":{"journeyId":"sample.catalogue.4.product.lender.open","journeyLabel":"sample.catalogue.4: product.lender.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.4","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/Summerland%20Bank","expectedPath":"/bank/Summerland%20Bank","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":9,"actionRevisionAfter":10,"actionResultEvidence":"{\"expectedPath\":\"/bank/Summerland%20Bank\"}","actionMs":831.2,"preActionWaitMs":1.1,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJusti…
11-24 23:11:15.607 E/unknown:ReactNative(20018): ?anon_0_@1:3694919
11-24 23:11:15.607 E/unknown:ReactNative(20018): ?anon_0_@1:3700719
11-24 23:11:15.607 E/unknown:ReactNative(20018): SyntheticError@1:163016
11-24 23:11:15.607 E/unknown:ReactNative(20018): Wrapper@1:163531
11-24 23:11:15.607 E/unknown:ReactNative(20018): _callSuper@1:148404
11-24 23:11:15.607 E/unknown:ReactNative(20018): _construct@1:163879
11-24 23:11:15.607 E/unknown:ReactNative(20018): _next@1:594867
```

### 90 audit 7 min
```
11-24 23:11:41.440 E/ReactNativeJS(20018): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvb0o58-650e9d875f74f22e","check":{"id":"deep-first-pass.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (first-pass)","kind":"journey","status":"fail","durationMs":1533.4,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Police%20Credit%20Union%20Ltd%7CINV_BHL_MAX_90_LVR_PI%7CRESIDENTIAL_MORTGAGES%7CBetter%20Home%20Loan%2090%25%20LVR%20P%26I%20-%20Investment","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,…
11-24 23:11:41.442 E/unknown:ReactNative(20018): ?anon_0_@1:3694919
11-24 23:11:41.442 E/unknown:ReactNative(20018): ?anon_0_@1:3700719
11-24 23:11:41.442 E/unknown:ReactNative(20018): SyntheticError@1:163016
11-24 23:11:41.442 E/unknown:ReactNative(20018): Wrapper@1:163531
11-24 23:11:41.442 E/unknown:ReactNative(20018): _callSuper@1:148404
11-24 23:11:41.442 E/unknown:ReactNative(20018): _construct@1:163879
11-24 23:11:41.442 E/unknown:ReactNative(20018): _next@1:594867
```

### 91 audit 8 min
```
11-24 23:13:41.084 E/ReactNativeJS(20018): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvb0o58-650e9d875f74f22e","check":{"id":"deep-first-pass.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (first-pass)","kind":"journey","status":"fail","durationMs":4958.9,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":131,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1300.4,"forwardWorkMs":1300.4,"navigationCommitMs":1300,"firstReadyFrameMs":0.…
11-24 23:13:41.086 E/unknown:ReactNative(20018): ?anon_0_@1:3694919
11-24 23:13:41.086 E/unknown:ReactNative(20018): ?anon_0_@1:3700719
11-24 23:13:41.086 E/unknown:ReactNative(20018): SyntheticError@1:163016
11-24 23:13:41.086 E/unknown:ReactNative(20018): Wrapper@1:163531
11-24 23:13:41.086 E/unknown:ReactNative(20018): _callSuper@1:148404
11-24 23:13:41.086 E/unknown:ReactNative(20018): _construct@1:163879
11-24 23:13:41.086 E/unknown:ReactNative(20018): _next@1:594867
```

### 92 audit 10 min
```
11-24 23:14:55.883 E/ReactNativeJS(20018): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvb0o58-650e9d875f74f22e","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.mortgage.scope.apply.0","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.0 (repeat)","kind":"journey","status":"fail","durationMs":1942.1,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.0","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.0","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.0","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":43,"actionRevisionAfter":44,"renderRevisionBefore":"state-9","renderRevisionAfter":"state-15","actionMs":88.7,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQu…
11-24 23:14:55.884 E/unknown:ReactNative(20018): ?anon_0_@1:3694919
11-24 23:14:55.884 E/unknown:ReactNative(20018): ?anon_0_@1:3700719
11-24 23:14:55.884 E/unknown:ReactNative(20018): SyntheticError@1:163016
11-24 23:14:55.884 E/unknown:ReactNative(20018): Wrapper@1:163531
11-24 23:14:55.884 E/unknown:ReactNative(20018): _callSuper@1:148404
11-24 23:14:55.884 E/unknown:ReactNative(20018): _construct@1:163879
11-24 23:14:55.884 E/unknown:ReactNative(20018): _next@1:594867
```

### 93 audit 11 min
```
11-24 23:16:45.034 E/ReactNativeJS(20018): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvb0o58-650e9d875f74f22e","check":{"id":"deep-repeat.route.calculator.calculator.open","label":"route.calculator: calculator.open (repeat)","kind":"journey","status":"fail","durationMs":3949.6,"metrics":{"journeyId":"route.calculator.calculator.open","journeyLabel":"route.calculator: calculator.open","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.open","depth":0,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":428.4,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":72.9,"forwardWorkMs":72.9,"navigationCommitMs":0.1,"firstReadyFrameMs":72.9,"firstReadyFrameObserved":true,"…
11-24 23:16:45.036 E/unknown:ReactNative(20018): ?anon_0_@1:3694919
11-24 23:16:45.036 E/unknown:ReactNative(20018): ?anon_0_@1:3700719
11-24 23:16:45.036 E/unknown:ReactNative(20018): SyntheticError@1:163016
11-24 23:16:45.036 E/unknown:ReactNative(20018): Wrapper@1:163531
11-24 23:16:45.036 E/unknown:ReactNative(20018): _callSuper@1:148404
11-24 23:16:45.036 E/unknown:ReactNative(20018): _construct@1:163879
11-24 23:16:45.036 E/unknown:ReactNative(20018): _next@1:594867
```

### 94 audit 12 min
```
11-24 23:18:34.640 E/ReactNativeJS(20018): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwvb0o58-650e9d875f74f22e","check":{"id":"deep-repeat.route.not-found.not-found.home","label":"route.not-found: not-found.home (repeat)","kind":"journey","status":"fail","durationMs":9921.6,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"warm","passId":"repeat","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":1,"actionRevisionAfter":2,"renderRevisionBefore":"not-found-v1","actionMs":138.4,"preActionWaitMs":0.7,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetour…
11-24 23:18:34.641 E/unknown:ReactNative(20018): ?anon_0_@1:3694919
11-24 23:18:34.641 E/unknown:ReactNative(20018): ?anon_0_@1:3700719
11-24 23:18:34.641 E/unknown:ReactNative(20018): SyntheticError@1:163016
11-24 23:18:34.641 E/unknown:ReactNative(20018): Wrapper@1:163531
11-24 23:18:34.641 E/unknown:ReactNative(20018): _callSuper@1:148404
11-24 23:18:34.641 E/unknown:ReactNative(20018): _construct@1:163879
11-24 23:18:34.641 E/unknown:ReactNative(20018): _next@1:594867
```
