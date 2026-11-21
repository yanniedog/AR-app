# App explorer: 1.0.340 (396)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 16913 |  | 64/82 | 200 | 519 | 4 errors; start 3260ms |
| 2 | browse-open | 88 |  | 2/2 | 31 | 544 | boot js-start 81431, layout-mounted 82095, cache-read 82293, hydrated 82597, splash-hide 82597, manifest 84138, resolved 84492, core-fetched 86814, core-saved 87192, rows-prepared 87340, search-index-idle 87340, details-start 88068, pricing-ready 88599, details-fetched 93485, detail-filters-idle 95640, suitability-built 95900, core-ready 108878, rates-ready 114911 |
| 3 | browse | 0 |  |  |  | 585 |  |
| 4 | watchlist-open | 86 |  | 3/4 | 81 | 625 |  |
| 5 | watchlist | 1 |  |  |  | 495 |  |
| 6 | market-open | 48 |  | 20/26 | 69 | 500 |  |
| 7 | market | 1 |  |  |  | 483 |  |
| 8 | tools-open | 37 |  | 16/19 | 250 | 497 |  |
| 9 | tools | 1 |  |  |  | 493 |  |
| 10 | trends-open | 38 |  | 32/42 | 105 | 510 |  |
| 11 | trends | 1 |  |  |  | 509 |  |
| 12 | search-open | 31 |  | 30/38 | 133 | 585 |  |
| 13 | search | 1 |  |  |  | 616 |  |
| 14 | bank-rates-open | 42 |  | 21/30 | 81 | 622 |  |
| 15 | bank-rates | 1 |  |  |  | 616 |  |
| 16 | compare-open | 35 |  | 11/13 | 150 | 622 |  |
| 17 | compare | 1 |  |  |  | 620 |  |
| 18 | calculator-open | 36 |  | 17/25 | 85 | 632 |  |
| 19 | calculator | 1 |  |  |  | 627 |  |
| 20 | projections-open | 37 |  | 20/26 | 89 | 662 |  |
| 21 | projections | 1 |  |  |  | 657 |  |
| 22 | research-open | 39 |  | 22/31 | 77 | 650 |  |
| 23 | research | 1 |  |  |  | 653 |  |
| 24 | rba-open | 34 |  | 18/25 | 105 | 662 |  |
| 25 | rba | 1 |  |  |  | 660 |  |
| 26 | rba-scrolled-open | 65 |  | 4/4 | 27 | 659 |  |
| 27 | rba-scrolled | 2201 |  | 37/59 | 73 | 658 |  |
| 28 | rba-response-open | 41 |  | 22/30 | 77 | 668 |  |
| 29 | rba-response | 1 |  |  |  | 665 |  |
| 30 | settings-open | 45 |  | 18/26 | 89 | 681 |  |
| 31 | settings | 1 |  |  |  | 675 |  |
| 32 | about-open | 41 |  | 16/25 | 89 | 682 |  |
| 33 | about | 1 |  |  |  | 681 |  |
| 34 | profile-open | 38 |  | 19/25 | 101 | 692 |  |
| 35 | profile | 1 |  |  |  | 690 |  |
| 36 | terms-open | 37 |  | 18/24 | 97 | 693 |  |
| 37 | terms | 1 |  |  |  | 693 |  |
| 38 | third-party-open | 36 |  | 16/22 | 81 | 699 |  |
| 39 | third-party | 1 |  |  |  | 697 |  |
| 40 | catalogue-open | 39 |  | 34/43 | 117 | 734 |  |
| 41 | catalogue | 1 |  |  |  | 691 |  |

## Errors

### 1 cold start
```
11-21 08:56:11.443 E/australianrates( 4896): Not starting debugger since process cannot load the jdwp agent.
11-21 08:56:21.296 E/unknown:SurfaceMountingManager( 4896): Stopping surface [1]
11-21 08:56:21.298 E/unknown:SurfaceMountingManager( 4896): Surface [1] was stopped on SurfaceMountingManager.
11-21 08:56:21.315 E/unknown:IntBufferBatchMountItem( 4896): Skipping batch of MountItems; was stopped [1].
```
