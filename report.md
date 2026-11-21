# App explorer: 1.0.340 (396)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode crawl | 30 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 2
Baseline 1.0.340

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 19381 | +8526 | 41/55 | 300 | 552 | 1 errors; start 3609ms |
| 2 | /browse | 113 | -2478 | 2/2 | 32 | 449 | boot js-start 85419, layout-mounted 85915, cache-read 86177, hydrated 86593, splash-hide 86593, manifest 87206, resolved 88119, core-fetched 90530, core-saved 91089, rows-prepared 91439, search-index-idle 91439, details-start 92434, pricing-ready 95096, details-fetched 96725, detail-filters-idle 100467, suitability-built 100683, core-ready 111303, rates-ready 120076 |
| 3 | /watchlist | 105 | +50 | 3/4 | 34 | 601 |  |
| 4 | /market | 4817 | +2485 | 17/25 | 53 | 521 |  |
| 5 | /tools | 55 | +19 | 12/21 | 117 | 529 |  |
| 6 | /trends | 45 | +17 | 30/42 | 101 | 546 |  |
| 7 | /search | 120 | +93 | 31/37 | 101 | 597 |  |
| 8 | /banks | 43 | +15 | 35/42 | 101 | 636 |  |
| 9 | /bank-rates | 60 | +33 | 19/26 | 121 | 644 |  |
| 10 | /categories | 28 | -1 | 36/45 | 93 | 646 |  |
| 11 | /catalogue | 29 | -2 | 29/42 | 101 | 653 |  |
| 12 | /compare | 41 | +6 | 12/15 | 129 | 621 |  |
| 13 | /matches | 28 | -2 | 39/50 | 89 | 625 |  |
| 14 | /calculator | 30 | -1 | 18/25 | 81 | 627 |  |
| 15 | /projections | 27 | -3 | 23/34 | 105 | 630 |  |
| 16 | /profile | 27 | -1 | 14/23 | 69 | 634 |  |
| 17 | /research | 31 | +7 | 19/29 | 85 | 642 |  |
| 18 | /rba | 28 | -1 | 12/23 | 89 | 648 |  |
| 19 | /rba-response | 27 | 0 | 18/30 | 69 | 647 |  |
| 20 | /settings | 28 | -1 | 15/26 | 85 | 653 |  |
| 21 | /about | 25 | +3 | 13/22 | 85 | 653 |  |
| 22 | /terms | 25 | +3 | 14/21 | 81 | 654 |  |
| 23 | /privacy | 31 | +6 |  |  | 657 |  |
| 24 | /third-party-notices | 32 | +7 | 17/23 | 81 | 657 |  |
| 25 | /node | 23 | -6 | 33/42 | 97 | 672 |  |
| 26 | /passthrough | 30 | +1 | 35/48 | 85 | 655 |  |
| 27 | /calculation-receipt | 34 | +9 | 12/23 | 65 | 648 |  |
| 28 | /rate-receipt | 29 | +4 | 7/9 | 73 | 649 |  |
| 29 | warm resume | 686 | +329 | 2/4 | 42 | 647 |  |
| 30 | cold relaunch | 9896 | +1795 | 28/33 | 250 | 511 | 1 errors; start 4091ms; boot js-start 342845, layout-mounted 343088, hydrated 343213, cache-read 344459, core-ready 344738, rows-prepared 344873, search-index-idle 344873, detail-filters-idle 344873, splash-hide 344874, manifest 346958, resolved 347657, pricing-ready 348444, rates-ready 348719 |

## Errors

### 1 cold start
```
11-21 09:02:27.892 E/australianrates( 5057): Not starting debugger since process cannot load the jdwp agent.
```

### 30 cold relaunch
```
11-21 09:06:46.051 E/australianrates( 9437): Not starting debugger since process cannot load the jdwp agent.
```
