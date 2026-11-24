# App explorer: 1.0.368 (424)

**Real-use session ATTENTION vs 1.0.366: 0 broken, 16 friction, 1 slower**

- Friction: No reaction for 3.5 s after "scroll rates 1"
- Friction: No reaction for 3.5 s after "open product"
- Friction: No reaction for 3.0 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll lenders"
- Friction: No reaction for 3.8 s after "switch to savings"
- Friction: No reaction for 3.4 s after "open filters"
- Friction: No reaction for 3.0 s after "open market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 4.1 s after "open term deposits"
- Friction: No reaction for 3.5 s after "verify term deposit rates"
- Friction: No reaction for 7.3 s after "search Macquarie"
- Friction: No reaction for 3.2 s after "open mortgage filter draft"
- Friction: No reaction for 3.3 s after "open unsaved rate"
- Friction: No reaction for 4.4 s after "leave removed product"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: No reaction for 3.4 s after "follow browse rates recovery"
- Slower: "leave removed product" content 0.0 s to 2.2 s

**Initial Rates readiness:** 33.3 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode full | 111 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 18
Baseline 1.0.366
**Audit live: outcome failed | 962 s | audit log 856421 bytes (audit-log.txt) https://paste.c-net.org/5b1dbad3-084a-9298-8325-943639c85a41 | debug log Upload and copy link not found**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2710 | -51571 | 536/844 | 73 | 525 | 3 errors; start 2672ms; boot js-start 405538, layout-mounted 406273, cache-read 406395, hydrated 406548, splash-hide 406548, manifest 408461, resolved 409474, core-fetched 413780, core-saved 414826, rows-prepared 415043, search-index-idle 415043, leading-requested 415043, details-start 415409, leading-scoped 415443, pricing-ready 416545, last-gate 417017, details-fetched 423663, detail-filters-idle 428851, last-pricing 428851, suitability-built 429943, post-refresh-wait 430738, leading-page 432268, last-rows 438619, rates-ready 438832, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 161, pricing-scope-ms 9938, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 3, filter-rows 38533, filter-yields 12, filter-ms 403, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 117 |
| 2 | scroll rates 1 | 690 | -62 | 32/57 | 77 | 492 |  |
| 3 | scroll rates 2 | 681 | -92 | 20/36 | 77 | 715 |  |
| 4 | scroll rates back | 668 | -26 |  |  | 555 |  |
| 5 | open product | 3649 | -5447 | 31/50 | 69 | 653 | 3 errors |
| 6 | scroll product | 686 | -31 | 29/58 | 69 | 671 |  |
| 7 | back to rates | 26 | -4 | 12/25 | 73 | 632 |  |
| 8 | open lenders | 19 | -4 | 17/25 | 200 | 639 |  |
| 9 | scroll lenders | 713 | -18 | 17/21 | 97 | 637 |  |
| 10 | back from lenders | 19 | -6 | 9/10 | 105 | 638 |  |
| 11 | switch to savings | 22 | -3 | 36/65 | 73 | 652 |  |
| 12 | switch to home loans | 21 | -4 | 15/31 | 53 | 665 |  |
| 13 | open filters | 19 | -6 | 27/33 | 150 | 662 |  |
| 14 | close filters | 19 | -6 | 7/10 | 150 | 661 |  |
| 15 | open market | 19 | -4 | 19/33 | 57 | 663 |  |
| 16 | open rba | 2443 | -209 | 55/75 | 65 | 680 |  |
| 17 | scroll rba | 692 | -19 | 28/54 | 65 | 673 |  |
| 18 | back from rba | 20 | -4 | 8/21 | 48 | 673 |  |
| 19 | scroll market | 705 | -14 | 23/45 | 69 | 672 |  |
| 20 | open saved | 18 | -7 | 10/17 | 53 | 676 |  |
| 21 | return to rates | 27 | +3 | 19/37 | 57 | 678 |  |
| 22 | start category switch | 23 | -12 |  |  | 679 |  |
| 23 | open term deposits | 21 | -3 | 47/78 | 73 | 701 |  |
| 24 | verify term deposit rates | 724 | +9 | 36/62 | 65 | 704 |  |
| 25 | restore home loans | 19 | -7 | 15/32 | 57 | 710 |  |
| 26 | start search from rates | 22 | -6 |  |  | 703 |  |
| 27 | open savings search | 19 | -25 | 15/33 | 61 | 721 |  |
| 28 | search Macquarie | 2613 | +275 | 81/96 | 150 | 729 | 1 errors |
| 29 | verify Macquarie result | 0 | 0 | 15/15 | 16 | 719 |  |
| 30 | clear query and restore results | 18 | -7 | 18/19 | 29 | 734 |  |
| 31 | return from savings search | 19 | -9 | 29/42 | 89 | 757 |  |
| 32 | start filter rollback | 22 | -8 | 13/15 | 16 | 747 |  |
| 33 | open mortgage filter draft | 19 | -9 | 27/31 | 121 | 762 |  |
| 34 | select fixed in draft | 19 | -9 | 9/13 | 150 | 765 |  |
| 35 | discard unsaved filter draft | 17 | -8 | 17/22 | 93 | 769 |  |
| 36 | verify fixed was not applied | 27 | -1 | 24/28 | 109 | 783 | 1 errors |
| 37 | close verified filter draft | 18 | -6 | 17/22 | 69 | 782 |  |
| 38 | start save from rates | 30 | -7 | 14/15 | 19 | 779 | 1 errors |
| 39 | open unsaved rate | 26 | +1 | 45/63 | 77 | 815 | 1 errors |
| 40 | save a rate | 20 | -4 | 9/16 | 53 | 813 | 1 errors |
| 41 | leave saved product | 28 | +4 | 13/24 | 69 | 817 |  |
| 42 | restart with a saved rate | 12676 | -6974 | 123/200 | 81 | 595 | 1 errors; start 5263ms; boot js-start 794044, layout-mounted 794573, hydrated 795683, cache-read 796428, core-ready 796993, rows-prepared 797109, search-index-idle 797109, detail-filters-idle 797109, leading-requested 797109, last-pricing 797109, splash-hide 797110, manifest 798916, leading-scoped 799780, leading-page 799780, resolved 800291, pricing-ready 802767, last-rows 802767, rates-ready 802906, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 27, pricing-scope-ms 3595, filter-runs 1, filter-rows 6861, filter-yields 3, filter-ms 80, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 13 |
| 43 | verify saved rate after restart | 20 | -17 | 21/36 | 69 | 427 |  |
| 44 | open product from saved rates | 19 | -10 | 37/66 | 73 | 551 |  |
| 45 | remove saved rate | 20 | -13 | 11/17 | 57 | 617 |  |
| 46 | leave removed product | 2182 | +2154 | 6/10 | 65 | 634 |  |
| 47 | follow browse rates recovery | 22 |  | 16/29 | 53 | 676 |  |
| 48 | start compare from rates | 28 | -10135 |  |  | 713 |  |
| 49 | enter selection mode | 25 | 0 | 7/14 | 53 | 715 |  |
| 50 | select first comparison rate | 18 | -2260 | 8/16 | 48 | 707 |  |
| 51 | select second comparison rate | 18 | -10 | 9/14 | 48 | 706 |  |
| 52 | open two-rate comparison | 18 | -7 | 18/29 | 150 | 716 |  |
| 53 | return from two-rate comparison | 17 | -18 | 21/31 | 89 | 716 |  |
| 54 | cold start | 8755 |  | 27/36 | 300 | 581 | 1 errors; start 3680ms; boot js-start 907499, layout-mounted 907676, hydrated 907676, cache-read 908717, core-ready 909301, rows-prepared 909408, search-index-idle 909408, detail-filters-idle 909408, leading-requested 909408, last-pricing 909408, splash-hide 909409, manifest 910593, leading-scoped 911200, leading-page 911200, resolved 911672, pricing-ready 912318, last-rows 912318, rates-ready 912457, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 19, pricing-scope-ms 1694, filter-runs 1, filter-rows 6861, filter-yields 3, filter-ms 77, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 12 |
| 55 | /browse | 2209 |  | 2/2 | 32 | 427 |  |
| 56 | /watchlist | 24 |  | 3/3 | 48 | 494 |  |
| 57 | /market | 40 |  | 10/19 | 65 | 570 |  |
| 58 | /tools | 4363 |  | 15/22 | 89 | 617 |  |
| 59 | /trends | 25 |  | 22/36 | 85 | 621 |  |
| 60 | /search | 27 |  | 26/39 | 117 | 641 |  |
| 61 | /banks | 8124 |  | 40/55 | 93 | 661 |  |
| 62 | /bank-rates | 26 |  | 13/29 | 73 | 675 |  |
| 63 | /categories | 25 |  | 35/48 | 85 | 707 |  |
| 64 | /catalogue | 24 |  | 33/48 | 93 | 726 |  |
| 65 | /compare | 29 |  | 12/17 | 101 | 735 |  |
| 66 | /matches | 38 |  | 39/53 | 81 | 739 |  |
| 67 | /calculator | 21 |  | 13/25 | 77 | 715 |  |
| 68 | /projections | 20 |  | 19/33 | 81 | 720 |  |
| 69 | /profile | 20 |  | 12/26 | 61 | 725 |  |
| 70 | /research | 20 |  | 15/28 | 69 | 730 |  |
| 71 | /rba | 22 |  | 11/26 | 48 | 742 |  |
| 72 | /rba-response | 21 |  | 17/32 | 73 | 744 |  |
| 73 | /settings | 22 |  | 15/35 | 69 | 753 |  |
| 74 | /about | 25 |  | 12/24 | 61 | 755 |  |
| 75 | /terms | 22 |  | 12/25 | 61 | 759 |  |
| 76 | /privacy | 21 |  |  |  | 760 |  |
| 77 | /third-party-notices | 22 |  | 12/24 | 65 | 767 |  |
| 78 | /node | 27 |  | 29/42 | 89 | 810 |  |
| 79 | /passthrough | 28 |  | 27/46 | 89 | 780 |  |
| 80 | /calculation-receipt | 22 |  | 11/23 | 69 | 780 |  |
| 81 | /rate-receipt | 21 |  | 7/9 | 73 | 782 |  |
| 82 | warm resume | 987 |  | 4/5 | 350 | 780 | start 427ms |
| 83 | cold relaunch | 8958 |  | 24/37 | 300 | 578 | 1 errors; start 3602ms; boot js-start 1141512, layout-mounted 1141658, hydrated 1141741, cache-read 1142683, core-ready 1143234, rows-prepared 1143317, search-index-idle 1143317, detail-filters-idle 1143317, leading-requested 1143317, last-pricing 1143317, splash-hide 1143318, manifest 1144602, leading-scoped 1144965, leading-page 1144965, pricing-ready 1145669, last-rows 1145669, resolved 1145718, rates-ready 1146424, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 22, pricing-scope-ms 1434, filter-runs 2, filter-rows 13722, filter-yields 5, filter-cancels 1, filter-ms 278, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 13 |
| 84 | about | 31 |  | 10/20 | 150 | 409 |  |
| 85 | audit screen | 17 |  | 104/220 | 57 | 606 |  |
| 86 | audit 0 min | 0 |  | 26/34 | 93 | 750 |  |
| 87 | audit 2 min | 0 |  | 1084/1277 | 101 | 971 | 80 errors |
| 88 | audit 4 min | 0 |  | 941/1104 | 101 | 1104 | 80 errors |
| 89 | audit 5 min | 0 |  | 422/526 | 89 |  | 80 errors |
| 90 | audit 6 min | 0 |  | 858/1028 | 105 | 1167 | 80 errors |
| 91 | audit 7 min | 0 |  | 710/823 | 101 | 1187 | 80 errors |
| 92 | audit 9 min | 0 |  | 463/564 | 93 | 1348 | 80 errors |
| 93 | audit 10 min | 0 |  | 890/1064 | 101 | 1255 | 80 errors |
| 94 | audit 12 min | 0 |  | 287/342 | 97 | 1254 | 80 errors |
| 95 | audit 13 min | 0 |  | 147/184 | 34 | 1273 |  |
| 96 | audit 15 min | 0 |  | 110/145 | 48 | 1299 |  |
| 97 | audit finished | 0 |  | 113/212 | 65 | 1289 |  |
| 98 | audit result 1 | 0 |  |  |  | 1293 |  |
| 99 | audit result 2 | 0 |  |  |  | 1288 |  |
| 100 | audit result 3 | 0 |  |  |  | 1288 |  |
| 101 | audit result 4 | 0 |  |  |  | 1290 |  |
| 102 | audit result 5 | 0 |  |  |  | 1288 |  |
| 103 | audit result 6 | 0 |  |  |  | 1291 |  |
| 104 | audit result 7 | 0 |  |  |  | 1289 |  |
| 105 | audit result 8 | 0 |  |  |  | 1289 |  |
| 106 | audit result 9 | 0 |  |  |  | 1292 |  |
| 107 | audit result 10 | 0 |  |  |  | 1290 |  |
| 108 | audit result 11 | 0 |  |  |  | 1293 |  |
| 109 | audit result 12 | 0 |  |  |  | 1290 |  |
| 110 | about for debug log | 3575 |  | 19/30 | 65 | 1343 |  |
| 111 | debug log screen | 0 |  | 97/215 | 57 | 1339 |  |

