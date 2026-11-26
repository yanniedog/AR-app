# App explorer: 1.0.376 (432)

**Real-use session ATTENTION vs 1.0.375: 0 broken, 22 friction, 4 slower**

- Friction: No reaction for 3.4 s after "scroll rates 1"
- Friction: No reaction for 3.3 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll product fees"
- Friction: No reaction for 3.1 s after "scroll product sources"
- Friction: No reaction for 3.1 s after "scroll lenders"
- Friction: No reaction for 4.6 s after "switch to savings"
- Friction: No reaction for 5.9 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 4.7 s after "open term deposits"
- Friction: No reaction for 3.5 s after "verify term deposit rates"
- Friction: No reaction for 6.0 s after "search Macquarie"
- Friction: No reaction for 3.1 s after "return from savings search"
- Friction: No reaction for 3.5 s after "open mortgage filter draft"
- Friction: No reaction for 3.1 s after "verify fixed was not applied"
- Friction: No reaction for 3.7 s after "open unsaved rate"
- Friction: No reaction for 5.0 s after "open product from saved rates"
- Friction: No reaction for 5.4 s after "remove saved rate"
- Friction: "No saved rates" shown on "leave removed product"
- Slower: "switch to home loans" content 3.1 s to 5.9 s
- Slower: "switch to home loans" reaction 3.1 s to 5.9 s
- Slower: "remove saved rate" content 3.2 s to 5.4 s
- Slower: "remove saved rate" reaction 3.2 s to 5.4 s

**Initial Rates readiness:** 33.7 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-26

