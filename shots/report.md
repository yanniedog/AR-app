# App explorer: 1.0.389 (445)

Runner payload check: manifest HTTP 200, 3752 bytes, latest published run date 2026-11-27

Mode script | 43 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 10375 |  | 39/53 | 150 | 417 | 2 errors; start 1888ms |
| 2 | browse-open | 70 |  | 2/2 | 28 | 594 | boot js-start 63496, layout-mounted 63760, cache-read 63924, hydrated 64171, splash-hide 64171, manifest 65148, resolved 65927, core-fetched 67565, core-saved 67852, search-index-idle 67953, leading-requested 67953, details-start 68483, leading-scoped 68535, pricing-ready 68670, details-fetched 72368, rows-prepared 73856, detail-filters-idle 73856, last-pricing 73856, suitability-built 74226, post-refresh-wait 74318, leading-page 74814, last-rows 83785, rates-ready 84315, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 185, pricing-scope-ms 9776, leading-gated 1, filter-runs 3, filter-rows 56880, filter-yields 10, filter-ms 330, sort-runs 4, sort-rows 1191, sort-yields 4, sort-ms 40 |
| 3 | browse | 1 |  |  |  | 668 |  |
| 4 | watchlist-open | 4942 |  | 2/4 | 32 | 541 |  |
| 5 | watchlist | 0 |  |  |  | 530 |  |
| 6 | market-open | 26 |  | 11/22 | 44 | 542 |  |
| 7 | market | 0 |  |  |  | 537 |  |
| 8 | tools-open | 41 |  | 16/24 | 77 | 553 |  |
| 9 | tools | 0 |  |  |  | 549 |  |
| 10 | trends-open | 25 |  | 18/33 | 81 | 566 |  |
| 11 | trends | 0 |  |  |  | 566 |  |
| 12 | search-open | 26 |  | 26/38 | 97 | 630 |  |
| 13 | search | 0 |  |  |  | 610 |  |
| 14 | bank-rates-open | 72 |  | 14/27 | 73 | 614 |  |
| 15 | bank-rates | 0 |  |  |  | 608 |  |
| 16 | compare-open | 24 |  | 11/18 | 81 | 613 |  |
| 17 | compare | 0 |  |  |  | 614 |  |
| 18 | calculator-open | 23 |  | 13/26 | 48 | 621 |  |
| 19 | calculator | 0 |  |  |  | 617 |  |
| 20 | projections-open | 31 |  | 20/37 | 81 | 630 |  |
| 21 | projections | 0 |  |  |  | 642 |  |
| 22 | research-open | 24 |  | 16/30 | 69 | 639 |  |
| 23 | research | 0 |  |  |  | 640 |  |
| 24 | rba-open | 23 |  | 12/24 | 65 | 665 |  |
| 25 | rba | 0 |  |  |  | 653 |  |
| 26 | rba-scrolled-open | 29 |  | 3/4 | 32 | 657 |  |
| 27 | rba-scrolled | 2148 |  | 37/89 | 57 | 656 |  |
| 28 | rba-response-open | 28 |  | 15/30 | 57 | 667 |  |
| 29 | rba-response | 0 |  |  |  | 664 |  |
| 30 | settings-open | 25 |  | 12/29 | 57 | 675 |  |
| 31 | settings | 2886 |  | 46/101 | 61 | 672 |  |
| 32 | debug-log-open | 32 |  | 10/26 | 101 | 678 |  |
| 33 | debug-log-tap-1 | 27 |  | 3/3 | 32 | 677 |  |
| 34 | debug-log-tap-2 | 21 |  | 23/55 | 53 | 682 |  |
| 35 | debug-log | 0 |  |  |  | 681 |  |
| 36 | profile-open | 28 |  | 14/28 | 61 | 692 |  |
| 37 | profile | 0 |  |  |  | 690 |  |
| 38 | terms-open | 27 |  | 12/28 | 53 | 694 |  |
| 39 | terms | 0 |  |  |  | 693 |  |
| 40 | third-party-open | 23 |  | 14/27 | 61 | 699 |  |
| 41 | third-party | 0 |  |  |  | 697 |  |
| 42 | catalogue-open | 22 |  | 31/49 | 73 | 749 |  |
| 43 | catalogue | 0 |  |  |  | 723 |  |

## Errors

### 1 cold start
```
11-26 23:03:36.408 E/australianrates( 4807): Not starting debugger since process cannot load the jdwp agent.
11-26 23:03:42.227 W/ReactNativeJS( 4807): [AR warn] degrade: fetch.httpError status=503 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-11-27-r000001/details-2026-11-27-1461123eeab… ctx=download
```
