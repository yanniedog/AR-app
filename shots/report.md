# App explorer: 1.0.375 (431)

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-26

Mode script | 43 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 20331 |  | 69/86 | 200 | 412 | 6 errors; start 2525ms |
| 2 | browse-open | 5349 |  | 1/2 | 30 | 569 | boot js-start 70208, layout-mounted 70546, cache-read 70677, hydrated 70918, splash-hide 70918, manifest 74585, resolved 75912, core-fetched 78162, core-saved 78682, search-index-idle 79024, leading-requested 79024, details-start 80241, leading-scoped 80336, pricing-ready 81431, details-fetched 85852, rows-prepared 89129, detail-filters-idle 89129, last-pricing 89129, suitability-built 89348, post-refresh-wait 89551, leading-page 90185, last-rows 104066, rates-ready 104566, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 224, pricing-scope-ms 15910, leading-gated 1, filter-runs 3, filter-rows 56340, filter-yields 12, filter-ms 406, sort-runs 4, sort-rows 1183, sort-yields 4, sort-ms 101 |
| 3 | browse | 0 |  |  |  | 626 |  |
| 4 | watchlist-open | 61 |  | 5/5 | 61 | 479 |  |
| 5 | watchlist | 0 |  |  |  | 538 |  |
| 6 | market-open | 118 |  | 12/20 | 69 | 535 |  |
| 7 | market | 0 |  |  |  | 531 |  |
| 8 | tools-open | 43 |  | 16/23 | 150 | 544 |  |
| 9 | tools | 0 |  |  |  | 535 |  |
| 10 | trends-open | 27 |  | 25/37 | 97 | 553 |  |
| 11 | trends | 0 |  |  |  | 549 |  |
| 12 | search-open | 30 |  | 32/41 | 101 | 623 |  |
| 13 | search | 0 |  |  |  | 663 |  |
| 14 | bank-rates-open | 36 |  | 20/31 | 89 | 661 |  |
| 15 | bank-rates | 0 |  |  |  | 655 |  |
| 16 | compare-open | 31 |  | 10/15 | 129 | 664 |  |
| 17 | compare | 0 |  |  |  | 662 |  |
| 18 | calculator-open | 27 |  | 15/25 | 85 | 673 |  |
| 19 | calculator | 0 |  |  |  | 669 |  |
| 20 | projections-open | 26 |  | 19/34 | 97 | 679 |  |
| 21 | projections | 0 |  |  |  | 678 |  |
| 22 | research-open | 31 |  | 19/28 | 77 | 689 |  |
| 23 | research | 0 |  |  |  | 690 |  |
| 24 | rba-open | 2418 |  | 15/23 | 101 | 719 |  |
| 25 | rba | 0 |  |  |  | 706 |  |
| 26 | rba-scrolled-open | 30 |  | 3/4 | 48 | 697 |  |
| 27 | rba-scrolled | 2142 |  | 41/63 | 73 | 669 |  |
| 28 | rba-response-open | 29 |  | 20/33 | 81 | 676 |  |
| 29 | rba-response | 0 |  |  |  | 672 |  |
| 30 | settings-open | 32 |  | 14/25 | 69 | 679 |  |
| 31 | settings | 2882 |  | 55/85 | 81 | 676 |  |
| 32 | debug-log-open | 31 |  | 17/26 | 81 | 678 |  |
| 33 | debug-log-tap-1 | 23 |  | 2/2 | 16 | 677 |  |
| 34 | debug-log-tap-2 | 21 |  | 32/57 | 65 | 681 |  |
| 35 | debug-log | 0 |  |  |  | 679 |  |
| 36 | profile-open | 31 |  | 14/21 | 69 | 687 |  |
| 37 | profile | 0 |  |  |  | 684 |  |
| 38 | terms-open | 33 |  | 15/21 | 93 | 686 |  |
| 39 | terms | 0 |  |  |  | 685 |  |
| 40 | third-party-open | 26 |  | 12/22 | 69 | 688 |  |
| 41 | third-party | 0 |  |  |  | 686 |  |
| 42 | catalogue-open | 30 |  | 37/43 | 89 | 723 |  |
| 43 | catalogue | 0 |  |  |  | 691 |  |

## Errors

### 1 cold start
```
11-25 22:47:58.234 E/australianrates( 4748): Not starting debugger since process cannot load the jdwp agent.
11-25 22:48:01.117 W/ReactNativeJS( 4748): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-25 22:48:03.946 W/ReactNativeJS( 4748): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-25 22:48:11.763 E/unknown:SurfaceMountingManager( 4748): Stopping surface [1]
11-25 22:48:11.786 E/unknown:IntBufferBatchMountItem( 4748): Skipping batch of MountItems; was stopped [1].
11-25 22:48:11.786 E/unknown:SurfaceMountingManager( 4748): Surface [1] was stopped on SurfaceMountingManager.
```