## Errors

### 1 open app
```
11-24 02:49:08.773 E/australianrates(10393): Not starting debugger since process cannot load the jdwp agent.
11-24 02:49:11.994 W/ReactNativeJS(10393): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-24 02:49:13.336 W/ReactNativeJS(10393): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
```

### 5 open product
```
11-24 02:50:13.468 W/ReactNativeJS(10393): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-24 02:50:13.957 W/ReactNativeJS(10393): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-24 02:50:15.119 W/ReactNativeJS(10393): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
```

### 28 search Macquarie
```
11-24 02:53:51.284 E/FrameTracker(10393): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 36 verify fixed was not applied
```
11-24 02:54:52.061 E/FrameTracker(10393): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 38 start save from rates
```
11-24 02:55:08.396 E/FrameTracker(10393): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 39 open unsaved rate
```
11-24 02:55:13.658 E/ImeBackDispatcher(10393): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 122679176
```

### 40 save a rate
```
11-24 02:55:24.312 E/FrameTracker(10393): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 42 restart with a saved rate
```
11-24 02:55:37.787 E/australianrates(14609): Not starting debugger since process cannot load the jdwp agent.
```

### 54 cold start
```
11-24 02:57:31.478 E/australianrates(15920): Not starting debugger since process cannot load the jdwp agent.
```

