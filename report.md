# App explorer: 1.0.360 (416)

**Real-use session ATTENTION vs 1.0.360: 0 broken, 10 friction, 5 slower**

- Friction: No reaction for 3.5 s after "scroll rates 1"
- Friction: No reaction for 3.2 s after "scroll rates 2"
- Friction: No reaction for 4.0 s after "open product"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 4.9 s after "switch to savings"
- Friction: No reaction for 3.0 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Slower: Dropped frames 65% to 83% on "open app"
- Slower: Dropped frames 57% to 79% on "scroll rates 2"
- Slower: "open product" reaction 2.6 s to 4.0 s
- Slower: Dropped frames 52% to 71% on "back to rates"
- Slower: Dropped frames 50% to 71% on "scroll rba"

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode full | 81 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 15
Baseline 1.0.360
**Audit live: outcome completed | 1019 s | audit log 841650 bytes (audit-log.txt) https://paste.c-net.org/8371d1f9-8f9d-2b30-0b7c-3ec4e8ca3305 | debug log Upload and copy link not found**

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 2974 | +90 | 627/758 | 97 | 492 | 1 errors; start 2913ms |
| 2 | scroll rates 1 | 696 | -32 | 32/45 | 97 | 589 | boot js-start 445282, layout-mounted 446104, cache-read 446252, hydrated 446523, splash-hide 446523, manifest 447967, resolved 448929, core-fetched 453728, core-saved 454817, rows-prepared 455015, search-index-idle 455015, leading-requested 455015, details-start 455444, leading-scoped 455527, pricing-ready 456668, last-gate 456934, details-fetched 465999, detail-filters-idle 473111, last-pricing 473111, suitability-built 474274, post-refresh-wait 474706, leading-page 476409, last-rows 485292, rates-ready 485524, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 186, pricing-scope-ms 12435, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 3, filter-rows 38533, filter-yields 7, filter-ms 217, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 49 |
| 3 | scroll rates 2 | 747 | +13 | 22/28 | 89 | 653 |  |
| 4 | scroll rates back | 678 | -11 |  |  | 542 |  |
| 5 | open product | 24 | -5335 | 42/58 | 105 | 621 | 3 errors |
| 6 | scroll product | 721 | -9 | 36/49 | 85 | 657 |  |
| 7 | back to rates | 29 | -5 | 15/21 | 85 | 650 |  |
| 8 | open lenders | 24 | -2 | 20/23 | 250 | 646 |  |
| 9 | scroll lenders | 704 | -117 | 17/19 | 150 | 643 |  |
| 10 | back from lenders | 22 | -5 | 7/8 | 150 | 644 |  |
| 11 | switch to savings | 23 | -1 | 64/81 | 93 | 658 |  |
| 12 | switch to home loans | 24 | -6 | 19/29 | 81 | 674 |  |
| 13 | open filters | 23 | -2 | 22/25 | 150 | 678 |  |
| 14 | close filters | 22 | -3 | 7/8 | 125 | 673 |  |
| 15 | open market | 23 | 0 | 21/28 | 77 | 675 |  |
| 16 | open rba | 2720 | -61 | 63/71 | 85 | 689 |  |
| 17 | scroll rba | 717 | +34 | 35/49 | 89 | 683 |  |
| 18 | back from rba | 23 | -2 | 13/18 | 77 | 684 |  |
| 19 | scroll market | 783 | +48 | 22/35 | 105 | 683 |  |
| 20 | open saved | 21 | -8 | 10/13 | 101 | 686 |  |
| 21 | return to rates | 23 | -5 | 19/30 | 117 | 688 |  |
| 22 | cold start | 10487 | +1140 | 32/37 | 109 | 585 | 3 errors; start 4369ms; boot js-start 677018, layout-mounted 677218, hydrated 677253, cache-read 678553, core-ready 679250, rows-prepared 679356, search-index-idle 679356, detail-filters-idle 679356, leading-requested 679356, last-pricing 679356, splash-hide 679357, manifest 681516, leading-scoped 681904, leading-page 681904, resolved 682397, pricing-ready 683190, last-rows 683190, rates-ready 683368, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 20, pricing-scope-ms 1559, filter-runs 1, filter-rows 6861, filter-yields 4, filter-ms 101, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 14 |
| 23 | /browse | 4565 |  | 2/2 | 32 | 437 |  |
| 24 | /watchlist | 34 |  | 2/3 | 32 | 446 |  |
| 25 | /market | 23 |  | 15/21 | 61 | 535 |  |
| 26 | /tools | 30 |  | 13/20 | 250 | 601 |  |
| 27 | /trends | 37 |  |  |  | 611 |  |
| 28 | /search | 35 |  | 32/43 | 150 | 618 |  |
| 29 | /banks | 38 |  | 31/40 | 125 | 631 |  |
| 30 | /bank-rates | 36 |  | 19/29 | 93 | 641 |  |
| 31 | /categories | 31 |  | 32/42 | 109 | 655 |  |
| 32 | /catalogue | 37 |  | 31/36 | 121 | 679 |  |
| 33 | /compare | 39 |  | 13/15 | 150 | 660 |  |
| 34 | /matches | 24 |  | 38/45 | 105 | 677 |  |
| 35 | /calculator | 30 |  | 16/19 | 101 | 663 |  |
| 36 | /projections | 33 |  | 26/34 | 105 | 665 |  |
| 37 | /profile | 30 |  | 19/24 | 73 | 670 |  |
| 38 | /research | 28 |  | 21/27 | 85 | 681 |  |
| 39 | /rba | 31 |  | 14/23 | 117 | 697 |  |
| 40 | /rba-response | 32 |  | 19/28 | 85 | 699 |  |
| 41 | /settings | 25 |  | 14/22 | 77 | 709 |  |
| 42 | /about | 33 |  | 14/21 | 93 | 711 |  |
| 43 | /terms | 27 |  | 13/20 | 93 | 714 |  |
| 44 | /privacy | 26 |  |  |  | 715 |  |
| 45 | /third-party-notices | 34 |  | 15/21 | 85 | 719 |  |
| 46 | /node | 25 |  | 35/45 | 117 | 749 |  |
| 47 | /passthrough | 29 |  | 35/45 | 113 | 728 |  |
| 48 | /calculation-receipt | 35 |  | 15/24 | 77 | 723 |  |
| 49 | /rate-receipt | 28 |  | 7/9 | 85 | 725 |  |
| 50 | warm resume | 283 |  | 4/4 | 81 | 724 |  |
| 51 | cold relaunch | 13469 |  | 39/51 | 117 | 584 | 17 errors; start 3907ms; boot js-start 911532, layout-mounted 911732, hydrated 911765, cache-read 913050, core-ready 913751, rows-prepared 913870, search-index-idle 913870, detail-filters-idle 913870, leading-requested 913870, last-pricing 913870, splash-hide 913872, leading-scoped 916345, leading-page 916345, pricing-ready 917053, last-rows 917053, rates-ready 917283, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 15, pricing-scope-ms 1013, filter-runs 1, filter-rows 6861, filter-yields 5, filter-ms 146, sort-runs 1, sort-rows 1175, sort-yields 1, sort-ms 16 |
| 52 | about | 27 | -4 | 14/19 | 300 | 409 |  |
| 53 | audit screen | 20 | -3 | 142/219 | 73 | 607 |  |
| 54 | audit 0 min | 0 |  | 409/451 | 121 | 739 | 80 errors |
| 55 | audit 2 min | 0 |  | 650/715 | 121 | 869 | 80 errors |
| 56 | audit 3 min | 0 | 0 | 1038/1133 | 125 | 984 | 80 errors |
| 57 | audit 4 min | 0 | 0 | 141/155 | 117 | 1003 | 80 errors |
| 58 | audit 5 min | 0 |  | 685/747 | 121 | 1096 | 80 errors |
| 59 | audit 7 min | 0 |  | 514/542 | 133 | 1023 | 80 errors |
| 60 | audit 8 min | 0 | 0 | 214/227 | 129 | 1035 | 80 errors |
| 61 | audit 9 min | 0 | 0 | 925/1001 | 117 | 1090 | 80 errors |
| 62 | audit 10 min | 0 | 0 | 681/760 | 117 | 1224 | 80 errors |
| 63 | audit 11 min | 0 |  | 488/535 | 133 | 1182 | 80 errors |
| 64 | audit 13 min | 0 | 0 | 117/133 | 34 | 1065 | 19 errors |
| 65 | audit 14 min | 0 |  | 153/178 | 42 | 1088 |  |
| 66 | audit 16 min | 0 |  | 122/142 | 73 | 1218 |  |
| 67 | audit finished | 0 | 0 | 119/170 | 73 | 1068 |  |
| 68 | audit result 1 | 0 | 0 |  |  | 1064 |  |
| 69 | audit result 2 | 0 | 0 |  |  | 1064 |  |
| 70 | audit result 3 | 0 | 0 |  |  | 1066 |  |
| 71 | audit result 4 | 0 | 0 |  |  | 1064 |  |
| 72 | audit result 5 | 0 | 0 |  |  | 1067 |  |
| 73 | audit result 6 | 0 | 0 |  |  | 1065 |  |
| 74 | audit result 7 | 0 | 0 |  |  | 1065 |  |
| 75 | audit result 8 | 0 | 0 |  |  | 1069 |  |
| 76 | audit result 9 | 0 | 0 |  |  | 1067 |  |
| 77 | audit result 10 | 0 | 0 |  |  | 1069 |  |
| 78 | audit result 11 | 0 | 0 |  |  | 1067 |  |
| 79 | audit result 12 | 0 | 0 |  |  | 1067 |  |
| 80 | about for debug log | 3643 | +28 | 27/38 | 121 | 1108 |  |
| 81 | debug log screen | 0 | 0 | 116/191 | 69 | 1114 |  |

