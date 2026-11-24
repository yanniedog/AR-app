# App explorer: 1.0.371 (427)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 11773 |  | 37/56 | 250 | 430 | 1 errors; start 2033ms; boot js-start 65961, layout-mounted 66237, cache-read 66322, hydrated 66539, splash-hide 66539, manifest 67726, resolved 68185, core-fetched 69672, core-saved 70201, rows-prepared 70495, search-index-idle 70495, leading-requested 70495, details-start 70824, leading-scoped 71057, pricing-ready 73071, last-gate 73141, details-fetched 74364, detail-filters-idle 76259, last-pricing 76259, suitability-built 76424, post-refresh-wait 76539, leading-page 76973, last-rows 84331, rates-ready 84603, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 161, pricing-scope-ms 10140, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 4, filter-rows 63344, filter-yields 10, filter-ms 157, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 44 |
| 2 | browse-open | 64 |  |  |  | 573 |  |
| 3 | browse | 1 |  |  |  | 653 |  |
| 4 | watchlist-open | 2335 |  | 4/4 | 40 | 544 |  |
| 5 | watchlist | 0 |  |  |  | 538 |  |
| 6 | market-open | 29 |  | 11/25 | 46 | 536 |  |
| 7 | market | 0 |  |  |  | 533 |  |
| 8 | tools-open | 30 |  | 14/23 | 125 | 550 |  |
| 9 | tools | 0 |  |  |  | 544 |  |
| 10 | trends-open | 24 |  | 20/37 | 77 | 563 |  |
| 11 | trends | 0 |  |  |  | 564 |  |
| 12 | search-open | 25 |  | 30/44 | 81 | 602 |  |
| 13 | search | 0 |  |  |  | 600 |  |
| 14 | bank-rates-open | 41 |  | 14/28 | 73 | 608 |  |
| 15 | bank-rates | 0 |  |  |  | 606 |  |
| 16 | compare-open | 28 |  | 14/19 | 81 | 610 |  |
| 17 | compare | 0 |  |  |  | 610 |  |
| 18 | calculator-open | 24 |  | 13/25 | 61 | 618 |  |
| 19 | calculator | 0 |  |  |  | 615 |  |
| 20 | projections-open | 23 |  | 14/29 | 61 | 627 |  |
| 21 | projections | 0 |  |  |  | 624 |  |
| 22 | research-open | 35 |  | 17/32 | 48 | 640 |  |
| 23 | research | 0 |  |  |  | 635 |  |
| 24 | rba-open | 36 |  | 13/25 | 73 | 665 |  |
| 25 | rba | 1 |  |  |  | 652 |  |
| 26 | rba-scrolled-open | 27 |  | 2/4 | 27 | 654 |  |
| 27 | rba-scrolled | 2071 |  | 27/72 | 53 | 654 |  |
| 28 | rba-response-open | 29 |  | 14/32 | 89 | 666 |  |
| 29 | rba-response | 0 |  |  |  | 662 |  |
| 30 | settings-open | 31 |  | 13/30 | 65 | 676 |  |
| 31 | settings | 0 |  |  |  | 672 |  |
| 32 | about-open | 21 |  | 10/26 | 48 | 678 |  |
| 33 | about | 0 |  |  |  | 677 |  |
| 34 | profile-open | 27 |  | 11/26 | 57 | 688 |  |
| 35 | profile | 0 |  |  |  | 686 |  |
| 36 | terms-open | 28 |  | 13/27 | 53 | 689 |  |
| 37 | terms | 0 |  |  |  | 688 |  |
| 38 | third-party-open | 22 |  | 13/25 | 57 | 695 |  |
| 39 | third-party | 0 |  |  |  | 693 |  |
| 40 | catalogue-open | 27 |  | 27/45 | 85 | 740 |  |
| 41 | catalogue | 0 |  |  |  | 712 |  |

## Errors

### 1 cold start
```
11-24 14:15:41.135 E/australianrates( 4985): Not starting debugger since process cannot load the jdwp agent.
```
