# App explorer: 1.0.338 (394)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode crawl | 30 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 2
Baseline 1.0.338

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 12284 | -5120 | 36/51 | 200 | 507 | 1 errors; start 2556ms |
| 2 | /browse | 2619 | -2291 | 2/2 | 32 | 565 | boot js-start 62280, layout-mounted 62692, cache-read 62889, hydrated 63158, splash-hide 63158, manifest 64285, resolved 64761, core-fetched 66676, core-saved 66975, rows-prepared 67102, search-index-idle 67102, details-start 67605, pricing-ready 68314, details-fetched 70920, detail-filters-idle 72592, suitability-built 72709, core-ready 79303, rates-ready 84837 |
| 3 | /watchlist | 55 | +9 | 3/3 | 73 | 603 |  |
| 4 | /market | 2385 | -2638 | 12/20 | 48 | 479 |  |
| 5 | /tools | 75 | +35 | 17/25 | 125 | 490 |  |
| 6 | /trends | 33 | -7 | 23/37 | 113 | 506 |  |
| 7 | /search | 25 | -3 | 29/40 | 117 | 577 |  |
| 8 | /banks | 27 | -5 | 28/42 | 93 | 627 |  |
| 9 | /bank-rates | 30 | +1 | 15/25 | 65 | 633 |  |
| 10 | /categories | 26 | -20 | 28/44 | 85 | 644 |  |
| 11 | /catalogue | 30 | -26 | 28/41 | 85 | 657 |  |
| 12 | /compare | 27 | -8 | 12/16 | 117 | 626 |  |
| 13 | /matches | 26 | +1 | 23/34 | 89 | 645 |  |
| 14 | /calculator | 36 | +3 | 14/23 | 57 | 633 |  |
| 15 | /projections | 30 | +2 | 20/32 | 89 | 638 |  |
| 16 | /profile | 28 | -2 | 13/27 | 53 | 641 |  |
| 17 | /research | 29 | +3 | 14/30 | 65 | 648 |  |
| 18 | /rba | 34 | +1 | 11/22 | 61 | 653 |  |
| 19 | /rba-response | 32 | -2 | 15/33 | 53 | 655 |  |
| 20 | /settings | 29 | 0 | 14/29 | 117 | 662 |  |
| 21 | /about | 31 | -3 | 10/26 | 57 | 660 |  |
| 22 | /terms | 26 | -5 | 13/25 | 73 | 661 |  |
| 23 | /privacy | 26 | -9 |  |  | 661 |  |
| 24 | /third-party-notices | 33 | +2 | 12/28 | 61 | 664 |  |
| 25 | /node | 23 | -7 | 32/47 | 77 | 698 |  |
| 26 | /passthrough | 29 | -6 | 22/43 | 73 | 672 |  |
| 27 | /calculation-receipt | 29 | 0 | 12/24 | 61 | 663 |  |
| 28 | /rate-receipt | 25 | -7 | 7/10 | 73 | 663 |  |
| 29 | warm resume | 309 | -149 | 2/4 | 32 | 660 |  |
| 30 | cold relaunch | 8355 | -1328 | 24/33 | 300 | 519 | 1 errors; start 3402ms; boot js-start 298277, layout-mounted 298442, hydrated 298588, cache-read 299675, core-ready 299920, rows-prepared 300027, search-index-idle 300027, detail-filters-idle 300027, splash-hide 300028, manifest 301150, resolved 301822, pricing-ready 302502, rates-ready 302707 |

## Errors

### 1 cold start
```
11-21 06:52:49.209 E/australianrates( 4749): Not starting debugger since process cannot load the jdwp agent.
```

### 30 cold relaunch
```
11-21 06:56:45.407 E/australianrates( 9009): Not starting debugger since process cannot load the jdwp agent.
```
