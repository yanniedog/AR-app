# App explorer: 1.0.393 (449)

**Real-use session ATTENTION vs 1.0.392: 0 broken, 26 friction, 5 slower**

- Friction: No reaction for 4.1 s after "scroll rates 1"
- Friction: No reaction for 3.2 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll product fees"
- Friction: No reaction for 3.1 s after "scroll product eligibility"
- Friction: No reaction for 3.1 s after "scroll product sources"
- Friction: No reaction for 5.0 s after "switch to savings"
- Friction: No reaction for 3.1 s after "switch to home loans"
- Friction: No reaction for 3.4 s after "open filters"
- Friction: No reaction for 3.3 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.3 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 5.0 s after "open term deposits"
- Friction: No reaction for 3.6 s after "verify term deposit rates"
- Friction: No reaction for 9.5 s after "search Macquarie"
- Friction: No reaction for 3.3 s after "return from savings search"
- Friction: No reaction for 3.6 s after "open mortgage filter draft"
- Friction: No reaction for 3.6 s after "verify fixed was not applied"
- Friction: No reaction for 3.9 s after "open unsaved rate"
- Friction: No reaction for 3.0 s after "verify saved rate after restart"
- Friction: No reaction for 3.5 s after "open product from saved rates"
- Friction: No reaction for 13.8 s after "leave removed product"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: "No saved rates" shown on "follow browse rates recovery"
- Friction: No reaction for 5.2 s after "start compare from rates"
- Slower: Dropped frames 60% to 77% on "scroll product"
- Slower: Dropped frames 58% to 81% on "back to rates"
- Slower: "leave removed product" content 0.0 s to 11.4 s
- Slower: "leave removed product" reaction 2.3 s to 13.8 s
- Slower: "select first comparison rate" content 0.0 s to 2.7 s

**Initial Rates readiness:** 37.0 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-28

