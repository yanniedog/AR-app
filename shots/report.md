# App explorer: 1.0.358 (414)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 15239 |  | 54/74 | 150 | 402 | 4 errors; start 2735ms |
| 2 | browse-open | 5302 |  | 2/2 | 32 | 554 | boot js-start 81003, layout-mounted 81480, cache-read 81670, hydrated 82004, splash-hide 82004, manifest 83040, resolved 83640, core-fetched 85657, core-saved 86093, rows-prepared 86251, search-index-idle 86251, leading-requested 86251, details-start 86983, leading-scoped 87111, pricing-ready 89620, last-gate 89737, details-fetched 90821, detail-filters-idle 95037, last-pricing 95037, suitability-built 95305, post-refresh-wait 95435, leading-page 95951, last-rows 108968, rates-ready 109395, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 232, pricing-scope-ms 15159, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 3, filter-rows 38533, filter-yields 10, filter-ms 295, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 95 |
| 3 | browse | 0 |  |  |  | 565 |  |
| 4 | watchlist-open | 63 |  | 3/3 | 81 | 618 |  |
| 5 | watchlist | 0 |  |  |  | 505 |  |
| 6 | market-open | 60 |  | 14/23 | 65 | 501 |  |
| 7 | market | 0 |  |  |  | 484 |  |
| 8 | tools-open | 27 |  | 12/21 | 89 | 498 |  |
| 9 | tools | 0 |  |  |  | 493 |  |
| 10 | trends-open | 26 |  | 28/35 | 200 | 512 |  |
| 11 | trends | 0 |  |  |  | 509 |  |
| 12 | search-open | 37 |  | 29/35 | 150 | 581 |  |
| 13 | search | 0 |  |  |  | 621 |  |
| 14 | bank-rates-open | 33 |  | 21/29 | 73 | 619 |  |
| 15 | bank-rates | 0 |  |  |  | 616 |  |
| 16 | compare-open | 29 |  | 13/17 | 121 | 619 |  |
| 17 | compare | 0 |  |  |  | 620 |  |
| 18 | calculator-open | 26 |  | 18/25 | 77 | 628 |  |
| 19 | calculator | 0 |  |  |  | 629 |  |
| 20 | projections-open | 37 |  | 29/40 | 97 | 662 |  |
| 21 | projections | 0 |  |  |  | 661 |  |
| 22 | research-open | 25 |  | 17/32 | 61 | 649 |  |
| 23 | research | 0 |  |  |  | 646 |  |
| 24 | rba-open | 28 |  | 14/27 | 73 | 662 |  |
| 25 | rba | 0 |  |  |  | 655 |  |
| 26 | rba-scrolled-open | 26 |  | 2/4 | 18 | 659 |  |
| 27 | rba-scrolled | 2134 |  | 33/61 | 69 | 657 |  |
| 28 | rba-response-open | 29 |  | 16/32 | 61 | 668 |  |
| 29 | rba-response | 0 |  |  |  | 664 |  |
| 30 | settings-open | 25 |  | 13/22 | 81 | 682 |  |
| 31 | settings | 0 |  |  |  | 675 |  |
| 32 | about-open | 33 |  | 12/23 | 73 | 682 |  |
| 33 | about | 0 |  |  |  | 680 |  |
| 34 | profile-open | 35 |  | 15/22 | 101 | 691 |  |
| 35 | profile | 0 |  |  |  | 689 |  |
| 36 | terms-open | 26 |  | 16/23 | 93 | 693 |  |
| 37 | terms | 0 |  |  |  | 692 |  |
| 38 | third-party-open | 31 |  | 14/23 | 73 | 697 |  |
| 39 | third-party | 1 |  |  |  | 697 |  |
| 40 | catalogue-open | 32 |  | 33/43 | 101 | 745 |  |
| 41 | catalogue | 0 |  |  |  | 713 |  |

## Errors

### 1 cold start
```
11-23 17:14:53.728 E/australianrates( 5130): Not starting debugger since process cannot load the jdwp agent.
11-23 17:15:05.783 E/unknown:SurfaceMountingManager( 5130): Stopping surface [1]
11-23 17:15:05.835 E/unknown:IntBufferBatchMountItem( 5130): Skipping batch of MountItems; was stopped [1].
11-23 17:15:05.835 E/unknown:SurfaceMountingManager( 5130): Surface [1] was stopped on SurfaceMountingManager.
```
