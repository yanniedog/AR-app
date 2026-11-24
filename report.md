# App explorer: 1.0.371 (427)

**Real-use session ATTENTION vs 1.0.370: 0 broken, 13 friction, 2 slower**

- Friction: No reaction for 3.3 s after "scroll rates 1"
- Friction: No reaction for 3.1 s after "scroll rates 2"
- Friction: No reaction for 3.5 s after "open product"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.3 s after "scroll lenders"
- Friction: No reaction for 3.6 s after "switch to savings"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 3.9 s after "open term deposits"
- Friction: No reaction for 3.3 s after "verify term deposit rates"
- Friction: No reaction for 5.7 s after "search Macquarie"
- Friction: No reaction for 3.4 s after "open unsaved rate"
- Friction: No reaction for 6.3 s after "remove saved rate"
- Friction: "No saved rates" shown on "leave removed product"
- Slower: "remove saved rate" content 2.6 s to 6.3 s
- Slower: "remove saved rate" reaction 2.6 s to 6.3 s

**Initial Rates readiness:** 25.2 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode full | 110 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 15
Baseline 1.0.370
**Audit live: outcome failed | 839 s | audit log 843185 bytes (audit-log.txt) https://paste.c-net.org/7cd9b443-10b1-131b-6e04-9379f0ab893d | debug log Upload and copy link not found**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 27047 | -48691 | 358/686 | 69 | 493 | 1 errors; start 2682ms; boot js-start 394345, layout-mounted 394906, cache-read 395165, hydrated 395409, splash-hide 395409, manifest 396710, resolved 397458, core-fetched 400493, core-saved 401069, rows-prepared 401308, search-index-idle 401308, leading-requested 401308, details-start 401536, leading-scoped 401690, pricing-ready 402454, last-gate 402765, details-fetched 408498, detail-filters-idle 412747, last-pricing 412747, suitability-built 413475, post-refresh-wait 414017, leading-page 415012, last-rows 419380, rates-ready 419511, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 132, pricing-scope-ms 6879, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 3, filter-rows 38533, filter-yields 6, filter-ms 163, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 43 |
| 2 | scroll rates 1 | 710 | -62 | 28/58 | 73 | 712 |  |
| 3 | scroll rates 2 | 690 | -113 | 21/45 | 77 | 560 |  |
| 4 | scroll rates back | 684 | -32 |  |  | 544 |  |
| 5 | open product | 3663 | -4109 | 24/54 | 65 | 658 |  |
| 6 | scroll product | 698 | -43 | 23/65 | 61 | 661 |  |
| 7 | back to rates | 29 | -3 | 12/24 | 53 | 642 |  |
| 8 | open lenders | 21 | -9 | 21/26 | 150 | 649 |  |
| 9 | scroll lenders | 747 | -8 | 27/32 | 121 | 646 |  |
| 10 | back from lenders | 18 | -9 | 8/10 | 200 | 650 |  |
| 11 | switch to savings | 18 | -15 | 29/63 | 61 | 662 |  |
| 12 | switch to home loans | 18 | -13 | 12/33 | 46 | 679 |  |
| 13 | open filters | 17 | -13 | 24/29 | 105 | 687 |  |
| 14 | close filters | 18 | -8 | 8/10 | 150 | 673 |  |
| 15 | open market | 20 | -9 | 15/32 | 48 | 675 |  |
| 16 | open rba | 2571 | -130 | 53/99 | 48 | 692 |  |
| 17 | scroll rba | 701 | +12 | 24/63 | 57 | 684 |  |
| 18 | back from rba | 22 | -9 | 10/22 | 46 | 685 |  |
| 19 | scroll market | 693 | -42 | 20/48 | 61 | 684 |  |
| 20 | open saved | 17 | -19 | 7/19 | 53 | 692 |  |
| 21 | return to rates | 16 | -15 | 11/38 | 46 | 690 |  |
| 22 | start category switch | 20 | -21 |  |  | 690 |  |
| 23 | open term deposits | 17 | -14 | 36/72 | 69 | 712 |  |
| 24 | verify term deposit rates | 675 | -26 | 27/71 | 57 | 715 |  |
| 25 | restore home loans | 18 | -10 | 14/32 | 53 | 721 |  |
| 26 | start search from rates | 21 | -15 |  |  | 714 |  |
| 27 | open savings search | 18 | -13 | 12/34 | 48 | 735 |  |
| 28 | search Macquarie | 1711 | -500 | 60/79 | 150 | 739 |  |
| 29 | verify Macquarie result | 0 | -1 | 11/14 | 16 | 732 | 1 errors |
| 30 | clear query and restore results | 16 | -18 | 16/19 | 29 | 744 |  |
| 31 | return from savings search | 16 | -33 | 30/43 | 69 | 758 |  |
| 32 | start filter rollback | 45 | +4 | 11/15 | 16 | 747 |  |
| 33 | open mortgage filter draft | 21 | -11 | 26/31 | 150 | 763 |  |
| 34 | select fixed in draft | 17 | -14 | 12/15 | 97 | 765 |  |
| 35 | discard unsaved filter draft | 18 | -11 | 19/21 | 73 | 769 |  |
| 36 | verify fixed was not applied | 18 | -14 | 23/28 | 200 | 781 |  |
| 37 | close verified filter draft | 18 | -18 | 17/22 | 53 | 782 |  |
| 38 | start save from rates | 24 | -13 | 11/15 | 16 | 779 | 1 errors |
| 39 | open unsaved rate | 18 | -10 | 58/127 | 57 | 818 | 1 errors |
| 40 | save a rate | 20 | -10 | 7/16 | 44 | 814 | 1 errors |
| 41 | leave saved product | 19 | -12 | 10/26 | 65 | 819 |  |
| 42 | restart with a saved rate | 12319 | -4034 | 115/230 | 81 | 409 | 1 errors; start 4938ms; boot js-start 772971, layout-mounted 773477, hydrated 774484, cache-read 775123, core-ready 775592, rows-prepared 775696, search-index-idle 775696, detail-filters-idle 775696, leading-requested 775696, last-pricing 775696, splash-hide 775697, manifest 777001, leading-scoped 778382, leading-page 778382, resolved 779062, pricing-ready 781413, last-rows 781413, rates-ready 781568, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 24, pricing-scope-ms 4282, filter-runs 2, filter-rows 31672, filter-yields 5, filter-ms 88, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 12 |
| 43 | verify saved rate after restart | 27 | -7 | 15/27 | 97 | 464 |  |
| 44 | open product from saved rates | 18 | -13 | 34/75 | 61 | 661 |  |
| 45 | remove saved rate | 4312 | +4281 | 8/18 | 81 | 672 |  |
| 46 | leave removed product | 17 | -2349 | 6/11 | 61 | 669 |  |
| 47 | follow browse rates recovery | 17 | -14 | 13/29 | 53 | 693 |  |
| 48 | start compare from rates | 21 | -21 |  |  | 699 |  |
| 49 | enter selection mode | 17 | -11 | 6/15 | 46 | 701 |  |
| 50 | select first comparison rate | 18 | -12 | 8/16 | 48 | 695 |  |
| 51 | select second comparison rate | 19 | -11 | 7/16 | 48 | 695 |  |
| 52 | open two-rate comparison | 18 | -10 | 14/34 | 101 | 707 |  |
| 53 | return from two-rate comparison | 20 | -11 | 19/33 | 73 | 706 |  |
| 54 | cold start | 7798 |  | 25/36 | 300 | 398 | 1 errors; start 2710ms; boot js-start 884574, layout-mounted 884715, hydrated 884794, cache-read 885546, core-ready 885996, rows-prepared 886087, search-index-idle 886087, detail-filters-idle 886087, leading-requested 886087, last-pricing 886087, splash-hide 886088, manifest 887376, leading-scoped 887627, leading-page 887627, resolved 888136, pricing-ready 888644, last-rows 888644, rates-ready 888761, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 21, pricing-scope-ms 1225, filter-runs 1, filter-rows 6861, filter-yields 3, filter-ms 59, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 10 |
| 55 | /browse | 22 |  | 2/2 | 32 | 441 |  |
| 56 | /watchlist | 18 |  | 2/2 | 40 | 525 |  |
| 57 | /market | 4279 |  | 8/24 | 40 | 612 |  |
| 58 | /tools | 22 |  | 12/24 | 69 | 612 |  |
| 59 | /trends | 24 |  | 21/39 | 89 | 619 |  |
| 60 | /search | 20 |  | 26/38 | 133 | 642 |  |
| 61 | /banks | 27 |  | 24/40 | 97 | 665 |  |
| 62 | /bank-rates | 21 |  | 12/28 | 65 | 677 |  |
| 63 | /categories | 20 |  | 35/55 | 73 | 716 |  |
| 64 | /catalogue | 22 |  | 27/45 | 89 | 752 |  |
| 65 | /compare | 34 |  | 16/19 | 85 | 746 |  |
| 66 | /matches | 23 |  | 25/53 | 65 | 691 |  |
| 67 | /calculator | 29 |  | 11/23 | 61 | 678 |  |
| 68 | /projections | 25 |  | 15/33 | 61 | 666 |  |
| 69 | /profile | 23 |  | 12/28 | 53 | 667 |  |
| 70 | /research | 24 |  | 16/29 | 65 | 673 |  |
| 71 | /rba | 25 |  | 12/28 | 81 | 685 |  |
| 72 | /rba-response | 26 |  | 12/28 | 61 | 686 |  |
| 73 | /settings | 21 |  | 7/24 | 69 | 691 |  |
| 74 | /about | 25 |  | 9/27 | 53 | 690 |  |
| 75 | /terms | 25 |  | 8/26 | 57 | 691 |  |
| 76 | /privacy | 25 |  |  |  | 690 |  |
| 77 | /third-party-notices | 22 |  | 11/26 | 77 | 693 |  |
| 78 | /node | 22 |  | 28/46 | 81 | 713 |  |
| 79 | /passthrough | 23 |  | 22/46 | 81 | 692 |  |
| 80 | /calculation-receipt | 27 |  | 11/28 | 65 | 686 |  |
| 81 | /rate-receipt | 24 |  | 5/9 | 57 | 686 |  |
| 82 | warm resume | 445 |  | 4/5 | 150 | 685 |  |
| 83 | cold relaunch | 8689 |  | 33/49 | 109 | 407 | 2 errors; start 2802ms; boot js-start 1099347, layout-mounted 1099510, hydrated 1099557, cache-read 1100371, core-ready 1100814, rows-prepared 1100887, search-index-idle 1100887, detail-filters-idle 1100887, leading-requested 1100887, last-pricing 1100887, splash-hide 1100888, leading-scoped 1102392, leading-page 1102392, pricing-ready 1103003, last-rows 1103003, rates-ready 1103154, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 12, pricing-scope-ms 859, filter-runs 1, filter-rows 6861, filter-yields 3, filter-ms 83, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 10 |
| 84 | about | 24 |  | 13/21 | 61 | 492 |  |
| 85 | audit screen | 15 |  | 83/245 | 46 | 603 |  |
| 86 | audit 1 min | 0 |  | 1005/1288 | 89 | 955 | 80 errors |
| 87 | audit 3 min | 0 |  | 901/1174 | 89 | 1134 | 80 errors |
| 88 | audit 4 min | 0 |  | 924/1198 | 85 | 1187 | 80 errors |
| 89 | audit 6 min | 0 |  | 896/1153 | 89 | 1238 | 80 errors |
| 90 | audit 7 min | 0 |  | 262/360 | 77 | 1336 | 80 errors |
| 91 | audit 8 min | 0 |  | 927/1215 | 89 | 1437 | 80 errors |
| 92 | audit 10 min | 0 |  | 128/179 | 32 | 1242 | 80 errors |
| 93 | audit 11 min | 0 |  | 68/108 | 32 | 1253 |  |
| 94 | audit 13 min | 0 |  | 124/189 | 34 | 1262 |  |
| 95 | audit 14 min | 0 |  | 25/47 | 65 | 1378 |  |
| 96 | audit finished | 0 |  | 61/167 | 53 | 1265 |  |
| 97 | audit result 1 | 0 |  |  |  | 1253 |  |
| 98 | audit result 2 | 0 |  |  |  | 1251 |  |
| 99 | audit result 3 | 0 |  |  |  | 1254 |  |
| 100 | audit result 4 | 0 |  |  |  | 1252 |  |
| 101 | audit result 5 | 0 |  |  |  | 1254 |  |
| 102 | audit result 6 | 0 |  |  |  | 1251 |  |
| 103 | audit result 7 | 0 |  |  |  | 1251 |  |
| 104 | audit result 8 | 0 |  |  |  | 1254 |  |
| 105 | audit result 9 | 0 |  |  |  | 1252 |  |
| 106 | audit result 10 | 0 |  |  |  | 1255 |  |
| 107 | audit result 11 | 0 |  |  |  | 1253 |  |
| 108 | audit result 12 | 0 |  |  |  | 1253 |  |
| 109 | about for debug log | 3683 |  | 18/33 | 61 | 1286 |  |
| 110 | debug log screen | 1 |  | 68/229 | 46 | 1307 |  |

