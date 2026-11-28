# App explorer: 1.0.395 (451)

**Real-use session ATTENTION vs 1.0.394: 0 broken, 16 friction, 0 slower**

- Friction: No reaction for 3.2 s after "scroll rates 1"
- Friction: No reaction for 3.9 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "open product"
- Friction: No reaction for 3.0 s after "scroll product"
- Friction: No reaction for 3.3 s after "switch to savings"
- Friction: No reaction for 3.0 s after "open market"
- Friction: No reaction for 3.3 s after "open rba"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 4.0 s after "open term deposits"
- Friction: No reaction for 3.2 s after "verify term deposit rates"
- Friction: No reaction for 6.3 s after "search Macquarie"
- Friction: No reaction for 3.6 s after "open mortgage filter draft"
- Friction: No reaction for 3.4 s after "verify fixed was not applied"
- Friction: No reaction for 3.3 s after "open unsaved rate"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: No reaction for 4.5 s after "follow browse rates recovery"

**Initial Rates readiness:** 23.9 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-28

Mode full | 119 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 16
Baseline 1.0.394
**Audit live: outcome failed | 901 s | audit log 849153 bytes (audit-log.txt) https://paste.c-net.org/ca3b3117-d588-aebc-a025-4ff1ff548db6 | debug log 5709639 bytes read from host https://paste.c-net.org/f840f463-e620-260e-0b74-72d300c7c594**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 25540 | +22261 | 339/655 | 69 | 467 | 1 errors; start 3012ms; boot js-start 437832, layout-mounted 438439, cache-read 438619, hydrated 438770, splash-hide 438888, manifest 440067, resolved 440476, core-fetched 443766, core-saved 444510, pricing-wait-suitability 444749, search-index-idle 444749, details-start 444999, details-fetched 450912, rows-prepared 454843, detail-filters-idle 454843, leading-requested 454843, last-pricing 454843, suitability-built 455757, post-refresh-wait 456140, leading-scoped 457239, leading-page 457239, pricing-ready 461552, last-rows 461552, rates-ready 461685, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 114, pricing-scope-ms 6016, filter-runs 1, filter-rows 6944, filter-yields 3, filter-ms 74, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 10 |
| 2 | scroll rates 1 | 714 | +7 | 26/58 | 69 | 549 |  |
| 3 | scroll rates 2 | 707 | -24 | 24/58 | 61 | 548 |  |
| 4 | scroll rates back | 670 | -29 |  |  | 538 |  |
| 5 | open product | 6477 | +6449 | 33/67 | 69 | 636 |  |
| 6 | scroll product | 716 | +7 | 26/61 | 65 | 628 |  |
| 7 | expand visible fees | 18 | -2374 | 6/16 | 53 | 620 |  |
| 8 | expand product facts | 1 | +1 | 189/429 | 65 | 617 |  |
| 9 | scroll product fees | 710 | -31 | 20/39 | 61 | 629 |  |
| 10 | scroll product eligibility | 719 | -9 | 20/35 | 77 | 618 |  |
| 11 | expand eligibility | 0 | 0 | 178/357 | 65 | 629 |  |
| 12 | expand constraints | 15 | -11 | 7/18 | 53 | 624 |  |
| 13 | scroll product sources | 697 | -54 | 19/39 | 73 | 627 |  |
| 14 | back to rates | 20 | -15 | 11/26 | 57 | 624 |  |
| 15 | open lenders | 17 | -10 | 16/25 | 150 | 631 |  |
| 16 | scroll lenders | 773 | +12 | 22/27 | 109 | 629 |  |
| 17 | back from lenders | 16 | -11 | 5/8 | 109 | 629 |  |
| 18 | switch to savings | 18 | -9 | 32/58 | 69 | 643 |  |
| 19 | switch to home loans | 16 | -12 | 14/32 | 46 | 663 |  |
| 20 | open filters | 23 | -5 | 22/29 | 129 | 668 |  |
| 21 | close filters | 17 | -10 | 10/11 | 89 | 668 |  |
| 22 | open market | 17 | -8 | 14/31 | 48 | 673 |  |
| 23 | open rba | 19 | -2757 | 37/65 | 48 | 694 |  |
| 24 | scroll rba | 688 | -3 | 28/58 | 61 | 687 |  |
| 25 | back from rba | 21 | -11 | 8/21 | 46 | 688 |  |
| 26 | scroll market | 697 | +10 | 20/44 | 57 | 687 |  |
| 27 | open saved | 17 | -11 | 11/23 | 65 | 690 |  |
| 28 | return to rates | 18 | -10 | 13/32 | 57 | 697 |  |
| 29 | start category switch | 33 | 0 |  |  | 697 |  |
| 30 | open term deposits | 20 | -6 | 35/76 | 73 | 727 |  |
| 31 | verify term deposit rates | 686 | -40 | 27/63 | 61 | 735 |  |
| 32 | restore home loans | 19 | -8 | 11/29 | 48 | 756 |  |
| 33 | start search from rates | 22 | -9 |  |  | 749 |  |
| 34 | open savings search | 19 | -8 | 15/33 | 46 | 774 |  |
| 35 | search Macquarie | 1965 | -367 | 63/77 | 117 | 795 |  |
| 36 | verify Macquarie result | 0 | 0 | 8/14 | 16 | 780 | 1 errors |
| 37 | clear query and restore results | 26 | -29 | 13/18 | 26 | 787 |  |
| 38 | return from savings search | 24 | -26 | 27/39 | 73 | 816 |  |
| 39 | start filter rollback | 25 | -8 | 11/16 | 16 | 810 |  |
| 40 | open mortgage filter draft | 20 | -6 | 25/33 | 200 | 824 |  |
| 41 | select fixed in draft | 22 | -6 | 13/14 | 101 | 816 |  |
| 42 | discard unsaved filter draft | 19 | -7 | 20/21 | 93 | 754 |  |
| 43 | verify fixed was not applied | 20 | -7 | 22/30 | 200 | 749 | 1 errors |
| 44 | close verified filter draft | 23 | -4 | 16/23 | 77 | 746 |  |
| 45 | start save from rates | 26 | -13 | 13/15 | 17 | 744 | 1 errors |
| 46 | open unsaved rate | 36 | +9 | 60/115 | 69 | 806 | 1 errors |
| 47 | save a rate | 33 | +5 | 9/17 | 48 | 761 | 1 errors |
| 48 | leave saved product | 26 | -1 | 11/23 | 69 | 761 |  |
| 49 | restart with a saved rate | 12055 | -7787 | 118/235 | 69 | 614 | 1 errors; start 4899ms; boot js-start 954111, layout-mounted 954726, hydrated 954990, cache-read 956349, core-ready 956853, rows-prepared 956960, search-index-idle 956960, detail-filters-idle 956960, leading-requested 956960, last-pricing 956960, splash-hide 956961, manifest 958830, leading-scoped 960027, leading-page 960027, resolved 960321, pricing-ready 961914, last-rows 961914, rates-ready 962351, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 19, pricing-scope-ms 2861, filter-runs 2, filter-rows 31912, filter-yields 9, filter-ms 320, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 27 |
| 50 | verify saved rate after restart | 24 | -5 | 16/35 | 61 | 490 |  |
| 51 | open product from saved rates | 26 | -9 | 36/72 | 65 | 642 |  |
| 52 | remove saved rate | 25 | -10 |  |  | 637 |  |
| 53 | leave removed product | 24 | -20128 | 13/31 | 48 | 658 |  |
| 54 | follow browse rates recovery | 6805 |  | 14/31 | 48 | 731 |  |
| 55 | start compare from rates | 29 | -8 |  |  | 709 |  |
| 56 | enter selection mode | 19 | -4981 | 8/13 | 40 | 710 |  |
| 57 | select first comparison rate | 22 | -11 | 8/16 | 42 | 712 |  |
| 58 | select second comparison rate | 18 | -11 | 8/15 | 48 | 711 |  |
| 59 | open two-rate comparison | 19 | -8 | 17/31 | 121 | 722 |  |
| 60 | return from two-rate comparison | 28 | +2 | 20/31 | 73 | 722 |  |
| 61 | cold start | 8606 | -5284 | 30/45 | 69 | 687 | 1 errors; start 3095ms; boot js-start 1076411, layout-mounted 1076591, hydrated 1076591, cache-read 1077498, core-ready 1077964, rows-prepared 1078063, search-index-idle 1078063, detail-filters-idle 1078063, leading-requested 1078063, last-pricing 1078063, splash-hide 1078064, manifest 1079549, leading-scoped 1080153, leading-page 1080153, resolved 1080493, pricing-ready 1081109, last-rows 1081109, rates-ready 1081233, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 21, pricing-scope-ms 1511, filter-runs 1, filter-rows 6944, filter-yields 3, filter-ms 67, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 10 |
| 62 | /browse | 28 | -8 | 2/2 | 32 | 654 |  |
| 63 | /watchlist | 30 | -4 | 3/3 | 48 | 471 |  |
| 64 | /market | 23 | -11 | 11/24 | 44 | 528 |  |
| 65 | /tools | 26 | -10 | 7/10 | 200 | 609 |  |
| 66 | /trends | 30 | -2295 | 16/34 | 65 | 627 |  |
| 67 | /search | 25 | -4 | 23/40 | 150 | 630 |  |
| 68 | /banks | 24 | -9 | 30/47 | 81 | 645 |  |
| 69 | /bank-rates | 25 | -10 | 13/32 | 53 | 657 |  |
| 70 | /categories | 24 | -6 | 33/51 | 81 | 687 |  |
| 71 | /catalogue | 52 | +12 | 29/48 | 89 | 707 |  |
| 72 | /compare | 31 | -7 | 12/16 | 117 | 675 |  |
| 73 | /matches | 26 | -4 | 31/48 | 73 | 695 |  |
| 74 | /calculator | 33 | +2 | 14/25 | 65 | 691 |  |
| 75 | /projections | 25 | -5 | 19/37 | 73 | 687 |  |
| 76 | /profile | 30 | -3 | 14/27 | 61 | 688 |  |
| 77 | /research | 30 | -6 | 18/34 | 73 | 696 |  |
| 78 | /rba | 28 | -2 | 9/25 | 65 | 709 |  |
| 79 | /rba-response | 22 | -11 | 14/34 | 48 | 710 |  |
| 80 | /settings | 22 | -14 | 12/26 | 81 | 716 |  |
| 81 | /about | 23 | -13 | 9/25 | 57 | 716 |  |
| 82 | /terms | 26 | -14 | 8/26 | 57 | 718 |  |
| 83 | /privacy | 25 | -10 |  |  | 717 |  |
| 84 | /third-party-notices | 26 | -10 | 9/25 | 53 | 721 |  |
| 85 | /node | 27 | -8 | 29/50 | 81 | 758 |  |
| 86 | /passthrough | 35 | +5 | 26/51 | 65 | 727 |  |
| 87 | /calculation-receipt | 21 | -15 | 11/25 | 69 | 718 |  |
| 88 | /rate-receipt | 23 | -13 | 5/10 | 65 | 718 |  |
| 89 | warm resume | 641 | -279 | 4/4 | 89 | 717 | start 379ms |
| 90 | cold relaunch | 8114 | -2440 | 32/44 | 93 | 401 | 1 errors; start 2757ms; boot js-start 1294159, layout-mounted 1294329, hydrated 1294329, cache-read 1295210, core-ready 1295681, rows-prepared 1295792, search-index-idle 1295792, detail-filters-idle 1295792, leading-requested 1295792, last-pricing 1295792, splash-hide 1295794, manifest 1297198, leading-scoped 1297688, leading-page 1297688, resolved 1298054, pricing-ready 1298686, last-rows 1298686, rates-ready 1298820, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 18, pricing-scope-ms 1411, filter-runs 1, filter-rows 6944, filter-yields 3, filter-ms 71, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 10 |
| 91 | about | 24 | -7 | 14/24 | 69 | 485 |  |
| 92 | audit screen | 18 | -8 | 86/227 | 53 | 598 |  |
| 93 | audit 0 min | 0 | 0 | 18/22 | 65 | 778 |  |
| 94 | audit 2 min | 0 | 0 | 1281/1621 | 89 | 1037 | 80 errors |
| 95 | audit 4 min | 0 | 0 | 691/901 | 93 | 1048 | 80 errors |
| 96 | audit 5 min | 0 | 0 | 839/1088 | 89 | 1141 | 80 errors |
| 97 | audit 6 min | 0 |  | 772/973 | 89 | 1217 | 80 errors |
| 98 | audit 8 min | 0 | 0 | 477/649 | 81 | 1251 | 80 errors |
| 99 | audit 9 min | 0 | 0 | 833/1097 | 89 | 1340 | 80 errors |
| 100 | audit 11 min | 0 | 0 | 255/332 | 89 | 1361 | 80 errors |
| 101 | audit 12 min | 0 | 0 | 112/151 | 32 | 1383 |  |
| 102 | audit 13 min | 0 |  | 105/143 | 32 | 1421 |  |
| 103 | audit 14 min | 0 | 0 | 53/82 | 61 | 1422 |  |
| 104 | audit finished | 0 | 0 | 70/221 | 53 | 1404 |  |
| 105 | audit result 1 | 0 | 0 |  |  | 1406 |  |
| 106 | audit result 2 | 0 | 0 |  |  | 1407 |  |
| 107 | audit result 3 | 0 | 0 |  |  | 1405 |  |
| 108 | audit result 4 | 0 | 0 |  |  | 1408 |  |
| 109 | audit result 5 | 0 | 0 |  |  | 1405 |  |
| 110 | audit result 6 | 0 | 0 |  |  | 1405 |  |
| 111 | audit result 7 | 0 | 0 |  |  | 1408 |  |
| 112 | audit result 8 | 0 | 0 |  |  | 1406 |  |
| 113 | audit result 9 | 0 | 0 |  |  | 1409 |  |
| 114 | audit result 10 | 0 | 0 |  |  | 1407 |  |
| 115 | audit result 11 | 0 | 0 |  |  | 1410 |  |
| 116 | audit result 12 | 0 | 0 |  |  | 1408 |  |
| 117 | about for debug log | 3181 | -173 | 20/35 | 48 | 1293 |  |
| 118 | debug log screen | 0 | 0 | 67/242 | 46 | 1269 |  |
| 119 | debug log uploaded | 0 | 0 | 23/32 | 65 | 1533 |  |

