# App explorer: 1.0.374 (430)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 43 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 15595 |  | 58/79 | 200 | 482 | 4 errors; start 2273ms |
| 2 | browse-open | 2710 |  | 2/2 | 48 | 535 | boot js-start 79384, layout-mounted 79678, cache-read 79782, hydrated 79962, splash-hide 79962, manifest 81363, resolved 82014, core-fetched 83840, core-saved 84213, search-index-idle 84345, leading-requested 84345, details-start 84763, leading-scoped 84920, pricing-ready 85604, details-fetched 91254, rows-prepared 94390, detail-filters-idle 94390, last-pricing 94390, suitability-built 94661, post-refresh-wait 94776, leading-page 95294, last-rows 105468, rates-ready 106291, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 210, pricing-scope-ms 11731, leading-gated 1, filter-runs 3, filter-rows 56596, filter-yields 18, filter-ms 584, sort-runs 4, sort-rows 1177, sort-yields 4, sort-ms 53 |
| 3 | browse | 0 |  |  |  | 471 |  |
| 4 | watchlist-open | 106 |  | 5/6 | 53 | 608 |  |
| 5 | watchlist | 0 |  |  |  | 530 |  |
| 6 | market-open | 56 |  | 15/24 | 69 | 527 |  |
| 7 | market | 0 |  |  |  | 523 |  |
| 8 | tools-open | 40 |  | 16/22 | 117 | 531 |  |
| 9 | tools | 0 |  |  |  | 526 |  |
| 10 | trends-open | 80 |  | 29/39 | 113 | 544 |  |
| 11 | trends | 0 |  |  |  | 546 |  |
| 12 | search-open | 26 |  | 33/40 | 133 | 619 |  |
| 13 | search | 0 |  |  |  | 657 |  |
| 14 | bank-rates-open | 30 |  | 22/31 | 85 | 654 |  |
| 15 | bank-rates | 0 |  |  |  | 652 |  |
| 16 | compare-open | 28 |  | 10/16 | 133 | 656 |  |
| 17 | compare | 0 |  |  |  | 658 |  |
| 18 | calculator-open | 33 |  | 17/24 | 85 | 664 |  |
| 19 | calculator | 0 |  |  |  | 661 |  |
| 20 | projections-open | 25 |  | 32/39 | 93 | 700 |  |
| 21 | projections | 0 |  |  |  | 693 |  |
| 22 | research-open | 40 |  | 16/26 | 81 | 682 |  |
| 23 | research | 0 |  |  |  | 646 |  |
| 24 | rba-open | 2438 |  | 14/23 | 81 | 669 |  |
| 25 | rba | 0 |  |  |  | 657 |  |
| 26 | rba-scrolled-open | 29 |  | 3/4 | 26 | 660 |  |
| 27 | rba-scrolled | 2173 |  | 48/75 | 77 | 657 |  |
| 28 | rba-response-open | 34 |  | 23/34 | 65 | 664 |  |
| 29 | rba-response | 0 |  |  |  | 660 |  |
| 30 | settings-open | 28 |  | 14/23 | 89 | 669 |  |
| 31 | settings | 0 |  |  |  | 664 |  |
| 32 | debug-log-open | 23 |  | 16/27 | 77 | 667 |  |
| 33 | debug-log-tap-1 | 26 |  | 3/3 | 16 | 666 |  |
| 34 | debug-log-tap-2 | 22 |  | 28/50 | 65 | 670 |  |
| 35 | debug-log | 0 |  |  |  | 669 |  |
| 36 | profile-open | 31 |  | 16/24 | 77 | 676 |  |
| 37 | profile | 0 |  |  |  | 674 |  |
| 38 | terms-open | 32 |  | 16/23 | 77 | 676 |  |
| 39 | terms | 0 |  |  |  | 675 |  |
| 40 | third-party-open | 30 |  | 15/21 | 81 | 718 |  |
| 41 | third-party | 0 |  |  |  | 737 |  |
| 42 | catalogue-open | 71 |  | 28/39 | 150 | 722 |  |
| 43 | catalogue | 0 |  |  |  | 684 |  |

## Errors

### 1 cold start
```
11-25 05:26:51.112 E/australianrates( 4863): Not starting debugger since process cannot load the jdwp agent.
11-25 05:27:00.197 E/unknown:SurfaceMountingManager( 4863): Stopping surface [1]
11-25 05:27:00.212 E/unknown:SurfaceMountingManager( 4863): Surface [1] was stopped on SurfaceMountingManager.
11-25 05:27:00.223 E/unknown:IntBufferBatchMountItem( 4863): Skipping batch of MountItems; was stopped [1].
```
