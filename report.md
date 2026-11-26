# App explorer: 1.0.386 (442)

**Real-use session ATTENTION vs 1.0.385: 0 broken, 10 friction, 3 slower**

- Friction: No reaction for 3.2 s after "switch to savings"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 4.0 s after "open term deposits"
- Friction: No reaction for 3.0 s after "verify term deposit rates"
- Friction: No reaction for 4.7 s after "search Macquarie"
- Friction: No reaction for 3.3 s after "open mortgage filter draft"
- Friction: No reaction for 4.3 s after "open unsaved rate"
- Friction: No reaction for 7.6 s after "remove saved rate"
- Friction: No reaction for 5.0 s after "leave removed product"
- Friction: "No saved rates" shown on "leave removed product"
- Slower: "expand eligibility" content 0.0 s to 2.3 s
- Slower: "remove saved rate" content 2.5 s to 7.6 s
- Slower: "remove saved rate" reaction 2.5 s to 7.6 s

**Initial Rates readiness:** 21.8 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3752 bytes, latest published run date 2026-11-27

Mode full | 116 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 15
Baseline 1.0.385
**Audit live: outcome failed | 784 s | audit log 834721 bytes (audit-log.txt) https://paste.c-net.org/5b62fac3-52d5-0f7f-e09e-105dd3b7a095 | debug log 5697361 bytes read from host https://paste.c-net.org/6f9934ad-37dd-6a71-287f-231f326540d7**