Mode full | 115 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 16
Baseline 1.0.375
**Audit live: outcome failed | 924 s | audit log 846013 bytes (audit-log.txt) https://paste.c-net.org/d9ebd6dc-29f7-4fd3-72de-d15ab66ff2e2 | debug log fetch failed (Hosted log exceeds the upload byte limit) https://paste.rs/vZDIL**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2794 | -171 | 514/813 | 77 | 502 | 1 errors; start 2713ms |
| 2 | scroll rates 1 | 730 | +30 | 35/60 | 69 | 596 | boot js-start 446482, layout-mounted 446916, cache-read 447304, hydrated 447491, splash-hide 447491, manifest 448716, resolved 449083, core-fetched 453613, core-saved 454198, search-index-idle 454633, leading-requested 454633, details-start 455156, leading-scoped 455313, pricing-ready 456729, details-fetched 464890, rows-prepared 470141, detail-filters-idle 470141, last-pricing 470141, suitability-built 471081, post-refresh-wait 471519, leading-page 473025, last-rows 479910, rates-ready 480173, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 169, pricing-scope-ms 10766, leading-gated 1, filter-runs 2, filter-rows 31602, filter-yields 8, filter-ms 1082, sort-runs 4, sort-rows 1183, sort-yields 4, sort-ms 56 |
| 3 | scroll rates 2 | 711 | +19 | 21/33 | 73 | 692 |  |
| 4 | scroll rates back | 680 | +2 |  |  | 550 |  |
| 5 | open product | 5740 | +5714 | 37/61 | 85 | 666 |  |
| 6 | scroll product | 714 | +10 | 32/52 | 69 | 656 |  |
| 7 | scroll product fees | 724 |  | 31/56 | 69 | 670 |  |
| 8 | scroll product eligibility | 696 |  | 15/28 | 65 | 657 |  |
| 9 | scroll product sources | 685 |  | 23/38 | 77 | 657 |  |
| 10 | back to rates | 30 | +6 | 11/24 | 69 | 652 |  |
| 11 | open lenders | 30 | +7 | 19/24 | 250 | 659 |  |
| 12 | scroll lenders | 741 | +6 | 16/21 | 121 | 657 |  |
| 13 | back from lenders | 20 | -3 | 8/9 | 150 | 661 |  |
| 14 | switch to savings | 25 | -3 | 60/88 | 81 | 672 |  |
| 15 | switch to home loans | 2276 | +2253 | 16/27 | 69 | 678 |  |
| 16 | open filters | 26 | -4 | 22/27 | 113 | 682 |  |
| 17 | close filters | 24 | +1 | 7/8 | 200 | 684 |  |
| 18 | open market | 25 | -1 | 16/32 | 53 | 687 |  |
| 19 | open rba | 2701 | +221 | 59/81 | 61 | 702 |  |
| 20 | scroll rba | 743 | +52 | 32/59 | 73 | 696 |  |
| 21 | back from rba | 25 | -5 | 11/21 | 57 | 697 |  |
| 22 | scroll market | 684 | -15 | 23/41 | 69 | 695 |  |
| 23 | open saved | 19 | -5 | 10/19 | 93 | 701 |  |
| 24 | return to rates | 20 | -2 | 19/37 | 69 | 702 |  |
| 25 | start category switch | 35 | +6 |  |  | 701 |  |
| 26 | open term deposits | 19 | -7 | 60/95 | 77 | 724 |  |
| 27 | verify term deposit rates | 698 | +12 | 33/56 | 73 | 725 |  |
| 28 | restore home loans | 34 | +11 | 15/28 | 57 | 736 |  |
| 29 | start search from rates | 24 | -9 |  |  | 730 |  |
| 30 | open savings search | 20 | -5 | 17/32 | 48 | 745 |  |
| 31 | search Macquarie | 1583 | -437 | 57/63 | 121 | 743 |  |
| 32 | verify Macquarie result | 0 | 0 | 12/15 | 16 | 738 | 1 errors |
| 33 | clear query and restore results | 20 | -4 | 15/20 | 32 | 749 |  |
| 34 | return from savings search | 42 | +18 | 31/44 | 89 | 762 |  |
| 35 | start filter rollback | 36 | +4 | 14/15 | 32 | 754 |  |
| 36 | open mortgage filter draft | 24 | -2 | 26/31 | 250 | 763 |  |
| 37 | select fixed in draft | 19 | -5 | 12/13 | 125 | 763 |  |
| 38 | discard unsaved filter draft | 19 | -5 | 17/21 | 57 | 764 |  |
| 39 | verify fixed was not applied | 20 | -8 | 24/28 | 150 | 772 | 1 errors |
| 40 | close verified filter draft | 20 | -4 | 20/21 | 93 | 770 |  |
| 41 | start save from rates | 29 | +1 | 13/15 | 19 | 767 | 1 errors |
| 42 | open unsaved rate | 21 | -20 | 101/153 | 77 | 804 | 1 errors |
| 43 | save a rate | 27 | -6 | 6/16 | 53 | 789 | 1 errors |
| 44 | leave saved product | 28 | -1 | 14/24 | 65 | 791 |  |
| 45 | restart with a saved rate | 14064 | -69 | 166/267 | 85 | 521 | 1 errors; start 5316ms; boot js-start 876977, layout-mounted 877312, hydrated 878208, cache-read 879004, core-ready 879601, rows-prepared 879717, search-index-idle 879717, detail-filters-idle 879717, leading-requested 879717, last-pricing 879717, splash-hide 879718, manifest 882247, leading-scoped 883814, leading-page 883814, resolved 884414, pricing-ready 886652, last-rows 886652, rates-ready 886793, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 30, pricing-scope-ms 4371, filter-runs 1, filter-rows 6864, filter-yields 3, filter-ms 79, sort-runs 1, sort-rows 1183, sort-yields 1, sort-ms 13 |
| 46 | verify saved rate after restart | 24 | 0 | 18/29 | 73 | 411 |  |
| 47 | open product from saved rates | 2236 | +2208 | 40/62 | 81 | 438 |  |
| 48 | remove saved rate | 2242 | +2212 | 7/18 | 65 | 434 |  |
| 49 | leave removed product | 32 | -9039 | 6/8 | 77 | 428 |  |
| 50 | follow browse rates recovery | 23 | 0 | 15/27 | 69 | 453 |  |
| 51 | start compare from rates | 27 | 0 |  |  | 453 |  |
| 52 | enter selection mode | 21 | -3 | 7/14 | 48 | 450 |  |
| 53 | select first comparison rate | 22 | -2 | 10/14 | 65 | 448 |  |
| 54 | select second comparison rate | 18 | -5 | 11/16 | 65 | 449 |  |
| 55 | open two-rate comparison | 22 | 0 | 18/30 | 150 | 463 |  |
| 56 | return from two-rate comparison | 23 | +2 | 19/28 | 101 | 464 |  |
| 57 | cold start | 9653 | -797 | 31/39 | 200 | 589 | 3 errors; start 4057ms; boot js-start 996252, layout-mounted 996431, hydrated 996534, cache-read 997630, core-ready 998261, rows-prepared 998356, search-index-idle 998356, detail-filters-idle 998356, leading-requested 998356, last-pricing 998356, splash-hide 998358, manifest 1000302, leading-scoped 1000770, leading-page 1000770, resolved 1001180, pricing-ready 1001942, last-rows 1001942, rates-ready 1002115, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 20, pricing-scope-ms 1665, filter-runs 1, filter-rows 6864, filter-yields 4, filter-ms 99, sort-runs 1, sort-rows 1183, sort-yields 1, sort-ms 13 |
| 58 | /browse | 4498 | +17 | 2/2 | 32 | 442 |  |
| 59 | /watchlist | 30 | +6 | 4/4 | 32 | 524 |  |
| 60 | /market | 27 | -7 | 12/20 | 69 | 606 |  |
| 61 | /tools | 29 | -1 |  |  | 591 |  |
| 62 | /trends | 4487 | +4450 | 21/36 | 93 | 599 |  |
| 63 | /search | 27 | -3 | 24/32 | 150 | 628 |  |
| 64 | /banks | 25 | -6 | 29/41 | 101 | 644 |  |
| 65 | /bank-rates | 24 | -7 | 17/33 | 61 | 646 |  |
| 66 | /categories | 24 | -6 | 35/47 | 93 | 675 |  |
| 67 | /catalogue | 37 | +2 | 30/43 | 109 | 699 |  |
| 68 | /compare | 22 | -21 | 11/14 | 117 | 674 |  |
| 69 | /matches | 27 | -3 | 32/48 | 89 | 698 |  |
| 70 | /calculator | 25 | +2 | 14/22 | 69 | 686 |  |
| 71 | /projections | 27 | +4 | 20/32 | 89 | 693 |  |
| 72 | /profile | 29 | +5 | 16/27 | 61 | 698 |  |
| 73 | /research | 23 | -3 | 18/31 | 61 | 707 |  |
| 74 | /rba | 34 | +5 | 12/25 | 85 | 724 |  |
| 75 | /rba-response | 29 | -1 | 14/31 | 57 | 727 |  |
| 76 | /settings | 28 | +1 | 13/28 | 73 | 735 |  |
| 77 | /about | 23 | -6 | 10/22 | 65 | 739 |  |
| 78 | /terms | 29 | +5 | 10/23 | 61 | 741 |  |
| 79 | /privacy | 21 | -10 |  |  | 741 |  |
| 80 | /third-party-notices | 33 | +3 | 17/26 | 61 | 747 |  |
| 81 | /node | 30 | 0 | 28/43 | 93 | 786 |  |
| 82 | /passthrough | 45 | +13 | 28/45 | 85 | 768 |  |
| 83 | /calculation-receipt | 24 | -7 | 14/25 | 69 | 751 |  |
| 84 | /rate-receipt | 27 | -2 | 6/8 | 73 | 753 |  |
| 85 | warm resume | 291 | -601 | 3/4 | 42 | 752 |  |
| 86 | cold relaunch | 9810 | -421 | 35/44 | 117 | 665 | 1 errors; start 3829ms; boot js-start 1230163, layout-mounted 1230379, hydrated 1230379, cache-read 1231514, core-ready 1232178, rows-prepared 1232326, search-index-idle 1232326, detail-filters-idle 1232326, leading-requested 1232326, last-pricing 1232326, splash-hide 1232328, manifest 1234365, leading-scoped 1234829, leading-page 1234829, resolved 1235424, pricing-ready 1236167, last-rows 1236167, rates-ready 1236335, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 20, pricing-scope-ms 1715, filter-runs 1, filter-rows 6864, filter-yields 4, filter-ms 92, sort-runs 1, sort-rows 1183, sort-yields 1, sort-ms 13 |
| 87 | about | 35 | +3 | 12/19 | 300 | 607 |  |
| 88 | audit screen | 35 | +14 | 125/223 | 69 | 552 |  |
| 89 | audit 0 min | 0 | 0 | 27/29 | 97 | 776 |  |
| 90 | audit 2 min | 0 | 0 | 1038/1225 | 105 | 1022 | 80 errors |
| 91 | audit 3 min | 0 |  | 1137/1323 | 105 | 1116 | 80 errors |
| 92 | audit 4 min | 0 | 0 | 508/620 | 101 | 1185 | 80 errors |
| 93 | audit 6 min | 0 | 0 | 742/854 | 117 | 1281 | 80 errors |
| 94 | audit 8 min | 0 | 0 | 937/1092 | 105 | 1279 | 80 errors |
| 95 | audit 9 min | 0 |  | 942/1085 | 109 | 1379 | 80 errors |
| 96 | audit 11 min | 0 | 0 | 240/289 | 109 | 1329 | 80 errors |
| 97 | audit 12 min | 0 |  | 92/108 | 32 | 1337 |  |
| 98 | audit 13 min | 0 | 0 | 150/186 | 36 | 1365 |  |
| 99 | audit 14 min | 0 |  | 60/68 | 65 | 1243 |  |
| 100 | audit finished | 0 | 0 | 114/209 | 65 | 1421 |  |
| 101 | audit result 1 | 0 | 0 |  |  | 1386 |  |
| 102 | audit result 2 | 0 | 0 |  |  | 1389 |  |
| 103 | audit result 3 | 0 | 0 |  |  | 1388 |  |
| 104 | audit result 4 | 0 | 0 |  |  | 1391 |  |
| 105 | audit result 5 | 0 | 0 |  |  | 1388 |  |
| 106 | audit result 6 | 0 | 0 |  |  | 1392 |  |
| 107 | audit result 7 | 0 | 0 |  |  | 1390 |  |
| 108 | audit result 8 | 0 | 0 |  |  | 1393 |  |
| 109 | audit result 9 | 0 | 0 |  |  | 1393 |  |
| 110 | audit result 10 | 0 | 0 |  |  | 1391 |  |
| 111 | audit result 11 | 0 | 0 |  |  | 1394 |  |
| 112 | audit result 12 | 0 | 0 |  |  | 1392 |  |
| 113 | about for debug log | 3361 | +3325 | 19/31 | 65 | 1273 |  |
| 114 | debug log screen | 0 | -1 | 105/220 | 57 | 1251 |  |
| 115 | debug log uploaded | 0 | 0 | 24/28 | 109 | 1507 |  |

