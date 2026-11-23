# App explorer: 1.0.356 (412)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 21544 |  | 51/63 | 300 | 503 | 1 errors; start 3817ms |
| 2 | browse-open | 72 |  | 2/2 | 48 | 482 | boot js-start 73637, layout-mounted 74305, cache-read 74463, hydrated 75010, splash-hide 75010, manifest 76637, resolved 77183, core-fetched 80412, core-saved 81460, rows-prepared 81905, search-index-idle 81905, leading-requested 81905, details-start 82960, leading-scoped 83011, pricing-ready 84442, last-gate 86286, details-fetched 88259, detail-filters-idle 92199, last-pricing 92199, suitability-built 92488, post-refresh-wait 92617, leading-page 93037, last-rows 109875, rates-ready 110275, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 263, pricing-scope-ms 18855, leading-short 1, leading-short-rows 0, leading-scope-rows 112, leading-visible-rows 0, leading-nonstd-rows 9, filter-runs 3, filter-rows 38624, filter-yields 9, filter-ms 1917, sort-runs 5, sort-rows 1182, sort-yields 5, sort-ms 176 |
| 3 | browse | 1 |  |  |  | 546 |  |
| 4 | watchlist-open | 100 |  | 3/3 | 117 | 718 |  |
| 5 | watchlist | 1 |  |  |  | 483 |  |
| 6 | market-open | 42 |  | 17/22 | 65 | 487 |  |
| 7 | market | 1 |  |  |  | 483 |  |
| 8 | tools-open | 34 |  | 17/22 | 150 | 486 |  |
| 9 | tools | 1 |  |  |  | 482 |  |
| 10 | trends-open | 35 |  | 23/37 | 150 | 497 |  |
| 11 | trends | 1 |  |  |  | 495 |  |
| 12 | search-open | 29 |  | 32/40 | 133 | 555 |  |
| 13 | search | 1 |  |  |  | 597 |  |
| 14 | bank-rates-open | 48 |  | 18/27 | 81 | 597 |  |
| 15 | bank-rates | 1 |  |  |  | 590 |  |
| 16 | compare-open | 27 |  | 12/16 | 121 | 598 |  |
| 17 | compare | 0 |  |  |  | 597 |  |
| 18 | calculator-open | 29 |  | 18/26 | 69 | 608 |  |
| 19 | calculator | 0 |  |  |  | 604 |  |
| 20 | projections-open | 32 |  | 24/32 | 101 | 613 |  |
| 21 | projections | 0 |  |  |  | 613 |  |
| 22 | research-open | 32 |  | 21/30 | 89 | 625 |  |
| 23 | research | 0 |  |  |  | 626 |  |
| 24 | rba-open | 37 |  | 15/22 | 101 | 634 |  |
| 25 | rba | 0 |  |  |  | 628 |  |
| 26 | rba-scrolled-open | 32 |  | 2/4 | 19 | 630 |  |
| 27 | rba-scrolled | 2104 |  | 37/61 | 65 | 629 |  |
| 28 | rba-response-open | 31 |  | 20/28 | 65 | 641 |  |
| 29 | rba-response | 1 |  |  |  | 637 |  |
| 30 | settings-open | 34 |  | 12/21 | 73 | 653 |  |
| 31 | settings | 0 |  |  |  | 648 |  |
| 32 | about-open | 34 |  | 12/22 | 69 | 656 |  |
| 33 | about | 0 |  |  |  | 655 |  |
| 34 | profile-open | 29 |  | 14/24 | 69 | 664 |  |
| 35 | profile | 1 |  |  |  | 662 |  |
| 36 | terms-open | 26 |  | 14/25 | 93 | 667 |  |
| 37 | terms | 1 |  |  |  | 666 |  |
| 38 | third-party-open | 30 |  | 13/24 | 77 | 672 |  |
| 39 | third-party | 0 |  |  |  | 670 |  |
| 40 | catalogue-open | 33 |  | 32/43 | 101 | 720 |  |
| 41 | catalogue | 1 |  |  |  | 695 |  |

## Errors

### 1 cold start
```
11-23 14:07:03.140 E/australianrates( 4678): Not starting debugger since process cannot load the jdwp agent.
```