## Errors

### 1 open app
```
11-28 13:04:09.515 E/australianrates(11370): Not starting debugger since process cannot load the jdwp agent.
```

### 36 verify Macquarie result
```
11-28 13:10:58.685 E/FrameTracker(11370): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 43 verify fixed was not applied
```
11-28 13:11:59.231 E/FrameTracker(11370): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 start save from rates
```
11-28 13:12:16.278 E/FrameTracker(11370): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 open unsaved rate
```
11-28 13:12:21.639 E/ImeBackDispatcher(11370): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 165382587
```

### 47 save a rate
```
11-28 13:12:32.265 E/FrameTracker(11370): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 49 restart with a saved rate
```
11-28 13:12:46.203 E/australianrates(17222): Not starting debugger since process cannot load the jdwp agent.
```

### 61 cold start
```
11-28 13:14:49.101 E/australianrates(18711): Not starting debugger since process cannot load the jdwp agent.
```

### 90 cold relaunch
```
11-28 13:18:26.912 E/australianrates(21774): Not starting debugger since process cannot load the jdwp agent.
```

### 94 audit 2 min
```
11-28 13:19:36.061 E/ReactNativeJS(21774): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0fsqos-d95d06e2251c292d","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":6176.8,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":232.6,"liveStage:dates-index:fetched:ms":217.2,"liveStage:revision:verified:ms":41.8,"liveStage:Core asset:downloaded:ms":132.7,"liveStage:Core asset:hash-verified:ms":8.5,"liveStage:Core asset:native-inflated-and-text-decoded:ms":152.6,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":156.3,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":457.3,"liveStage:Details asset:downloaded:ms":815.4,"liveStage:Details asset:hash-verified:ms":26,"liveStage…
11-28 13:19:36.063 E/unknown:ReactNative(21774): ?anon_0_@1:3707964
11-28 13:19:36.063 E/unknown:ReactNative(21774): ?anon_0_@1:3713764
11-28 13:19:36.063 E/unknown:ReactNative(21774): SyntheticError@1:163172
11-28 13:19:36.063 E/unknown:ReactNative(21774): Wrapper@1:163687
11-28 13:19:36.063 E/unknown:ReactNative(21774): _callSuper@1:148560
11-28 13:19:36.063 E/unknown:ReactNative(21774): _construct@1:164035
11-28 13:19:36.063 E/unknown:ReactNative(21774): _next@1:595023
```

