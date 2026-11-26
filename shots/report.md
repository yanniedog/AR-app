# App explorer: 1.0.386 (442)

Runner payload check: manifest HTTP 200, 3752 bytes, latest published run date 2026-11-27

Mode script | 43 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 8384 |  | 41/60 | 200 | 430 | 1 errors; start 2247ms; boot js-start 62909, layout-mounted 63311, cache-read 63412, hydrated 63612, splash-hide 63612, manifest 64688, resolved 65206, core-fetched 67223, core-saved 67448, search-index-idle 67545, leading-requested 67545, details-start 68029, leading-scoped 68062, pricing-ready 68172, details-fetched 70736, rows-prepared 71827, detail-filters-idle 71827, last-pricing 71827, suitability-built 71927, post-refresh-wait 72067, leading-page 72663, last-rows 80010, rates-ready 80200, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 161, pricing-scope-ms 8155, leading-gated 1, filter-runs 3, filter-rows 56880, filter-yields 6, filter-ms 104, sort-runs 4, sort-rows 1191, sort-yields 4, sort-ms 11 |
| 2 | browse-open | 45 |  |  |  | 480 |  |
| 3 | browse | 0 |  |  |  | 552 |  |
| 4 | watchlist-open | 33 |  | 2/2 | 32 | 546 |  |
| 5 | watchlist | 0 |  |  |  | 531 |  |
| 6 | market-open | 18 |  | 8/23 | 36 | 542 |  |
| 7 | market | 0 |  |  |  | 538 |  |
| 8 | tools-open | 19 |  | 10/25 | 65 | 564 |  |
| 9 | tools | 0 |  |  |  | 549 |  |
| 10 | trends-open | 20 |  | 20/38 | 81 | 568 |  |
| 11 | trends | 0 |  |  |  | 566 |  |
| 12 | search-open | 18 |  | 24/44 | 77 | 611 |  |
| 13 | search | 0 |  |  |  | 609 |  |
| 14 | bank-rates-open | 24 |  | 13/33 | 61 | 612 |  |
| 15 | bank-rates | 0 |  |  |  | 611 |  |
| 16 | compare-open | 26 |  | 8/21 | 73 | 614 |  |
| 17 | compare | 0 |  |  |  | 616 |  |
| 18 | calculator-open | 20 |  | 11/28 | 48 | 623 |  |
| 19 | calculator | 0 |  |  |  | 619 |  |
| 20 | projections-open | 23 |  | 11/33 | 65 | 642 |  |
| 21 | projections | 0 |  |  |  | 640 |  |
| 22 | research-open | 24 |  | 13/32 | 53 | 648 |  |
| 23 | research | 0 |  |  |  | 640 |  |
| 24 | rba-open | 23 |  | 10/27 | 61 | 670 |  |
| 25 | rba | 0 |  |  |  | 658 |  |
| 26 | rba-scrolled-open | 24 |  | 2/4 | 28 | 660 |  |
| 27 | rba-scrolled | 2097 |  | 22/100 | 46 | 660 |  |
| 28 | rba-response-open | 30 |  | 10/32 | 48 | 670 |  |
| 29 | rba-response | 0 |  |  |  | 667 |  |
| 30 | settings-open | 22 |  | 11/31 | 53 | 683 |  |
| 31 | settings | 2817 |  | 30/115 | 48 | 677 |  |
| 32 | debug-log-open | 23 |  | 8/27 | 44 | 682 |  |
| 33 | debug-log-tap-1 | 14 |  | 1/2 | 16 | 682 |  |
| 34 | debug-log-tap-2 | 19 |  | 16/60 | 48 | 688 |  |
| 35 | debug-log | 0 |  |  |  | 686 |  |
| 36 | profile-open | 24 |  | 10/29 | 40 | 696 |  |
| 37 | profile | 0 |  |  |  | 694 |  |
| 38 | terms-open | 26 |  | 8/27 | 69 | 701 |  |
| 39 | terms | 0 |  |  |  | 699 |  |
| 40 | third-party-open | 23 |  | 8/27 | 53 | 705 |  |
| 41 | third-party | 0 |  |  |  | 704 |  |
| 42 | catalogue-open | 24 |  | 24/49 | 73 | 752 |  |
| 43 | catalogue | 0 |  |  |  | 728 |  |

## Errors

### 1 cold start
```
11-26 18:49:54.117 E/australianrates( 5363): Not starting debugger since process cannot load the jdwp agent.
```
