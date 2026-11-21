# App explorer: 1.0.340 (396)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode crawl | 30 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 2
Baseline 1.0.340

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 10855 | +2313 | 35/49 | 200 | 531 | 1 errors; start 2234ms |
| 2 | /browse | 2591 |  | 1/1 | 16 | 491 | boot js-start 72491, layout-mounted 72881, cache-read 72981, hydrated 73149, splash-hide 73149, manifest 74361, resolved 74608, core-fetched 76061, core-saved 76334, rows-prepared 76418, search-index-idle 76418, details-start 76902, pricing-ready 77499, details-fetched 79659, detail-filters-idle 81120, suitability-built 81225, core-ready 89613, rates-ready 93525 |
| 3 | /watchlist | 55 |  | 2/2 | 101 | 617 |  |
| 4 | /market | 2332 |  | 11/22 | 57 | 509 |  |
| 5 | /tools | 36 |  | 16/22 | 150 | 508 |  |
| 6 | /trends | 28 |  | 18/36 | 97 | 521 |  |
| 7 | /search | 27 |  | 26/41 | 105 | 602 |  |
| 8 | /banks | 28 |  | 24/38 | 101 | 653 |  |
| 9 | /bank-rates | 27 |  | 15/28 | 61 | 657 |  |
| 10 | /categories | 29 |  | 35/54 | 73 | 661 |  |
| 11 | /catalogue | 31 |  | 34/48 | 73 | 679 |  |
| 12 | /compare | 35 |  | 10/16 | 109 | 687 |  |
| 13 | /matches | 30 |  | 30/51 | 81 | 678 |  |
| 14 | /calculator | 31 |  | 15/26 | 65 | 671 |  |
| 15 | /projections | 30 |  | 18/35 | 85 | 665 |  |
| 16 | /profile | 28 |  | 12/28 | 73 | 669 |  |
| 17 | /research | 24 |  | 15/29 | 65 | 677 |  |
| 18 | /rba | 29 |  | 12/26 | 93 | 690 |  |
| 19 | /rba-response | 27 |  | 19/32 | 65 | 685 |  |
| 20 | /settings | 29 |  | 10/26 | 93 | 690 |  |
| 21 | /about | 22 |  | 10/24 | 57 | 690 |  |
| 22 | /terms | 22 |  | 11/26 | 57 | 690 |  |
| 23 | /privacy | 25 |  |  |  | 690 |  |
| 24 | /third-party-notices | 25 |  | 13/24 | 57 | 693 |  |
| 25 | /node | 29 |  | 29/46 | 89 | 726 |  |
| 26 | /passthrough | 29 |  | 24/43 | 85 | 700 |  |
| 27 | /calculation-receipt | 25 |  | 10/24 | 61 | 690 |  |
| 28 | /rate-receipt | 25 |  | 6/10 | 61 | 690 |  |
| 29 | warm resume | 357 |  | 3/4 | 32 | 688 |  |
| 30 | cold relaunch | 8101 |  | 24/30 | 350 | 522 | 1 errors; start 3076ms; boot js-start 304379, layout-mounted 304553, hydrated 304660, cache-read 305728, core-ready 305966, rows-prepared 306055, search-index-idle 306055, detail-filters-idle 306055, splash-hide 306056, manifest 307351, resolved 307796, pricing-ready 308398, rates-ready 308570 |

## Errors

### 1 cold start
```
11-21 08:54:56.307 E/australianrates( 5087): Not starting debugger since process cannot load the jdwp agent.
```

### 30 cold relaunch
```
11-21 08:58:48.177 E/australianrates( 9070): Not starting debugger since process cannot load the jdwp agent.
```