### 95 audit 4 min
```
11-28 13:22:07.700 E/ReactNativeJS(21774): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0fsqos-d95d06e2251c292d","check":{"id":"deep-first-pass.route.market.market.history.open","label":"route.market: market.history.open (first-pass)","kind":"journey","status":"fail","durationMs":1583.7,"metrics":{"journeyId":"route.market.market.history.open","journeyLabel":"route.market: market.history.open","iteration":"cold","passId":"first-pass","scenarioId":"route.market","semanticActionId":"market.history.open","depth":1,"plannedExpectedPath":"/bank-rates","expectedPath":"/bank-rates","expectedSurface":"bank-rates.dashboard","actionSource":"market.overview","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRevisionAfter":4,"renderRevisionBefore":"state-1","actionMs":152.8,"preActionWaitMs":158.1,"preActionQuietWindowReused":false,"preActionQuietWindowAvoidedMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"r…
11-28 13:22:07.701 E/unknown:ReactNative(21774): ?anon_0_@1:3707964
11-28 13:22:07.701 E/unknown:ReactNative(21774): ?anon_0_@1:3713764
11-28 13:22:07.701 E/unknown:ReactNative(21774): SyntheticError@1:163172
11-28 13:22:07.701 E/unknown:ReactNative(21774): Wrapper@1:163687
11-28 13:22:07.701 E/unknown:ReactNative(21774): _callSuper@1:148560
11-28 13:22:07.701 E/unknown:ReactNative(21774): _construct@1:164035
11-28 13:22:07.701 E/unknown:ReactNative(21774): _next@1:595023
```