## Fatal lines
```
54 E/ReactNativeJS(15942): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtqan2v-22d441b7d962a627","check":{"id":"manifest-network","label":"Live-source manifest transport","kind":"network","status":"fail","durationMs":528.2,"metrics":{"executionAttempted":true,"allowlistedSource":true},"error":"Error: Live-source publication validation failed: Error: Live manifest returned HTTP 502\\n    at ?anon_0_ (address at index.android.bundle:1:3730156)\\n    at next (native)\\n    at asyncGeneratorStep (address at index.android.bundle:1:594609)\\n    at _next (address at index.android.bundle:1:594867)\\n    at tryCallOne (address at InternalBytecode.js:1:1180)\\n    at anonymous (address at InternalBytecode.js:1:1874)\\n    at ?anon_0_ (address at index.android.bundle:1:3625301)\\n    at throw (native)\\n    at asyncGeneratorStep (address at index.android.bundle:1:594609)\\n    at _throw (address at index.android.bundle:1:594914)\\n    at tryCallOne (address at InternalBytecode.js:1:1180)\\n    at anonymous (address at InternalByteco…
54 E/unknown:ReactNative(15942): console.error: [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtqan2v-22d441b7d962a627","check":{"id":"manifest-network","label":"Live-source manifest transport","kind":"network","status":"fail","durationMs":528.2,"metrics":{"executionAttempted":true,"allowlistedSource":true},"error":"Error: Live-source publication validation failed: Error: Live manifest returned HTTP 502\\n    at ?anon_0_ (address at index.android.bundle:1:3730156)\\n    at next (native)\\n    at asyncGeneratorStep (address at index.android.bundle:1:594609)\\n    at _next (address at index.android.bundle:1:594867)\\n    at tryCallOne (address at InternalBytecode.js:1:1180)\\n    at anonymous (address at InternalBytecode.js:1:1874)\\n    at ?anon_0_ (address at index.android.bundle:1:3625301)\\n    at throw (native)\\n    at asyncGeneratorStep (address at index.android.bundle:1:594609)\\n    at _throw (address at index.android.bundle:1:594914)\\n    at tryCallOne (address at InternalBytecode.js:1:1180)\\n    at anonymous (address at InternalByteco…, stack:
```