Mode full | 119 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 17
Baseline 1.0.392
**Audit live: outcome failed | 985 s | audit log 853585 bytes (audit-log.txt) https://paste.c-net.org/93b59e61-0d98-ee9e-7998-78d12d474e95 | debug log 5647533 bytes read from host https://paste.c-net.org/f28558ba-3fec-e59f-e32d-378ad91175f7**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2914 | -47 | 594/751 | 89 | 456 | 2 errors; start 2859ms |
| 2 | scroll rates 1 | 736 | +28 | 40/57 | 93 | 557 | boot js-start 484977, layout-mounted 485588, cache-read 485781, hydrated 485975, splash-hide 485975, manifest 487111, resolved 488456, core-fetched 493676, core-saved 494455, pricing-wait-suitability 494816, search-index-idle 494816, details-start 495096, details-fetched 503916, rows-prepared 510382, detail-filters-idle 510382, leading-requested 510382, last-pricing 510382, suitability-built 511933, post-refresh-wait 512407, leading-scoped 513902, leading-page 513902, pricing-ready 521825, last-rows 521825, rates-ready 522000, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 153, pricing-scope-ms 10075, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 97, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 14 |
| 3 | scroll rates 2 | 721 | -6 | 16/26 | 85 | 696 |  |
| 4 | scroll rates back | 685 | +3 |  |  | 556 |  |
| 5 | open product | 28 | +4 | 36/53 | 85 | 576 |  |
| 6 | scroll product | 713 | -24 | 34/44 | 89 | 693 |  |
| 7 | expand visible fees | 26 | -2257 | 10/14 | 93 | 673 |  |
| 8 | expand product facts | 26 | +6 | 111/162 | 89 | 661 |  |
| 9 | scroll product fees | 711 | +29 | 12/26 | 73 | 672 |  |
| 10 | scroll product eligibility | 691 | -48 | 18/27 | 73 | 678 |  |
| 11 | expand eligibility | 24 | +4 | 9/14 | 65 | 674 |  |
| 12 | expand constraints | 25 | +5 | 12/15 | 81 | 674 |  |
| 13 | scroll product sources | 723 | -50 | 18/25 | 65 | 678 |  |
| 14 | back to rates | 28 | -6811 | 17/21 | 73 | 667 |  |
| 15 | open lenders | 32 | +11 | 16/21 | 200 | 671 |  |
| 16 | scroll lenders | 762 | +56 | 18/19 | 150 | 669 |  |
| 17 | back from lenders | 30 | +9 | 7/8 | 150 | 667 |  |
| 18 | switch to savings | 29 | +8 | 62/82 | 89 | 671 |  |
| 19 | switch to home loans | 30 | +6 | 15/26 | 65 | 683 |  |
| 20 | open filters | 26 | +5 | 19/23 | 200 | 688 |  |
| 21 | close filters | 26 | +5 | 7/8 | 117 | 685 |  |
| 22 | open market | 25 | +4 | 17/27 | 77 | 688 |  |
| 23 | open rba | 2703 | +234 | 94/109 | 69 | 704 |  |
| 24 | scroll rba | 722 | +11 | 33/50 | 77 | 697 |  |
| 25 | back from rba | 31 | +10 | 11/18 | 57 | 697 |  |
| 26 | scroll market | 787 | +89 | 26/38 | 93 | 696 |  |
| 27 | open saved | 24 | +4 | 14/20 | 93 | 701 |  |
| 28 | return to rates | 27 | +6 | 19/31 | 73 | 701 |  |
| 29 | start category switch | 38 | +11 |  |  | 701 |  |
| 30 | open term deposits | 32 | +11 | 64/85 | 85 | 718 |  |
| 31 | verify term deposit rates | 761 | +57 | 38/48 | 97 | 719 |  |
| 32 | restore home loans | 27 | +6 | 14/24 | 73 | 725 |  |
| 33 | start search from rates | 31 | +7 |  |  | 723 |  |
| 34 | open savings search | 26 | +5 | 19/29 | 81 | 742 |  |
| 35 | search Macquarie | 3057 | +1567 | 104/120 | 150 | 745 | 1 errors |
| 36 | verify Macquarie result | 1 | +1 | 12/16 | 36 | 740 |  |
| 37 | clear query and restore results | 27 | +2 | 15/22 | 57 | 750 |  |
| 38 | return from savings search | 25 | +5 | 30/41 | 105 | 770 |  |
| 39 | start filter rollback | 34 | -1 | 14/16 | 16 | 763 |  |
| 40 | open mortgage filter draft | 25 | +5 | 24/27 | 200 | 766 |  |
| 41 | select fixed in draft | 26 | +3 | 12/13 | 109 | 764 |  |
| 42 | discard unsaved filter draft | 25 | +5 | 16/23 | 85 | 766 |  |
| 43 | verify fixed was not applied | 28 | -2 | 24/29 | 300 | 770 | 1 errors |
| 44 | close verified filter draft | 23 | +3 | 18/21 | 101 | 770 |  |
| 45 | start save from rates | 30 | -3 | 14/16 | 17 | 766 | 1 errors |
| 46 | open unsaved rate | 26 | +1 | 104/137 | 97 | 798 | 1 errors |
| 47 | save a rate | 25 | +4 | 9/16 | 65 | 789 | 1 errors |
| 48 | leave saved product | 32 | +6 | 15/21 | 81 | 790 |  |
| 49 | restart with a saved rate | 15146 | -6197 | 197/261 | 93 | 594 | 2 errors; start 6150ms; boot js-start 978053, layout-mounted 978870, hydrated 978951, cache-read 980405, core-ready 981115, rows-prepared 981263, search-index-idle 981263, detail-filters-idle 981263, leading-requested 981263, last-pricing 981263, splash-hide 981264, leading-scoped 984620, leading-page 984620, manifest 985166, pricing-ready 985732, last-rows 985732, resolved 985916, rates-ready 988796, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 30, pricing-scope-ms 4093, filter-runs 2, filter-rows 13888, filter-yields 5, filter-cancels 1, filter-ms 936, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 17 |
| 50 | verify saved rate after restart | 26 | +5 | 27/38 | 81 | 624 |  |
| 51 | open product from saved rates | 30 | -4 | 38/58 | 97 | 543 |  |
| 52 | remove saved rate | 29 | +4 | 11/17 | 77 | 641 |  |
| 53 | leave removed product | 11405 | +11376 | 7/11 | 77 | 637 |  |
| 54 | follow browse rates recovery | 27 | 0 |  |  | 652 |  |
| 55 | start compare from rates | 2311 | -2226 | 17/26 | 73 | 688 |  |
| 56 | enter selection mode | 27 | -1 | 12/17 | 61 | 724 |  |
| 57 | select first comparison rate | 26 | -11 | 9/13 | 61 | 712 |  |
| 58 | select second comparison rate | 28 | +3 | 7/13 | 61 | 698 |  |
| 59 | open two-rate comparison | 26 | +5 | 21/28 | 150 | 707 |  |
| 60 | return from two-rate comparison | 24 | +3 | 17/24 | 125 | 707 |  |
| 61 | cold start | 9984 | -68 | 32/41 | 117 | 583 | 1 errors; start 4369ms; boot js-start 1118390, layout-mounted 1118575, hydrated 1118703, cache-read 1119983, core-ready 1120636, rows-prepared 1120763, search-index-idle 1120763, detail-filters-idle 1120763, leading-requested 1120763, last-pricing 1120763, splash-hide 1120764, manifest 1122319, leading-scoped 1123009, leading-page 1123009, resolved 1123249, pricing-ready 1124231, last-rows 1124231, rates-ready 1124397, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 22, pricing-scope-ms 1849, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 94, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 14 |
| 62 | /browse | 2312 | -2168 | 1/2 | 48 | 427 |  |
| 63 | /watchlist | 31 | -8 | 3/3 | 34 | 495 |  |
| 64 | /market | 31 | 0 | 12/22 | 69 | 571 |  |
| 65 | /tools | 33 | +1 |  |  | 608 |  |
| 66 | /trends | 2311 | +2274 | 23/35 | 97 | 626 |  |
| 67 | /search | 31 | -4517 | 25/34 | 150 | 657 |  |
| 68 | /banks | 28 | +2 | 29/36 | 129 | 669 |  |
| 69 | /bank-rates | 30 | +2 | 15/26 | 81 | 669 |  |
| 70 | /categories | 26 | -11 | 38/46 | 105 | 696 |  |
| 71 | /catalogue | 34 | -3 | 30/39 | 150 | 713 |  |
| 72 | /compare | 35 | +4 | 11/13 | 133 | 685 |  |
| 73 | /matches | 28 | +2 | 33/44 | 109 | 707 |  |
| 74 | /calculator | 32 | +2 | 13/22 | 85 | 701 |  |
| 75 | /projections | 35 | +6 | 21/29 | 117 | 695 |  |
| 76 | /profile | 29 | +3 | 18/25 | 85 | 696 |  |
| 77 | /research | 27 | -2 | 22/31 | 81 | 705 |  |
| 78 | /rba | 32 | +3 | 17/24 | 117 | 719 |  |
| 79 | /rba-response | 32 | +1 | 19/29 | 89 | 718 |  |
| 80 | /settings | 29 | +5 | 21/28 | 93 | 725 |  |
| 81 | /about | 36 | +5 | 14/22 | 61 | 725 |  |
| 82 | /terms | 30 | -2 | 15/22 | 73 | 725 |  |
| 83 | /privacy | 32 | +8 |  |  | 725 |  |
| 84 | /third-party-notices | 33 | +4 | 16/24 | 81 | 728 |  |
| 85 | /node | 33 | +9 | 29/42 | 89 | 757 |  |
| 86 | /passthrough | 36 | +8 | 30/42 | 101 | 734 |  |
| 87 | /calculation-receipt | 28 | 0 | 16/26 | 77 | 726 |  |
| 88 | /rate-receipt | 31 | -2 | 8/9 | 81 | 728 |  |
| 89 | warm resume | 870 | +170 | 4/4 | 150 | 727 | start 341ms |
| 90 | cold relaunch | 10365 | +202 | 34/44 | 93 | 583 | 1 errors; start 4195ms; boot js-start 1356673, layout-mounted 1356861, hydrated 1356957, cache-read 1358287, core-ready 1358952, rows-prepared 1359062, search-index-idle 1359062, detail-filters-idle 1359062, leading-requested 1359062, last-pricing 1359062, splash-hide 1359064, manifest 1361000, leading-scoped 1361525, leading-page 1361525, resolved 1362045, pricing-ready 1362838, last-rows 1362838, rates-ready 1363008, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 21, pricing-scope-ms 1799, filter-runs 1, filter-rows 6944, filter-yields 4, filter-ms 96, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 15 |
| 91 | about | 64 | +31 | 13/19 | 250 | 410 |  |
| 92 | audit screen | 25 | +5 | 151/240 | 69 | 608 |  |
| 93 | audit 0 min | 0 | 0 | 23/27 | 93 | 864 |  |
| 94 | audit 1 min | 0 |  | 1106/1252 | 117 | 1065 | 80 errors |
| 95 | audit 3 min | 0 |  | 787/901 | 121 | 1060 | 80 errors |
| 96 | audit 4 min | 0 | 0 | 367/415 | 117 | 1180 | 80 errors |
| 97 | audit 5 min | 0 | 0 | 811/925 | 117 | 1195 | 80 errors |
| 98 | audit 7 min | 0 | 0 | 464/513 | 129 | 1162 | 80 errors |
| 99 | audit 8 min | 0 |  | 1017/1163 | 117 | 1326 | 80 errors |
| 100 | audit 10 min | 0 | 0 | 859/979 | 117 | 1227 | 80 errors |
| 101 | audit 12 min | 0 |  | 343/383 | 121 | 1257 | 80 errors |
| 102 | audit 14 min | 0 |  | 168/195 | 38 | 1280 |  |
| 103 | audit 15 min | 0 | 0 | 122/140 | 48 | 1297 |  |
| 104 | audit finished | 0 | 0 | 123/179 | 81 | 1293 |  |
| 105 | audit result 1 | 0 | 0 |  |  | 1283 |  |
| 106 | audit result 2 | 0 | 0 |  |  | 1281 |  |
| 107 | audit result 3 | 0 | 0 |  |  | 1284 |  |
| 108 | audit result 4 | 0 | 0 |  |  | 1282 |  |
| 109 | audit result 5 | 0 | 0 |  |  | 1284 |  |
| 110 | audit result 6 | 0 | 0 |  |  | 1286 |  |
| 111 | audit result 7 | 0 | 0 |  |  | 1284 |  |
| 112 | audit result 8 | 0 | 0 |  |  | 1284 |  |
| 113 | audit result 9 | 0 | 0 |  |  | 1286 |  |
| 114 | audit result 10 | 0 | 0 |  |  | 1284 |  |
| 115 | audit result 11 | 0 | 0 |  |  | 1287 |  |
| 116 | audit result 12 | 0 | 0 |  |  | 1286 |  |
| 117 | about for debug log | 3188 | -59 | 19/30 | 89 | 1327 |  |
| 118 | debug log screen | 1 | +1 | 116/199 | 69 | 1328 |  |
| 119 | debug log uploaded | 0 | 0 | 24/32 | 109 | 1419 |  |

