# App explorer: 1.0.357 (413)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 20105 |  | 43/55 | 250 | 412 | 1 errors; start 4701ms |
| 2 | browse-open | 66 |  | 1/1 | 42 | 502 | boot js-start 84613, layout-mounted 85294, cache-read 85555, hydrated 85889, splash-hide 85889, manifest 87016, resolved 88169, core-fetched 91488, core-saved 92237, rows-prepared 92562, search-index-idle 92562, leading-requested 92562, details-start 93359, leading-scoped 93444, pricing-ready 96019, last-gate 96524, details-fetched 98259, detail-filters-idle 101562, last-pricing 101562, suitability-built 101921, post-refresh-wait 102039, leading-page 102683, last-rows 119762, rates-ready 120316, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 264, pricing-scope-ms 20551, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 4, filter-rows 63344, filter-yields 13, filter-ms 709, sort-runs 5, sort-rows 1175, sort-yields 6, sort-ms 144 |
| 3 | browse | 0 |  |  |  | 562 |  |
| 4 | watchlist-open | 79 |  | 4/4 | 125 | 620 |  |
| 5 | watchlist | 0 |  |  |  | 498 |  |
| 6 | market-open | 46 |  | 17/24 | 61 | 498 |  |
| 7 | market | 0 |  |  |  | 485 |  |
| 8 | tools-open | 34 |  | 14/20 | 250 | 501 |  |
| 9 | tools | 1 |  |  |  | 496 |  |
| 10 | trends-open | 44 |  | 23/35 | 93 | 514 |  |
| 11 | trends | 1 |  |  |  | 513 |  |
| 12 | search-open | 33 |  | 35/43 | 105 | 582 |  |
| 13 | search | 0 |  |  |  | 593 |  |
| 14 | bank-rates-open | 36 |  | 18/26 | 105 | 610 |  |
| 15 | bank-rates | 1 |  |  |  | 608 |  |
| 16 | compare-open | 25 |  | 12/15 | 150 | 612 |  |
| 17 | compare | 1 |  |  |  | 614 |  |
| 18 | calculator-open | 35 |  | 17/25 | 81 | 621 |  |
| 19 | calculator | 0 |  |  |  | 618 |  |
| 20 | projections-open | 32 |  | 27/39 | 93 | 655 |  |
| 21 | projections | 0 |  |  |  | 652 |  |
| 22 | research-open | 27 |  | 16/33 | 65 | 646 |  |
| 23 | research | 1 |  |  |  | 643 |  |
| 24 | rba-open | 38 |  | 13/22 | 77 | 657 |  |
| 25 | rba | 0 |  |  |  | 649 |  |
| 26 | rba-scrolled-open | 40 |  | 2/4 | 29 | 651 |  |
| 27 | rba-scrolled | 2235 |  | 43/67 | 65 | 649 |  |
| 28 | rba-response-open | 34 |  | 15/29 | 69 | 661 |  |
| 29 | rba-response | 1 |  |  |  | 657 |  |
| 30 | settings-open | 36 |  | 15/23 | 113 | 673 |  |
| 31 | settings | 0 |  |  |  | 667 |  |
| 32 | about-open | 34 |  | 16/25 | 65 | 676 |  |
| 33 | about | 1 |  |  |  | 675 |  |
| 34 | profile-open | 35 |  | 16/25 | 69 | 683 |  |
| 35 | profile | 1 |  |  |  | 682 |  |
| 36 | terms-open | 32 |  | 15/23 | 77 | 685 |  |
| 37 | terms | 0 |  |  |  | 684 |  |
| 38 | third-party-open | 36 |  | 14/25 | 69 | 690 |  |
| 39 | third-party | 1 |  |  |  | 689 |  |
| 40 | catalogue-open | 37 |  | 31/48 | 89 | 725 |  |
| 41 | catalogue | 1 |  |  |  | 699 |  |

## Errors

### 1 cold start
```
11-23 15:38:47.373 E/australianrates( 4907): Not starting debugger since process cannot load the jdwp agent.
```
