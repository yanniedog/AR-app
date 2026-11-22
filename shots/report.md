# App explorer: 1.0.353 (409)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 16098 |  | 43/57 | 200 | 420 | 1 errors; start 3208ms |
| 2 | browse-open | 67 |  | 1/2 | 32 | 548 | boot js-start 85319, layout-mounted 85960, cache-read 86227, hydrated 86464, splash-hide 86464, manifest 87707, resolved 88178, core-fetched 90703, core-saved 91144, rows-prepared 91432, search-index-idle 91432, leading-requested 91432, leading-scoped 92311, details-start 92322, pricing-ready 94259, last-gate 94643, details-fetched 96055, detail-filters-idle 98434, last-pricing 98434, suitability-built 98704, post-refresh-wait 98842, leading-page 99291, last-rows 108260, rates-ready 108573, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 193, pricing-scope-ms 11528, leading-short 1, leading-short-rows 0, leading-scope-rows 113, leading-visible-rows 0, leading-nonstd-rows 10, filter-runs 3, filter-rows 38576, filter-yields 11, filter-ms 476, sort-runs 5, sort-rows 1182, sort-yields 5, sort-ms 45 |
| 3 | browse | 0 |  |  |  | 568 |  |
| 4 | watchlist-open | 75 |  | 5/5 | 53 | 624 |  |
| 5 | watchlist | 0 |  |  |  | 488 |  |
| 6 | market-open | 86 |  | 16/24 | 65 | 489 |  |
| 7 | market | 0 |  |  |  | 484 |  |
| 8 | tools-open | 47 |  | 16/19 | 300 | 495 |  |
| 9 | tools | 0 |  |  |  | 489 |  |
| 10 | trends-open | 37 |  | 35/40 | 121 | 507 |  |
| 11 | trends | 0 |  |  |  | 505 |  |
| 12 | search-open | 41 |  | 31/38 | 150 | 580 |  |
| 13 | search | 0 |  |  |  | 617 |  |
| 14 | bank-rates-open | 44 |  | 19/27 | 85 | 617 |  |
| 15 | bank-rates | 0 |  |  |  | 611 |  |
| 16 | compare-open | 38 |  | 10/14 | 150 | 619 |  |
| 17 | compare | 0 |  |  |  | 618 |  |
| 18 | calculator-open | 35 |  | 18/22 | 93 | 629 |  |
| 19 | calculator | 0 |  |  |  | 625 |  |
| 20 | projections-open | 37 |  | 25/31 | 105 | 660 |  |
| 21 | projections | 0 |  |  |  | 656 |  |
| 22 | research-open | 55 |  | 22/29 | 101 | 648 |  |
| 23 | research | 0 |  |  |  | 650 |  |
| 24 | rba-open | 39 |  | 20/27 | 85 | 660 |  |
| 25 | rba | 0 |  |  |  | 658 |  |
| 26 | rba-scrolled-open | 41 |  | 2/4 | 32 | 657 |  |
| 27 | rba-scrolled | 2116 |  | 32/57 | 73 | 656 |  |
| 28 | rba-response-open | 40 |  | 21/33 | 81 | 667 |  |
| 29 | rba-response | 0 |  |  |  | 663 |  |
| 30 | settings-open | 38 |  | 17/28 | 69 | 678 |  |
| 31 | settings | 0 |  |  |  | 673 |  |
| 32 | about-open | 37 |  | 18/24 | 85 | 681 |  |
| 33 | about | 0 |  |  |  | 679 |  |
| 34 | profile-open | 44 |  | 18/22 | 77 | 691 |  |
| 35 | profile | 0 |  |  |  | 689 |  |
| 36 | terms-open | 35 |  | 14/25 | 77 | 692 |  |
| 37 | terms | 0 |  |  |  | 691 |  |
| 38 | third-party-open | 37 |  | 17/25 | 73 | 697 |  |
| 39 | third-party | 0 |  |  |  | 696 |  |
| 40 | catalogue-open | 38 |  | 33/43 | 109 | 733 |  |
| 41 | catalogue | 0 |  |  |  | 695 |  |

## Errors

### 1 cold start
```
11-22 09:17:04.396 E/australianrates( 4925): Not starting debugger since process cannot load the jdwp agent.
```
