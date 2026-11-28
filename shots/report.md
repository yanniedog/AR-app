# App explorer: 1.0.396 (452)

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-28

Mode script | 45 steps | crashes 0 | step failures 1 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 11981 |  | 33/49 | 300 | 505 | 1 errors; start 2691ms |
| 2 | browse-open | 2654 |  | 2/2 | 44 | 513 | boot js-start 82064, layout-mounted 82468, cache-read 82625, hydrated 82724, splash-hide 82817, manifest 83714, resolved 84281, core-fetched 86131, core-saved 86543, pricing-wait-suitability 86696, search-index-idle 86696, details-start 87127, details-fetched 90789, rows-prepared 92425, detail-filters-idle 92425, leading-requested 92425, last-pricing 92425, suitability-built 92878, post-refresh-wait 93106, leading-scoped 93696, leading-page 93696, pricing-ready 104998, last-rows 104998, rates-ready 105292, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 196, pricing-scope-ms 12152, filter-runs 1, filter-rows 6944, filter-yields 5, filter-ms 113, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 16 |
| 3 | browse | 0 |  |  |  | 540 |  |
| 4 | watchlist-open | 175 |  | 5/5 | 73 | 710 |  |
| 5 | watchlist | 0 |  |  |  | 472 |  |
| 6 | market-open | 2413 |  | 14/21 | 69 | 475 |  |
| 7 | market | 0 |  |  |  | 464 |  |
| 8 | tools-open | 32 |  | 14/22 | 150 | 475 |  |
| 9 | tools | 0 |  |  |  | 471 |  |
| 10 | trends-open | 31 |  | 26/39 | 117 | 486 |  |
| 11 | trends | 0 |  |  |  | 483 |  |
| 12 | search-open | 26 |  | 26/32 | 150 | 547 |  |
| 13 | search | 0 |  |  |  | 596 |  |
| 14 | bank-rates-open | 26 |  | 21/31 | 85 | 596 |  |
| 15 | bank-rates | 0 |  |  |  | 589 |  |
| 16 | compare-open | 29 |  | 11/14 | 117 | 595 |  |
| 17 | compare | 0 |  |  |  | 594 |  |
| 18 | calculator-open | 29 |  | 15/21 | 77 | 604 |  |
| 19 | calculator | 0 |  |  |  | 600 |  |
| 20 | projections-open | 27 |  | 29/40 | 101 | 610 |  |
| 21 | projections | 0 |  |  |  | 615 |  |
| 22 | research-open | 4519 |  | 18/29 | 73 | 623 |  |
| 23 | research | 0 |  |  |  | 627 |  |
| 24 | rba-open | 2423 |  | 14/23 | 73 | 657 |  |
| 25 | rba | 0 |  |  |  | 644 |  |
| 26 | rba-scrolled-open | 32 |  | 2/4 | 32 | 646 |  |
| 27 | rba-scrolled | 2216 |  | 41/65 | 69 | 646 |  |
| 28 | rba-response-open | 25 |  | 19/32 | 81 | 656 |  |
| 29 | rba-response | 0 |  |  |  | 653 |  |
| 30 | settings-open | 26 |  | 23/30 | 89 | 667 |  |
| 31 | settings | 2947 |  | 54/81 | 81 | 661 |  |
| 32 | debug-log-open | 30 |  | 12/21 | 73 | 669 |  |
| 33 | debug-log-tap-1 | 21 |  | 2/2 | 16 | 667 |  |
| 34 | debug-log-tap-2 | 23 |  | 29/50 | 69 | 673 |  |
| 35 | debug-log | 0 |  |  |  | 672 |  |
| 36 | profile-open | 30 |  | 15/26 | 73 | 678 |  |
| 37 | profile | 0 |  |  |  | 677 |  |
| 38 | product-history-open | 3322 |  | 25/36 | 81 | 740 |  |
| 39 | product-history-scroll | 715 |  | 34/51 | 73 | 725 |  |
| 40 | product-history | 0 |  | 0/2 | 9 | 724 |  |
| 41 | bank-history-open | 3384 |  | 23/32 | 81 | 739 |  |
| 42 | bank-history | 0 |  |  |  | 723 |  |
| 43 | mortgage-history-open | 31 |  | 31/44 | 65 | 748 |  |
| 44 | mortgage-history-scroll | 739 |  | 36/53 | 85 | 782 |  |
| 45 | mortgage-history | 0 |  |  |  | 747 | timeout waiting for {"label":"1 year","clickable":true,"enabled":true} |

## Errors

### 1 cold start
```
11-28 13:39:21.347 E/australianrates( 5071): Not starting debugger since process cannot load the jdwp agent.
```
