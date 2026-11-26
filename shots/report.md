# App explorer: 1.0.376 (432)

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-26

Mode script | 43 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 20128 |  | 43/60 | 350 | 416 | 1 errors; start 3178ms |
| 2 | browse-open | 2884 |  | 2/2 | 81 | 552 | boot js-start 71366, layout-mounted 71795, cache-read 71981, hydrated 72434, splash-hide 72434, manifest 73565, resolved 74701, core-fetched 77833, core-saved 78557, search-index-idle 78838, leading-requested 78838, details-start 79708, leading-scoped 79944, pricing-ready 82920, details-fetched 85612, rows-prepared 89619, detail-filters-idle 89619, last-pricing 89619, suitability-built 89886, post-refresh-wait 90065, leading-page 90696, last-rows 100554, rates-ready 101340, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 209, pricing-scope-ms 13852, leading-gated 1, filter-runs 2, filter-rows 31602, filter-yields 6, filter-ms 674, sort-runs 4, sort-rows 1183, sort-yields 4, sort-ms 93 |
| 3 | browse | 1 |  |  |  | 473 |  |
| 4 | watchlist-open | 74 |  | 5/5 | 81 | 619 |  |
| 5 | watchlist | 1 |  |  |  | 521 |  |
| 6 | market-open | 88 |  | 20/27 | 65 | 512 |  |
| 7 | market | 1 |  |  |  | 508 |  |
| 8 | tools-open | 26 |  | 14/22 | 117 | 524 |  |
| 9 | tools | 1 |  |  |  | 519 |  |
| 10 | trends-open | 28 |  | 26/41 | 109 | 537 |  |
| 11 | trends | 1 |  |  |  | 533 |  |
| 12 | search-open | 32 |  | 26/38 | 101 | 601 |  |
| 13 | search | 1 |  |  |  | 648 |  |
| 14 | bank-rates-open | 41 |  | 17/29 | 73 | 646 |  |
| 15 | bank-rates | 1 |  |  |  | 640 |  |
| 16 | compare-open | 24 |  | 10/16 | 97 | 648 |  |
| 17 | compare | 0 |  |  |  | 646 |  |
| 18 | calculator-open | 31 |  | 12/24 | 69 | 657 |  |
| 19 | calculator | 0 |  |  |  | 653 |  |
| 20 | projections-open | 24 |  | 28/38 | 93 | 681 |  |
| 21 | projections | 0 |  |  |  | 682 |  |
| 22 | research-open | 24 |  | 18/32 | 65 | 683 |  |
| 23 | research | 0 |  |  |  | 685 |  |
| 24 | rba-open | 2631 |  | 10/23 | 81 | 702 |  |
| 25 | rba | 0 |  |  |  | 702 |  |
| 26 | rba-scrolled-open | 27 |  | 2/4 | 18 | 704 |  |
| 27 | rba-scrolled | 2257 |  | 45/81 | 65 | 703 |  |
| 28 | rba-response-open | 33 |  | 20/30 | 81 | 698 |  |
| 29 | rba-response | 1 |  |  |  | 662 |  |
| 30 | settings-open | 26 |  | 18/28 | 89 | 671 |  |
| 31 | settings | 2949 |  | 48/88 | 81 | 665 |  |
| 32 | debug-log-open | 28 |  | 14/23 | 81 | 668 |  |
| 33 | debug-log-tap-1 | 24 |  | 2/2 | 16 | 667 |  |
| 34 | debug-log-tap-2 | 24 |  | 26/54 | 61 | 671 |  |
| 35 | debug-log | 0 |  |  |  | 670 |  |
| 36 | profile-open | 28 |  | 13/24 | 77 | 677 |  |
| 37 | profile | 1 |  |  |  | 675 |  |
| 38 | terms-open | 25 |  | 14/24 | 77 | 676 |  |
| 39 | terms | 1 |  |  |  | 675 |  |
| 40 | third-party-open | 35 |  | 13/24 | 73 | 678 |  |
| 41 | third-party | 1 |  |  |  | 677 |  |
| 42 | catalogue-open | 23 |  | 35/47 | 97 | 713 |  |
| 43 | catalogue | 1 |  |  |  | 688 |  |

## Errors

### 1 cold start
```
11-26 02:00:40.818 E/australianrates( 4574): Not starting debugger since process cannot load the jdwp agent.
```