## Errors

### 1 open app
```
11-23 20:29:56.856 E/australianrates(10737): Not starting debugger since process cannot load the jdwp agent.
```

### 5 open product
```
11-23 20:31:09.862 W/ReactNativeJS(10737): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-23 20:31:10.697 W/ReactNativeJS(10737): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-23 20:31:12.855 W/ReactNativeJS(10737): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
```

### 22 cold start
```
11-23 20:33:49.113 E/australianrates(12990): Not starting debugger since process cannot load the jdwp agent.
11-23 20:33:53.409 E/SurfaceSyncGroup(12990): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-23 20:33:53.410 E/SurfaceSyncGroup(12990): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```

### 51 cold relaunch
```
11-23 20:37:43.794 E/australianrates(15942): Not starting debugger since process cannot load the jdwp agent.
11-23 20:37:48.903 W/ReactNativeJS(15942): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-23 20:37:49.821 W/ReactNativeJS(15942): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-23 20:37:50.842 E/ReactNativeJS(15942): [AR error] store: refresh failed: asset HTTP 502
11-23 20:37:50.842 W/ReactNativeJS(15942): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-23 20:37:50.843 E/unknown:ReactNative(15942): ?anon_0_@1:2027514
11-23 20:37:50.843 E/unknown:ReactNative(15942): SyntheticError@1:163016
11-23 20:37:50.843 E/unknown:ReactNative(15942): Wrapper@1:163531
```