### 83 cold relaunch
```
11-24 03:01:25.538 E/australianrates(18986): Not starting debugger since process cannot load the jdwp agent.
```

### 87 audit 2 min
```
11-24 03:02:35.576 E/ReactNativeJS(18986): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu3zv6b-23c84d88b715b7b4","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":4168.8,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":282.3,"liveStage:dates-index:fetched:ms":233.8,"liveStage:revision:verified:ms":63.3,"liveStage:Core asset:downloaded:ms":182.5,"liveStage:Core asset:hash-verified:ms":3.4,"liveStage:Core asset:native-inflated-and-text-decoded:ms":137.6,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":168.8,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":539.5,"liveStage:Details asset:downloaded:ms":1036.3,"liveStage:Details asset:hash-verified:ms":36.1,"liveSt…
11-24 03:02:35.578 E/unknown:ReactNative(18986): ?anon_0_@1:3694852
11-24 03:02:35.578 E/unknown:ReactNative(18986): ?anon_0_@1:3700652
11-24 03:02:35.578 E/unknown:ReactNative(18986): SyntheticError@1:163016
11-24 03:02:35.578 E/unknown:ReactNative(18986): Wrapper@1:163531
11-24 03:02:35.578 E/unknown:ReactNative(18986): _callSuper@1:148404
11-24 03:02:35.578 E/unknown:ReactNative(18986): _construct@1:163879
11-24 03:02:35.578 E/unknown:ReactNative(18986): _next@1:594867
```

