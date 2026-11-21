# App explorer: 1.0.340 (396)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 11134 |  | 43/57 | 150 | 526 | 1 errors; start 2033ms |
| 2 | browse-open | 62 |  | 2/2 | 32 | 573 | boot js-start 62056, layout-mounted 62399, cache-read 62499, hydrated 62690, splash-hide 62690, manifest 63039, resolved 63792, core-fetched 65419, core-saved 65828, rows-prepared 65949, search-index-idle 65949, details-start 66598, pricing-ready 68218, details-fetched 69885, detail-filters-idle 71395, suitability-built 71556, core-ready 76905, rates-ready 80553 |
| 3 | browse | 1 |  |  |  | 512 |  |
| 4 | watchlist-open | 61 |  | 3/4 | 32 | 517 |  |
| 5 | watchlist | 0 |  |  |  | 503 |  |
| 6 | market-open | 28 |  | 11/21 | 46 | 514 |  |
| 7 | market | 0 |  |  |  | 510 |  |
| 8 | tools-open | 27 |  | 15/23 | 93 | 525 |  |
| 9 | tools | 0 |  |  |  | 521 |  |
| 10 | trends-open | 26 |  | 24/34 | 101 | 540 |  |
| 11 | trends | 0 |  |  |  | 541 |  |
| 12 | search-open | 37 |  | 28/43 | 101 | 582 |  |
| 13 | search | 0 |  |  |  | 579 |  |
| 14 | bank-rates-open | 24 |  | 15/25 | 61 | 585 |  |
| 15 | bank-rates | 0 |  |  |  | 581 |  |
| 16 | compare-open | 31 |  | 14/18 | 89 | 586 |  |
| 17 | compare | 0 |  |  |  | 587 |  |
| 18 | calculator-open | 24 |  | 15/27 | 65 | 594 |  |
| 19 | calculator | 0 |  |  |  | 590 |  |
| 20 | projections-open | 26 |  | 21/34 | 85 | 602 |  |
| 21 | projections | 0 |  |  |  | 599 |  |
| 22 | research-open | 26 |  | 17/33 | 57 | 615 |  |
| 23 | research | 0 |  |  |  | 609 |  |
| 24 | rba-open | 28 |  | 13/25 | 61 | 618 |  |
| 25 | rba | 0 |  |  |  | 612 |  |
| 26 | rba-scrolled-open | 24 |  | 2/4 | 32 | 615 |  |
| 27 | rba-scrolled | 2089 |  | 27/69 | 48 | 614 |  |
| 28 | rba-response-open | 28 |  | 14/32 | 53 | 625 |  |
| 29 | rba-response | 0 |  |  |  | 622 |  |
| 30 | settings-open | 28 |  | 14/27 | 81 | 637 |  |
| 31 | settings | 0 |  |  |  | 633 |  |
| 32 | about-open | 23 |  | 10/24 | 57 | 641 |  |
| 33 | about | 0 |  |  |  | 640 |  |
| 34 | profile-open | 26 |  | 16/29 | 61 | 648 |  |
| 35 | profile | 0 |  |  |  | 646 |  |
| 36 | terms-open | 26 |  | 14/29 | 61 | 651 |  |
| 37 | terms | 0 |  |  |  | 650 |  |
| 38 | third-party-open | 29 |  | 11/23 | 81 | 656 |  |
| 39 | third-party | 0 |  |  |  | 655 |  |
| 40 | catalogue-open | 27 |  | 31/48 | 93 | 706 |  |
| 41 | catalogue | 0 |  |  |  | 681 |  |

## Errors

### 1 cold start
```
11-21 08:25:31.908 E/australianrates( 4775): Not starting debugger since process cannot load the jdwp agent.
```