Collection: complete | Coverage: incomplete | Details: complete

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 23509 | +20388 | 277/659 | 65 | 473 | 1 errors; start 2365ms; boot js-start 398731, layout-mounted 399205, cache-read 399514, hydrated 399964, splash-hide 399964, manifest 401002, resolved 401366, core-fetched 404114, core-saved 404566, search-index-idle 404899, leading-requested 404899, details-start 405272, leading-scoped 405417, pricing-ready 406222, details-fetched 411613, rows-prepared 414997, detail-filters-idle 414997, last-pricing 414997, suitability-built 415506, post-refresh-wait 415979, leading-page 416805, last-rows 420449, rates-ready 420550, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 130, pricing-scope-ms 6031, leading-gated 1, filter-runs 2, filter-rows 31912, filter-yields 5, filter-ms 102, sort-runs 4, sort-rows 1191, sort-yields 4, sort-ms 52 |
| 2 | scroll rates 1 | 5300 | +4584 | 30/75 | 57 | 548 |  |
| 3 | scroll rates 2 | 681 | -32 | 16/44 | 57 | 534 |  |
| 4 | scroll rates back | 681 | +4 |  |  | 533 |  |
| 5 | open product | 5718 | +5696 | 26/73 | 57 | 645 |  |
| 6 | scroll product | 725 | +12 | 21/68 | 61 | 688 |  |
| 7 | expand product facts | 16 | -4 | 26/83 | 65 | 681 |  |
| 8 | scroll product fees | 687 | -1 | 15/67 | 53 | 667 |  |
| 9 | scroll product eligibility | 685 | -33 | 17/69 | 57 | 670 |  |
| 10 | expand eligibility | 15 | +15 | 5/18 | 36 | 636 |  |
| 11 | expand constraints | 15 | -4 | 4/18 | 32 | 643 |  |
| 12 | scroll product sources | 713 | -52 | 16/51 | 53 | 648 |  |
| 13 | back to rates | 17 | -12 | 10/26 | 57 | 637 |  |
| 14 | open lenders | 16 | -7 | 16/26 | 150 | 646 |  |
| 15 | scroll lenders | 701 | -5 | 14/22 | 97 | 642 |  |
| 16 | back from lenders | 15 | -8 | 8/11 | 85 | 644 |  |
| 17 | switch to savings | 17 | -8 | 21/57 | 57 | 653 |  |
| 18 | switch to home loans | 19 | -4 | 12/35 | 40 | 665 |  |
| 19 | open filters | 16 | -5 | 24/31 | 105 | 667 |  |
| 20 | close filters | 17 | -4 | 8/10 | 150 | 666 |  |
| 21 | open market | 16 | -8 | 15/35 | 53 | 668 |  |
| 22 | open rba | 2428 | -176 | 37/88 | 48 | 687 |  |
| 23 | scroll rba | 706 | +6 | 19/68 | 48 | 679 |  |
| 24 | back from rba | 18 | -7 | 7/21 | 44 | 679 |  |
| 25 | scroll market | 694 | -4 | 16/51 | 57 | 678 |  |
| 26 | open saved | 15 | -12 | 7/20 | 57 | 686 |  |
| 27 | return to rates | 16 | -8 | 10/33 | 44 | 684 |  |
| 28 | start category switch | 18 | -15 |  |  | 684 |  |
| 29 | open term deposits | 16 | -7 | 39/81 | 65 | 703 |  |
| 30 | verify term deposit rates | 701 | -20 | 25/64 | 61 | 704 |  |
| 31 | restore home loans | 15 | -6 | 10/33 | 42 | 714 |  |
| 32 | start search from rates | 19 | -5 |  |  | 710 |  |
| 33 | open savings search | 16 | -5 | 14/35 | 40 | 727 |  |
| 34 | search Macquarie | 1115 | -761 | 49/58 | 101 | 739 |  |
| 35 | verify Macquarie result | 1 | +1 | 13/14 | 16 | 724 | 1 errors |
| 36 | clear query and restore results | 16 | -11 | 16/19 | 32 | 728 |  |
| 37 | return from savings search | 17 | -5 | 24/42 | 81 | 759 |  |
| 38 | start filter rollback | 20 | -30 | 12/14 | 17 | 751 |  |
| 39 | open mortgage filter draft | 16 | -8 | 25/32 | 150 | 764 |  |
| 40 | select fixed in draft | 16 | -6 | 8/11 | 113 | 766 |  |
| 41 | discard unsaved filter draft | 15 | -7 | 19/23 | 65 | 769 |  |
| 42 | verify fixed was not applied | 16 | -5 | 23/28 | 200 | 783 | 1 errors |
| 43 | close verified filter draft | 15 | -7 | 16/23 | 73 | 775 |  |
| 44 | start save from rates | 19 | -5 | 12/15 | 16 | 773 | 1 errors |
| 45 | open unsaved rate | 16 | -7 | 31/67 | 73 | 810 | 1 errors |
| 46 | save a rate | 16 | -7 | 7/17 | 48 | 807 |  |
| 47 | leave saved product | 16 | -5 | 13/25 | 57 | 810 |  |
| 48 | restart with a saved rate | 10451 | -7303 | 84/203 | 65 | 413 | 1 errors; start 4463ms; boot js-start 833637, layout-mounted 833967, hydrated 834013, cache-read 835593, core-ready 836022, rows-prepared 836108, search-index-idle 836108, detail-filters-idle 836108, leading-requested 836108, last-pricing 836108, splash-hide 836109, manifest 837347, leading-scoped 838086, leading-page 838086, resolved 838744, pricing-ready 839984, last-rows 839984, rates-ready 840084, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 19, pricing-scope-ms 2953, filter-runs 1, filter-rows 6944, filter-yields 3, filter-ms 55, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 9 |
| 49 | verify saved rate after restart | 17 | -10 | 16/39 | 48 | 517 |  |
| 50 | open product from saved rates | 16 | -10 | 30/73 | 65 | 642 |  |
| 51 | remove saved rate | 4283 | +4255 | 5/19 | 53 | 694 |  |
| 52 | leave removed product | 2174 | -17977 | 4/12 | 48 | 709 |  |
| 53 | follow browse rates recovery | 16 |  | 13/29 | 53 | 692 |  |
| 54 | start compare from rates | 19 | -14 |  |  | 697 |  |
| 55 | enter selection mode | 16 | -4938 | 5/16 | 38 | 703 |  |
| 56 | select first comparison rate | 15 | -8 | 5/16 | 34 | 697 |  |
| 57 | select second comparison rate | 15 | -8 | 5/16 | 36 | 699 |  |
| 58 | open two-rate comparison | 16 | -5 | 17/39 | 73 | 712 |  |
| 59 | return from two-rate comparison | 18 | -5 | 14/35 | 77 | 713 |  |
| 60 | cold start | 13000 | +2759 | 32/49 | 150 | 441 | 17 errors; start 2699ms; boot js-start 945490, layout-mounted 945623, hydrated 945646, cache-read 946413, core-ready 946849, rows-prepared 946947, search-index-idle 946947, detail-filters-idle 946947, leading-requested 946947, last-pricing 946947, splash-hide 946948, leading-scoped 948166, leading-page 948166, pricing-ready 948575, last-rows 948575, rates-ready 948896, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 10, pricing-scope-ms 1014, filter-runs 1, filter-rows 6944, filter-yields 6, filter-ms 161, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 17 |
| 61 | /browse | 20 | -4484 |  |  | 533 |  |
| 62 | /watchlist | 21 | -15 | 2/3 | 20 | 592 |  |
| 63 | /market | 24 | -4 |  |  | 607 |  |
| 64 | /tools | 20 | -13 | 13/27 | 61 | 630 |  |
| 65 | /trends | 26 | +4 | 14/34 | 61 | 636 |  |
| 66 | /search | 2148 | -82 | 22/35 | 105 | 658 |  |
| 67 | /banks | 21 | -6 | 22/41 | 85 | 646 |  |
| 68 | /bank-rates | 17 | -9 | 12/29 | 48 | 656 |  |
| 69 | /categories | 20 | -3 | 28/50 | 77 | 694 |  |
| 70 | /catalogue | 26 | -4 | 25/49 | 77 | 697 |  |
| 71 | /compare | 17 | -8 | 11/19 | 97 | 703 |  |
| 72 | /matches | 18 | -7 | 26/43 | 69 | 701 |  |
| 73 | /calculator | 18 | -9 | 9/26 | 69 | 689 |  |
| 74 | /projections | 24 | 0 | 13/34 | 61 | 691 |  |
| 75 | /profile | 19 | -4 | 9/29 | 61 | 695 |  |
| 76 | /research | 26 | +3 | 12/31 | 48 | 704 |  |
| 77 | /rba | 20 | -6 | 8/26 | 85 | 718 |  |
| 78 | /rba-response | 23 | -2 | 10/32 | 48 | 717 |  |
| 79 | /settings | 21 | -5 | 10/30 | 53 | 722 |  |
| 80 | /about | 23 | -9 | 8/27 | 48 | 723 |  |
| 81 | /terms | 17 | -17 | 7/26 | 46 | 724 |  |
| 82 | /privacy | 17 | -14 |  |  | 723 |  |
| 83 | /third-party-notices | 21 | -9 | 9/26 | 61 | 727 |  |
| 84 | /node | 21 | -10 | 24/50 | 73 | 745 |  |
| 85 | /passthrough | 19 | -11 | 19/47 | 65 | 729 |  |
| 86 | /calculation-receipt | 17 | -14 | 7/26 | 44 | 721 |  |
| 87 | /rate-receipt | 18 | -15 | 6/11 | 48 | 721 |  |
| 88 | warm resume | 422 | +269 | 4/5 | 93 | 720 | start 164ms |
| 89 | cold relaunch | 7625 | -2614 | 26/35 | 93 | 416 | 1 errors; start 2512ms; boot js-start 1159740, layout-mounted 1159871, hydrated 1159871, cache-read 1160653, core-ready 1161082, rows-prepared 1161166, search-index-idle 1161166, detail-filters-idle 1161166, leading-requested 1161166, last-pricing 1161166, splash-hide 1161167, manifest 1162474, leading-scoped 1162713, leading-page 1162713, resolved 1163050, pricing-ready 1163126, last-rows 1163126, rates-ready 1163677, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 20, pricing-scope-ms 873, filter-runs 3, filter-rows 38856, filter-yields 5, filter-cancels 1, filter-ms 146, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 10 |
| 90 | about | 27 | -3 | 7/22 | 46 | 481 |  |
| 91 | audit screen | 14 | -6 | 69/245 | 44 | 606 |  |
| 92 | audit 0 min | 0 | 0 | 494/688 | 81 | 864 | 80 errors |
| 93 | audit 2 min | 0 | 0 | 934/1218 | 85 | 1062 | 80 errors |
| 94 | audit 3 min | 0 |  | 509/701 | 81 | 1186 | 80 errors |
| 95 | audit 5 min | 0 |  | 1059/1409 | 85 | 1327 | 80 errors |
| 96 | audit 6 min | 0 | 0 | 817/1145 | 81 | 1348 | 80 errors |
| 97 | audit 8 min | 0 | 0 | 811/1133 | 81 | 1402 | 80 errors |
| 98 | audit 9 min | 0 | 0 | 162/228 | 61 | 1230 | 80 errors |
| 99 | audit 11 min | 0 |  | 135/186 | 32 | 1248 |  |
| 100 | audit 12 min | 0 | 0 | 73/106 | 44 | 1258 |  |
| 101 | audit finished | 0 | 0 | 74/252 | 48 | 1238 |  |
| 102 | audit result 1 | 0 | 0 |  |  | 1226 |  |
| 103 | audit result 2 | 0 | 0 |  |  | 1228 |  |
| 104 | audit result 3 | 0 | 0 |  |  | 1226 |  |
| 105 | audit result 4 | 0 | 0 |  |  | 1226 |  |
| 106 | audit result 5 | 0 | 0 |  |  | 1227 |  |
| 107 | audit result 6 | 0 | 0 |  |  | 1228 |  |
| 108 | audit result 7 | 0 | 0 |  |  | 1229 |  |
| 109 | audit result 8 | 0 | 0 |  |  | 1227 |  |
| 110 | audit result 9 | 0 | 0 |  |  | 1230 |  |
| 111 | audit result 10 | 0 | 0 |  |  | 1228 |  |
| 112 | audit result 11 | 0 | 0 |  |  | 1228 |  |
| 113 | audit result 12 | 0 | 0 |  |  | 1229 |  |
| 114 | about for debug log | 21 | -3211 | 6/27 | 48 | 1235 |  |
| 115 | debug log screen | 0 | 0 | 52/257 | 36 | 1238 |  |
| 116 | debug log uploaded | 0 | 0 | 24/34 | 73 | 1494 |  |

