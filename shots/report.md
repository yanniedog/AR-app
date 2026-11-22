# App explorer: 1.0.352 (408)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 16348 |  | 36/56 | 250 | 411 | 1 errors; start 1582ms |
| 2 | browse-open | 66 |  | 2/2 | 32 | 566 | boot js-start 70879, layout-mounted 71091, cache-read 71184, hydrated 71341, splash-hide 71341, manifest 72157, resolved 72762, core-fetched 75295, core-saved 75598, rows-prepared 75720, search-index-idle 75720, leading-requested 75720, details-start 76404, leading-scoped 76614, pricing-ready 79095, last-gate 79246, details-fetched 81510, detail-filters-idle 85592, last-pricing 85592, suitability-built 85814, post-refresh-wait 85884, leading-page 86438, last-rows 95887, rates-ready 96091, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 194, pricing-scope-ms 11156, leading-short 1, leading-short-rows 0, leading-scope-rows 113, leading-visible-rows 0, leading-nonstd-rows 10, filter-runs 3, filter-rows 38576, filter-yields 6, filter-ms 156, sort-runs 5, sort-rows 1182, sort-yields 5, sort-ms 77 |
| 3 | browse | 0 |  |  |  | 638 |  |
| 4 | watchlist-open | 46 |  |  |  | 538 |  |
| 5 | watchlist | 0 |  | 2/3 | 48 | 535 |  |
| 6 | market-open | 22 |  | 13/23 | 53 | 539 |  |
| 7 | market | 0 |  |  |  | 535 |  |
| 8 | tools-open | 26 |  | 13/22 | 117 | 552 |  |
| 9 | tools | 0 |  |  |  | 546 |  |
| 10 | trends-open | 28 |  | 20/33 | 85 | 564 |  |
| 11 | trends | 0 |  |  |  | 561 |  |
| 12 | search-open | 27 |  | 28/36 | 150 | 602 |  |
| 13 | search | 0 |  |  |  | 600 |  |
| 14 | bank-rates-open | 22 |  | 15/27 | 65 | 611 |  |
| 15 | bank-rates | 0 |  |  |  | 605 |  |
| 16 | compare-open | 30 |  | 11/17 | 89 | 610 |  |
| 17 | compare | 0 |  |  |  | 609 |  |
| 18 | calculator-open | 25 |  | 16/25 | 69 | 620 |  |
| 19 | calculator | 0 |  |  |  | 615 |  |
| 20 | projections-open | 28 |  | 26/38 | 89 | 647 |  |
| 21 | projections | 0 |  |  |  | 645 |  |
| 22 | research-open | 24 |  | 18/31 | 61 | 652 |  |
| 23 | research | 0 |  |  |  | 642 |  |
| 24 | rba-open | 22 |  | 12/24 | 77 | 652 |  |
| 25 | rba | 0 |  |  |  | 646 |  |
| 26 | rba-scrolled-open | 24 |  | 3/4 | 32 | 648 |  |
| 27 | rba-scrolled | 2112 |  | 28/65 | 57 | 647 |  |
| 28 | rba-response-open | 23 |  | 17/32 | 65 | 659 |  |
| 29 | rba-response | 0 |  |  |  | 655 |  |
| 30 | settings-open | 27 |  | 11/22 | 69 | 669 |  |
| 31 | settings | 0 |  |  |  | 665 |  |
| 32 | about-open | 32 |  | 14/24 | 73 | 673 |  |
| 33 | about | 0 |  |  |  | 672 |  |
| 34 | profile-open | 23 |  | 12/25 | 65 | 681 |  |
| 35 | profile | 0 |  |  |  | 678 |  |
| 36 | terms-open | 23 |  | 14/24 | 81 | 681 |  |
| 37 | terms | 0 |  |  |  | 680 |  |
| 38 | third-party-open | 29 |  | 13/24 | 57 | 687 |  |
| 39 | third-party | 0 |  |  |  | 685 |  |
| 40 | catalogue-open | 29 |  | 36/47 | 85 | 729 |  |
| 41 | catalogue | 0 |  |  |  | 701 |  |

## Errors

### 1 cold start
```
11-22 03:27:57.955 E/australianrates( 5066): Not starting debugger since process cannot load the jdwp agent.
```