### 54 audit 0 min
```
11-23 20:39:01.003 E/ReactNativeJS(15942): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtqan2v-22d441b7d962a627","check":{"id":"manifest-network","label":"Live-source manifest transport","kind":"network","status":"fail","durationMs":528.2,"metrics":{"executionAttempted":true,"allowlistedSource":true},"error":"Error: Live-source publication validation failed: Error: Live manifest returned HTTP 502\\n    at ?anon_0_ (address at index.android.bundle:1:3730156)\\n    at next (native)\\n    at asyncGeneratorStep (address at index.android.bundle:1:594609)\\n    at _next (address at index.android.bundle:1:594867)\\n    at tryCallOne (address at InternalBytecode.js:1:1180)\\n    at anonymous (address at InternalBytecode.js:1:1874)\\n    at ?anon_0_ (address at index.android.bundle:1:3625301)\\n    at throw (native)\\n    at asyncGeneratorStep (address at index.android.bundle:1:594609)\\n    at _throw (address at index.android.bundle:1:594914)\\n    at tryCallOne (address at InternalBytecode.js:1:1180)\\n    at anonymous (address at InternalByteco…
11-23 20:39:01.009 E/unknown:ReactNative(15942): ?anon_0_@1:3693367
11-23 20:39:01.009 E/unknown:ReactNative(15942): ?anon_0_@1:3699167
11-23 20:39:01.009 E/unknown:ReactNative(15942): SyntheticError@1:163016
11-23 20:39:01.009 E/unknown:ReactNative(15942): Wrapper@1:163531
11-23 20:39:01.009 E/unknown:ReactNative(15942): _callSuper@1:148404
11-23 20:39:01.009 E/unknown:ReactNative(15942): _construct@1:163879
11-23 20:39:01.009 E/unknown:ReactNative(15942): _next@1:594867
```