## Errors

### 1 open app
```
11-26 18:55:30.051 E/australianrates(11076): Not starting debugger since process cannot load the jdwp agent.
```

### 35 verify Macquarie result
```
11-26 19:01:02.867 E/FrameTracker(11076): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 42 verify fixed was not applied
```
11-26 19:01:59.931 E/FrameTracker(11076): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 44 start save from rates
```
11-26 19:02:15.884 E/FrameTracker(11076): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 open unsaved rate
```
11-26 19:02:20.588 E/ImeBackDispatcher(11076): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 143749732
```

### 48 restart with a saved rate
```
11-26 19:02:44.776 E/australianrates(16411): Not starting debugger since process cannot load the jdwp agent.
```

### 60 cold start
```
11-26 19:04:37.380 E/australianrates(17851): Not starting debugger since process cannot load the jdwp agent.
11-26 19:04:39.817 W/ReactNativeJS(17851): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-26 19:04:40.712 W/ReactNativeJS(17851): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-26 19:04:41.962 E/ReactNativeJS(17851): [AR error] store: refresh failed: asset HTTP 502
11-26 19:04:41.962 W/ReactNativeJS(17851): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-26 19:04:41.965 E/unknown:ReactNative(17851): ?anon_0_@1:2033660
11-26 19:04:41.965 E/unknown:ReactNative(17851): SyntheticError@1:163048
11-26 19:04:41.965 E/unknown:ReactNative(17851): Wrapper@1:163563
```

### 89 cold relaunch
```
11-26 19:08:11.673 E/australianrates(21051): Not starting debugger since process cannot load the jdwp agent.
```

### 92 audit 0 min
```
11-26 19:09:12.184 E/ReactNativeJS(21051): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxxerpv-3deac559fa29c887","check":{"id":"manifest-network","label":"Live-source publication validation","kind":"network","status":"fail","durationMs":4878.1,"metrics":{"executionAttempted":true,"allowlistedSource":true,"validationStatus":"pass","performanceStatus":"fail","manifestValidated":true,"datesIndexValidated":true,"coreHashValidated":true,"detailsHashValidated":true,"nonTimingFailure":false,"liveStage:manifest:fetched:ms":218.7,"liveStage:dates-index:fetched:ms":300.5,"liveStage:revision:verified:ms":36.6,"liveStage:Core asset:downloaded:ms":149.5,"liveStage:Core asset:hash-verified:ms":13.4,"liveStage:Core asset:native-inflated-and-text-decoded:ms":107,"liveStage:Core asset:inflated:ms":0,"liveStage:Core asset:text-decoded:ms":0,"liveStage:Core asset:decoded:ms":120.7,"liveStage:core:history-sealed:ms":0.1,"liveStage:core:normalized:ms":341.7,"liveStage:Details asset:downloaded:ms":758.6,"liveStage:Details asset:hash-verified:ms":18.7,"liveStag…
11-26 19:09:12.185 E/unknown:ReactNative(21051): ?anon_0_@1:3699228
11-26 19:09:12.185 E/unknown:ReactNative(21051): ?anon_0_@1:3705028
11-26 19:09:12.185 E/unknown:ReactNative(21051): SyntheticError@1:163048
11-26 19:09:12.185 E/unknown:ReactNative(21051): Wrapper@1:163563
11-26 19:09:12.185 E/unknown:ReactNative(21051): _callSuper@1:148436
11-26 19:09:12.185 E/unknown:ReactNative(21051): _construct@1:163911
11-26 19:09:12.185 E/unknown:ReactNative(21051): _next@1:594899
```

### 93 audit 2 min
```
11-26 19:09:58.690 E/ReactNativeJS(21051): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxxerpv-3deac559fa29c887","check":{"id":"journey-rates-warm","label":"Rates (warm)","kind":"journey","status":"fail","durationMs":1649.2,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":877.5,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"searchMode":"deep","deepSearchAvailable":true,"journeyId":"rates","journeyLabel":"Rates","iteration":"warm","expectedPath":"/browse","expectedSurface":"rates.results","navigationKind":"tab","forwardMs":877.5,"firstReadyFrameObserved":true,"firstReadyFrameMs":259.36144699994475,"backgroundSettleMs":549.6,"destinationReadinessMs":259.4,"backgroundTasks":"Product details, Search index availability","backMs":34.7,"firstBackMs":34.7,"firstBackDestination":"/performance-audit","origi…
11-26 19:09:58.692 E/unknown:ReactNative(21051): ?anon_0_@1:3699228
11-26 19:09:58.692 E/unknown:ReactNative(21051): ?anon_0_@1:3705028
11-26 19:09:58.692 E/unknown:ReactNative(21051): SyntheticError@1:163048
11-26 19:09:58.692 E/unknown:ReactNative(21051): Wrapper@1:163563
11-26 19:09:58.692 E/unknown:ReactNative(21051): _callSuper@1:148436
11-26 19:09:58.692 E/unknown:ReactNative(21051): _construct@1:163911
11-26 19:09:58.692 E/unknown:ReactNative(21051): _next@1:594899
```

### 94 audit 3 min
```
11-26 19:11:40.343 E/ReactNativeJS(21051): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxxerpv-3deac559fa29c887","check":{"id":"deep-first-pass.route.product-calculation.product.open","label":"route.product-calculation: product.open (first-pass)","kind":"journey","status":"fail","durationMs":1866.4,"metrics":{"journeyId":"route.product-calculation.product.open","journeyLabel":"route.product-calculation: product.open","iteration":"cold","passId":"first-pass","scenarioId":"route.product-calculation","semanticActionId":"product.open","depth":0,"plannedExpectedPath":"/product/Great%20Southern%20Bank%7C2000-2600%7CTRANS_AND_SAVINGS_ACCOUNTS%7CEveryday%2050%2B%20Account","expectedPath":"/product/Great%20Southern%20Bank%7C2000-2600%7CTRANS_AND_SAVINGS_ACCOUNTS%7CEveryday%2050%2B%20Account","expectedSurface":"product.details","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":269.5,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries"…
11-26 19:11:40.344 E/unknown:ReactNative(21051): ?anon_0_@1:3699228
11-26 19:11:40.344 E/unknown:ReactNative(21051): ?anon_0_@1:3705028
11-26 19:11:40.344 E/unknown:ReactNative(21051): SyntheticError@1:163048
11-26 19:11:40.344 E/unknown:ReactNative(21051): Wrapper@1:163563
11-26 19:11:40.344 E/unknown:ReactNative(21051): _callSuper@1:148436
11-26 19:11:40.344 E/unknown:ReactNative(21051): _construct@1:163911
11-26 19:11:40.344 E/unknown:ReactNative(21051): _next@1:594899
```

### 95 audit 5 min
```
11-26 19:12:59.974 E/ReactNativeJS(21051): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxxerpv-3deac559fa29c887","check":{"id":"deep-first-pass.route.outlook.outlook.snapshot.browse.first","label":"route.outlook: outlook.snapshot.browse.first (first-pass)","kind":"journey","status":"fail","durationMs":1450.3,"metrics":{"journeyId":"route.outlook.outlook.snapshot.browse.first","journeyLabel":"route.outlook: outlook.snapshot.browse.first","iteration":"cold","passId":"first-pass","scenarioId":"route.outlook","semanticActionId":"outlook.snapshot.browse.first","depth":2,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"outlook.dashboard","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":8,"actionRevisionAfter":9,"renderRevisionBefore":"2026-11-27:Savings:race:All:2026-11-26","actionResultEvidence":"{\"expectedPath\":\"/browse\"}","actionMs":43.2,"preActionWaitMs":0.9,"preActionQuietWindowReused":false,"preActi…
11-26 19:12:59.975 E/unknown:ReactNative(21051): ?anon_0_@1:3699228
11-26 19:12:59.975 E/unknown:ReactNative(21051): ?anon_0_@1:3705028
11-26 19:12:59.975 E/unknown:ReactNative(21051): SyntheticError@1:163048
11-26 19:12:59.975 E/unknown:ReactNative(21051): Wrapper@1:163563
11-26 19:12:59.975 E/unknown:ReactNative(21051): _callSuper@1:148436
11-26 19:12:59.975 E/unknown:ReactNative(21051): _construct@1:163911
11-26 19:12:59.975 E/unknown:ReactNative(21051): _next@1:594899
```

### 96 audit 6 min
```
11-26 19:14:31.615 E/ReactNativeJS(21051): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxxerpv-3deac559fa29c887","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.open","label":"route.rates-mortgage-scope: search.open (repeat)","kind":"journey","status":"fail","durationMs":6279.4,"metrics":{"journeyId":"route.rates-mortgage-scope.search.open","journeyLabel":"route.rates-mortgage-scope: search.open","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.open","depth":0,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":217.4,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":5393.2,"forwardWorkMs":5393.2,"navigationCommitMs":359.1,"firstReadyFrameMs":5034,"firstRea…
11-26 19:14:31.616 E/unknown:ReactNative(21051): ?anon_0_@1:3699228
11-26 19:14:31.616 E/unknown:ReactNative(21051): ?anon_0_@1:3705028
11-26 19:14:31.616 E/unknown:ReactNative(21051): SyntheticError@1:163048
11-26 19:14:31.616 E/unknown:ReactNative(21051): Wrapper@1:163563
11-26 19:14:31.616 E/unknown:ReactNative(21051): _callSuper@1:148436
11-26 19:14:31.616 E/unknown:ReactNative(21051): _construct@1:163911
11-26 19:14:31.616 E/unknown:ReactNative(21051): _next@1:594899
```

### 97 audit 8 min
```
11-26 19:16:05.164 E/ReactNativeJS(21051): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxxerpv-3deac559fa29c887","check":{"id":"deep-repeat.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (repeat)","kind":"journey","status":"fail","durationMs":1254.2,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Great%20Southern%20Bank%7C2000-2600%7CTRANS_AND_SAVINGS_ACCOUNTS%7CEveryday%2050%2B%20Account","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":16,"actionRevisionAfter":17,"render…
11-26 19:16:05.165 E/unknown:ReactNative(21051): ?anon_0_@1:3699228
11-26 19:16:05.165 E/unknown:ReactNative(21051): ?anon_0_@1:3705028
11-26 19:16:05.165 E/unknown:ReactNative(21051): SyntheticError@1:163048
11-26 19:16:05.165 E/unknown:ReactNative(21051): Wrapper@1:163563
11-26 19:16:05.165 E/unknown:ReactNative(21051): _callSuper@1:148436
11-26 19:16:05.165 E/unknown:ReactNative(21051): _construct@1:163911
11-26 19:16:05.165 E/unknown:ReactNative(21051): _next@1:594899
```

### 98 audit 9 min
```
11-26 19:17:33.524 E/ReactNativeJS(21051): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwxxerpv-3deac559fa29c887","check":{"id":"deep-repeat.redirect.tab-index.redirect.tab-index.verify","label":"redirect.tab-index: redirect.tab-index.verify (repeat)","kind":"journey","status":"fail","durationMs":1710.2,"metrics":{"journeyId":"redirect.tab-index.redirect.tab-index.verify","journeyLabel":"redirect.tab-index: redirect.tab-index.verify","iteration":"warm","passId":"repeat","scenarioId":"redirect.tab-index","semanticActionId":"redirect.tab-index.verify","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":258.3,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":799.7,"forwardWorkMs":799.7,"navigationCommitMs":608.3,"first…
11-26 19:17:33.525 E/unknown:ReactNative(21051): ?anon_0_@1:3699228
11-26 19:17:33.525 E/unknown:ReactNative(21051): ?anon_0_@1:3705028
11-26 19:17:33.525 E/unknown:ReactNative(21051): SyntheticError@1:163048
11-26 19:17:33.525 E/unknown:ReactNative(21051): Wrapper@1:163563
11-26 19:17:33.525 E/unknown:ReactNative(21051): _callSuper@1:148436
11-26 19:17:33.525 E/unknown:ReactNative(21051): _construct@1:163911
11-26 19:17:33.525 E/unknown:ReactNative(21051): _next@1:594899
```
