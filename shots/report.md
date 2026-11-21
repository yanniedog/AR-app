# App explorer: 1.0.337 (393)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 23665 |  | 42/56 | 300 | 490 | 1 errors; start 3574ms |
| 2 | browse-open | 5321 |  | 2/2 | 32 | 516 | boot js-start 80990, layout-mounted 81687, cache-read 81909, hydrated 82204, splash-hide 82204, manifest 83787, resolved 84365, core-fetched 87023, core-saved 87592, rows-prepared 87890, search-index-idle 87890, details-start 89178, pricing-ready 92827, details-fetched 95738, detail-filters-idle 100189, suitability-built 100687, details-saved 115004, rates-ready 115669 |
| 3 | browse | 0 |  |  |  | 362 |  |
| 4 | watchlist-open | 102 |  | 4/4 | 81 | 363 |  |
| 5 | watchlist | 0 |  |  |  | 427 |  |
| 6 | market-open | 55 |  | 21/30 | 65 | 430 |  |
| 7 | market | 0 |  |  |  | 417 |  |
| 8 | tools-open | 45 |  | 16/25 | 250 | 433 |  |
| 9 | tools | 0 |  |  |  | 430 |  |
| 10 | trends-open | 34 |  | 24/33 | 121 | 446 |  |
| 11 | trends | 0 |  |  |  | 447 |  |
| 12 | search-open | 37 |  | 31/40 | 129 | 514 |  |
| 13 | search | 0 |  |  |  | 521 |  |
| 14 | bank-rates-open | 40 |  | 21/27 | 101 | 539 |  |
| 15 | bank-rates | 0 |  |  |  | 536 |  |
| 16 | compare-open | 35 |  | 12/14 | 150 | 537 |  |
| 17 | compare | 0 |  |  |  | 535 |  |
| 18 | calculator-open | 41 |  | 14/20 | 113 | 549 |  |
| 19 | calculator | 0 |  |  |  | 546 |  |
| 20 | projections-open | 32 |  | 28/36 | 97 | 555 |  |
| 21 | projections | 0 |  |  |  | 553 |  |
| 22 | research-open | 32 |  | 22/32 | 73 | 567 |  |
| 23 | research | 0 |  |  |  | 562 |  |
| 24 | rba-open | 33 |  | 14/20 | 150 | 572 |  |
| 25 | rba | 0 |  |  |  | 567 |  |
| 26 | rba-scrolled-open | 33 |  | 2/4 | 16 | 569 |  |
| 27 | rba-scrolled | 2259 |  | 37/56 | 73 | 569 |  |
| 28 | rba-response-open | 36 |  | 21/31 | 97 | 580 |  |
| 29 | rba-response | 0 |  |  |  | 577 |  |
| 30 | settings-open | 37 |  | 18/28 | 73 | 577 |  |
| 31 | settings | 0 |  |  |  | 565 |  |
| 32 | about-open | 35 |  | 16/21 | 85 | 570 |  |
| 33 | about | 0 |  |  |  | 569 |  |
| 34 | profile-open | 31 |  | 17/25 | 81 | 574 |  |
| 35 | profile | 0 |  |  |  | 572 |  |
| 36 | terms-open | 42 |  | 15/21 | 89 | 573 |  |
| 37 | terms | 0 |  |  |  | 572 |  |
| 38 | third-party-open | 34 |  | 13/22 | 81 | 575 |  |
| 39 | third-party | 0 |  |  |  | 574 |  |
| 40 | catalogue-open | 37 |  | 32/40 | 113 | 611 |  |
| 41 | catalogue | 0 |  |  |  | 586 |  |

## Errors

### 1 cold start
```
11-21 05:30:55.053 E/australianrates( 4691): Not starting debugger since process cannot load the jdwp agent.
```