### 55 audit 2 min
```
11-23 20:39:49.770 E/ReactNativeJS(15942): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtqan2v-22d441b7d962a627","check":{"id":"journey-lender-cold","label":"Lender details (cold)","kind":"journey","status":"fail","durationMs":2145.3,"metrics":{"measurementMode":"route-round-trip","readinessQuietWindowMs":650,"forwardWorkMs":807.4,"minimumJustifiedActions":2,"observedActions":2,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"avoidableWaitMs":0,"executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"journeyId":"lender","journeyLabel":"Lender details","iteration":"cold","expectedPath":"/bank/Homestar%20Finance%20Pty%20Ltd","expectedSurface":"lender.details","navigationKind":"stack","forwardMs":807.4,"firstReadyFrameObserved":true,"firstReadyFrameMs":227.28441799990833,"backgroundSettleMs":880.2,"destinationReadinessMs":227.3,"backgroundTasks":"Bank response analysis","backMs":204.4,"firstBackMs":204.4,"firstBackDestination":"/performance-audit","originReadinessMs"…
11-23 20:39:49.775 E/unknown:ReactNative(15942): ?anon_0_@1:3693367
11-23 20:39:49.775 E/unknown:ReactNative(15942): ?anon_0_@1:3699167
11-23 20:39:49.775 E/unknown:ReactNative(15942): SyntheticError@1:163016
11-23 20:39:49.775 E/unknown:ReactNative(15942): Wrapper@1:163531
11-23 20:39:49.775 E/unknown:ReactNative(15942): _callSuper@1:148404
11-23 20:39:49.775 E/unknown:ReactNative(15942): _construct@1:163879
11-23 20:39:49.775 E/unknown:ReactNative(15942): _next@1:594867
```

### 56 audit 3 min
```
11-23 20:40:54.379 E/ReactNativeJS(15942): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtqan2v-22d441b7d962a627","check":{"id":"deep-first-pass.route.rates.search.filters.open","label":"route.rates: search.filters.open (first-pass)","kind":"journey","status":"fail","durationMs":5575.6,"metrics":{"journeyId":"route.rates.search.filters.open","journeyLabel":"route.rates: search.filters.open","iteration":"cold","passId":"first-pass","scenarioId":"route.rates","semanticActionId":"search.filters.open","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":3,"actionRevisionAfter":4,"renderRevisionBefore":"state-23","renderRevisionAfter":"state-26","actionMs":0.2,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtra…
11-23 20:40:54.380 E/unknown:ReactNative(15942): ?anon_0_@1:3693367
11-23 20:40:54.380 E/unknown:ReactNative(15942): ?anon_0_@1:3699167
11-23 20:40:54.380 E/unknown:ReactNative(15942): SyntheticError@1:163016
11-23 20:40:54.380 E/unknown:ReactNative(15942): Wrapper@1:163531
11-23 20:40:54.380 E/unknown:ReactNative(15942): _callSuper@1:148404
11-23 20:40:54.380 E/unknown:ReactNative(15942): _construct@1:163879
11-23 20:40:54.380 E/unknown:ReactNative(15942): _next@1:594867
```

### 57 audit 4 min
```
11-23 20:42:47.945 E/ReactNativeJS(15942): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtqan2v-22d441b7d962a627","check":{"id":"deep-first-pass.sample.catalogue.4.product.lender.open","label":"sample.catalogue.4: product.lender.open (first-pass)","kind":"journey","status":"fail","durationMs":2363.5,"metrics":{"journeyId":"sample.catalogue.4.product.lender.open","journeyLabel":"sample.catalogue.4: product.lender.open","iteration":"cold","passId":"first-pass","scenarioId":"sample.catalogue.4","semanticActionId":"product.lender.open","depth":1,"plannedExpectedPath":"/bank/Laboratories%20Credit%20Union","expectedPath":"/bank/Laboratories%20Credit%20Union","expectedSurface":"lender.details","actionSource":"product.details","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":9,"actionRevisionAfter":10,"actionResultEvidence":"{\"expectedPath\":\"/bank/Laboratories%20Credit%20Union\"}","actionMs":757.6,"preActionWaitMs":4.3,"preActionQuietWindowReused":true,"preActionQui…
11-23 20:42:48.484 E/unknown:ReactNative(15942): ?anon_0_@1:3693367
11-23 20:42:48.484 E/unknown:ReactNative(15942): ?anon_0_@1:3699167
11-23 20:42:48.484 E/unknown:ReactNative(15942): SyntheticError@1:163016
11-23 20:42:48.484 E/unknown:ReactNative(15942): Wrapper@1:163531
11-23 20:42:48.484 E/unknown:ReactNative(15942): _callSuper@1:148404
11-23 20:42:48.484 E/unknown:ReactNative(15942): _construct@1:163879
11-23 20:42:48.484 E/unknown:ReactNative(15942): _next@1:594867
```

