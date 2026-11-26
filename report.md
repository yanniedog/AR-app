# App explorer: 1.0.378 (434)

**Real-use session ATTENTION vs 1.0.376: 0 broken, 18 friction, 1 slower**

- Friction: No reaction for 3.6 s after "scroll rates 1"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.0 s after "scroll product fees"
- Friction: No reaction for 3.1 s after "scroll product eligibility"
- Friction: No reaction for 6.5 s after "expand constraints"
- Friction: No reaction for 3.2 s after "scroll lenders"
- Friction: No reaction for 4.5 s after "switch to savings"
- Friction: No reaction for 3.0 s after "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 4.2 s after "open term deposits"
- Friction: No reaction for 3.4 s after "verify term deposit rates"
- Friction: No reaction for 6.0 s after "search Macquarie"
- Friction: No reaction for 3.6 s after "open mortgage filter draft"
- Friction: No reaction for 3.8 s after "open unsaved rate"
- Friction: No reaction for 5.9 s after "open product from saved rates"
- Friction: No reaction for 3.0 s after "remove saved rate"
- Friction: "No saved rates" shown on "leave removed product"
- Slower: Dropped frames 76% to 93% on "scroll lenders"

**Initial Rates readiness:** 31.2 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-26

Mode full | 119 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 16
Baseline 1.0.376
**Audit live: outcome failed | 972 s | audit log 846805 bytes (audit-log.txt) https://paste.c-net.org/4a0faca9-1d9c-aee5-affc-bf08e0a6efa5 | debug log fetch failed (Hosted log exceeds the upload byte limit) https://paste.rs/kzP37**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2775 | -19 | 498/770 | 77 | 503 | 1 errors; start 2734ms; boot js-start 424448, layout-mounted 424866, cache-read 425076, hydrated 425389, splash-hide 425389, manifest 426214, resolved 426796, core-fetched 431325, core-saved 432397, search-index-idle 432705, leading-requested 432705, details-start 433189, leading-scoped 433265, pricing-ready 435105, details-fetched 441792, rows-prepared 446485, detail-filters-idle 446485, last-pricing 446485, suitability-built 447200, post-refresh-wait 447893, leading-page 449078, last-rows 455510, rates-ready 455674, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 158, pricing-scope-ms 10308, leading-gated 1, filter-runs 2, filter-rows 31602, filter-yields 5, filter-ms 145, sort-runs 4, sort-rows 1183, sort-yields 4, sort-ms 61 |
| 2 | scroll rates 1 | 693 | -37 | 35/52 | 73 | 596 |  |
| 3 | scroll rates 2 | 690 | -21 | 13/25 | 65 | 544 |  |
| 4 | scroll rates back | 679 | -1 |  |  | 530 |  |
| 5 | open product | 21 | -5719 | 33/59 | 81 | 613 |  |
| 6 | scroll product | 721 | +7 | 34/55 | 65 | 660 |  |
| 7 | expand product facts | 18 |  | 36/71 | 77 | 674 |  |
| 8 | scroll product fees | 692 | -32 | 28/55 | 65 | 665 |  |
| 9 | scroll product eligibility | 707 | +11 | 22/42 | 69 | 653 |  |
| 10 | expand eligibility | 0 |  | 204/312 | 73 | 645 |  |
| 11 | expand constraints | 4480 |  | 7/17 | 53 | 649 |  |
| 12 | scroll product sources | 694 | +9 | 19/35 | 73 | 647 |  |
| 13 | back to rates | 24 | -6 | 13/23 | 65 | 645 |  |
| 14 | open lenders | 20 | -10 | 22/24 | 150 | 653 |  |
| 15 | scroll lenders | 772 | +31 | 25/27 | 133 | 649 |  |
| 16 | back from lenders | 20 | 0 | 8/10 | 117 | 653 |  |
| 17 | switch to savings | 19 | -6 | 57/88 | 77 | 665 |  |
| 18 | switch to home loans | 21 | -2255 | 16/32 | 57 | 677 |  |
| 19 | open filters | 18 | -8 | 23/30 | 150 | 683 |  |
| 20 | close filters | 18 | -6 | 6/10 | 101 | 676 |  |
| 21 | open market | 19 | -6 | 17/29 | 57 | 680 |  |
| 22 | open rba | 2417 | -284 | 58/75 | 65 | 695 |  |
| 23 | scroll rba | 706 | -37 | 31/55 | 73 | 688 |  |
| 24 | back from rba | 26 | +1 | 11/21 | 57 | 689 |  |
| 25 | scroll market | 718 | +34 | 25/44 | 73 | 689 |  |
| 26 | open saved | 20 | +1 | 12/17 | 73 | 693 |  |
| 27 | return to rates | 19 | -1 | 15/31 | 65 | 694 |  |
| 28 | start category switch | 26 | -9 |  |  | 693 |  |
| 29 | open term deposits | 20 | +1 | 48/71 | 73 | 715 |  |
| 30 | verify term deposit rates | 682 | -16 | 35/59 | 77 | 716 |  |
| 31 | restore home loans | 18 | -16 | 16/31 | 57 | 728 |  |
| 32 | start search from rates | 23 | -1 |  |  | 722 |  |
| 33 | open savings search | 20 | 0 | 15/33 | 65 | 741 |  |
| 34 | search Macquarie | 2086 | +503 | 56/68 | 150 | 755 |  |
| 35 | verify Macquarie result | 0 | 0 | 14/15 | 17 | 736 |  |
| 36 | clear query and restore results | 20 | 0 | 14/20 | 36 | 744 |  |
| 37 | return from savings search | 22 | -20 | 28/40 | 81 | 754 |  |
| 38 | start filter rollback | 27 | -9 | 13/16 | 32 | 750 |  |
| 39 | open mortgage filter draft | 38 | +14 | 27/30 | 200 | 760 |  |
| 40 | select fixed in draft | 19 | 0 | 9/12 | 69 | 759 |  |
| 41 | discard unsaved filter draft | 19 | 0 | 18/23 | 89 | 761 |  |
| 42 | verify fixed was not applied | 22 | +2 | 25/27 | 150 | 769 | 1 errors |
| 43 | close verified filter draft | 18 | -2 | 18/23 | 81 | 767 |  |
| 44 | start save from rates | 28 | -1 | 13/15 | 18 | 764 | 1 errors |
| 45 | open unsaved rate | 20 | -1 | 88/130 | 77 | 789 | 1 errors |
| 46 | save a rate | 20 | -7 | 7/16 | 48 | 790 | 1 errors |
| 47 | leave saved product | 21 | -7 | 13/24 | 85 | 795 |  |
| 48 | restart with a saved rate | 13947 | -117 | 159/250 | 81 | 520 | 1 errors; start 5757ms; boot js-start 909180, layout-mounted 909917, hydrated 909917, cache-read 911863, core-ready 912457, rows-prepared 912604, search-index-idle 912604, detail-filters-idle 912604, leading-requested 912604, last-pricing 912604, splash-hide 912605, manifest 915049, leading-scoped 916193, leading-page 916193, resolved 916659, pricing-ready 918979, last-rows 918979, rates-ready 919196, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 25, pricing-scope-ms 3639, filter-runs 2, filter-rows 31602, filter-yields 6, filter-ms 134, sort-runs 1, sort-rows 1183, sort-yields 1, sort-ms 14 |
| 49 | verify saved rate after restart | 22 | -2 | 15/26 | 69 | 440 |  |
| 50 | open product from saved rates | 2237 | +1 | 39/62 | 77 | 459 |  |
| 51 | remove saved rate | 21 | -2221 | 8/17 | 46 | 461 |  |
| 52 | leave removed product | 23 | -9 | 7/11 | 73 | 451 |  |
| 53 | follow browse rates recovery | 19 | -4 | 13/27 | 65 | 460 |  |
| 54 | start compare from rates | 27 | 0 |  |  | 470 |  |
| 55 | enter selection mode | 19 | -2 | 7/14 | 48 | 476 |  |
| 56 | select first comparison rate | 19 | -3 | 10/14 | 48 | 473 |  |
| 57 | select second comparison rate | 19 | +1 | 8/15 | 57 | 479 |  |
| 58 | open two-rate comparison | 20 | -2 | 20/32 | 150 | 489 |  |
| 59 | return from two-rate comparison | 24 | +1 | 20/29 | 93 | 473 |  |
| 60 | cold start | 9081 | -572 | 28/39 | 93 | 595 | 1 errors; start 3698ms; boot js-start 1024860, layout-mounted 1025017, hydrated 1025089, cache-read 1026128, core-ready 1026698, rows-prepared 1026810, search-index-idle 1026810, detail-filters-idle 1026810, leading-requested 1026810, last-pricing 1026810, splash-hide 1026811, manifest 1028214, leading-scoped 1028695, leading-page 1028695, resolved 1029250, pricing-ready 1029875, last-rows 1029875, rates-ready 1030026, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 21, pricing-scope-ms 1583, filter-runs 1, filter-rows 6864, filter-yields 4, filter-ms 88, sort-runs 1, sort-rows 1183, sort-yields 1, sort-ms 12 |
| 61 | /browse | 2218 | -2280 | 2/2 | 32 | 443 |  |
| 62 | /watchlist | 30 | 0 | 2/3 | 48 | 524 |  |
| 63 | /market | 29 | +2 | 13/22 | 53 | 606 |  |
| 64 | /tools | 26 | -3 |  |  | 601 |  |
| 65 | /trends | 2195 | -2292 | 20/37 | 85 | 609 |  |
| 66 | /search | 30 | +3 | 29/39 | 150 | 638 |  |
| 67 | /banks | 31 | +6 | 26/38 | 125 | 653 |  |
| 68 | /bank-rates | 19 | -5 | 20/31 | 65 | 656 |  |
| 69 | /categories | 24 | 0 | 32/46 | 117 | 682 |  |
| 70 | /catalogue | 23 | -14 | 29/43 | 97 | 698 |  |
| 71 | /compare | 26 | +4 | 8/14 | 117 | 670 |  |
| 72 | /matches | 21 | -6 | 35/51 | 81 | 697 |  |
| 73 | /calculator | 26 | +1 | 12/23 | 65 | 687 |  |
| 74 | /projections | 28 | +1 | 15/27 | 69 | 690 |  |
| 75 | /profile | 22 | -7 | 15/28 | 57 | 697 |  |
| 76 | /research | 25 | +2 | 18/28 | 65 | 710 |  |
| 77 | /rba | 20 | -14 | 14/28 | 101 | 723 |  |
| 78 | /rba-response | 27 | -2 | 14/27 | 65 | 728 |  |
| 79 | /settings | 25 | -3 | 15/26 | 73 | 735 |  |
| 80 | /about | 28 | +5 | 13/24 | 57 | 738 |  |
| 81 | /terms | 27 | -2 | 14/24 | 69 | 741 |  |
| 82 | /privacy | 23 | +2 |  |  | 740 |  |
| 83 | /third-party-notices | 29 | -4 | 15/23 | 65 | 746 |  |
| 84 | /node | 24 | -6 | 28/45 | 85 | 788 |  |
| 85 | /passthrough | 25 | -20 | 32/47 | 85 | 756 |  |
| 86 | /calculation-receipt | 28 | +4 | 12/26 | 73 | 751 |  |
| 87 | /rate-receipt | 27 | 0 | 5/8 | 65 | 752 |  |
| 88 | warm resume | 651 | +360 | 5/5 | 200 | 752 | start 263ms |
| 89 | cold relaunch | 9148 | -662 | 27/41 | 85 | 583 | 1 errors; start 3360ms; boot js-start 1248873, layout-mounted 1249059, hydrated 1249059, cache-read 1250131, core-ready 1250730, rows-prepared 1250832, search-index-idle 1250832, detail-filters-idle 1250832, leading-requested 1250832, last-pricing 1250832, splash-hide 1250833, manifest 1252617, leading-scoped 1253064, leading-page 1253064, resolved 1253450, pricing-ready 1254135, last-rows 1254135, rates-ready 1254293, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 20, pricing-scope-ms 1480, filter-runs 1, filter-rows 6864, filter-yields 4, filter-ms 96, sort-runs 1, sort-rows 1183, sort-yields 1, sort-ms 13 |
| 90 | about | 26 | -9 | 11/21 | 65 | 411 |  |
| 91 | audit screen | 24 | -11 | 103/216 | 61 | 602 |  |
| 92 | audit 0 min | 0 | 0 | 21/29 | 81 | 862 |  |
| 93 | audit 2 min | 0 | 0 | 1023/1214 | 101 | 975 | 80 errors |
| 94 | audit 3 min | 0 | 0 | 1062/1279 | 101 | 1152 | 80 errors |
| 95 | audit 5 min | 0 |  | 648/791 | 93 | 1228 | 80 errors |
| 96 | audit 6 min | 0 | 0 | 467/537 | 109 | 1144 | 80 errors |
| 97 | audit 7 min | 0 |  | 212/238 | 101 | 1178 | 80 errors |
| 98 | audit 8 min | 0 | 0 | 908/1104 | 97 | 1321 | 80 errors |
| 99 | audit 10 min | 0 |  | 661/808 | 93 | 1389 | 80 errors |
| 100 | audit 12 min | 0 | 0 | 500/610 | 101 | 1250 | 80 errors |
| 101 | audit 13 min | 0 | 0 | 125/160 | 34 | 1269 |  |
| 102 | audit 14 min | 0 | 0 | 87/119 | 34 | 1276 |  |
| 103 | audit 15 min | 0 |  | 56/68 | 65 | 1284 |  |
| 104 | audit finished | 0 | 0 | 117/216 | 65 | 1299 |  |
| 105 | audit result 1 | 0 | 0 |  |  | 1287 |  |
| 106 | audit result 2 | 0 | 0 |  |  | 1284 |  |
| 107 | audit result 3 | 0 | 0 |  |  | 1287 |  |
| 108 | audit result 4 | 0 | 0 |  |  | 1285 |  |
| 109 | audit result 5 | 0 | 0 |  |  | 1287 |  |
| 110 | audit result 6 | 0 | 0 |  |  | 1288 |  |
| 111 | audit result 7 | 0 | 0 |  |  | 1286 |  |
| 112 | audit result 8 | 0 | 0 |  |  | 1289 |  |
| 113 | audit result 9 | 0 | 0 |  |  | 1287 |  |
| 114 | audit result 10 | 0 | 0 |  |  | 1287 |  |
| 115 | audit result 11 | 0 | 0 |  |  | 1289 |  |
| 116 | audit result 12 | 0 | 0 |  |  | 1288 |  |
| 117 | about for debug log | 3032 | -329 | 20/34 | 77 | 1317 |  |
| 118 | debug log screen | 0 | 0 | 103/222 | 53 | 1335 |  |
| 119 | debug log uploaded | 0 | 0 | 22/27 | 93 | 1384 |  |

