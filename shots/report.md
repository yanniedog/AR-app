# App explorer: 1.0.339 (395)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 10763 |  | 33/57 | 200 | 520 | 1 errors; start 1532ms |
| 2 | browse-open | 2413 |  | 2/2 | 16 | 602 | boot js-start 64845, layout-mounted 65031, cache-read 65116, hydrated 65249, splash-hide 65249, manifest 66486, resolved 66817, core-fetched 68135, core-saved 68479, rows-prepared 68587, search-index-idle 68587, details-start 68897, pricing-ready 70659, details-fetched 72423, detail-filters-idle 74576, suitability-built 74714, core-ready 82517, rates-ready 85649 |
| 3 | browse | 0 |  |  |  | 551 |  |
| 4 | watchlist-open | 39 |  | 3/4 | 32 | 546 |  |
| 5 | watchlist | 0 |  |  |  | 533 |  |
| 6 | market-open | 73 |  | 11/28 | 48 | 547 |  |
| 7 | market | 0 |  |  |  | 542 |  |
| 8 | tools-open | 22 |  | 11/23 | 85 | 556 |  |
| 9 | tools | 0 |  |  |  | 553 |  |
| 10 | trends-open | 21 |  | 17/34 | 65 | 571 |  |
| 11 | trends | 0 |  |  |  | 571 |  |
| 12 | search-open | 25 |  | 28/44 | 133 | 638 |  |
| 13 | search | 0 |  |  |  | 616 |  |
| 14 | bank-rates-open | 31 |  | 14/27 | 65 | 620 |  |
| 15 | bank-rates | 0 |  |  |  | 612 |  |
| 16 | compare-open | 26 |  | 11/17 | 81 | 616 |  |
| 17 | compare | 0 |  |  |  | 617 |  |
| 18 | calculator-open | 24 |  | 14/27 | 65 | 624 |  |
| 19 | calculator | 0 |  |  |  | 621 |  |
| 20 | projections-open | 23 |  | 12/24 | 65 | 661 |  |
| 21 | projections | 0 |  |  |  | 660 |  |
| 22 | research-open | 27 |  | 18/33 | 61 | 648 |  |
| 23 | research | 0 |  |  |  | 645 |  |
| 24 | rba-open | 22 |  | 10/25 | 53 | 658 |  |
| 25 | rba | 0 |  |  |  | 650 |  |
| 26 | rba-scrolled-open | 25 |  | 3/4 | 32 | 652 |  |
| 27 | rba-scrolled | 2162 |  | 28/76 | 53 | 652 |  |
| 28 | rba-response-open | 31 |  | 15/31 | 46 | 664 |  |
| 29 | rba-response | 0 |  |  |  | 659 |  |
| 30 | settings-open | 24 |  | 14/27 | 65 | 673 |  |
| 31 | settings | 0 |  |  |  | 669 |  |
| 32 | about-open | 26 |  | 11/25 | 61 | 678 |  |
| 33 | about | 0 |  |  |  | 677 |  |
| 34 | profile-open | 22 |  | 15/27 | 73 | 686 |  |
| 35 | profile | 0 |  |  |  | 684 |  |
| 36 | terms-open | 23 |  | 11/26 | 61 | 687 |  |
| 37 | terms | 0 |  |  |  | 686 |  |
| 38 | third-party-open | 28 |  | 12/24 | 65 | 693 |  |
| 39 | third-party | 0 |  |  |  | 692 |  |
| 40 | catalogue-open | 23 |  | 34/50 | 85 | 691 |  |
| 41 | catalogue | 0 |  |  |  | 666 |  |

## Errors

### 1 cold start
```
11-21 07:29:08.483 E/australianrates( 4638): Not starting debugger since process cannot load the jdwp agent.
```