### 96 audit 5 min
```
11-28 13:23:18.117 E/ReactNativeJS(21774): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0fsqos-d95d06e2251c292d","check":{"id":"deep-first-pass.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (first-pass)","kind":"journey","status":"fail","durationMs":1499.4,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/AFG%20Home%20Loans%20Alpha%7C47ff39a2-9935-4c15-a998-5abfa6424433%7CRESIDENTIAL_MORTGAGES%7CAFG%20Alpha%20Offset%20Home%20Loan","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisi…
11-28 13:23:18.118 E/unknown:ReactNative(21774): ?anon_0_@1:3707964
11-28 13:23:18.118 E/unknown:ReactNative(21774): ?anon_0_@1:3713764
11-28 13:23:18.118 E/unknown:ReactNative(21774): SyntheticError@1:163172
11-28 13:23:18.118 E/unknown:ReactNative(21774): Wrapper@1:163687
11-28 13:23:18.118 E/unknown:ReactNative(21774): _callSuper@1:148560
11-28 13:23:18.118 E/unknown:ReactNative(21774): _construct@1:164035
11-28 13:23:18.118 E/unknown:ReactNative(21774): _next@1:595023
```

### 97 audit 6 min
```
11-28 13:24:56.400 E/ReactNativeJS(21774): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0fsqos-d95d06e2251c292d","check":{"id":"deep-first-pass.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (first-pass)","kind":"journey","status":"fail","durationMs":3581.9,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":66,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":951.6,"forwardWorkMs":951.6,"navigationCommitMs":951.2,"firstReadyFrameMs":0.3,…
11-28 13:24:56.401 E/unknown:ReactNative(21774): ?anon_0_@1:3707964
11-28 13:24:56.401 E/unknown:ReactNative(21774): ?anon_0_@1:3713764
11-28 13:24:56.401 E/unknown:ReactNative(21774): SyntheticError@1:163172
11-28 13:24:56.401 E/unknown:ReactNative(21774): Wrapper@1:163687
11-28 13:24:56.401 E/unknown:ReactNative(21774): _callSuper@1:148560
11-28 13:24:56.401 E/unknown:ReactNative(21774): _construct@1:164035
11-28 13:24:56.401 E/unknown:ReactNative(21774): _next@1:595023
```