## Errors

### 1 open app
```
11-28 09:19:28.565 E/australianrates(11172): Not starting debugger since process cannot load the jdwp agent.
11-28 09:19:32.684 W/ReactNativeJS(11172): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
```

### 35 search Macquarie
```
11-28 09:25:45.008 E/FrameTracker(11172): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 43 verify fixed was not applied
```
11-28 09:26:51.731 E/FrameTracker(11172): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 start save from rates
```
11-28 09:27:09.551 E/FrameTracker(11172): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 open unsaved rate
```
11-28 09:27:15.703 E/ImeBackDispatcher(11172): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 219586969
```

### 47 save a rate
```
11-28 09:27:26.373 E/FrameTracker(11172): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 49 restart with a saved rate
```
11-28 09:27:41.609 E/australianrates(16607): Not starting debugger since process cannot load the jdwp agent.
11-28 09:27:47.941 W/ReactNativeJS(16607): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
```

### 61 cold start
```
11-28 09:30:02.907 E/australianrates(18153): Not starting debugger since process cannot load the jdwp agent.
```

### 90 cold relaunch
```
11-28 09:34:00.810 E/australianrates(21291): Not starting debugger since process cannot load the jdwp agent.
```

### 94 audit 1 min
```
11-28 09:35:23.495 E/ReactNativeJS(21291): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx07sfws-b5dfda397a5b4231","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":8539.3,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":233.6,"liveStage:dates-index:fetched:ms":185.3,"liveStage:revision:verified:ms":37.6,"liveStage:Core asset:downloaded:ms":157.2,"liveStage:Core asset:hash-verified:ms":3.2,"liveStage:Core asset:native-inflated-and-text-decoded:ms":245.9,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":237,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":689.5,"liveStage:Details asset:downloaded:ms":1052.8,"liveStage:Details asset:hash-verified:ms":32.9,"liveStag…
11-28 09:35:23.497 E/unknown:ReactNative(21291): ?anon_0_@1:3707775
11-28 09:35:23.497 E/unknown:ReactNative(21291): ?anon_0_@1:3713575
11-28 09:35:23.497 E/unknown:ReactNative(21291): SyntheticError@1:163172
11-28 09:35:23.497 E/unknown:ReactNative(21291): Wrapper@1:163687
11-28 09:35:23.497 E/unknown:ReactNative(21291): _callSuper@1:148560
11-28 09:35:23.497 E/unknown:ReactNative(21291): _construct@1:164035
11-28 09:35:23.497 E/unknown:ReactNative(21291): _next@1:595023
```

