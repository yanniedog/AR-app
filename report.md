# App explorer: 1.0.338 (394)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode crawl | 30 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 2
Baseline 1.0.337

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 17404 | +6282 | 74/87 | 150 | 533 | 4 errors; start 2433ms |
| 2 | /browse | 4910 | +4875 | 2/2 | 48 | 475 | boot js-start 71574, layout-mounted 71937, cache-read 72040, hydrated 72269, splash-hide 72269, manifest 72986, resolved 73649, core-fetched 75718, core-saved 76122, rows-prepared 76313, search-index-idle 76313, details-start 76930, pricing-ready 77429, details-fetched 80582, detail-filters-idle 84805, suitability-built 85105, core-ready 95786, rates-ready 100867 |
| 3 | /watchlist | 46 | +12 | 3/4 | 32 | 613 |  |
| 4 | /market | 5023 | +4967 | 17/25 | 69 | 532 |  |
| 5 | /tools | 40 | +4 | 15/21 | 101 | 534 |  |
| 6 | /trends | 40 | +8 | 31/44 | 109 | 542 |  |
| 7 | /search | 28 | -66 | 31/42 | 117 | 620 |  |
| 8 | /banks | 32 | 0 | 29/36 | 121 | 662 |  |
| 9 | /bank-rates | 29 | -4 | 18/27 | 81 | 671 |  |
| 10 | /categories | 46 | +14 | 35/41 | 105 | 659 |  |
| 11 | /catalogue | 56 | +11 | 33/42 | 97 | 669 |  |
| 12 | /compare | 35 | 0 | 10/15 | 150 | 682 |  |
| 13 | /matches | 25 | -14 | 36/44 | 101 | 666 |  |
| 14 | /calculator | 33 | -17 | 17/22 | 85 | 651 |  |
| 15 | /projections | 28 | -6 | 19/28 | 101 | 655 |  |
| 16 | /profile | 30 | -11 | 13/22 | 97 | 658 |  |
| 17 | /research | 26 | -11 | 16/27 | 89 | 666 |  |
| 18 | /rba | 33 | -2652 | 17/26 | 113 | 674 |  |
| 19 | /rba-response | 34 | -7 | 19/33 | 65 | 673 |  |
| 20 | /settings | 29 | -6 | 13/26 | 85 | 677 |  |
| 21 | /about | 34 | -7 | 16/24 | 73 | 678 |  |
| 22 | /terms | 31 | -6 | 16/23 | 93 | 677 |  |
| 23 | /privacy | 35 | -4 |  |  | 676 |  |
| 24 | /third-party-notices | 31 | -8 | 15/25 | 77 | 680 |  |
| 25 | /node | 30 | -6 | 38/45 | 97 | 712 |  |
| 26 | /passthrough | 35 | -8 | 33/44 | 93 | 683 |  |
| 27 | /calculation-receipt | 29 | -4 | 13/22 | 73 | 680 |  |
| 28 | /rate-receipt | 32 | -7 | 7/9 | 81 | 677 |  |
| 29 | warm resume | 458 | -493 | 3/4 | 38 | 676 |  |
| 30 | cold relaunch | 9683 | -1074 | 35/39 | 300 | 524 | 1 errors; start 4040ms; boot js-start 328794, layout-mounted 329014, hydrated 329055, cache-read 330385, core-ready 330676, rows-prepared 330813, search-index-idle 330813, detail-filters-idle 330813, splash-hide 330815, manifest 332431, resolved 333286, pricing-ready 334071, rates-ready 334312 |

## Errors

### 1 cold start
```
11-21 06:36:05.855 E/australianrates( 4786): Not starting debugger since process cannot load the jdwp agent.
11-21 06:36:17.450 E/unknown:SurfaceMountingManager( 4786): Stopping surface [1]
11-21 06:36:17.459 E/unknown:SurfaceMountingManager( 4786): Surface [1] was stopped on SurfaceMountingManager.
11-21 06:36:17.506 E/unknown:IntBufferBatchMountItem( 4786): Skipping batch of MountItems; was stopped [1].
```

### 30 cold relaunch
```
11-21 06:40:23.294 E/australianrates( 9295): Not starting debugger since process cannot load the jdwp agent.
```
