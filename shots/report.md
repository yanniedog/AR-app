# App explorer: 1.0.342 (398)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 17129 |  | 45/57 | 350 | 408 | 1 errors; start 3927ms |
| 2 | browse-open | 84 |  |  |  | 501 |  |
| 3 | browse | 0 |  | 2/2 | 150 | 455 | boot js-start 82152, layout-mounted 82832, cache-read 83140, hydrated 83712, splash-hide 83712, manifest 84525, resolved 85565, core-fetched 88119, core-saved 88819, rows-prepared 89211, search-index-idle 89211, details-start 90026, pricing-ready 92372, last-gate 92869, details-fetched 94467, detail-filters-idle 96897, last-pricing 96897, suitability-built 97155, post-refresh-wait 97349, last-rows 114551, rates-ready 116390 |
| 4 | watchlist-open | 203 |  | 4/4 | 32 | 602 |  |
| 5 | watchlist | 0 |  |  |  | 500 |  |
| 6 | market-open | 49 |  | 16/22 | 53 | 508 |  |
| 7 | market | 0 |  |  |  | 498 |  |
| 8 | tools-open | 82 |  | 15/20 | 350 | 513 |  |
| 9 | tools | 0 |  |  |  | 509 |  |
| 10 | trends-open | 37 |  | 26/35 | 105 | 527 |  |
| 11 | trends | 0 |  |  |  | 525 |  |
| 12 | search-open | 27 |  | 33/44 | 113 | 600 |  |
| 13 | search | 0 |  |  |  | 628 |  |
| 14 | bank-rates-open | 30 |  | 21/29 | 81 | 638 |  |
| 15 | bank-rates | 0 |  |  |  | 632 |  |
| 16 | compare-open | 28 |  | 13/15 | 121 | 641 |  |
| 17 | compare | 0 |  |  |  | 640 |  |
| 18 | calculator-open | 30 |  | 19/24 | 97 | 651 |  |
| 19 | calculator | 0 |  |  |  | 647 |  |
| 20 | projections-open | 29 |  | 24/32 | 109 | 680 |  |
| 21 | projections | 0 |  |  |  | 677 |  |
| 22 | research-open | 33 |  | 20/33 | 73 | 671 |  |
| 23 | research | 0 |  |  |  | 670 |  |
| 24 | rba-open | 27 |  | 14/21 | 81 | 680 |  |
| 25 | rba | 0 |  |  |  | 678 |  |
| 26 | rba-scrolled-open | 26 |  | 2/4 | 18 | 676 |  |
| 27 | rba-scrolled | 2082 |  | 35/59 | 81 | 675 |  |
| 28 | rba-response-open | 36 |  | 21/31 | 69 | 688 |  |
| 29 | rba-response | 0 |  |  |  | 671 |  |
| 30 | settings-open | 30 |  | 15/22 | 101 | 651 |  |
| 31 | settings | 0 |  |  |  | 645 |  |
| 32 | about-open | 32 |  | 13/21 | 73 | 649 |  |
| 33 | about | 0 |  |  |  | 647 |  |
| 34 | profile-open | 28 |  | 16/24 | 77 | 652 |  |
| 35 | profile | 0 |  |  |  | 650 |  |
| 36 | terms-open | 34 |  | 17/24 | 73 | 652 |  |
| 37 | terms | 0 |  |  |  | 651 |  |
| 38 | third-party-open | 32 |  | 17/24 | 73 | 654 |  |
| 39 | third-party | 0 |  |  |  | 652 |  |
| 40 | catalogue-open | 30 |  | 33/46 | 97 | 689 |  |
| 41 | catalogue | 0 |  |  |  | 661 |  |

## Errors

### 1 cold start
```
11-21 10:41:17.729 E/australianrates( 4797): Not starting debugger since process cannot load the jdwp agent.
```