### 88 audit 4 min
```
11-24 03:04:22.130 E/ReactNativeJS(18986): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu3zv6b-23c84d88b715b7b4","check":{"id":"deep-first-pass.route.rates.search.filters.open","label":"route.rates: search.filters.open (first-pass)","kind":"journey","status":"fail","durationMs":3956.2,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRevisionAfter":4,"renderRevisionBefore":"state-24","renderRevisionAfter":"state-27","actionMs":0.2,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtra…
11-24 03:04:22.131 E/unknown:ReactNative(18986): ?anon_0_@1:3694852
11-24 03:04:22.131 E/unknown:ReactNative(18986): ?anon_0_@1:3700652
11-24 03:04:22.131 E/unknown:ReactNative(18986): SyntheticError@1:163016
11-24 03:04:22.131 E/unknown:ReactNative(18986): Wrapper@1:163531
11-24 03:04:22.131 E/unknown:ReactNative(18986): _callSuper@1:148404
11-24 03:04:22.131 E/unknown:ReactNative(18986): _construct@1:163879
11-24 03:04:22.131 E/unknown:ReactNative(18986): _next@1:594867
```

### 89 audit 5 min
```
11-24 03:06:13.236 E/ReactNativeJS(18986): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu3zv6b-23c84d88b715b7b4","check":{"id":"deep-first-pass.sample.catalogue.3.product.open","label":"sample.catalogue.3: product.open (first-pass)","kind":"journey","status":"fail","durationMs":1918.6,"metrics":{"journeyId":"sample.catalogue.3.product.open","journeyLabel":"sample.catalogue.3: product.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.3","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/People%20First%20and%20Heritage%20Bank%7Cd9772ff5-78d8-46c4-b489-caa0f05d4c98%7CTRANS_AND_SAVINGS_ACCOUNTS%7CDream%20Fund","expectedPath":"/product/People%20First%20and%20Heritage%20Bank%7Cd9772ff5-78d8-46c4-b489-caa0f05d4c98%7CTRANS_AND_SAVINGS_ACCOUNTS%7CDream%20Fund","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":674.8,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observe…
11-24 03:06:13.246 E/unknown:ReactNative(18986): ?anon_0_@1:3694852
11-24 03:06:13.246 E/unknown:ReactNative(18986): ?anon_0_@1:3700652
11-24 03:06:13.246 E/unknown:ReactNative(18986): SyntheticError@1:163016
11-24 03:06:13.246 E/unknown:ReactNative(18986): Wrapper@1:163531
11-24 03:06:13.246 E/unknown:ReactNative(18986): _callSuper@1:148404
11-24 03:06:13.246 E/unknown:ReactNative(18986): _construct@1:163879
11-24 03:06:13.246 E/unknown:ReactNative(18986): _next@1:594867
```