## Errors

### 1 open app
```
11-26 02:06:56.206 E/australianrates(11071): Not starting debugger since process cannot load the jdwp agent.
```

### 32 verify Macquarie result
```
11-26 02:12:16.151 E/FrameTracker(11071): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 39 verify fixed was not applied
```
11-26 02:13:17.289 E/FrameTracker(11071): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 41 start save from rates
```
11-26 02:13:34.124 E/FrameTracker(11071): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 42 open unsaved rate
```
11-26 02:13:39.655 E/ImeBackDispatcher(11071): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 27643954
```

### 43 save a rate
```
11-26 02:13:50.254 E/FrameTracker(11071): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 45 restart with a saved rate
```
11-26 02:14:06.041 E/australianrates(15974): Not starting debugger since process cannot load the jdwp agent.
```

### 57 cold start
```
11-26 02:16:06.267 E/australianrates(17447): Not starting debugger since process cannot load the jdwp agent.
11-26 02:16:10.212 E/SurfaceSyncGroup(17447): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-26 02:16:10.213 E/SurfaceSyncGroup(17447): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 86 cold relaunch
```
11-26 02:20:00.377 E/australianrates(20585): Not starting debugger since process cannot load the jdwp agent.
```

### 90 audit 2 min
```
11-26 02:21:16.122 E/ReactNativeJS(20585): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwwxeh8d-56b14cf6de3ce2d9","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":7259.9,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":272.5,"liveStage:dates-index:fetched:ms":251.1,"liveStage:revision:verified:ms":55.9,"liveStage:Core asset:downloaded:ms":223.4,"liveStage:Core asset:hash-verified:ms":2.8,"liveStage:Core asset:native-inflated-and-text-decoded:ms":161,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":213.1,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":656.2,"liveStage:Details asset:downloaded:ms":1211.5,"liveStage:Details asset:hash-verified:ms":59.5,"liveStag…
11-26 02:21:16.125 E/unknown:ReactNative(20585): ?anon_0_@1:3696648
11-26 02:21:16.125 E/unknown:ReactNative(20585): ?anon_0_@1:3702448
11-26 02:21:16.125 E/unknown:ReactNative(20585): SyntheticError@1:163048
11-26 02:21:16.125 E/unknown:ReactNative(20585): Wrapper@1:163563
11-26 02:21:16.125 E/unknown:ReactNative(20585): _callSuper@1:148436
11-26 02:21:16.125 E/unknown:ReactNative(20585): _construct@1:163911
11-26 02:21:16.125 E/unknown:ReactNative(20585): _next@1:594899
```

### 91 audit 3 min
```
11-26 02:23:02.268 E/ReactNativeJS(20585): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwwxeh8d-56b14cf6de3ce2d9","check":{"id":"deep-first-pass.route.rates.search.filters.apply","label":"route.rates: search.filters.apply (first-pass)","kind":"journey","status":"fail","durationMs":1433.2,"metrics":{"journeyId":"route.rates.search.filters.apply","journeyLabel":"route.rates: search.filters.apply","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.filters.apply","depth":2,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"state-26","renderRevisionAfter":"state-32","actionMs":174.5,"preActionWaitMs":1,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"ba…
11-26 02:23:02.269 E/unknown:ReactNative(20585): ?anon_0_@1:3696648
11-26 02:23:02.269 E/unknown:ReactNative(20585): ?anon_0_@1:3702448
11-26 02:23:02.269 E/unknown:ReactNative(20585): SyntheticError@1:163048
11-26 02:23:02.269 E/unknown:ReactNative(20585): Wrapper@1:163563
11-26 02:23:02.269 E/unknown:ReactNative(20585): _callSuper@1:148436
11-26 02:23:02.269 E/unknown:ReactNative(20585): _construct@1:163911
11-26 02:23:02.269 E/unknown:ReactNative(20585): _next@1:594899
```

### 92 audit 4 min
```
11-26 02:25:10.856 E/ReactNativeJS(20585): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwwxeh8d-56b14cf6de3ce2d9","check":{"id":"deep-first-pass.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (first-pass)","kind":"journey","status":"fail","durationMs":1455.6,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Cairns%20bank%7CI1_24M_UNDER_500K%7CTERM_DEPOSITS%7CTerm%20deposits%2024mths%20under%20%24500%2C000","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":7,"actionRevision…
11-26 02:25:10.858 E/unknown:ReactNative(20585): ?anon_0_@1:3696648
11-26 02:25:10.858 E/unknown:ReactNative(20585): ?anon_0_@1:3702448
11-26 02:25:10.858 E/unknown:ReactNative(20585): SyntheticError@1:163048
11-26 02:25:10.858 E/unknown:ReactNative(20585): Wrapper@1:163563
11-26 02:25:10.858 E/unknown:ReactNative(20585): _callSuper@1:148436
11-26 02:25:10.858 E/unknown:ReactNative(20585): _construct@1:163911
11-26 02:25:10.858 E/unknown:ReactNative(20585): _next@1:594899
```

### 93 audit 6 min
```
11-26 02:26:25.100 E/ReactNativeJS(20585): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwwxeh8d-56b14cf6de3ce2d9","check":{"id":"deep-first-pass.route.debug-log.debug-log.open","label":"route.debug-log: debug-log.open (first-pass)","kind":"journey","status":"fail","durationMs":905.5,"metrics":{"journeyId":"route.debug-log.debug-log.open","journeyLabel":"route.debug-log: debug-log.open","iteration":"cold","passId":"first-pass","scenarioId":"route.debug-log","semanticActionId":"debug-log.open","depth":0,"plannedExpectedPath":"/debug-log","expectedPath":"/debug-log","expectedSurface":"debug-log.entries","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":232.2,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":21.9,"forwardWorkMs":21.9,"navigationCommitMs":0,"firstReadyFrameMs":21.9,"firstReadyFrameObserved":true,"read…
11-26 02:26:25.102 E/unknown:ReactNative(20585): ?anon_0_@1:3696648
11-26 02:26:25.102 E/unknown:ReactNative(20585): ?anon_0_@1:3702448
11-26 02:26:25.102 E/unknown:ReactNative(20585): SyntheticError@1:163048
11-26 02:26:25.102 E/unknown:ReactNative(20585): Wrapper@1:163563
11-26 02:26:25.102 E/unknown:ReactNative(20585): _callSuper@1:148436
11-26 02:26:25.102 E/unknown:ReactNative(20585): _construct@1:163911
11-26 02:26:25.102 E/unknown:ReactNative(20585): _next@1:594899
```

### 94 audit 8 min
```
11-26 02:27:39.639 E/ReactNativeJS(20585): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwwxeh8d-56b14cf6de3ce2d9","check":{"id":"deep-repeat.route.rates-sheets.search.section.next","label":"route.rates-sheets: search.section.next (repeat)","kind":"journey","status":"fail","durationMs":8266.2,"metrics":{"journeyId":"route.rates-sheets.search.section.next","journeyLabel":"route.rates-sheets: search.section.next","iteration":"warm","passId":"repeat","scenarioId":"route.rates-sheets","semanticActionId":"search.section.next","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":40,"actionRevisionAfter":41,"renderRevisionBefore":"state-24","renderRevisionAfter":"state-30","actionMs":196.9,"preActionWaitMs":4.4,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"val…
11-26 02:27:39.640 E/unknown:ReactNative(20585): ?anon_0_@1:3696648
11-26 02:27:39.640 E/unknown:ReactNative(20585): ?anon_0_@1:3702448
11-26 02:27:39.640 E/unknown:ReactNative(20585): SyntheticError@1:163048
11-26 02:27:39.640 E/unknown:ReactNative(20585): Wrapper@1:163563
11-26 02:27:39.640 E/unknown:ReactNative(20585): _callSuper@1:148436
11-26 02:27:39.640 E/unknown:ReactNative(20585): _construct@1:163911
11-26 02:27:39.640 E/unknown:ReactNative(20585): _next@1:594899
```

### 95 audit 9 min
```
11-26 02:29:35.052 E/ReactNativeJS(20585): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwwxeh8d-56b14cf6de3ce2d9","check":{"id":"deep-repeat.route.calculator.calculator.section.savings","label":"route.calculator: calculator.section.savings (repeat)","kind":"journey","status":"fail","durationMs":2564.6,"metrics":{"journeyId":"route.calculator.calculator.section.savings","journeyLabel":"route.calculator: calculator.section.savings","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.section.savings","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":13,"actionRevisionAfter":14,"renderRevisionBefore":"2026-11-26:0e55e66b7edb…:state-9","renderRevisionAfter":"2026-11-26:0e55e66b7edb…:state-10","actionResultEvidence":"{\"selectedSectionBefore\":\"Mortgage\",\"requestedSectio…
11-26 02:29:35.055 E/unknown:ReactNative(20585): ?anon_0_@1:3696648
11-26 02:29:35.055 E/unknown:ReactNative(20585): ?anon_0_@1:3702448
11-26 02:29:35.055 E/unknown:ReactNative(20585): SyntheticError@1:163048
11-26 02:29:35.055 E/unknown:ReactNative(20585): Wrapper@1:163563
11-26 02:29:35.055 E/unknown:ReactNative(20585): _callSuper@1:148436
11-26 02:29:35.055 E/unknown:ReactNative(20585): _construct@1:163911
11-26 02:29:35.055 E/unknown:ReactNative(20585): _next@1:594899
```

### 96 audit 11 min
```
11-26 02:31:17.520 E/ReactNativeJS(20585): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwwxeh8d-56b14cf6de3ce2d9","check":{"id":"deep-repeat.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (repeat)","kind":"journey","status":"fail","durationMs":3971.7,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":122.9,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1583.1,"forwardWorkMs":1583.1,"navigationCommitMs":1582.2,"firstReadyFrameMs":0.9,"first…
11-26 02:31:17.524 E/unknown:ReactNative(20585): ?anon_0_@1:3696648
11-26 02:31:17.524 E/unknown:ReactNative(20585): ?anon_0_@1:3702448
11-26 02:31:17.524 E/unknown:ReactNative(20585): SyntheticError@1:163048
11-26 02:31:17.524 E/unknown:ReactNative(20585): Wrapper@1:163563
11-26 02:31:17.524 E/unknown:ReactNative(20585): _callSuper@1:148436
11-26 02:31:17.524 E/unknown:ReactNative(20585): _construct@1:163911
11-26 02:31:17.524 E/unknown:ReactNative(20585): _next@1:594899
```
