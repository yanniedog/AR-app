# App explorer: 1.0.370 (426)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 16651 |  | 40/61 | 300 | 422 | 1 errors; start 3181ms |
| 2 | browse-open | 2530 |  | 2/2 | 32 | 558 | boot js-start 77715, layout-mounted 78274, cache-read 78474, hydrated 78886, splash-hide 78886, manifest 80492, resolved 80969, core-fetched 83599, core-saved 84144, rows-prepared 84270, search-index-idle 84270, leading-requested 84270, leading-scoped 85195, details-start 85205, pricing-ready 87943, last-gate 88085, details-fetched 89967, detail-filters-idle 93629, last-pricing 93629, suitability-built 93901, post-refresh-wait 94010, leading-page 94420, last-rows 105070, rates-ready 105624, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 236, pricing-scope-ms 14020, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 3, filter-rows 38533, filter-yields 12, filter-ms 451, sort-runs 5, sort-rows 1175, sort-yields 6, sort-ms 111 |
| 3 | browse | 0 |  |  |  | 574 |  |
| 4 | watchlist-open | 93 |  | 3/4 | 48 | 625 |  |
| 5 | watchlist | 0 |  |  |  | 489 |  |
| 6 | market-open | 36 |  | 15/27 | 65 | 494 |  |
| 7 | market | 0 |  |  |  | 490 |  |
| 8 | tools-open | 26 |  | 17/21 | 97 | 498 |  |
| 9 | tools | 0 |  |  |  | 494 |  |
| 10 | trends-open | 32 |  | 23/36 | 133 | 513 |  |
| 11 | trends | 0 |  |  |  | 513 |  |
| 12 | search-open | 34 |  | 35/43 | 101 | 581 |  |
| 13 | search | 0 |  |  |  | 615 |  |
| 14 | bank-rates-open | 25 |  | 23/31 | 81 | 623 |  |
| 15 | bank-rates | 0 |  |  |  | 621 |  |
| 16 | compare-open | 33 |  | 14/16 | 129 | 625 |  |
| 17 | compare | 0 |  |  |  | 626 |  |
| 18 | calculator-open | 36 |  | 17/25 | 77 | 633 |  |
| 19 | calculator | 0 |  |  |  | 630 |  |
| 20 | projections-open | 29 |  | 23/28 | 109 | 667 |  |
| 21 | projections | 0 |  |  |  | 664 |  |
| 22 | research-open | 44 |  | 19/27 | 101 | 663 |  |
| 23 | research | 0 |  |  |  | 655 |  |
| 24 | rba-open | 2651 |  | 20/28 | 101 | 688 |  |
| 25 | rba | 0 |  |  |  | 675 |  |
| 26 | rba-scrolled-open | 27 |  | 2/4 | 22 | 677 |  |
| 27 | rba-scrolled | 2210 |  | 44/67 | 69 | 676 |  |
| 28 | rba-response-open | 28 |  | 17/29 | 73 | 687 |  |
| 29 | rba-response | 0 |  |  |  | 683 |  |
| 30 | settings-open | 33 |  | 15/23 | 73 | 699 |  |
| 31 | settings | 0 |  |  |  | 693 |  |
| 32 | about-open | 30 |  | 13/23 | 73 | 700 |  |
| 33 | about | 0 |  |  |  | 698 |  |
| 34 | profile-open | 32 |  | 16/26 | 65 | 710 |  |
| 35 | profile | 0 |  |  |  | 708 |  |
| 36 | terms-open | 35 |  | 15/26 | 77 | 711 |  |
| 37 | terms | 0 |  |  |  | 710 |  |
| 38 | third-party-open | 29 |  | 12/22 | 77 | 717 |  |
| 39 | third-party | 0 |  |  |  | 715 |  |
| 40 | catalogue-open | 30 |  | 32/43 | 105 | 765 |  |
| 41 | catalogue | 0 |  |  |  | 738 |  |

## Errors

### 1 cold start
```
11-24 04:45:03.481 E/australianrates( 4734): Not starting debugger since process cannot load the jdwp agent.
```