### 98 audit 8 min
```
11-28 13:26:37.786 E/ReactNativeJS(21774): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0fsqos-d95d06e2251c292d","check":{"id":"deep-repeat.route.receipt.receipt.back-to-product","label":"route.receipt: receipt.back-to-product (repeat)","kind":"journey","status":"fail","durationMs":1469.2,"metrics":{"journeyId":"route.receipt.receipt.back-to-product","journeyLabel":"route.receipt: receipt.back-to-product","iteration":"warm","passId":"repeat","scenarioId":"route.receipt","semanticActionId":"receipt.back-to-product","depth":1,"plannedExpectedPath":"/product/AFG%20Home%20Loans%20Alpha%7C47ff39a2-9935-4c15-a998-5abfa6424433%7CRESIDENTIAL_MORTGAGES%7CAFG%20Alpha%20Offset%20Home%20Loan","expectedPath":"/product/AFG%20Home%20Loans%20Alpha%7C47ff39a2-9935-4c15-a998-5abfa6424433%7CRESIDENTIAL_MORTGAGES%7CAFG%20Alpha%20Offset%20Home%20Loan","expectedSurface":"product.details","actionSource":"receipt.evidence","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRev…
11-28 13:26:37.787 E/unknown:ReactNative(21774): ?anon_0_@1:3707964
11-28 13:26:37.787 E/unknown:ReactNative(21774): ?anon_0_@1:3713764
11-28 13:26:37.787 E/unknown:ReactNative(21774): SyntheticError@1:163172
11-28 13:26:37.787 E/unknown:ReactNative(21774): Wrapper@1:163687
11-28 13:26:37.787 E/unknown:ReactNative(21774): _callSuper@1:148560
11-28 13:26:37.787 E/unknown:ReactNative(21774): _construct@1:164035
11-28 13:26:37.787 E/unknown:ReactNative(21774): _next@1:595023
```

