# App explorer: 1.0.354 (410)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 17366 |  | 41/53 | 150 | 415 | 1 errors; start 2302ms |
| 2 | browse-open | 49 |  | 2/2 | 32 | 583 | boot js-start 67598, layout-mounted 67931, cache-read 68077, hydrated 68292, splash-hide 68292, manifest 69532, resolved 69852, core-fetched 71966, core-saved 72394, rows-prepared 72611, search-index-idle 72611, leading-requested 72611, details-start 73346, leading-scoped 73392, pricing-ready 73973, last-gate 74051, details-fetched 77890, detail-filters-idle 81347, last-pricing 81347, suitability-built 81965, post-refresh-wait 82370, leading-page 83070, last-rows 92543, rates-ready 92700, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 176, pricing-scope-ms 11308, leading-short 1, leading-short-rows 0, leading-scope-rows 113, leading-visible-rows 0, leading-nonstd-rows 10, filter-runs 3, filter-rows 38576, filter-yields 7, filter-ms 130, sort-runs 5, sort-rows 1182, sort-yields 5, sort-ms 42 |
| 3 | browse | 0 |  |  |  | 630 |  |
| 4 | watchlist-open | 63 |  | 3/5 | 36 | 481 |  |
| 5 | watchlist | 1 |  |  |  | 542 |  |
| 6 | market-open | 30 |  | 11/20 | 48 | 549 |  |
| 7 | market | 1 |  |  |  | 537 |  |
| 8 | tools-open | 23 |  | 13/23 | 81 | 553 |  |
| 9 | tools | 1 |  |  |  | 548 |  |
| 10 | trends-open | 37 |  | 30/47 | 89 | 565 |  |
| 11 | trends | 0 |  |  |  | 563 |  |
| 12 | search-open | 28 |  | 30/42 | 113 | 628 |  |
| 13 | search | 0 |  |  |  | 608 |  |
| 14 | bank-rates-open | 21 |  | 16/28 | 85 | 611 |  |
| 15 | bank-rates | 1 |  |  |  | 608 |  |
| 16 | compare-open | 29 |  | 13/17 | 105 | 612 |  |
| 17 | compare | 1 |  |  |  | 614 |  |
| 18 | calculator-open | 23 |  | 15/24 | 73 | 623 |  |
| 19 | calculator | 1 |  |  |  | 622 |  |
| 20 | projections-open | 25 |  | 20/33 | 109 | 628 |  |
| 21 | projections | 1 |  |  |  | 626 |  |
| 22 | research-open | 32 |  | 14/29 | 65 | 643 |  |
| 23 | research | 1 |  |  |  | 639 |  |
| 24 | rba-open | 2477 |  | 14/27 | 73 | 653 |  |
| 25 | rba | 1 |  |  |  | 643 |  |
| 26 | rba-scrolled-open | 27 |  | 3/4 | 24 | 645 |  |
| 27 | rba-scrolled | 2151 |  | 32/69 | 61 | 644 |  |
| 28 | rba-response-open | 33 |  | 19/32 | 61 | 655 |  |
| 29 | rba-response | 1 |  |  |  | 652 |  |
| 30 | settings-open | 27 |  | 10/22 | 77 | 666 |  |
| 31 | settings | 1 |  |  |  | 663 |  |
| 32 | about-open | 27 |  | 12/23 | 69 | 671 |  |
| 33 | about | 1 |  |  |  | 670 |  |
| 34 | profile-open | 27 |  | 13/26 | 65 | 677 |  |
| 35 | profile | 1 |  |  |  | 675 |  |
| 36 | terms-open | 27 |  | 16/26 | 69 | 680 |  |
| 37 | terms | 1 |  |  |  | 679 |  |
| 38 | third-party-open | 28 |  | 10/23 | 61 | 684 |  |
| 39 | third-party | 1 |  |  |  | 683 |  |
| 40 | catalogue-open | 27 |  | 28/49 | 85 | 726 |  |
| 41 | catalogue | 1 |  |  |  | 702 |  |

## Errors

### 1 cold start
```
11-22 10:17:19.945 E/australianrates( 4843): Not starting debugger since process cannot load the jdwp agent.
```
