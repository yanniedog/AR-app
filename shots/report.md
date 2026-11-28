# App explorer: 1.0.397 (453)

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-28

Mode script | 45 steps | crashes 0 | step failures 1 | settle timeouts 0 | steps with JS/native errors 2

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 13586 |  | 39/54 | 300 | 410 | 1 errors; start 3312ms |
| 2 | browse-open | 72 |  | 2/2 | 32 | 557 | boot js-start 61576, layout-mounted 62151, cache-read 62480, hydrated 62792, splash-hide 62792, manifest 64174, resolved 64595, core-fetched 67079, core-saved 67521, pricing-wait-suitability 67723, search-index-idle 67723, details-start 68478, details-fetched 71338, rows-prepared 72883, detail-filters-idle 72883, leading-requested 72883, last-pricing 72883, suitability-built 73309, post-refresh-wait 73556, leading-scoped 75000, leading-page 75000, pricing-ready 83389, last-rows 83389, rates-ready 84100, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 250, pricing-scope-ms 10135, filter-runs 2, filter-rows 37735, filter-yields 20, filter-ms 452, sort-runs 1, sort-rows 2150, sort-yields 2, sort-ms 101 |
| 3 | browse | 0 |  |  |  | 654 |  |
| 4 | watchlist-open | 58 |  | 4/5 | 42 | 505 |  |
| 5 | watchlist | 0 |  |  |  | 570 |  |
| 6 | market-open | 2363 |  | 11/26 | 44 | 576 |  |
| 7 | market | 0 |  |  |  | 568 |  |
| 8 | tools-open | 22 |  | 12/24 | 117 | 590 |  |
| 9 | tools | 0 |  |  |  | 579 |  |
| 10 | trends-open | 24 |  | 18/34 | 85 | 596 |  |
| 11 | trends | 0 |  |  |  | 594 |  |
| 12 | search-open | 46 |  | 30/43 | 117 | 670 |  |
| 13 | search | 1 |  |  |  | 627 |  |
| 14 | bank-rates-open | 24 |  | 17/31 | 81 | 617 |  |
| 15 | bank-rates | 0 |  |  |  | 611 |  |
| 16 | compare-open | 29 |  | 13/19 | 97 | 613 |  |
| 17 | compare | 0 |  |  |  | 612 |  |
| 18 | calculator-open | 26 |  | 13/22 | 65 | 617 |  |
| 19 | calculator | 0 |  |  |  | 616 |  |
| 20 | projections-open | 25 |  | 18/36 | 69 | 623 |  |
| 21 | projections | 0 |  |  |  | 619 |  |
| 22 | research-open | 28 |  | 16/28 | 65 | 634 |  |
| 23 | research | 0 |  |  |  | 633 |  |
| 24 | rba-open | 29 |  | 15/29 | 65 | 646 |  |
| 25 | rba | 1 |  |  |  | 639 |  |
| 26 | rba-scrolled-open | 32 |  | 2/4 | 16 | 638 |  |
| 27 | rba-scrolled | 2157 |  | 39/85 | 61 | 636 |  |
| 28 | rba-response-open | 23 |  | 14/34 | 48 | 644 |  |
| 29 | rba-response | 0 |  |  |  | 640 |  |
| 30 | settings-open | 24 |  | 13/30 | 77 | 648 |  |
| 31 | settings | 2909 |  | 45/103 | 61 | 646 |  |
| 32 | debug-log-open | 27 |  | 11/26 | 65 | 649 |  |
| 33 | debug-log-tap-1 | 22 |  | 2/2 | 21 | 648 |  |
| 34 | debug-log-tap-2 | 18 |  | 22/58 | 53 | 653 |  |
| 35 | debug-log | 0 |  |  |  | 652 |  |
| 36 | profile-open | 25 |  | 11/27 | 46 | 657 |  |
| 37 | profile | 0 |  |  |  | 655 |  |
| 38 | product-history-open | 3172 |  | 25/44 | 53 | 717 | 3 errors |
| 39 | product-history-scroll | 685 |  | 31/58 | 69 | 744 |  |
| 40 | product-history | 0 |  |  |  | 721 |  |
| 41 | bank-history-open | 31 |  | 20/33 | 69 | 770 |  |
| 42 | bank-history | 0 |  |  |  | 756 |  |
| 43 | mortgage-history-open | 24 |  | 27/40 | 65 | 804 |  |
| 44 | mortgage-history-scroll | 696 |  | 25/61 | 65 | 846 |  |
| 45 | mortgage-history | 0 |  |  |  | 805 | timeout waiting for {"label":"1 year","clickable":true,"enabled":true} |

## Errors

### 1 cold start
```
11-28 14:25:05.446 E/australianrates( 4669): Not starting debugger since process cannot load the jdwp agent.
```

### 38 product-history-open
```
11-28 14:30:09.297 W/ReactNativeJS( 4669): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-28 14:30:09.631 W/ReactNativeJS( 4669): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-28 14:30:10.405 W/ReactNativeJS( 4669): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
```