## Errors

### 1 open app
```
11-24 14:21:08.958 E/australianrates(10415): Not starting debugger since process cannot load the jdwp agent.
```

### 29 verify Macquarie result
```
11-24 14:25:44.810 E/FrameTracker(10415): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 38 start save from rates
```
11-24 14:26:58.760 E/FrameTracker(10415): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 39 open unsaved rate
```
11-24 14:27:03.558 E/ImeBackDispatcher(10415): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 178782733
```

### 40 save a rate
```
11-24 14:27:14.161 E/FrameTracker(10415): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 42 restart with a saved rate
```
11-24 14:27:27.819 E/australianrates(14769): Not starting debugger since process cannot load the jdwp agent.
```

### 54 cold start
```
11-24 14:29:20.177 E/australianrates(16131): Not starting debugger since process cannot load the jdwp agent.
```

### 83 cold relaunch
```
11-24 14:32:54.863 E/australianrates(19089): Not starting debugger since process cannot load the jdwp agent.
11-24 14:32:58.241 W/ReactNativeJS(19089): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
```

### 86 audit 1 min
```
11-24 14:33:55.695 E/ReactNativeJS(19089): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwusp37g-ff33e2110e86f97e","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":3573.3,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":312.1,"liveStage:dates-index:fetched:ms":283.9,"liveStage:revision:verified:ms":87.4,"liveStage:Core asset:downloaded:ms":206.6,"liveStage:Core asset:hash-verified:ms":5.5,"liveStage:Core asset:native-inflated-and-text-decoded:ms":159.4,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":132.4,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":379.2,"liveStage:Details asset:downloaded:ms":846.9,"liveStage:Details asset:hash-verified:ms":34.6,"liveSta…
11-24 14:33:55.697 E/unknown:ReactNative(19089): ?anon_0_@1:3694919
11-24 14:33:55.697 E/unknown:ReactNative(19089): ?anon_0_@1:3700719
11-24 14:33:55.697 E/unknown:ReactNative(19089): SyntheticError@1:163016
11-24 14:33:55.697 E/unknown:ReactNative(19089): Wrapper@1:163531
11-24 14:33:55.697 E/unknown:ReactNative(19089): _callSuper@1:148404
11-24 14:33:55.697 E/unknown:ReactNative(19089): _construct@1:163879
11-24 14:33:55.697 E/unknown:ReactNative(19089): _next@1:594867
```

### 87 audit 3 min
```
11-24 14:35:30.250 E/ReactNativeJS(19089): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwusp37g-ff33e2110e86f97e","check":{"id":"deep-first-pass.route.rates.search.filters.open","label":"route.rates: search.filters.open (first-pass)","kind":"journey","status":"fail","durationMs":1050.3,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRevisionAfter":4,"renderRevisionBefore":"state-23","renderRevisionAfter":"state-26","actionMs":0.2,"preActionWaitMs":0.8,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtra…
11-24 14:35:30.251 E/unknown:ReactNative(19089): ?anon_0_@1:3694919
11-24 14:35:30.251 E/unknown:ReactNative(19089): ?anon_0_@1:3700719
11-24 14:35:30.251 E/unknown:ReactNative(19089): SyntheticError@1:163016
11-24 14:35:30.251 E/unknown:ReactNative(19089): Wrapper@1:163531
11-24 14:35:30.251 E/unknown:ReactNative(19089): _callSuper@1:148404
11-24 14:35:30.251 E/unknown:ReactNative(19089): _construct@1:163879
11-24 14:35:30.251 E/unknown:ReactNative(19089): _next@1:594867
```

### 88 audit 4 min
```
11-24 14:37:07.626 E/ReactNativeJS(19089): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwusp37g-ff33e2110e86f97e","check":{"id":"deep-first-pass.sample.catalogue.5.product.open","label":"sample.catalogue.5: product.open (first-pass)","kind":"journey","status":"fail","durationMs":1916.3,"metrics":{"journeyId":"sample.catalogue.5.product.open","journeyLabel":"sample.catalogue.5: product.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.5","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Aussie%20Activate%7CAUS04032%7CRESIDENTIAL_MORTGAGES%7CNon-Conforming%20Construction%20Loan%20-%20Near%20Prime%20Alt%20Doc","expectedPath":"/product/Aussie%20Activate%7CAUS04032%7CRESIDENTIAL_MORTGAGES%7CNon-Conforming%20Construction%20Loan%20-%20Near%20Prime%20Alt%20Doc","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":202.4,"avoidableWaitMs":0,"minimumJustifiedActions":1,"obser…
11-24 14:37:07.635 E/unknown:ReactNative(19089): ?anon_0_@1:3694919
11-24 14:37:07.635 E/unknown:ReactNative(19089): ?anon_0_@1:3700719
11-24 14:37:07.635 E/unknown:ReactNative(19089): SyntheticError@1:163016
11-24 14:37:07.635 E/unknown:ReactNative(19089): Wrapper@1:163531
11-24 14:37:07.635 E/unknown:ReactNative(19089): _callSuper@1:148404
11-24 14:37:07.635 E/unknown:ReactNative(19089): _construct@1:163879
11-24 14:37:07.635 E/unknown:ReactNative(19089): _next@1:594867
```

### 89 audit 6 min
```
11-24 14:38:57.717 E/ReactNativeJS(19089): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwusp37g-ff33e2110e86f97e","check":{"id":"deep-first-pass.redirect.tab-index.redirect.tab-index.verify","label":"redirect.tab-index: redirect.tab-index.verify (first-pass)","kind":"journey","status":"fail","durationMs":1511.5,"metrics":{"journeyId":"redirect.tab-index.redirect.tab-index.verify","journeyLabel":"redirect.tab-index: redirect.tab-index.verify","iteration":"cold","passId":"first-pass","scenarioId":"redirect.tab-index","semanticActionId":"redirect.tab-index.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":72.5,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":776,"forwardWorkMs":776,"navigationCommitMs":583.2…
11-24 14:38:57.717 E/unknown:ReactNative(19089): ?anon_0_@1:3694919
11-24 14:38:57.717 E/unknown:ReactNative(19089): ?anon_0_@1:3700719
11-24 14:38:57.717 E/unknown:ReactNative(19089): SyntheticError@1:163016
11-24 14:38:57.717 E/unknown:ReactNative(19089): Wrapper@1:163531
11-24 14:38:57.717 E/unknown:ReactNative(19089): _callSuper@1:148404
11-24 14:38:57.717 E/unknown:ReactNative(19089): _construct@1:163879
11-24 14:38:57.717 E/unknown:ReactNative(19089): _next@1:594867
```

### 90 audit 7 min
```
11-24 14:40:36.675 E/ReactNativeJS(19089): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwusp37g-ff33e2110e86f97e","check":{"id":"deep-repeat.sample.catalogue.1.product.lender.open","label":"sample.catalogue.1: product.lender.open (repeat)","kind":"journey","status":"fail","durationMs":1788,"metrics":{"journeyId":"sample.catalogue.1.product.lender.open","journeyLabel":"sample.catalogue.1: product.lender.open","iteration":"warm","passId":"repeat","scenarioId":"sample.catalogue.1","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/The%20Mac","expectedPath":"/bank/The%20Mac","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":19,"actionRevisionAfter":20,"actionResultEvidence":"{\"expectedPath\":\"/bank/The%20Mac\"}","actionMs":733.9,"preActionWaitMs":0.8,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"r…
11-24 14:40:36.676 E/unknown:ReactNative(19089): ?anon_0_@1:3694919
11-24 14:40:36.676 E/unknown:ReactNative(19089): ?anon_0_@1:3700719
11-24 14:40:36.676 E/unknown:ReactNative(19089): SyntheticError@1:163016
11-24 14:40:36.676 E/unknown:ReactNative(19089): Wrapper@1:163531
11-24 14:40:36.676 E/unknown:ReactNative(19089): _callSuper@1:148404
11-24 14:40:36.676 E/unknown:ReactNative(19089): _construct@1:163879
11-24 14:40:36.676 E/unknown:ReactNative(19089): _next@1:594867
```

### 91 audit 8 min
```
11-24 14:41:14.633 E/ReactNativeJS(19089): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwusp37g-ff33e2110e86f97e","check":{"id":"deep-repeat.route.projections.projections.open","label":"route.projections: projections.open (repeat)","kind":"journey","status":"fail","durationMs":1182.9,"metrics":{"journeyId":"route.projections.projections.open","journeyLabel":"route.projections: projections.open","iteration":"warm","passId":"repeat","scenarioId":"route.projections","semanticActionId":"projections.open","depth":0,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"projections.inputs","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":320.2,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":68.3,"forwardWorkMs":68.3,"navigationCommitMs":0,"firstReadyFrameMs":68.2,"firstReadyFrameObserved…
11-24 14:41:14.634 E/unknown:ReactNative(19089): ?anon_0_@1:3694919
11-24 14:41:14.634 E/unknown:ReactNative(19089): ?anon_0_@1:3700719
11-24 14:41:14.634 E/unknown:ReactNative(19089): SyntheticError@1:163016
11-24 14:41:14.634 E/unknown:ReactNative(19089): Wrapper@1:163531
11-24 14:41:14.634 E/unknown:ReactNative(19089): _callSuper@1:148404
11-24 14:41:14.634 E/unknown:ReactNative(19089): _construct@1:163879
11-24 14:41:14.634 E/unknown:ReactNative(19089): _next@1:594867
```

### 92 audit 10 min
```
11-24 14:42:49.567 E/ReactNativeJS(19089): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwusp37g-ff33e2110e86f97e","check":{"id":"external-link-28","kind":"network","status":"fail","durationMs":0.20204099989496171,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"fail","browserHandler":"unknown","httpReachability":"unknown","handlerAttempted":false,"httpAttempted":false,"httpSelected":true,"handlerResolution":"unresolved","host":"qrco.de","destinationPath":"/bgD4D4"},"error":"This website is not approved for this type of source.","canonicalMetrics":true}}
11-24 14:42:49.568 E/unknown:ReactNative(19089): ?anon_0_@1:3694919
11-24 14:42:49.568 E/unknown:ReactNative(19089): ?anon_0_@1:3704280
11-24 14:42:49.568 E/unknown:ReactNative(19089): SyntheticError@1:163016
11-24 14:42:49.568 E/unknown:ReactNative(19089): Wrapper@1:163531
11-24 14:42:49.568 E/unknown:ReactNative(19089): _callSuper@1:148404
11-24 14:42:49.568 E/unknown:ReactNative(19089): _construct@1:163879
11-24 14:42:49.568 E/unknown:ReactNative(19089): _next@1:594867
```
