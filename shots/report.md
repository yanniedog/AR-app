# App explorer: 1.0.364 (420)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 11856 |  | 42/56 | 250 | 529 | 1 errors; start 2701ms; boot js-start 61531, layout-mounted 61909, cache-read 62017, hydrated 62318, splash-hide 62318, manifest 62905, resolved 63657, core-fetched 65557, core-saved 65834, rows-prepared 65997, search-index-idle 65997, leading-requested 65997, details-start 66217, leading-scoped 66289, pricing-ready 68452, last-gate 68913, details-fetched 70187, detail-filters-idle 72061, last-pricing 72061, suitability-built 72344, post-refresh-wait 72477, leading-page 72811, last-rows 79423, rates-ready 79587, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 162, pricing-scope-ms 9394, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 4, filter-rows 63344, filter-yields 7, filter-ms 333, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 83 |
| 2 | browse-open | 48 |  |  |  | 513 |  |
| 3 | browse | 0 |  |  |  | 762 |  |
| 4 | watchlist-open | 55 |  | 2/4 | 29 | 635 |  |
| 5 | watchlist | 0 |  |  |  | 624 |  |
| 6 | market-open | 22 |  | 13/22 | 53 | 624 |  |
| 7 | market | 0 |  |  |  | 619 |  |
| 8 | tools-open | 21 |  | 15/24 | 81 | 637 |  |
| 9 | tools | 0 |  |  |  | 632 |  |
| 10 | trends-open | 20 |  | 17/38 | 113 | 651 |  |
| 11 | trends | 0 |  |  |  | 651 |  |
| 12 | search-open | 19 |  | 27/50 | 93 | 712 |  |
| 13 | search | 0 |  |  |  | 693 |  |
| 14 | bank-rates-open | 24 |  | 10/28 | 69 | 697 |  |
| 15 | bank-rates | 0 |  |  |  | 696 |  |
| 16 | compare-open | 20 |  | 12/20 | 85 | 699 |  |
| 17 | compare | 0 |  |  |  | 701 |  |
| 18 | calculator-open | 22 |  | 13/28 | 46 | 709 |  |
| 19 | calculator | 0 |  |  |  | 705 |  |
| 20 | projections-open | 29 |  | 18/38 | 77 | 719 |  |
| 21 | projections | 0 |  |  |  | 716 |  |
| 22 | research-open | 20 |  | 13/32 | 48 | 733 |  |
| 23 | research | 0 |  |  |  | 726 |  |
| 24 | rba-open | 2335 |  | 12/26 | 81 | 670 |  |
| 25 | rba | 0 |  |  |  | 657 |  |
| 26 | rba-scrolled-open | 19 |  | 3/4 | 32 | 658 |  |
| 27 | rba-scrolled | 2161 |  | 30/96 | 53 | 658 |  |
| 28 | rba-response-open | 22 |  | 11/28 | 65 | 665 |  |
| 29 | rba-response | 0 |  |  |  | 661 |  |
| 30 | settings-open | 27 |  | 7/26 | 53 | 672 |  |
| 31 | settings | 0 |  |  |  | 666 |  |
| 32 | about-open | 24 |  | 7/25 | 53 | 669 |  |
| 33 | about | 0 |  |  |  | 668 |  |
| 34 | profile-open | 26 |  | 13/28 | 73 | 675 |  |
| 35 | profile | 0 |  |  |  | 672 |  |
| 36 | terms-open | 22 |  | 11/25 | 61 | 674 |  |
| 37 | terms | 0 |  |  |  | 673 |  |
| 38 | third-party-open | 29 |  | 12/26 | 65 | 678 |  |
| 39 | third-party | 0 |  |  |  | 676 |  |
| 40 | catalogue-open | 52 |  | 30/51 | 73 | 712 |  |
| 41 | catalogue | 0 |  |  |  | 686 |  |

## Errors

### 1 cold start
```
11-23 23:39:50.259 E/australianrates( 4950): Not starting debugger since process cannot load the jdwp agent.
```
