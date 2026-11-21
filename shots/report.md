# App explorer: 1.0.338 (394)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 20266 |  | 38/49 | 400 | 524 | 1 errors; start 3747ms |
| 2 | browse-open | 2711 |  | 2/2 | 32 | 564 | boot js-start 73713, layout-mounted 74248, cache-read 74722, hydrated 75113, splash-hide 75113, manifest 76129, resolved 77054, core-fetched 79812, core-saved 80329, rows-prepared 80542, search-index-idle 80542, details-start 81496, pricing-ready 82791, details-fetched 87495, detail-filters-idle 89766, suitability-built 90170, core-ready 98413, rates-ready 104762 |
| 3 | browse | 0 |  |  |  | 610 |  |
| 4 | watchlist-open | 68 |  | 3/4 | 57 | 612 |  |
| 5 | watchlist | 0 |  |  |  | 508 |  |
| 6 | market-open | 58 |  | 20/25 | 57 | 515 |  |
| 7 | market | 0 |  |  |  | 505 |  |
| 8 | tools-open | 50 |  | 15/21 | 200 | 520 |  |
| 9 | tools | 0 |  |  |  | 515 |  |
| 10 | trends-open | 54 |  | 27/38 | 150 | 533 |  |
| 11 | trends | 0 |  |  |  | 533 |  |
| 12 | search-open | 34 |  | 28/36 | 125 | 608 |  |
| 13 | search | 0 |  |  |  | 643 |  |
| 14 | bank-rates-open | 43 |  | 19/25 | 109 | 638 |  |
| 15 | bank-rates | 0 |  |  |  | 636 |  |
| 16 | compare-open | 32 |  | 13/15 | 121 | 640 |  |
| 17 | compare | 0 |  |  |  | 642 |  |
| 18 | calculator-open | 35 |  | 15/21 | 101 | 649 |  |
| 19 | calculator | 0 |  |  |  | 645 |  |
| 20 | projections-open | 40 |  | 25/36 | 101 | 657 |  |
| 21 | projections | 0 |  |  |  | 654 |  |
| 22 | research-open | 31 |  | 22/32 | 69 | 671 |  |
| 23 | research | 0 |  |  |  | 663 |  |
| 24 | rba-open | 2660 |  | 19/25 | 93 | 673 |  |
| 25 | rba | 0 |  |  |  | 668 |  |
| 26 | rba-scrolled-open | 39 |  | 4/4 | 32 | 670 |  |
| 27 | rba-scrolled | 2161 |  | 36/60 | 69 | 670 |  |
| 28 | rba-response-open | 39 |  | 19/29 | 81 | 681 |  |
| 29 | rba-response | 0 |  |  |  | 678 |  |
| 30 | settings-open | 34 |  | 16/25 | 113 | 693 |  |
| 31 | settings | 0 |  |  |  | 688 |  |
| 32 | about-open | 30 |  | 14/24 | 65 | 695 |  |
| 33 | about | 0 |  |  |  | 693 |  |
| 34 | profile-open | 32 |  | 17/24 | 69 | 706 |  |
| 35 | profile | 0 |  |  |  | 698 |  |
| 36 | terms-open | 38 |  | 16/23 | 101 | 666 |  |
| 37 | terms | 0 |  |  |  | 665 |  |
| 38 | third-party-open | 32 |  | 18/23 | 97 | 668 |  |
| 39 | third-party | 0 |  |  |  | 667 |  |
| 40 | catalogue-open | 38 |  | 32/43 | 101 | 689 |  |
| 41 | catalogue | 0 |  |  |  | 657 |  |

## Errors

### 1 cold start
```
11-21 06:24:02.090 E/australianrates( 4670): Not starting debugger since process cannot load the jdwp agent.
```