### 90 audit 6 min
```
11-24 03:07:17.131 E/ReactNativeJS(18986): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu3zv6b-23c84d88b715b7b4","check":{"id":"deep-first-pass.route.outlook.outlook.economy.lens.next","label":"route.outlook: outlook.economy.lens.next (first-pass)","kind":"journey","status":"fail","durationMs":11749.4,"metrics":{"journeyId":"route.outlook.outlook.economy.lens.next","journeyLabel":"route.outlook: outlook.economy.lens.next","iteration":"cold","passId":"first-pass","scenarioId":"route.outlook","semanticActionId":"outlook.economy.lens.next","depth":2,"plannedExpectedPath":"/research","expectedPath":"/research","expectedSurface":"outlook.economy","actionSource":"outlook.economy","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":0,"actionRevisionAfter":1,"renderRevisionBefore":"2026-11-24:false:unavailable","renderRevisionAfter":"2026-11-24:true:unavailable","actionMs":8.1,"preActionWaitMs":14.6,"preActionQuietWindowReused":false,"preActionQuietWindowAvoidedMs":0,"mi…
11-24 03:07:17.132 E/unknown:ReactNative(18986): ?anon_0_@1:3694852
11-24 03:07:17.132 E/unknown:ReactNative(18986): ?anon_0_@1:3700652
11-24 03:07:17.132 E/unknown:ReactNative(18986): SyntheticError@1:163016
11-24 03:07:17.132 E/unknown:ReactNative(18986): Wrapper@1:163531
11-24 03:07:17.132 E/unknown:ReactNative(18986): _callSuper@1:148404
11-24 03:07:17.132 E/unknown:ReactNative(18986): _construct@1:163879
11-24 03:07:17.132 E/unknown:ReactNative(18986): _next@1:594867
```

### 91 audit 7 min
```
11-24 03:08:59.396 E/ReactNativeJS(18986): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu3zv6b-23c84d88b715b7b4","check":{"id":"deep-repeat.route.rates.search.filters.open","label":"route.rates: search.filters.open (repeat)","kind":"journey","status":"fail","durationMs":4236.7,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":26,"actionRevisionAfter":27,"renderRevisionBefore":"state-25","renderRevisionAfter":"state-28","actionMs":0.2,"preActionWaitMs":0.7,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"re…
11-24 03:08:59.397 E/unknown:ReactNative(18986): ?anon_0_@1:3694852
11-24 03:08:59.397 E/unknown:ReactNative(18986): ?anon_0_@1:3700652
11-24 03:08:59.397 E/unknown:ReactNative(18986): SyntheticError@1:163016
11-24 03:08:59.397 E/unknown:ReactNative(18986): Wrapper@1:163531
11-24 03:08:59.397 E/unknown:ReactNative(18986): _callSuper@1:148404
11-24 03:08:59.397 E/unknown:ReactNative(18986): _construct@1:163879
11-24 03:08:59.397 E/unknown:ReactNative(18986): _next@1:594867
```