### 99 audit 9 min
```
11-28 13:27:28.738 E/ReactNativeJS(21774): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0fsqos-d95d06e2251c292d","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1404.8,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/AFG%20Home%20Loans%20Alpha%7C47ff39a2-9935-4c15-a998-5abfa6424433%7CRESIDENTIAL_MORTGAGES%7CAFG%20Alpha%20Offset%20Home%20Loan","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16…
11-28 13:27:28.740 E/unknown:ReactNative(21774): ?anon_0_@1:3707964
11-28 13:27:28.740 E/unknown:ReactNative(21774): ?anon_0_@1:3713764
11-28 13:27:28.740 E/unknown:ReactNative(21774): SyntheticError@1:163172
11-28 13:27:28.740 E/unknown:ReactNative(21774): Wrapper@1:163687
11-28 13:27:28.740 E/unknown:ReactNative(21774): _callSuper@1:148560
11-28 13:27:28.740 E/unknown:ReactNative(21774): _construct@1:164035
11-28 13:27:28.740 E/unknown:ReactNative(21774): _next@1:595023
```

### 100 audit 11 min
```
11-28 13:29:02.283 E/ReactNativeJS(21774): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx0fsqos-d95d06e2251c292d","check":{"id":"deep-repeat.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (repeat)","kind":"journey","status":"fail","durationMs":3548.5,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":55.2,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":927.9,"forwardWorkMs":927.9,"navigationCommitMs":927.5,"firstReadyFrameMs":0.5,"firstRead…
11-28 13:29:02.284 E/unknown:ReactNative(21774): ?anon_0_@1:3707964
11-28 13:29:02.284 E/unknown:ReactNative(21774): ?anon_0_@1:3713764
11-28 13:29:02.284 E/unknown:ReactNative(21774): SyntheticError@1:163172
11-28 13:29:02.284 E/unknown:ReactNative(21774): Wrapper@1:163687
11-28 13:29:02.284 E/unknown:ReactNative(21774): _callSuper@1:148560
11-28 13:29:02.284 E/unknown:ReactNative(21774): _construct@1:164035
11-28 13:29:02.284 E/unknown:ReactNative(21774): _next@1:595023
```
