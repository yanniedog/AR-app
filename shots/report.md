# App explorer: 1.0.391 (447)

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-28

Mode script | 44 steps | crashes 0 | step failures 1 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 20725 |  | 41/51 | 200 | 526 | 1 errors; start 3474ms |
| 2 | browse-open | 4738 |  | 2/2 | 40 | 514 | boot js-start 73273, layout-mounted 73879, cache-read 74048, hydrated 74387, splash-hide 74387, manifest 75473, resolved 76675, core-fetched 80387, core-saved 81233, search-index-idle 81396, leading-requested 81396, details-start 82178, leading-scoped 82253, pricing-ready 82505, details-fetched 87629, rows-prepared 89792, detail-filters-idle 89792, last-pricing 89792, suitability-built 90199, post-refresh-wait 90495, leading-page 91546, last-rows 104246, rates-ready 105067, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 210, pricing-scope-ms 14458, leading-gated 1, filter-runs 2, filter-rows 31912, filter-yields 7, filter-ms 684, sort-runs 4, sort-rows 1191, sort-yields 4, sort-ms 51 |
| 3 | browse | 0 |  |  |  | 536 |  |
| 4 | watchlist-open | 56 |  | 5/5 | 48 | 710 |  |
| 5 | watchlist | 0 |  |  |  | 515 |  |
| 6 | market-open | 2438 |  | 17/24 | 69 | 519 |  |
| 7 | market | 0 |  |  |  | 518 |  |
| 8 | tools-open | 29 |  | 15/21 | 121 | 527 |  |
| 9 | tools | 0 |  |  |  | 523 |  |
| 10 | trends-open | 29 |  | 30/41 | 93 | 539 |  |
| 11 | trends | 0 |  |  |  | 536 |  |
| 12 | search-open | 32 |  | 34/40 | 133 | 576 |  |
| 13 | search | 0 |  |  |  | 589 |  |
| 14 | bank-rates-open | 30 |  | 17/27 | 101 | 580 |  |
| 15 | bank-rates | 0 |  |  |  | 575 |  |
| 16 | compare-open | 25 |  | 10/14 | 150 | 578 |  |
| 17 | compare | 0 |  |  |  | 579 |  |
| 18 | calculator-open | 25 |  | 17/26 | 85 | 587 |  |
| 19 | calculator | 0 |  |  |  | 588 |  |
| 20 | projections-open | 26 |  | 29/38 | 85 | 596 |  |
| 21 | projections | 0 |  |  |  | 593 |  |
| 22 | research-open | 27 |  | 17/27 | 65 | 619 |  |
| 23 | research | 0 |  |  |  | 609 |  |
| 24 | rba-open | 2575 |  | 15/24 | 117 | 637 |  |
| 25 | rba | 0 |  |  |  | 630 |  |
| 26 | rba-scrolled-open | 24 |  | 1/4 | 26 | 630 |  |
| 27 | rba-scrolled | 2211 |  | 39/67 | 73 | 628 |  |
| 28 | rba-response-open | 26 |  | 20/28 | 89 | 639 |  |
| 29 | rba-response | 0 |  |  |  | 636 |  |
| 30 | settings-open | 27 |  | 16/27 | 69 | 648 |  |
| 31 | settings | 2886 |  | 52/84 | 81 | 645 |  |
| 32 | debug-log-open | 30 |  | 13/23 | 81 | 652 |  |
| 33 | debug-log-tap-1 | 22 |  | 2/2 | 16 | 651 |  |
| 34 | debug-log-tap-2 | 24 |  | 26/49 | 69 | 658 |  |
| 35 | debug-log | 0 |  |  |  | 657 |  |
| 36 | profile-open | 34 |  | 13/24 | 61 | 663 |  |
| 37 | profile | 0 |  |  |  | 662 |  |
| 38 | product-history-open | 3312 |  | 29/39 | 69 | 737 |  |
| 39 | product-history-scroll | 1412 |  | 52/71 | 85 | 750 |  |
| 40 | product-history | 0 |  | 1/1 | 16 | 737 | timeout waiting for {"label":"1 year","clickable":true,"enabled":true} |
| 41 | bank-history-open | 3446 |  | 22/33 | 73 | 743 |  |
| 42 | bank-history | 0 |  |  |  | 730 |  |
| 43 | catalogue-open | 28 |  | 33/44 | 117 | 767 |  |
| 44 | catalogue | 0 |  |  |  | 731 |  |

## Errors

### 1 cold start
```
11-27 21:39:54.823 E/australianrates( 4728): Not starting debugger since process cannot load the jdwp agent.
```