### 95 audit 3 min
```
11-28 09:37:23.873 E/ReactNativeJS(21291): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx07sfws-b5dfda397a5b4231","check":{"id":"deep-first-pass.route.rates.search.filters.clear","label":"route.rates: search.filters.clear (first-pass)","kind":"journey","status":"fail","durationMs":1550.8,"metrics":{"journeyId":"route.rates.search.filters.clear","journeyLabel":"route.rates: search.filters.clear","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.filters.clear","depth":2,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":6,"actionRevisionAfter":7,"renderRevisionBefore":"state-32","renderRevisionAfter":"state-35","actionMs":350.9,"preActionWaitMs":1.3,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"…
11-28 09:37:23.875 E/unknown:ReactNative(21291): ?anon_0_@1:3707775
11-28 09:37:23.875 E/unknown:ReactNative(21291): ?anon_0_@1:3713575
11-28 09:37:23.875 E/unknown:ReactNative(21291): SyntheticError@1:163172
11-28 09:37:23.875 E/unknown:ReactNative(21291): Wrapper@1:163687
11-28 09:37:23.875 E/unknown:ReactNative(21291): _callSuper@1:148560
11-28 09:37:23.875 E/unknown:ReactNative(21291): _construct@1:164035
11-28 09:37:23.875 E/unknown:ReactNative(21291): _next@1:595023
```

