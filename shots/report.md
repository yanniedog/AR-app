# App explorer: 1.0.392 (448)

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-28

Mode script | 44 steps | crashes 0 | step failures 1 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 13836 |  | 39/47 | 300 | 500 | 1 errors; start 1933ms |
| 2 | browse-open | 76 |  |  |  | 462 |  |
| 3 | browse | 0 |  | 2/2 | 22 | 548 | boot js-start 78668, layout-mounted 78885, cache-read 78955, hydrated 79096, splash-hide 79096, manifest 80388, resolved 81179, core-fetched 83240, core-saved 83540, pricing-wait-suitability 83639, search-index-idle 83639, details-start 83776, details-fetched 87798, rows-prepared 90544, detail-filters-idle 90544, leading-requested 90544, last-pricing 90544, suitability-built 90911, post-refresh-wait 90972, leading-scoped 91711, leading-page 91711, pricing-ready 109749, last-rows 109749, rates-ready 110042, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 231, pricing-scope-ms 18857, filter-runs 1, filter-rows 6944, filter-yields 5, filter-ms 176, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 25 |
| 4 | watchlist-open | 75 |  | 4/5 | 40 | 710 |  |
| 5 | watchlist | 0 |  |  |  | 462 |  |
| 6 | market-open | 2413 |  | 18/25 | 61 | 460 |  |
| 7 | market | 0 |  |  |  | 459 |  |
| 8 | tools-open | 27 |  | 15/22 | 133 | 473 |  |
| 9 | tools | 0 |  |  |  | 470 |  |
| 10 | trends-open | 31 |  | 27/42 | 85 | 489 |  |
| 11 | trends | 0 |  |  |  | 485 |  |
| 12 | search-open | 25 |  | 32/41 | 109 | 559 |  |
| 13 | search | 0 |  |  |  | 603 |  |
| 14 | bank-rates-open | 30 |  | 17/26 | 97 | 596 |  |
| 15 | bank-rates | 0 |  |  |  | 593 |  |
| 16 | compare-open | 36 |  | 15/17 | 93 | 597 |  |
| 17 | compare | 0 |  |  |  | 600 |  |
| 18 | calculator-open | 32 |  | 16/24 | 69 | 608 |  |
| 19 | calculator | 0 |  |  |  | 608 |  |
| 20 | projections-open | 32 |  | 25/37 | 101 | 617 |  |
| 21 | projections | 0 |  |  |  | 612 |  |
| 22 | research-open | 31 |  | 21/28 | 77 | 640 |  |
| 23 | research | 0 |  |  |  | 632 |  |
| 24 | rba-open | 27 |  | 12/23 | 81 | 657 |  |
| 25 | rba | 0 |  |  |  | 651 |  |
| 26 | rba-scrolled-open | 32 |  | 2/4 | 16 | 651 |  |
| 27 | rba-scrolled | 2222 |  | 50/76 | 69 | 649 |  |
| 28 | rba-response-open | 28 |  | 18/30 | 69 | 659 |  |
| 29 | rba-response | 0 |  |  |  | 656 |  |
| 30 | settings-open | 24 |  | 16/28 | 69 | 668 |  |
| 31 | settings | 2928 |  | 54/89 | 81 | 665 |  |
| 32 | debug-log-open | 27 |  | 13/23 | 69 | 672 |  |
| 33 | debug-log-tap-1 | 21 |  | 2/2 | 18 | 671 |  |
| 34 | debug-log-tap-2 | 21 |  | 28/52 | 73 | 678 |  |
| 35 | debug-log | 1 |  |  |  | 676 |  |
| 36 | profile-open | 25 |  | 18/28 | 65 | 685 |  |
| 37 | profile | 0 |  |  |  | 683 |  |
| 38 | product-history-open | 3268 |  | 23/36 | 65 | 711 |  |
| 39 | product-history-scroll | 1453 |  | 51/72 | 89 | 727 |  |
| 40 | product-history | 0 |  | 1/1 | 16 | 704 | timeout waiting for {"label":"1 year","clickable":true,"enabled":true} |
| 41 | bank-history-open | 42 |  | 26/32 | 101 | 726 |  |
| 42 | bank-history | 0 |  |  |  | 712 |  |
| 43 | catalogue-open | 31 |  | 35/48 | 93 | 741 |  |
| 44 | catalogue | 0 |  |  |  | 703 |  |

## Errors

### 1 cold start
```
11-28 02:39:07.258 E/australianrates( 4862): Not starting debugger since process cannot load the jdwp agent.
```
