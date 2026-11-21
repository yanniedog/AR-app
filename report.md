# App explorer: 1.0.339 (395)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode crawl | 30 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 2
Baseline 1.0.339

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 13664 | -6727 | 35/55 | 200 | 509 | 1 errors; start 2614ms |
| 2 | /browse | 4747 | +1977 | 2/2 | 32 | 481 | boot js-start 65812, layout-mounted 66470, cache-read 66732, hydrated 66931, splash-hide 67074, manifest 68245, resolved 68594, core-fetched 69863, core-saved 70152, rows-prepared 70252, search-index-idle 70252, details-start 70988, pricing-ready 71711, details-fetched 75280, detail-filters-idle 77966, suitability-built 78231, core-ready 88802, rates-ready 93143 |
| 3 | /watchlist | 54 | -23 | 3/3 | 32 | 608 |  |
| 4 | /market | 71 | -5046 | 8/13 | 89 | 504 |  |
| 5 | /tools | 34 | -5 | 15/22 | 117 | 515 |  |
| 6 | /trends | 29 | -20 | 19/29 | 97 | 528 |  |
| 7 | /search | 32 | -107 | 31/46 | 117 | 591 |  |
| 8 | /banks | 29 | -7 | 31/38 | 105 | 632 |  |
| 9 | /bank-rates | 34 | +2 | 14/25 | 81 | 638 |  |
| 10 | /categories | 24 | -14 | 36/49 | 89 | 650 |  |
| 11 | /catalogue | 27 | -2 | 32/48 | 85 | 657 |  |
| 12 | /compare | 23 | -22 | 14/16 | 113 | 641 |  |
| 13 | /matches | 25 | -18 | 27/46 | 93 | 654 |  |
| 14 | /calculator | 25 | -10 | 15/23 | 73 | 653 |  |
| 15 | /projections | 24 | -11 | 18/28 | 73 | 645 |  |
| 16 | /profile | 20 | -16 | 15/27 | 81 | 648 |  |
| 17 | /research | 21 | -20 | 16/29 | 65 | 653 |  |
| 18 | /rba | 26 | -9 | 11/24 | 81 | 661 |  |
| 19 | /rba-response | 21 | -15 | 18/32 | 65 | 662 |  |
| 20 | /settings | 21 | -17 | 15/28 | 69 | 668 |  |
| 21 | /about | 24 | -12 | 11/23 | 69 | 668 |  |
| 22 | /terms | 28 | -10 | 10/24 | 65 | 668 |  |
| 23 | /privacy | 28 | -12 |  |  | 666 |  |
| 24 | /third-party-notices | 22 | -12 | 13/23 | 69 | 671 |  |
| 25 | /node | 23 | -11 | 28/46 | 81 | 703 |  |
| 26 | /passthrough | 27 | -63 | 25/40 | 73 | 673 |  |
| 27 | /calculation-receipt | 23 | -15 | 13/25 | 65 | 671 |  |
| 28 | /rate-receipt | 22 | -18 | 6/10 | 69 | 669 |  |
| 29 | warm resume | 193 | -563 | 2/3 | 36 | 667 |  |
| 30 | cold relaunch | 8822 | -1548 | 27/38 | 400 | 528 | 1 errors; start 3358ms; boot js-start 299463, layout-mounted 299635, hydrated 299662, cache-read 300767, core-ready 301006, rows-prepared 301131, search-index-idle 301131, detail-filters-idle 301131, splash-hide 301132, manifest 302687, resolved 303534, pricing-ready 304120, rates-ready 304327 |

## Errors

### 1 cold start
```
11-21 07:56:04.279 E/australianrates( 4842): Not starting debugger since process cannot load the jdwp agent.
```

### 30 cold relaunch
```
11-21 07:59:58.252 E/australianrates( 9137): Not starting debugger since process cannot load the jdwp agent.
```
