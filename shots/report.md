# App explorer: 1.0.338 (394)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 19396 |  | 65/81 | 200 | 487 | 4 errors; start 2617ms |
| 2 | browse-open | 79 |  |  |  | 519 |  |
| 3 | browse | 0 |  | 2/2 | 48 | 563 | boot js-start 80177, layout-mounted 80512, cache-read 80576, hydrated 80668, splash-hide 80755, manifest 81891, resolved 82342, core-fetched 84756, core-saved 85047, rows-prepared 85453, search-index-idle 85453, details-start 86328, pricing-ready 86976, details-fetched 90437, detail-filters-idle 95364, suitability-built 95887, core-ready 111953, rates-ready 116920 |
| 4 | watchlist-open | 56 |  | 2/2 | 31 | 709 |  |
| 5 | watchlist | 0 |  |  |  | 505 |  |
| 6 | market-open | 126 |  | 23/32 | 69 | 511 |  |
| 7 | market | 0 |  |  |  | 492 |  |
| 8 | tools-open | 32 |  | 18/22 | 150 | 500 |  |
| 9 | tools | 1 |  |  |  | 496 |  |
| 10 | trends-open | 27 |  | 25/40 | 105 | 511 |  |
| 11 | trends | 0 |  |  |  | 508 |  |
| 12 | search-open | 27 |  | 29/39 | 129 | 560 |  |
| 13 | search | 0 |  |  |  | 600 |  |
| 14 | bank-rates-open | 27 |  | 17/25 | 81 | 599 |  |
| 15 | bank-rates | 0 |  |  |  | 592 |  |
| 16 | compare-open | 31 |  | 13/17 | 101 | 598 |  |
| 17 | compare | 0 |  |  |  | 597 |  |
| 18 | calculator-open | 24 |  | 15/23 | 77 | 608 |  |
| 19 | calculator | 0 |  |  |  | 604 |  |
| 20 | projections-open | 28 |  | 25/37 | 105 | 640 |  |
| 21 | projections | 0 |  |  |  | 635 |  |
| 22 | research-open | 27 |  | 22/29 | 85 | 641 |  |
| 23 | research | 0 |  |  |  | 630 |  |
| 24 | rba-open | 2441 |  | 14/22 | 121 | 641 |  |
| 25 | rba | 0 |  |  |  | 639 |  |
| 26 | rba-scrolled-open | 59 |  | 4/4 | 36 | 638 |  |
| 27 | rba-scrolled | 2107 |  | 34/62 | 69 | 637 |  |
| 28 | rba-response-open | 30 |  | 23/34 | 69 | 649 |  |
| 29 | rba-response | 0 |  |  |  | 645 |  |
| 30 | settings-open | 34 |  | 14/24 | 93 | 661 |  |
| 31 | settings | 0 |  |  |  | 655 |  |
| 32 | about-open | 31 |  | 18/24 | 69 | 662 |  |
| 33 | about | 0 |  |  |  | 660 |  |
| 34 | profile-open | 29 |  | 15/23 | 73 | 672 |  |
| 35 | profile | 0 |  |  |  | 670 |  |
| 36 | terms-open | 28 |  | 14/23 | 81 | 673 |  |
| 37 | terms | 0 |  |  |  | 672 |  |
| 38 | third-party-open | 30 |  | 14/21 | 77 | 678 |  |
| 39 | third-party | 0 |  |  |  | 676 |  |
| 40 | catalogue-open | 33 |  | 36/47 | 81 | 718 |  |
| 41 | catalogue | 0 |  |  |  | 687 |  |

## Errors

### 1 cold start
```
11-21 07:03:30.776 E/australianrates( 4957): Not starting debugger since process cannot load the jdwp agent.
11-21 07:03:43.695 E/unknown:SurfaceMountingManager( 4957): Stopping surface [1]
11-21 07:03:43.698 E/unknown:IntBufferBatchMountItem( 4957): Skipping batch of MountItems; was stopped [1].
11-21 07:03:43.699 E/unknown:SurfaceMountingManager( 4957): Surface [1] was stopped on SurfaceMountingManager.
```
