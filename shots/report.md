# App explorer: 1.0.355 (411)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 16277 |  | 60/84 | 250 | 531 | 4 errors; start 2708ms |
| 2 | browse-open | 4904 |  | 2/2 | 32 | 551 | boot js-start 82333, layout-mounted 82797, cache-read 82874, hydrated 83211, splash-hide 83211, manifest 83926, resolved 84946, core-fetched 87418, core-saved 87749, rows-prepared 87922, search-index-idle 87922, leading-requested 87922, details-start 88860, leading-scoped 88951, pricing-ready 90217, last-gate 91340, details-fetched 92805, detail-filters-idle 98280, last-pricing 98280, suitability-built 98608, post-refresh-wait 98725, leading-page 99197, last-rows 111258, rates-ready 112034, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 214, pricing-scope-ms 14052, leading-short 1, leading-short-rows 0, leading-scope-rows 113, leading-visible-rows 0, leading-nonstd-rows 10, filter-runs 3, filter-rows 38576, filter-yields 8, filter-ms 1502, sort-runs 5, sort-rows 1182, sort-yields 5, sort-ms 256 |
| 3 | browse | 0 |  |  |  | 566 |  |
| 4 | watchlist-open | 65 |  | 3/3 | 40 | 737 |  |
| 5 | watchlist | 0 |  |  |  | 525 |  |
| 6 | market-open | 49 |  | 17/22 | 65 | 522 |  |
| 7 | market | 0 |  |  |  | 503 |  |
| 8 | tools-open | 29 |  | 17/23 | 101 | 512 |  |
| 9 | tools | 0 |  |  |  | 508 |  |
| 10 | trends-open | 29 |  | 19/26 | 117 | 522 |  |
| 11 | trends | 0 |  |  |  | 519 |  |
| 12 | search-open | 27 |  | 33/39 | 117 | 565 |  |
| 13 | search | 0 |  |  |  | 595 |  |
| 14 | bank-rates-open | 24 |  | 20/29 | 85 | 598 |  |
| 15 | bank-rates | 0 |  |  |  | 595 |  |
| 16 | compare-open | 27 |  | 11/15 | 150 | 599 |  |
| 17 | compare | 0 |  |  |  | 602 |  |
| 18 | calculator-open | 28 |  | 17/26 | 69 | 611 |  |
| 19 | calculator | 0 |  |  |  | 611 |  |
| 20 | projections-open | 30 |  | 28/34 | 129 | 648 |  |
| 21 | projections | 0 |  |  |  | 642 |  |
| 22 | research-open | 38 |  | 21/35 | 65 | 635 |  |
| 23 | research | 0 |  |  |  | 630 |  |
| 24 | rba-open | 27 |  | 14/22 | 97 | 646 |  |
| 25 | rba | 0 |  |  |  | 638 |  |
| 26 | rba-scrolled-open | 32 |  | 4/4 | 34 | 645 |  |
| 27 | rba-scrolled | 2179 |  | 35/63 | 65 | 642 |  |
| 28 | rba-response-open | 40 |  | 20/28 | 69 | 651 |  |
| 29 | rba-response | 0 |  |  |  | 647 |  |
| 30 | settings-open | 31 |  | 13/22 | 150 | 665 |  |
| 31 | settings | 0 |  |  |  | 658 |  |
| 32 | about-open | 32 |  | 14/21 | 65 | 664 |  |
| 33 | about | 0 |  |  |  | 663 |  |
| 34 | profile-open | 35 |  | 19/25 | 69 | 674 |  |
| 35 | profile | 0 |  |  |  | 672 |  |
| 36 | terms-open | 34 |  | 15/23 | 73 | 675 |  |
| 37 | terms | 0 |  |  |  | 674 |  |
| 38 | third-party-open | 33 |  | 15/22 | 77 | 680 |  |
| 39 | third-party | 0 |  |  |  | 679 |  |
| 40 | catalogue-open | 26 |  | 32/44 | 93 | 710 |  |
| 41 | catalogue | 0 |  |  |  | 677 |  |

## Errors

### 1 cold start
```
11-22 11:57:02.345 E/australianrates( 5058): Not starting debugger since process cannot load the jdwp agent.
11-22 11:57:15.170 E/unknown:SurfaceMountingManager( 5058): Stopping surface [1]
11-22 11:57:15.177 E/unknown:IntBufferBatchMountItem( 5058): Skipping batch of MountItems; was stopped [1].
11-22 11:57:15.218 E/unknown:SurfaceMountingManager( 5058): Surface [1] was stopped on SurfaceMountingManager.
```
