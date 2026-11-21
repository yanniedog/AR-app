# App explorer: 1.0.348 (404)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 25704 |  | 70/86 | 150 | 507 | 4 errors; start 3636ms |
| 2 | browse-open | 67 |  |  |  | 552 |  |
| 3 | browse | 0 |  | 2/2 | 57 | 473 | boot js-start 73055, layout-mounted 73585, cache-read 73783, hydrated 74130, splash-hide 74130, manifest 74775, resolved 75724, core-fetched 79476, core-saved 80014, rows-prepared 80280, search-index-idle 80280, leading-requested 80280, details-start 81143, leading-scoped 81295, pricing-ready 84209, last-gate 84518, details-fetched 85998, detail-filters-idle 88873, last-pricing 88873, suitability-built 89096, post-refresh-wait 89193, leading-page 89737, last-rows 115732, rates-ready 116225, pricing-starts 3, pricing-cand-ms 18, pricing-resolve-ms 0, pricing-yields 309, pricing-scope-ms 28436, filter-runs 3, filter-rows 38576, filter-yields 9, filter-ms 511, sort-runs 5, sort-rows 1182, sort-yields 5, sort-ms 75 |
| 4 | watchlist-open | 71 |  | 5/5 | 57 | 622 |  |
| 5 | watchlist | 0 |  |  |  | 516 |  |
| 6 | market-open | 38 |  | 16/28 | 57 | 520 |  |
| 7 | market | 0 |  |  |  | 505 |  |
| 8 | tools-open | 27 |  | 16/23 | 77 | 517 |  |
| 9 | tools | 0 |  |  |  | 513 |  |
| 10 | trends-open | 25 |  | 31/41 | 101 | 531 |  |
| 11 | trends | 0 |  |  |  | 529 |  |
| 12 | search-open | 26 |  | 31/40 | 150 | 604 |  |
| 13 | search | 0 |  |  |  | 641 |  |
| 14 | bank-rates-open | 30 |  | 19/26 | 81 | 642 |  |
| 15 | bank-rates | 0 |  |  |  | 635 |  |
| 16 | compare-open | 26 |  | 12/16 | 101 | 644 |  |
| 17 | compare | 0 |  |  |  | 642 |  |
| 18 | calculator-open | 27 |  | 17/24 | 73 | 654 |  |
| 19 | calculator | 0 |  |  |  | 650 |  |
| 20 | projections-open | 29 |  | 30/39 | 85 | 688 |  |
| 21 | projections | 0 |  |  |  | 683 |  |
| 22 | research-open | 41 |  | 19/28 | 65 | 676 |  |
| 23 | research | 0 |  |  |  | 674 |  |
| 24 | rba-open | 27 |  | 12/23 | 61 | 684 |  |
| 25 | rba | 0 |  |  |  | 682 |  |
| 26 | rba-scrolled-open | 30 |  | 3/4 | 34 | 681 |  |
| 27 | rba-scrolled | 2209 |  | 35/66 | 65 | 679 |  |
| 28 | rba-response-open | 29 |  | 21/37 | 69 | 690 |  |
| 29 | rba-response | 0 |  |  |  | 686 |  |
| 30 | settings-open | 29 |  | 12/23 | 77 | 702 |  |
| 31 | settings | 0 |  |  |  | 697 |  |
| 32 | about-open | 27 |  | 16/22 | 81 | 693 |  |
| 33 | about | 0 |  |  |  | 689 |  |
| 34 | profile-open | 29 |  | 16/23 | 69 | 668 |  |
| 35 | profile | 0 |  |  |  | 666 |  |
| 36 | terms-open | 30 |  | 17/26 | 77 | 667 |  |
| 37 | terms | 0 |  |  |  | 666 |  |
| 38 | third-party-open | 29 |  | 12/22 | 77 | 669 |  |
| 39 | third-party | 0 |  |  |  | 667 |  |
| 40 | catalogue-open | 37 |  | 31/44 | 97 | 689 |  |
| 41 | catalogue | 0 |  |  |  | 651 |  |

## Errors

### 1 cold start
```
11-21 18:02:47.449 E/australianrates( 4636): Not starting debugger since process cannot load the jdwp agent.
11-21 18:03:09.650 E/unknown:SurfaceMountingManager( 4636): Stopping surface [1]
11-21 18:03:09.665 E/unknown:SurfaceMountingManager( 4636): Surface [1] was stopped on SurfaceMountingManager.
11-21 18:03:09.717 E/unknown:IntBufferBatchMountItem( 4636): Skipping batch of MountItems; was stopped [1].
```