### 58 audit 5 min
```
11-23 20:43:13.525 E/ReactNativeJS(15942): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtqan2v-22d441b7d962a627","check":{"id":"deep-first-pass.route.calculator.calculator.candidate.first","label":"route.calculator: calculator.candidate.first (first-pass)","kind":"journey","status":"fail","durationMs":1572.3,"metrics":{"journeyId":"route.calculator.calculator.candidate.first","journeyLabel":"route.calculator: calculator.candidate.first","iteration":"cold","passId":"first-pass","scenarioId":"route.calculator","semanticActionId":"calculator.candidate.first","depth":2,"plannedExpectedPath":"/product/Homestar%20Finance%20Pty%20Ltd%7CStar_Essentials%7CRESIDENTIAL_MORTGAGES%7CStar%20Essentials","expectedPath":"/product/Westpac%7CHLDefenceService%7CRESIDENTIAL_MORTGAGES%7CFlexi%20First%20Option%20Home%20Loan%20-%20Veterans","expectedSurface":"product.details","actionSource":"calculator.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":7,"actionRevisionAfter":…
11-23 20:43:13.527 E/unknown:ReactNative(15942): ?anon_0_@1:3693367
11-23 20:43:13.527 E/unknown:ReactNative(15942): ?anon_0_@1:3699167
11-23 20:43:13.527 E/unknown:ReactNative(15942): SyntheticError@1:163016
11-23 20:43:13.527 E/unknown:ReactNative(15942): Wrapper@1:163531
11-23 20:43:13.527 E/unknown:ReactNative(15942): _callSuper@1:148404
11-23 20:43:13.527 E/unknown:ReactNative(15942): _construct@1:163879
11-23 20:43:13.527 E/unknown:ReactNative(15942): _next@1:594867
```

### 59 audit 7 min
```
11-23 20:45:06.434 E/ReactNativeJS(15942): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtqan2v-22d441b7d962a627","check":{"id":"deep-first-pass.route.not-found.not-found.home","label":"route.not-found: not-found.home (first-pass)","kind":"journey","status":"fail","durationMs":9498.2,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"cold","passId":"first-pass","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":0,"actionRevisionAfter":1,"renderRevisionBefore":"not-found-v1","actionMs":85.3,"preActionWaitMs":0.6,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"s…
11-23 20:45:06.435 E/unknown:ReactNative(15942): ?anon_0_@1:3693367
11-23 20:45:06.435 E/unknown:ReactNative(15942): ?anon_0_@1:3699167
11-23 20:45:06.435 E/unknown:ReactNative(15942): SyntheticError@1:163016
11-23 20:45:06.435 E/unknown:ReactNative(15942): Wrapper@1:163531
11-23 20:45:06.435 E/unknown:ReactNative(15942): _callSuper@1:148404
11-23 20:45:06.435 E/unknown:ReactNative(15942): _construct@1:163879
11-23 20:45:06.435 E/unknown:ReactNative(15942): _next@1:594867
```

