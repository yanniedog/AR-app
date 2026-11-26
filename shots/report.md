# App explorer: 1.0.379 (435)

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-26

Mode script | 43 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 15193 |  | 38/51 | 400 | 409 | 1 errors; start 2301ms |
| 2 | browse-open | 73 |  |  |  | 499 |  |
| 3 | browse | 1 |  | 2/2 | 48 | 566 | boot js-start 84566, layout-mounted 84943, cache-read 85087, hydrated 85279, splash-hide 85279, manifest 86440, resolved 87003, core-fetched 89213, core-saved 89666, search-index-idle 89899, leading-requested 89899, details-start 90731, leading-scoped 90965, pricing-ready 94200, details-fetched 95897, rows-prepared 99002, detail-filters-idle 99002, last-pricing 99002, suitability-built 99353, post-refresh-wait 99424, leading-page 100017, last-rows 117894, rates-ready 118509, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 274, pricing-scope-ms 22032, leading-gated 1, filter-runs 2, filter-rows 31602, filter-yields 12, filter-ms 560, sort-runs 4, sort-rows 1183, sort-yields 4, sort-ms 70 |
| 4 | watchlist-open | 55 |  | 3/4 | 65 | 612 |  |
| 5 | watchlist | 0 |  |  |  | 488 |  |
| 6 | market-open | 2749 |  | 17/22 | 48 | 486 |  |
| 7 | market | 1 |  |  |  | 486 |  |
| 8 | tools-open | 36 |  | 15/21 | 117 | 501 |  |
| 9 | tools | 0 |  |  |  | 497 |  |
| 10 | trends-open | 35 |  | 26/37 | 150 | 515 |  |
| 11 | trends | 0 |  |  |  | 512 |  |
| 12 | search-open | 43 |  | 31/41 | 109 | 586 |  |
| 13 | search | 0 |  |  |  | 628 |  |
| 14 | bank-rates-open | 25 |  | 18/30 | 89 | 626 |  |
| 15 | bank-rates | 0 |  |  |  | 620 |  |
| 16 | compare-open | 32 |  | 11/14 | 101 | 629 |  |
| 17 | compare | 0 |  |  |  | 628 |  |
| 18 | calculator-open | 31 |  | 14/24 | 65 | 639 |  |
| 19 | calculator | 0 |  |  |  | 634 |  |
| 20 | projections-open | 33 |  | 28/39 | 93 | 672 |  |
| 21 | projections | 0 |  |  |  | 672 |  |
| 22 | research-open | 30 |  | 19/26 | 105 | 658 |  |
| 23 | research | 0 |  |  |  | 660 |  |
| 24 | rba-open | 2301 |  | 11/21 | 113 | 696 |  |
| 25 | rba | 0 |  |  |  | 680 |  |
| 26 | rba-scrolled-open | 37 |  | 2/3 | 32 | 679 |  |
| 27 | rba-scrolled | 2225 |  | 41/68 | 69 | 678 |  |
| 28 | rba-response-open | 29 |  | 19/29 | 101 | 689 |  |
| 29 | rba-response | 0 |  |  |  | 685 |  |
| 30 | settings-open | 28 |  | 12/24 | 81 | 699 |  |
| 31 | settings | 2969 |  | 52/88 | 81 | 694 |  |
| 32 | debug-log-open | 33 |  | 13/23 | 81 | 701 |  |
| 33 | debug-log-tap-1 | 25 |  | 2/2 | 16 | 700 |  |
| 34 | debug-log-tap-2 | 22 |  | 34/54 | 65 | 706 |  |
| 35 | debug-log | 0 |  |  |  | 705 |  |
| 36 | profile-open | 34 |  | 15/23 | 77 | 715 |  |
| 37 | profile | 0 |  |  |  | 713 |  |
| 38 | terms-open | 28 |  | 14/24 | 73 | 718 |  |
| 39 | terms | 0 |  |  |  | 717 |  |
| 40 | third-party-open | 30 |  | 16/25 | 77 | 718 |  |
| 41 | third-party | 0 |  |  |  | 741 |  |
| 42 | catalogue-open | 40 |  | 30/45 | 89 | 720 |  |
| 43 | catalogue | 0 |  |  |  | 692 |  |

## Errors

### 1 cold start
```
11-26 08:54:49.184 E/australianrates( 4990): Not starting debugger since process cannot load the jdwp agent.
```
