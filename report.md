# App explorer: 1.0.339 (395)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode crawl | 30 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 2
Baseline 1.0.339

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 20391 | +11750 | 44/55 | 400 | 535 | 1 errors; start 3094ms |
| 2 | /browse | 2770 |  | 2/2 | 32 | 468 | boot js-start 73387, layout-mounted 73952, cache-read 74150, hydrated 74381, splash-hide 74381, manifest 76014, resolved 76483, core-fetched 79446, core-saved 80072, rows-prepared 80321, search-index-idle 80321, details-start 81222, pricing-ready 83848, details-fetched 86873, detail-filters-idle 89751, suitability-built 90226, core-ready 98294, rates-ready 105164 |
| 3 | /watchlist | 77 |  | 4/4 | 85 | 612 |  |
| 4 | /market | 5117 |  | 15/19 | 73 | 516 |  |
| 5 | /tools | 39 |  | 16/21 | 125 | 517 |  |
| 6 | /trends | 49 |  | 30/36 | 150 | 530 |  |
| 7 | /search | 139 |  | 31/37 | 150 | 595 |  |
| 8 | /banks | 36 |  | 28/34 | 150 | 636 |  |
| 9 | /bank-rates | 32 |  | 21/25 | 97 | 643 |  |
| 10 | /categories | 38 |  | 33/44 | 105 | 644 |  |
| 11 | /catalogue | 29 |  | 33/41 | 109 | 656 |  |
| 12 | /compare | 45 |  | 11/14 | 129 | 662 |  |
| 13 | /matches | 43 |  | 35/46 | 109 | 643 |  |
| 14 | /calculator | 35 |  | 16/22 | 133 | 641 |  |
| 15 | /projections | 35 |  | 27/33 | 101 | 643 |  |
| 16 | /profile | 36 |  | 15/22 | 65 | 646 |  |
| 17 | /research | 41 |  | 20/29 | 89 | 653 |  |
| 18 | /rba | 35 |  | 15/20 | 129 | 658 |  |
| 19 | /rba-response | 36 |  | 27/32 | 109 | 660 |  |
| 20 | /settings | 38 |  | 15/20 | 150 | 666 |  |
| 21 | /about | 36 |  | 17/25 | 77 | 664 |  |
| 22 | /terms | 38 |  | 17/23 | 73 | 664 |  |
| 23 | /privacy | 40 |  |  |  | 664 |  |
| 24 | /third-party-notices | 34 |  | 14/21 | 65 | 667 |  |
| 25 | /node | 34 |  | 36/44 | 97 | 697 |  |
| 26 | /passthrough | 90 |  | 34/42 | 101 | 672 |  |
| 27 | /calculation-receipt | 38 |  | 18/25 | 73 | 663 |  |
| 28 | /rate-receipt | 40 |  | 7/12 | 73 | 663 |  |
| 29 | warm resume | 756 |  | 4/4 | 117 | 663 |  |
| 30 | cold relaunch | 10370 |  | 30/39 | 450 | 517 | 1 errors; start 4370ms; boot js-start 340460, layout-mounted 340697, hydrated 340844, cache-read 342155, core-ready 342465, rows-prepared 342623, search-index-idle 342623, detail-filters-idle 342623, splash-hide 342624, manifest 344774, resolved 345508, pricing-ready 346302, rates-ready 346573 |

## Errors

### 1 cold start
```
11-21 07:48:04.584 E/australianrates( 4612): Not starting debugger since process cannot load the jdwp agent.
```

### 30 cold relaunch
```
11-21 07:52:32.142 E/australianrates( 9223): Not starting debugger since process cannot load the jdwp agent.
```
