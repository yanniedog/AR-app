# App explorer: 1.0.368 (424)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 12660 |  | 44/57 | 250 | 448 | 1 errors; start 2906ms; boot js-start 70657, layout-mounted 71186, cache-read 71422, hydrated 71707, splash-hide 71707, manifest 72797, resolved 73346, core-fetched 75396, core-saved 75854, rows-prepared 76032, search-index-idle 76032, leading-requested 76032, details-start 76610, leading-scoped 76720, pricing-ready 78770, last-gate 78876, details-fetched 80652, detail-filters-idle 82311, last-pricing 82311, suitability-built 82619, post-refresh-wait 82769, leading-page 83194, last-rows 89776, rates-ready 89928, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 164, pricing-scope-ms 7856, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 3, filter-rows 38533, filter-yields 7, filter-ms 390, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 46 |
| 2 | browse-open | 77 |  |  |  | 564 |  |
| 3 | browse | 1 |  |  |  | 650 |  |
| 4 | watchlist-open | 4597 |  | 2/3 | 53 | 525 |  |
| 5 | watchlist | 0 |  |  |  | 522 |  |
| 6 | market-open | 23 |  | 10/22 | 48 | 525 |  |
| 7 | market | 0 |  |  |  | 521 |  |
| 8 | tools-open | 23 |  | 12/22 | 121 | 538 |  |
| 9 | tools | 0 |  |  |  | 533 |  |
| 10 | trends-open | 26 |  | 23/38 | 105 | 552 |  |
| 11 | trends | 0 |  |  |  | 552 |  |
| 12 | search-open | 21 |  | 26/44 | 109 | 591 |  |
| 13 | search | 0 |  |  |  | 590 |  |
| 14 | bank-rates-open | 30 |  | 18/30 | 81 | 596 |  |
| 15 | bank-rates | 0 |  |  |  | 595 |  |
| 16 | compare-open | 22 |  | 13/17 | 101 | 599 |  |
| 17 | compare | 0 |  |  |  | 601 |  |
| 18 | calculator-open | 21 |  | 14/26 | 65 | 608 |  |
| 19 | calculator | 0 |  |  |  | 605 |  |
| 20 | projections-open | 29 |  | 20/33 | 89 | 618 |  |
| 21 | projections | 0 |  |  |  | 615 |  |
| 22 | research-open | 28 |  | 17/30 | 81 | 632 |  |
| 23 | research | 0 |  |  |  | 626 |  |
| 24 | rba-open | 2470 |  | 13/27 | 73 | 655 |  |
| 25 | rba | 0 |  |  |  | 643 |  |
| 26 | rba-scrolled-open | 25 |  | 2/4 | 19 | 646 |  |
| 27 | rba-scrolled | 2187 |  | 41/82 | 65 | 645 |  |
| 28 | rba-response-open | 25 |  | 18/32 | 69 | 656 |  |
| 29 | rba-response | 0 |  |  |  | 652 |  |
| 30 | settings-open | 25 |  | 15/27 | 61 | 668 |  |
| 31 | settings | 0 |  |  |  | 662 |  |
| 32 | about-open | 30 |  | 12/24 | 57 | 669 |  |
| 33 | about | 0 |  |  |  | 668 |  |
| 34 | profile-open | 26 |  | 16/28 | 61 | 678 |  |
| 35 | profile | 0 |  |  |  | 676 |  |
| 36 | terms-open | 27 |  | 15/28 | 69 | 680 |  |
| 37 | terms | 0 |  |  |  | 678 |  |
| 38 | third-party-open | 30 |  | 10/24 | 69 | 685 |  |
| 39 | third-party | 0 |  |  |  | 684 |  |
| 40 | catalogue-open | 25 |  | 32/49 | 77 | 732 |  |
| 41 | catalogue | 0 |  |  |  | 702 |  |

## Errors

### 1 cold start
```
11-24 02:43:34.085 E/australianrates( 4959): Not starting debugger since process cannot load the jdwp agent.
```