### 60 audit 8 min
```
11-23 20:46:06.115 E/ReactNativeJS(15942): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtqan2v-22d441b7d962a627","check":{"id":"deep-repeat.route.rates.search.mortgage.scope.apply.0","label":"route.rates: search.mortgage.scope.apply.0 (repeat)","kind":"journey","status":"fail","durationMs":8793,"metrics":{"journeyId":"route.rates.search.mortgage.scope.apply.0","journeyLabel":"route.rates: search.mortgage.scope.apply.0","iteration":"warm","passId":"repeat","scenarioId":"route.rates","semanticActionId":"search.mortgage.scope.apply.0","depth":2,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":30,"actionRevisionAfter":31,"renderRevisionBefore":"state-37","renderRevisionAfter":"state-43","actionMs":114.6,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"re…
11-23 20:46:06.116 E/unknown:ReactNative(15942): ?anon_0_@1:3693367
11-23 20:46:06.116 E/unknown:ReactNative(15942): ?anon_0_@1:3699167
11-23 20:46:06.116 E/unknown:ReactNative(15942): SyntheticError@1:163016
11-23 20:46:06.116 E/unknown:ReactNative(15942): Wrapper@1:163531
11-23 20:46:06.116 E/unknown:ReactNative(15942): _callSuper@1:148404
11-23 20:46:06.116 E/unknown:ReactNative(15942): _construct@1:163879
11-23 20:46:06.116 E/unknown:ReactNative(15942): _next@1:594867
```

### 61 audit 9 min
```
11-23 20:46:45.958 E/ReactNativeJS(15942): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtqan2v-22d441b7d962a627","check":{"id":"deep-repeat.route.rates-mortgage-scope.search.mortgage.scope.clear","label":"route.rates-mortgage-scope: search.mortgage.scope.clear (repeat)","kind":"journey","status":"fail","durationMs":8978.4,"metrics":{"journeyId":"route.rates-mortgage-scope.search.mortgage.scope.clear","journeyLabel":"route.rates-mortgage-scope: search.mortgage.scope.clear","iteration":"warm","passId":"repeat","scenarioId":"route.rates-mortgage-scope","semanticActionId":"search.mortgage.scope.clear","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"rates.results","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":45,"actionRevisionAfter":46,"renderRevisionBefore":"state-17","renderRevisionAfter":"state-23","actionMs":139.3,"preActionWaitMs":0.9,"preActionQuietWindowReused":true,"preActionQuietWindo…
11-23 20:46:45.960 E/unknown:ReactNative(15942): ?anon_0_@1:3693367
11-23 20:46:45.960 E/unknown:ReactNative(15942): ?anon_0_@1:3699167
11-23 20:46:45.960 E/unknown:ReactNative(15942): SyntheticError@1:163016
11-23 20:46:45.960 E/unknown:ReactNative(15942): Wrapper@1:163531
11-23 20:46:45.960 E/unknown:ReactNative(15942): _callSuper@1:148404
11-23 20:46:45.960 E/unknown:ReactNative(15942): _construct@1:163879
11-23 20:46:45.960 E/unknown:ReactNative(15942): _next@1:594867
```

### 62 audit 10 min
```
11-23 20:48:04.786 E/ReactNativeJS(15942): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtqan2v-22d441b7d962a627","check":{"id":"deep-repeat.route.calculator.calculator.open","label":"route.calculator: calculator.open (repeat)","kind":"journey","status":"fail","durationMs":3861.3,"metrics":{"journeyId":"route.calculator.calculator.open","journeyLabel":"route.calculator: calculator.open","iteration":"warm","passId":"repeat","scenarioId":"route.calculator","semanticActionId":"calculator.open","depth":0,"plannedExpectedPath":"/calculator","expectedPath":"/calculator","expectedSurface":"calculator.results","actionSource":"router","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionMs":392.1,"avoidableWaitMs":0,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetours":0,"modalInterruptions":0,"forwardMs":33.9,"forwardWorkMs":33.9,"navigationCommitMs":0.1,"firstReadyFrameMs":33.9,"firstReadyFrameObserved":true,"…
11-23 20:48:04.787 E/unknown:ReactNative(15942): ?anon_0_@1:3693367
11-23 20:48:04.787 E/unknown:ReactNative(15942): ?anon_0_@1:3699167
11-23 20:48:04.787 E/unknown:ReactNative(15942): SyntheticError@1:163016
11-23 20:48:04.787 E/unknown:ReactNative(15942): Wrapper@1:163531
11-23 20:48:04.787 E/unknown:ReactNative(15942): _callSuper@1:148404
11-23 20:48:04.787 E/unknown:ReactNative(15942): _construct@1:163879
11-23 20:48:04.787 E/unknown:ReactNative(15942): _next@1:594867
```