### 96 audit 4 min
```
11-28 09:39:06.682 E/ReactNativeJS(21291): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx07sfws-b5dfda397a5b4231","check":{"id":"deep-first-pass.sample.catalogue.0.product.lender.open","label":"sample.catalogue.0: product.lender.open (first-pass)","kind":"journey","status":"fail","durationMs":2355.1,"metrics":{"journeyId":"sample.catalogue.0.product.lender.open","journeyLabel":"sample.catalogue.0: product.lender.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.0","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/Bank%20of%20us","expectedPath":"/bank/Bank%20of%20us","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"actionResultEvidence":"{\"expectedPath\":\"/bank/Bank%20of%20us\"}","actionMs":961.8,"preActionWaitMs":1.2,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedAction…
11-28 09:39:06.684 E/unknown:ReactNative(21291): ?anon_0_@1:3707775
11-28 09:39:06.684 E/unknown:ReactNative(21291): ?anon_0_@1:3713575
11-28 09:39:06.684 E/unknown:ReactNative(21291): SyntheticError@1:163172
11-28 09:39:06.684 E/unknown:ReactNative(21291): Wrapper@1:163687
11-28 09:39:06.684 E/unknown:ReactNative(21291): _callSuper@1:148560
11-28 09:39:06.684 E/unknown:ReactNative(21291): _construct@1:164035
11-28 09:39:06.684 E/unknown:ReactNative(21291): _next@1:595023
```

### 97 audit 5 min
```
11-28 09:39:44.057 E/ReactNativeJS(21291): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx07sfws-b5dfda397a5b4231","check":{"id":"deep-first-pass.route.calculator.calculator.scenario.apply-deposit","label":"route.calculator: calculator.scenario.apply-deposit (first-pass)","kind":"journey","status":"fail","durationMs":1683.9,"metrics":{"journeyId":"route.calculator.calculator.scenario.apply-deposit","journeyLabel":"route.calculator: calculator.scenario.apply-deposit","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.scenario.apply-deposit","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":5,"actionRevisionAfter":6,"renderRevisionBefore":"2026-11-28:5b24f9c481f0…:state-8","renderRevisionAfter":"2026-11-28:5b24f9c481f0…:state-9","actionResultEvidence":"{\"applied\":…
11-28 09:39:44.059 E/unknown:ReactNative(21291): ?anon_0_@1:3707775
11-28 09:39:44.059 E/unknown:ReactNative(21291): ?anon_0_@1:3713575
11-28 09:39:44.059 E/unknown:ReactNative(21291): SyntheticError@1:163172
11-28 09:39:44.059 E/unknown:ReactNative(21291): Wrapper@1:163687
11-28 09:39:44.059 E/unknown:ReactNative(21291): _callSuper@1:148560
11-28 09:39:44.059 E/unknown:ReactNative(21291): _construct@1:164035
11-28 09:39:44.059 E/unknown:ReactNative(21291): _next@1:595023
```

