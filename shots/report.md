# App explorer: 1.0.359 (415)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 17149 |  | 38/49 | 300 | 415 | 1 errors; start 3693ms |
| 2 | browse-open | 5098 |  | 2/2 | 48 | 549 | boot js-start 81474, layout-mounted 82019, cache-read 82347, hydrated 82617, splash-hide 82857, manifest 84062, resolved 84787, core-fetched 87686, core-saved 88034, rows-prepared 88344, search-index-idle 88344, leading-requested 88344, details-start 89445, leading-scoped 89569, pricing-ready 90989, last-gate 92326, details-fetched 93727, detail-filters-idle 95921, last-pricing 95921, suitability-built 96145, post-refresh-wait 96225, leading-page 96861, last-rows 111477, rates-ready 112148, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 253, pricing-scope-ms 16884, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 3, filter-rows 38533, filter-yields 11, filter-ms 1563, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 95 |
| 3 | browse | 0 |  |  |  | 563 |  |
| 4 | watchlist-open | 103 |  | 3/4 | 69 | 622 |  |
| 5 | watchlist | 0 |  |  |  | 489 |  |
| 6 | market-open | 34 |  | 13/25 | 61 | 496 |  |
| 7 | market | 0 |  |  |  | 489 |  |
| 8 | tools-open | 28 |  | 15/20 | 300 | 498 |  |
| 9 | tools | 0 |  |  |  | 494 |  |
| 10 | trends-open | 38 |  | 28/37 | 129 | 512 |  |
| 11 | trends | 0 |  |  |  | 510 |  |
| 12 | search-open | 56 |  | 30/37 | 133 | 583 |  |
| 13 | search | 0 |  |  |  | 629 |  |
| 14 | bank-rates-open | 27 |  | 16/26 | 69 | 621 |  |
| 15 | bank-rates | 0 |  |  |  | 616 |  |
| 16 | compare-open | 31 |  | 12/15 | 101 | 622 |  |
| 17 | compare | 0 |  |  |  | 623 |  |
| 18 | calculator-open | 30 |  | 18/25 | 105 | 630 |  |
| 19 | calculator | 0 |  |  |  | 627 |  |
| 20 | projections-open | 31 |  | 28/38 | 85 | 639 |  |
| 21 | projections | 0 |  |  |  | 636 |  |
| 22 | research-open | 28 |  | 18/30 | 69 | 653 |  |
| 23 | research | 0 |  |  |  | 647 |  |
| 24 | rba-open | 32 |  | 13/22 | 97 | 656 |  |
| 25 | rba | 0 |  |  |  | 651 |  |
| 26 | rba-scrolled-open | 30 |  | 3/4 | 32 | 653 |  |
| 27 | rba-scrolled | 2118 |  | 27/53 | 61 | 652 |  |
| 28 | rba-response-open | 29 |  | 19/32 | 85 | 663 |  |
| 29 | rba-response | 0 |  |  |  | 660 |  |
| 30 | settings-open | 33 |  | 19/27 | 81 | 676 |  |
| 31 | settings | 0 |  |  |  | 670 |  |
| 32 | about-open | 37 |  | 12/21 | 81 | 678 |  |
| 33 | about | 0 |  |  |  | 676 |  |
| 34 | profile-open | 34 |  | 13/23 | 93 | 687 |  |
| 35 | profile | 0 |  |  |  | 685 |  |
| 36 | terms-open | 30 |  | 14/22 | 57 | 689 |  |
| 37 | terms | 0 |  |  |  | 688 |  |
| 38 | third-party-open | 32 |  | 13/23 | 69 | 694 |  |
| 39 | third-party | 0 |  |  |  | 693 |  |
| 40 | catalogue-open | 30 |  | 35/49 | 93 | 742 |  |
| 41 | catalogue | 0 |  |  |  | 715 |  |

## Errors

### 1 cold start
```
11-23 18:46:28.608 E/australianrates( 4877): Not starting debugger since process cannot load the jdwp agent.
```