### 63 audit 11 min
```
11-23 20:49:59.842 E/ReactNativeJS(15942): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtqan2v-22d441b7d962a627","check":{"id":"deep-repeat.route.not-found.not-found.home","label":"route.not-found: not-found.home (repeat)","kind":"journey","status":"fail","durationMs":9400.3,"metrics":{"journeyId":"route.not-found.not-found.home","journeyLabel":"route.not-found: not-found.home","iteration":"warm","passId":"repeat","scenarioId":"route.not-found","semanticActionId":"not-found.home","depth":1,"plannedExpectedPath":"/browse","expectedPath":"/browse","expectedSurface":"rates.results","actionSource":"not-found.recovery","measurementMode":"semantic-action","executionAttempted":true,"actionInvoked":true,"actionCompleted":true,"actionRevisionBefore":1,"actionRevisionAfter":2,"renderRevisionBefore":"not-found-v1","actionMs":107.7,"preActionWaitMs":0.5,"preActionQuietWindowReused":true,"preActionQuietWindowAvoidedMs":650,"minimumJustifiedActions":1,"observedActions":1,"retries":0,"validationFailures":0,"backtracks":0,"repeatedFields":0,"scrollDetour…
11-23 20:49:59.843 E/unknown:ReactNative(15942): ?anon_0_@1:3693367
11-23 20:49:59.843 E/unknown:ReactNative(15942): ?anon_0_@1:3699167
11-23 20:49:59.843 E/unknown:ReactNative(15942): SyntheticError@1:163016
11-23 20:49:59.843 E/unknown:ReactNative(15942): Wrapper@1:163531
11-23 20:49:59.843 E/unknown:ReactNative(15942): _callSuper@1:148404
11-23 20:49:59.843 E/unknown:ReactNative(15942): _construct@1:163879
11-23 20:49:59.843 E/unknown:ReactNative(15942): _next@1:594867
```

### 64 audit 13 min
```
11-23 20:51:14.553 E/ReactNativeJS(15942): [AR error] perf-audit: {"kind":"check","sessionId":"pa-mwtqan2v-22d441b7d962a627","check":{"id":"external-link-381","kind":"network","status":"fail","durationMs":1082.1413950000424,"metrics":{"executionAttempted":true,"nonTimingFailure":true,"urlValidation":"pass","browserHandler":"pass","httpReachability":"fail","statusCode":404,"handlerAttempted":true,"httpAttempted":true,"httpSelected":true,"handlerResolution":"pass","host":"www.defencebank.com.au","destinationPath":"/banking/home-loans/essentials-home-loan---ultimate-package-investor-interest-only/"},"error":"HTTP 404: the destination is missing or unavailable.","canonicalMetrics":true}}
11-23 20:51:14.555 E/unknown:ReactNative(15942): ?anon_0_@1:3693367
11-23 20:51:14.555 E/unknown:ReactNative(15942): ?anon_0_@1:3702728
11-23 20:51:14.555 E/unknown:ReactNative(15942): SyntheticError@1:163016
11-23 20:51:14.555 E/unknown:ReactNative(15942): Wrapper@1:163531
11-23 20:51:14.555 E/unknown:ReactNative(15942): _callSuper@1:148404
11-23 20:51:14.555 E/unknown:ReactNative(15942): _construct@1:163879
11-23 20:51:14.555 E/unknown:ReactNative(15942): _next@1:594867
```