### 98 audit 7 min
```
11-28 09:41:30.190 E/ReactNativeJS(21291): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx07sfws-b5dfda397a5b4231","check":{"id":"deep-first-pass.redirect.catalogue.redirect.catalogue.verify","label":"redirect.catalogue: redirect.catalogue.verify (first-pass)","kind":"journey","status":"fail","durationMs":2212.5,"metrics":{"journeyId":"redirect.catalogue.redirect.catalogue.verify","journeyLabel":"redirect.catalogue: redirect.catalogue.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.catalogue","semanticActionId":"redirect.catalogue.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":69.7,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1485.2,"forwardWorkMs":1485.2,"navigationCommitMs"…
11-28 09:41:30.192 E/unknown:ReactNative(21291): ?anon_0_@1:3707775
11-28 09:41:30.192 E/unknown:ReactNative(21291): ?anon_0_@1:3713575
11-28 09:41:30.192 E/unknown:ReactNative(21291): SyntheticError@1:163172
11-28 09:41:30.192 E/unknown:ReactNative(21291): Wrapper@1:163687
11-28 09:41:30.192 E/unknown:ReactNative(21291): _callSuper@1:148560
11-28 09:41:30.192 E/unknown:ReactNative(21291): _construct@1:164035
11-28 09:41:30.192 E/unknown:ReactNative(21291): _next@1:595023
```

### 99 audit 8 min
```
11-28 09:42:35.040 E/ReactNativeJS(21291): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx07sfws-b5dfda397a5b4231","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.mortgage.scope.apply.0","label":"route.rates-mortgage-scope: search.mortgage.scope.apply.0 (repeat)","kind":"journey","status":"fail","durationMs":8063.1,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.apply.0","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.apply.0","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.apply.0","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":41,"actionRevisionAfter":42,"renderRevisionBefore":"state-8","renderRevisionAfter":"state-14","actionMs":117.1,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQ…
11-28 09:42:35.041 E/unknown:ReactNative(21291): ?anon_0_@1:3707775
11-28 09:42:35.041 E/unknown:ReactNative(21291): ?anon_0_@1:3713575
11-28 09:42:35.041 E/unknown:ReactNative(21291): SyntheticError@1:163172
11-28 09:42:35.041 E/unknown:ReactNative(21291): Wrapper@1:163687
11-28 09:42:35.041 E/unknown:ReactNative(21291): _callSuper@1:148560
11-28 09:42:35.041 E/unknown:ReactNative(21291): _construct@1:164035
11-28 09:42:35.041 E/unknown:ReactNative(21291): _next@1:595023
```

### 100 audit 10 min
```
11-28 09:44:19.673 E/unknown:ReactNative(21291): ?anon_0_@1:3707775
11-28 09:44:19.673 E/unknown:ReactNative(21291): ?anon_0_@1:3713575
11-28 09:44:19.673 E/unknown:ReactNative(21291): SyntheticError@1:163172
11-28 09:44:19.673 E/unknown:ReactNative(21291): Wrapper@1:163687
11-28 09:44:19.673 E/unknown:ReactNative(21291): _callSuper@1:148560
11-28 09:44:19.673 E/unknown:ReactNative(21291): _construct@1:164035
11-28 09:44:19.673 E/unknown:ReactNative(21291): _next@1:595023
11-28 09:44:19.673 E/unknown:ReactNative(21291): anonymous@1:594896
```

### 101 audit 12 min
```
11-28 09:46:17.856 E/ReactNativeJS(21291): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mx07sfws-b5dfda397a5b4231","check":{"id":"deep-repeat.redirect.onboarding.redirect.onboarding.verify","label":"redirect.onboarding: redirect.onboarding.verify (repeat)","kind":"journey","status":"fail","durationMs":1464.8,"metrics":{"journeyId":"redirect.onboarding.redirect.onboarding.verify","journeyLabel":"redirect.onboarding: redirect.onboarding.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.onboarding","semanticActionId":"redirect.onboarding.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":23.8,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":509.8,"forwardWorkMs":509.8,"navigationCommitMs":424…
11-28 09:46:17.858 E/unknown:ReactNative(21291): ?anon_0_@1:3707775
11-28 09:46:17.858 E/unknown:ReactNative(21291): ?anon_0_@1:3713575
11-28 09:46:17.858 E/unknown:ReactNative(21291): SyntheticError@1:163172
11-28 09:46:17.858 E/unknown:ReactNative(21291): Wrapper@1:163687
11-28 09:46:17.858 E/unknown:ReactNative(21291): _callSuper@1:148560
11-28 09:46:17.858 E/unknown:ReactNative(21291): _construct@1:164035
11-28 09:46:17.858 E/unknown:ReactNative(21291): _next@1:595023
```
