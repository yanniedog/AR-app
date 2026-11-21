# App explorer: 1.0.351 (407)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 14048 |  | 38/57 | 250 | 467 | 1 errors; start 1854ms; boot js-start 74017, layout-mounted 74291, cache-read 74362, hydrated 74552, splash-hide 74552, manifest 75721, resolved 76114, core-fetched 78084, core-saved 78575, rows-prepared 78829, search-index-idle 78829, leading-requested 78829, details-start 79489, leading-scoped 79652, pricing-ready 81627, last-gate 81694, details-fetched 84222, detail-filters-idle 87472, last-pricing 87472, suitability-built 87705, post-refresh-wait 87827, leading-page 88343, last-rows 95505, rates-ready 95768, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 174, pricing-scope-ms 8742, leading-short 1, leading-short-rows 0, leading-scope-rows 113, leading-visible-rows 0, leading-nonstd-rows 10, filter-runs 4, filter-rows 63396, filter-yields 10, filter-ms 209, sort-runs 5, sort-rows 1182, sort-yields 5, sort-ms 57 |
| 2 | browse-open | 101 |  |  |  | 475 |  |
| 3 | browse | 0 |  |  |  | 699 |  |
| 4 | watchlist-open | 2407 |  | 2/4 | 32 | 547 |  |
| 5 | watchlist | 0 |  |  |  | 544 |  |
| 6 | market-open | 31 |  | 10/16 | 73 | 543 |  |
| 7 | market | 0 |  |  |  | 539 |  |
| 8 | tools-open | 29 |  | 15/23 | 129 | 555 |  |
| 9 | tools | 0 |  |  |  | 552 |  |
| 10 | trends-open | 32 |  | 22/35 | 105 | 573 |  |
| 11 | trends | 0 |  |  |  | 570 |  |
| 12 | search-open | 32 |  | 28/37 | 117 | 609 |  |
| 13 | search | 0 |  |  |  | 606 |  |
| 14 | bank-rates-open | 44 |  | 19/30 | 77 | 616 |  |
| 15 | bank-rates | 0 |  |  |  | 610 |  |
| 16 | compare-open | 30 |  | 9/16 | 117 | 617 |  |
| 17 | compare | 0 |  |  |  | 613 |  |
| 18 | calculator-open | 32 |  | 17/27 | 77 | 622 |  |
| 19 | calculator | 0 |  |  |  | 623 |  |
| 20 | projections-open | 27 |  | 27/32 | 101 | 660 |  |
| 21 | projections | 0 |  |  |  | 656 |  |
| 22 | research-open | 23 |  | 18/29 | 77 | 659 |  |
| 23 | research | 0 |  |  |  | 648 |  |
| 24 | rba-open | 34 |  | 12/23 | 53 | 655 |  |
| 25 | rba | 0 |  |  |  | 649 |  |
| 26 | rba-scrolled-open | 30 |  | 3/4 | 32 | 652 |  |
| 27 | rba-scrolled | 2152 |  | 28/68 | 57 | 651 |  |
| 28 | rba-response-open | 33 |  | 16/29 | 65 | 662 |  |
| 29 | rba-response | 0 |  |  |  | 658 |  |
| 30 | settings-open | 25 |  | 13/22 | 73 | 672 |  |
| 31 | settings | 0 |  |  |  | 669 |  |
| 32 | about-open | 27 |  | 13/23 | 77 | 677 |  |
| 33 | about | 0 |  |  |  | 676 |  |
| 34 | profile-open | 30 |  | 13/24 | 81 | 685 |  |
| 35 | profile | 0 |  |  |  | 682 |  |
| 36 | terms-open | 25 |  | 14/24 | 57 | 686 |  |
| 37 | terms | 0 |  |  |  | 686 |  |
| 38 | third-party-open | 25 |  | 13/23 | 69 | 691 |  |
| 39 | third-party | 0 |  |  |  | 690 |  |
| 40 | catalogue-open | 31 |  | 32/47 | 85 | 735 |  |
| 41 | catalogue | 0 |  |  |  | 707 |  |

## Errors

### 1 cold start
```
11-21 21:54:13.427 E/australianrates( 5029): Not starting debugger since process cannot load the jdwp agent.
```
