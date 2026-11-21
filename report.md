# App explorer: 1.0.342 (398)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode crawl | 30 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 2
Baseline 1.0.340

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 17865 | -1516 | 42/54 | 300 | 414 | 1 errors; start 3130ms |
| 2 | /browse | 63 | -50 | 1/1 | 32 | 554 | boot js-start 72555, layout-mounted 73120, cache-read 73336, hydrated 73670, splash-hide 73670, manifest 75232, resolved 76009, core-fetched 79287, core-saved 79820, rows-prepared 80038, search-index-idle 80038, details-start 80932, pricing-ready 81314, last-gate 82284, details-fetched 86316, detail-filters-idle 88513, last-pricing 88513, suitability-built 88872, post-refresh-wait 88947, last-rows 97289, rates-ready 97767 |
| 3 | /watchlist | 99 | -6 | 5/5 | 97 | 609 |  |
| 4 | /market | 5827 | +1010 | 13/22 | 77 | 489 |  |
| 5 | /tools | 37 | -18 | 17/24 | 150 | 501 |  |
| 6 | /trends | 39 | -6 | 32/40 | 117 | 516 |  |
| 7 | /search | 51 | -69 | 35/40 | 133 | 575 |  |
| 8 | /banks | 60 | +17 | 34/36 | 109 | 611 |  |
| 9 | /bank-rates | 88 | +28 | 20/28 | 85 | 620 |  |
| 10 | /categories | 34 | +6 | 34/39 | 150 | 679 |  |
| 11 | /catalogue | 35 | +6 | 29/39 | 113 | 707 |  |
| 12 | /compare | 37 | -4 | 11/12 | 125 | 694 |  |
| 13 | /matches | 35 | +7 | 28/41 | 113 | 630 |  |
| 14 | /calculator | 33 | +3 | 17/24 | 89 | 627 |  |
| 15 | /projections | 36 | +9 | 25/34 | 117 | 630 |  |
| 16 | /profile | 33 | +6 | 16/25 | 73 | 633 |  |
| 17 | /research | 35 | +4 | 19/28 | 101 | 639 |  |
| 18 | /rba | 39 | +11 | 16/25 | 121 | 651 |  |
| 19 | /rba-response | 37 | +10 | 20/33 | 65 | 648 |  |
| 20 | /settings | 41 | +13 | 19/27 | 81 | 652 |  |
| 21 | /about | 33 | +8 | 13/22 | 89 | 651 |  |
| 22 | /terms | 36 | +11 | 18/24 | 81 | 653 |  |
| 23 | /privacy | 37 | +6 |  |  | 651 |  |
| 24 | /third-party-notices | 32 | 0 | 13/25 | 65 | 659 |  |
| 25 | /node | 38 | +15 | 36/45 | 93 | 688 |  |
| 26 | /passthrough | 39 | +9 | 32/42 | 101 | 673 |  |
| 27 | /calculation-receipt | 52 | +18 | 16/25 | 69 | 651 |  |
| 28 | /rate-receipt | 35 | +6 | 8/10 | 97 | 652 |  |
| 29 | warm resume | 330 | -356 | 4/4 | 73 | 651 |  |
| 30 | cold relaunch | 10066 | +170 | 29/34 | 200 | 518 | 1 errors; start 4302ms; boot js-start 335915, layout-mounted 336146, hydrated 336302, cache-read 337556, core-ready 337853, rows-prepared 337991, search-index-idle 337991, detail-filters-idle 337991, last-pricing 337991, splash-hide 337992, manifest 339877, resolved 340761, pricing-ready 341610, last-rows 341610, rates-ready 341877 |

## Errors

### 1 cold start
```
11-21 10:51:16.191 E/australianrates( 4612): Not starting debugger since process cannot load the jdwp agent.
```

### 30 cold relaunch
```
11-21 10:55:39.514 E/australianrates( 9251): Not starting debugger since process cannot load the jdwp agent.
```