## Errors

### 1 open app
```
11-26 05:54:54.401 E/australianrates(10970): Not starting debugger since process cannot load the jdwp agent.
```

### 42 verify fixed was not applied
```
11-26 06:02:12.442 E/FrameTracker(10970): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 44 start save from rates
```
11-26 06:02:28.849 E/FrameTracker(10970): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 open unsaved rate
```
11-26 06:02:34.203 E/ImeBackDispatcher(10970): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 121346035
```

### 46 save a rate
```
11-26 06:02:44.807 E/FrameTracker(10970): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 48 restart with a saved rate
```
11-26 06:02:59.516 E/australianrates(16464): Not starting debugger since process cannot load the jdwp agent.
```

### 60 cold start
```
11-26 06:04:55.870 E/australianrates(17897): Not starting debugger since process cannot load the jdwp agent.
```

### 89 cold relaunch
```
11-26 06:08:39.842 E/australianrates(21035): Not starting debugger since process cannot load the jdwp agent.
```

### 93 audit 2 min
```
11-26 06:09:51.747 E/ReactNativeJS(21035): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwx5kdh1-c93ab68f52138bfb","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":6584,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":158.3,"liveStage:dates-index:fetched:ms":225.9,"liveStage:revision:verified:ms":85,"liveStage:Core asset:downloaded:ms":193,"liveStage:Core asset:hash-verified:ms":12.6,"liveStage:Core asset:native-inflated-and-text-decoded:ms":132.4,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":177.1,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":569,"liveStage:Details asset:downloaded:ms":1157.7,"liveStage:Details asset:hash-verified:ms":25,"liveStage:Detai…
11-26 06:09:51.748 E/unknown:ReactNative(21035): ?anon_0_@1:3696648
11-26 06:09:51.748 E/unknown:ReactNative(21035): ?anon_0_@1:3702448
11-26 06:09:51.748 E/unknown:ReactNative(21035): SyntheticError@1:163048
11-26 06:09:51.748 E/unknown:ReactNative(21035): Wrapper@1:163563
11-26 06:09:51.748 E/unknown:ReactNative(21035): _callSuper@1:148436
11-26 06:09:51.748 E/unknown:ReactNative(21035): _construct@1:163911
11-26 06:09:51.748 E/unknown:ReactNative(21035): _next@1:594899
```

### 94 audit 3 min
```
11-26 06:11:37.955 E/ReactNativeJS(21035): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwx5kdh1-c93ab68f52138bfb","check":{"id":"deep-first-pass.route.rates.search.filters.open","label":"route.rates: search.filters.open (first-pass)","kind":"journey","status":"fail","durationMs":3762.4,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRevisionAfter":4,"renderRevisionBefore":"state-24","renderRevisionAfter":"state-28","actionMs":0.2,"preActionWaitMs":0.6,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtra…
11-26 06:11:37.956 E/unknown:ReactNative(21035): ?anon_0_@1:3696648
11-26 06:11:37.956 E/unknown:ReactNative(21035): ?anon_0_@1:3702448
11-26 06:11:37.956 E/unknown:ReactNative(21035): SyntheticError@1:163048
11-26 06:11:37.956 E/unknown:ReactNative(21035): Wrapper@1:163563
11-26 06:11:37.956 E/unknown:ReactNative(21035): _callSuper@1:148436
11-26 06:11:37.956 E/unknown:ReactNative(21035): _construct@1:163911
11-26 06:11:37.956 E/unknown:ReactNative(21035): _next@1:594899
```

### 95 audit 5 min
```
11-26 06:14:00.433 E/ReactNativeJS(21035): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwx5kdh1-c93ab68f52138bfb","check":{"id":"deep-first-pass.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (first-pass)","kind":"journey","status":"fail","durationMs":1474.1,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Bank%20of%20Queensland%20Limited%7C59906e88-5c03-ee11-8f6e-00224814d330%7CRESIDENTIAL_MORTGAGES%7CClear%20Path%20Variable%20Home%20Loan","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"act…
11-26 06:14:00.434 E/unknown:ReactNative(21035): ?anon_0_@1:3696648
11-26 06:14:00.434 E/unknown:ReactNative(21035): ?anon_0_@1:3702448
11-26 06:14:00.434 E/unknown:ReactNative(21035): SyntheticError@1:163048
11-26 06:14:00.434 E/unknown:ReactNative(21035): Wrapper@1:163563
11-26 06:14:00.434 E/unknown:ReactNative(21035): _callSuper@1:148436
11-26 06:14:00.434 E/unknown:ReactNative(21035): _construct@1:163911
11-26 06:14:00.434 E/unknown:ReactNative(21035): _next@1:594899
```

### 96 audit 6 min
```
11-26 06:15:28.657 E/ReactNativeJS(21035): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwx5kdh1-c93ab68f52138bfb","check":{"id":"deep-first-pass.route.not-found.not-found.home","label":"route.not-found: not-found.home (first-pass)","kind":"journey","status":"fail","durationMs":7720.4,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"cold","passId":"first-pass","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":0,"actionRevisionAfter":1,"renderRevisionBefore":"not-found-v1","actionMs":76.8,"preActionWaitMs":0.5,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"s…
11-26 06:15:28.658 E/unknown:ReactNative(21035): ?anon_0_@1:3696648
11-26 06:15:28.658 E/unknown:ReactNative(21035): ?anon_0_@1:3702448
11-26 06:15:28.658 E/unknown:ReactNative(21035): SyntheticError@1:163048
11-26 06:15:28.658 E/unknown:ReactNative(21035): Wrapper@1:163563
11-26 06:15:28.658 E/unknown:ReactNative(21035): _callSuper@1:148436
11-26 06:15:28.658 E/unknown:ReactNative(21035): _construct@1:163911
11-26 06:15:28.658 E/unknown:ReactNative(21035): _next@1:594899
```

### 97 audit 7 min
```
11-26 06:16:10.380 E/ReactNativeJS(21035): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwx5kdh1-c93ab68f52138bfb","check":{"id":"deep-repeat.route.rates.search.filters.open","label":"route.rates: search.filters.open (repeat)","kind":"journey","status":"fail","durationMs":4233,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":26,"actionRevisionAfter":27,"renderRevisionBefore":"state-25","renderRevisionAfter":"state-29","actionMs":0.1,"preActionWaitMs":0.6,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repe…
11-26 06:16:10.381 E/unknown:ReactNative(21035): ?anon_0_@1:3696648
11-26 06:16:10.381 E/unknown:ReactNative(21035): ?anon_0_@1:3702448
11-26 06:16:10.381 E/unknown:ReactNative(21035): SyntheticError@1:163048
11-26 06:16:10.381 E/unknown:ReactNative(21035): Wrapper@1:163563
11-26 06:16:10.381 E/unknown:ReactNative(21035): _callSuper@1:148436
11-26 06:16:10.381 E/unknown:ReactNative(21035): _construct@1:163911
11-26 06:16:10.381 E/unknown:ReactNative(21035): _next@1:594899
```

### 98 audit 8 min
```
11-26 06:16:59.680 E/ReactNativeJS(21035): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwx5kdh1-c93ab68f52138bfb","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.mortgage.scope.apply.1","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.1 (repeat)","kind":"journey","status":"fail","durationMs":7339.5,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.1","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.1","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.1","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":44,"actionRevisionAfter":45,"renderRevisionBefore":"state-15","renderRevisionAfter":"state-21","actionMs":102.8,"preActionWaitMs":0.7,"preActionQuietWindowReused":true,"preAction…
11-26 06:16:59.682 E/unknown:ReactNative(21035): ?anon_0_@1:3696648
11-26 06:16:59.682 E/unknown:ReactNative(21035): ?anon_0_@1:3702448
11-26 06:16:59.682 E/unknown:ReactNative(21035): SyntheticError@1:163048
11-26 06:16:59.682 E/unknown:ReactNative(21035): Wrapper@1:163563
11-26 06:16:59.682 E/unknown:ReactNative(21035): _callSuper@1:148436
11-26 06:16:59.682 E/unknown:ReactNative(21035): _construct@1:163911
11-26 06:16:59.682 E/unknown:ReactNative(21035): _next@1:594899
```

### 99 audit 10 min
```
11-26 06:18:21.637 E/ReactNativeJS(21035): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwx5kdh1-c93ab68f52138bfb","check":{"id":"deep-repeat.route.calculator.calculator.open","label":"route.calculator: calculator.open (repeat)","kind":"journey","status":"fail","durationMs":3261.2,"metrics":{"journeyId":"route.calculator.calculator.open","journeyLabel":"route.calculator: calculator.open","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.open","depth":0,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":234.1,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":49.6,"forwardWorkMs":49.6,"navigationCommitMs":0,"firstReadyFrameMs":49.6,"firstReadyFrameObserved":true,"re…
11-26 06:18:21.638 E/unknown:ReactNative(21035): ?anon_0_@1:3696648
11-26 06:18:21.638 E/unknown:ReactNative(21035): ?anon_0_@1:3702448
11-26 06:18:21.638 E/unknown:ReactNative(21035): SyntheticError@1:163048
11-26 06:18:21.638 E/unknown:ReactNative(21035): Wrapper@1:163563
11-26 06:18:21.638 E/unknown:ReactNative(21035): _callSuper@1:148436
11-26 06:18:21.638 E/unknown:ReactNative(21035): _construct@1:163911
11-26 06:18:21.638 E/unknown:ReactNative(21035): _next@1:594899
```

### 100 audit 12 min
```
11-26 06:20:02.259 E/ReactNativeJS(21035): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwx5kdh1-c93ab68f52138bfb","check":{"id":"deep-repeat.route.not-found.not-found.home","label":"route.not-found: not-found.home (repeat)","kind":"journey","status":"fail","durationMs":7987.1,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"warm","passId":"repeat","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":1,"actionRevisionAfter":2,"renderRevisionBefore":"not-found-v1","actionMs":84.3,"preActionWaitMs":0.5,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours…
11-26 06:20:02.260 E/unknown:ReactNative(21035): ?anon_0_@1:3696648
11-26 06:20:02.260 E/unknown:ReactNative(21035): ?anon_0_@1:3702448
11-26 06:20:02.260 E/unknown:ReactNative(21035): SyntheticError@1:163048
11-26 06:20:02.260 E/unknown:ReactNative(21035): Wrapper@1:163563
11-26 06:20:02.260 E/unknown:ReactNative(21035): _callSuper@1:148436
11-26 06:20:02.260 E/unknown:ReactNative(21035): _construct@1:163911
11-26 06:20:02.260 E/unknown:ReactNative(21035): _next@1:594899
```
