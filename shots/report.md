# App explorer: 1.0.380 (436)

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-26

Mode script | 43 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 18690 |  | 65/85 | 150 | 423 | 4 errors; start 2950ms |
| 2 | browse-open | 117 |  | 2/2 | 30 | 505 | boot js-start 80246, layout-mounted 80710, cache-read 80821, hydrated 81043, splash-hide 81043, manifest 82053, resolved 83023, core-fetched 84899, core-saved 85285, search-index-idle 85388, leading-requested 85388, details-start 86250, leading-scoped 86305, pricing-ready 88315, details-fetched 89904, rows-prepared 94847, detail-filters-idle 94847, last-pricing 94847, suitability-built 95382, post-refresh-wait 95602, leading-page 96299, last-rows 112581, rates-ready 113899, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 258, pricing-scope-ms 19340, leading-gated 1, filter-runs 2, filter-rows 31602, filter-yields 19, filter-ms 1057, sort-runs 4, sort-rows 1183, sort-yields 4, sort-ms 97 |
| 3 | browse | 0 |  |  |  | 555 |  |
| 4 | watchlist-open | 71 |  | 4/4 | 57 | 728 |  |
| 5 | watchlist | 0 |  |  |  | 483 |  |
| 6 | market-open | 2344 |  | 14/21 | 53 | 490 |  |
| 7 | market | 0 |  |  |  | 483 |  |
| 8 | tools-open | 34 |  | 17/22 | 81 | 493 |  |
| 9 | tools | 0 |  |  |  | 489 |  |
| 10 | trends-open | 31 |  | 23/34 | 129 | 505 |  |
| 11 | trends | 0 |  |  |  | 506 |  |
| 12 | search-open | 35 |  | 26/34 | 117 | 578 |  |
| 13 | search | 0 |  |  |  | 621 |  |
| 14 | bank-rates-open | 29 |  | 17/24 | 81 | 617 |  |
| 15 | bank-rates | 0 |  |  |  | 613 |  |
| 16 | compare-open | 35 |  | 11/17 | 113 | 618 |  |
| 17 | compare | 1 |  |  |  | 618 |  |
| 18 | calculator-open | 30 |  | 17/26 | 69 | 625 |  |
| 19 | calculator | 0 |  |  |  | 623 |  |
| 20 | projections-open | 35 |  | 30/39 | 97 | 662 |  |
| 21 | projections | 0 |  |  |  | 660 |  |
| 22 | research-open | 36 |  | 16/29 | 69 | 654 |  |
| 23 | research | 0 |  |  |  | 651 |  |
| 24 | rba-open | 2544 |  | 14/23 | 101 | 679 |  |
| 25 | rba | 0 |  |  |  | 671 |  |
| 26 | rba-scrolled-open | 32 |  | 2/4 | 32 | 672 |  |
| 27 | rba-scrolled | 2326 |  | 49/81 | 65 | 672 |  |
| 28 | rba-response-open | 31 |  | 17/30 | 65 | 680 |  |
| 29 | rba-response | 0 |  |  |  | 676 |  |
| 30 | settings-open | 38 |  | 19/26 | 89 | 689 |  |
| 31 | settings | 3009 |  | 58/89 | 77 | 686 |  |
| 32 | debug-log-open | 34 |  | 15/26 | 65 | 692 |  |
| 33 | debug-log-tap-1 | 26 |  | 3/3 | 16 | 691 |  |
| 34 | debug-log-tap-2 | 22 |  | 30/51 | 65 | 697 |  |
| 35 | debug-log | 0 |  |  |  | 696 |  |
| 36 | profile-open | 30 |  | 17/26 | 57 | 707 |  |
| 37 | profile | 0 |  |  |  | 705 |  |
| 38 | terms-open | 33 |  | 15/26 | 73 | 709 |  |
| 39 | terms | 0 |  |  |  | 708 |  |
| 40 | third-party-open | 32 |  | 13/21 | 69 | 713 |  |
| 41 | third-party | 0 |  |  |  | 712 |  |
| 42 | catalogue-open | 29 |  | 29/41 | 109 | 761 |  |
| 43 | catalogue | 0 |  |  |  | 729 |  |

## Errors

### 1 cold start
```
11-26 13:05:32.817 E/australianrates( 5069): Not starting debugger since process cannot load the jdwp agent.
11-26 13:05:45.345 E/unknown:SurfaceMountingManager( 5069): Stopping surface [1]
11-26 13:05:45.347 E/unknown:IntBufferBatchMountItem( 5069): Skipping batch of MountItems; was stopped [1].
11-26 13:05:45.352 E/unknown:SurfaceMountingManager( 5069): Surface [1] was stopped on SurfaceMountingManager.
```