### 92 audit 9 min
```
11-24 03:10:34.443 E/ReactNativeJS(18986): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu3zv6b-23c84d88b715b7b4","check":{"id":"deep-repeat.route.lender.product.lender.open","label":"route.lender: product.lender.open (repeat)","kind":"journey","status":"fail","durationMs":2449.2,"metrics":{"journeyId":"route.lender.product.lender.open","journeyLabel":"route.lender: product.lender.open","iteration":"warm","passId":"repeat","scenarioId":"route.lender","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/Beyond%20Bank%20Australia","expectedPath":"/bank/Beyond%20Bank%20Australia","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":17,"actionRevisionAfter":18,"actionResultEvidence":"{\"expectedPath\":\"/bank/Beyond%20Bank%20Australia\"}","actionMs":1040.7,"preActionWaitMs":1,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"ob…
11-24 03:10:34.620 E/unknown:ReactNative(18986): ?anon_0_@1:3694852
11-24 03:10:34.620 E/unknown:ReactNative(18986): ?anon_0_@1:3700652
11-24 03:10:34.620 E/unknown:ReactNative(18986): SyntheticError@1:163016
11-24 03:10:34.620 E/unknown:ReactNative(18986): Wrapper@1:163531
11-24 03:10:34.620 E/unknown:ReactNative(18986): _callSuper@1:148404
11-24 03:10:34.620 E/unknown:ReactNative(18986): _construct@1:163879
11-24 03:10:34.620 E/unknown:ReactNative(18986): _next@1:594867
```

### 93 audit 10 min
```
11-24 03:11:33.205 E/ReactNativeJS(18986): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu3zv6b-23c84d88b715b7b4","check":{"id":"deep-repeat.route.projections.projections.open","label":"route.projections: projections.open (repeat)","kind":"journey","status":"fail","durationMs":1109.2,"metrics":{"journeyId":"route.projections.projections.open","journeyLabel":"route.projections: projections.open","iteration":"warm","passId":"repeat","scenarioId":"route.projections","semanticActionId":"projections.open","depth":0,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"projections.inputs","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":219.6,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":109.5,"forwardWorkMs":109.5,"navigationCommitMs":0,"firstReadyFrameMs":109.4,"firstReadyFrameObser…
11-24 03:11:33.209 E/unknown:ReactNative(18986): ?anon_0_@1:3694852
11-24 03:11:33.209 E/unknown:ReactNative(18986): ?anon_0_@1:3700652
11-24 03:11:33.209 E/unknown:ReactNative(18986): SyntheticError@1:163016
11-24 03:11:33.209 E/unknown:ReactNative(18986): Wrapper@1:163531
11-24 03:11:33.209 E/unknown:ReactNative(18986): _callSuper@1:148404
11-24 03:11:33.209 E/unknown:ReactNative(18986): _construct@1:163879
11-24 03:11:33.209 E/unknown:ReactNative(18986): _next@1:594867
```

### 94 audit 12 min
```
11-24 03:13:12.655 E/ReactNativeJS(18986): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwu3zv6b-23c84d88b715b7b4","check":{"id":"deep-repeat.redirect.tools.redirect.tools.verify","label":"redirect.tools: redirect.tools.verify (repeat)","kind":"journey","status":"fail","durationMs":4133.7,"metrics":{"journeyId":"redirect.tools.redirect.tools.verify","journeyLabel":"redirect.tools: redirect.tools.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.tools","semanticActionId":"redirect.tools.verify","depth":1,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":50.8,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":1175.3,"forwardWorkMs":1175.3,"navigationCommitMs":1174.8,"firstReadyFrameMs":0.4,"firstR…
11-24 03:13:12.656 E/unknown:ReactNative(18986): ?anon_0_@1:3694852
11-24 03:13:12.656 E/unknown:ReactNative(18986): ?anon_0_@1:3700652
11-24 03:13:12.656 E/unknown:ReactNative(18986): SyntheticError@1:163016
11-24 03:13:12.656 E/unknown:ReactNative(18986): Wrapper@1:163531
11-24 03:13:12.656 E/unknown:ReactNative(18986): _callSuper@1:148404
11-24 03:13:12.656 E/unknown:ReactNative(18986): _construct@1:163879
11-24 03:13:12.656 E/unknown:ReactNative(18986): _next@1:594867
```
