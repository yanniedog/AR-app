# App explorer: 1.0.339 (395)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 13086 |  | 37/52 | 300 | 514 | 1 errors; start 2903ms |
| 2 | browse-open | 2626 |  | 2/2 | 44 | 455 | boot js-start 81403, layout-mounted 81894, cache-read 82112, hydrated 82312, splash-hide 82312, manifest 83476, resolved 83871, core-fetched 86175, core-saved 86641, rows-prepared 86859, search-index-idle 86859, details-start 87540, pricing-ready 89713, details-fetched 91073, detail-filters-idle 94058, suitability-built 94322, core-ready 101389, rates-ready 107700 |
| 3 | browse | 0 |  |  |  | 596 |  |
| 4 | watchlist-open | 75 |  | 2/2 | 101 | 456 |  |
| 5 | watchlist | 0 |  |  |  | 523 |  |
| 6 | market-open | 41 |  | 16/25 | 48 | 527 |  |
| 7 | market | 0 |  |  |  | 512 |  |
| 8 | tools-open | 41 |  | 15/20 | 200 | 527 |  |
| 9 | tools | 0 |  |  |  | 523 |  |
| 10 | trends-open | 34 |  | 23/37 | 89 | 542 |  |
| 11 | trends | 0 |  |  |  | 539 |  |
| 12 | search-open | 42 |  | 25/33 | 133 | 609 |  |
| 13 | search | 0 |  |  |  | 650 |  |
| 14 | bank-rates-open | 28 |  | 19/26 | 85 | 649 |  |
| 15 | bank-rates | 0 |  |  |  | 643 |  |
| 16 | compare-open | 29 |  | 13/15 | 121 | 652 |  |
| 17 | compare | 0 |  |  |  | 650 |  |
| 18 | calculator-open | 32 |  | 18/25 | 97 | 625 |  |
| 19 | calculator | 0 |  |  |  | 620 |  |
| 20 | projections-open | 35 |  | 30/37 | 121 | 646 |  |
| 21 | projections | 0 |  |  |  | 645 |  |
| 22 | research-open | 51 |  | 18/28 | 81 | 642 |  |
| 23 | research | 0 |  |  |  | 631 |  |
| 24 | rba-open | 30 |  | 14/21 | 101 | 639 |  |
| 25 | rba | 0 |  |  |  | 637 |  |
| 26 | rba-scrolled-open | 35 |  | 3/4 | 32 | 636 |  |
| 27 | rba-scrolled | 2333 |  | 43/66 | 69 | 635 |  |
| 28 | rba-response-open | 37 |  | 19/30 | 81 | 642 |  |
| 29 | rba-response | 0 |  |  |  | 638 |  |
| 30 | settings-open | 36 |  | 18/25 | 93 | 648 |  |
| 31 | settings | 0 |  |  |  | 644 |  |
| 32 | about-open | 31 |  | 13/20 | 101 | 650 |  |
| 33 | about | 0 |  |  |  | 648 |  |
| 34 | profile-open | 37 |  | 13/22 | 73 | 654 |  |
| 35 | profile | 0 |  |  |  | 652 |  |
| 36 | terms-open | 41 |  | 12/21 | 69 | 654 |  |
| 37 | terms | 0 |  |  |  | 653 |  |
| 38 | third-party-open | 37 |  | 12/20 | 77 | 658 |  |
| 39 | third-party | 0 |  |  |  | 656 |  |
| 40 | catalogue-open | 37 |  | 32/42 | 93 | 689 |  |
| 41 | catalogue | 0 |  |  |  | 647 |  |

## Errors

### 1 cold start
```
11-21 08:16:45.215 E/australianrates( 4977): Not starting debugger since process cannot load the jdwp agent.
```
