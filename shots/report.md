# App explorer: 1.0.365 (421)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 12726 |  | 43/58 | 150 | 413 | 1 errors; start 2350ms; boot js-start 60609, layout-mounted 60998, cache-read 61183, hydrated 61437, splash-hide 61437, manifest 62638, resolved 63250, core-fetched 65585, core-saved 66108, rows-prepared 66282, search-index-idle 66282, leading-requested 66282, details-start 66999, leading-scoped 67030, pricing-ready 67318, last-gate 68460, details-fetched 70386, detail-filters-idle 72214, last-pricing 72214, suitability-built 72276, post-refresh-wait 72427, leading-page 72869, last-rows 79363, rates-ready 79651, pricing-starts 2, pricing-cand-ms 1, pricing-resolve-ms 0, pricing-yields 158, pricing-scope-ms 7214, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 4, filter-rows 63344, filter-yields 11, filter-ms 220, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 1049 |
| 2 | browse-open | 85 |  |  |  | 548 |  |
| 3 | browse | 0 |  |  |  | 630 |  |
| 4 | watchlist-open | 2586 |  | 2/2 | 48 | 513 |  |
| 5 | watchlist | 0 |  |  |  | 511 |  |
| 6 | market-open | 33 |  | 11/21 | 48 | 515 |  |
| 7 | market | 1 |  |  |  | 511 |  |
| 8 | tools-open | 26 |  | 10/22 | 133 | 530 |  |
| 9 | tools | 1 |  |  |  | 523 |  |
| 10 | trends-open | 34 |  | 19/38 | 105 | 545 |  |
| 11 | trends | 1 |  |  |  | 545 |  |
| 12 | search-open | 30 |  | 30/45 | 105 | 587 |  |
| 13 | search | 1 |  |  |  | 584 |  |
| 14 | bank-rates-open | 31 |  | 15/29 | 69 | 590 |  |
| 15 | bank-rates | 1 |  |  |  | 587 |  |
| 16 | compare-open | 25 |  | 12/18 | 81 | 591 |  |
| 17 | compare | 0 |  |  |  | 592 |  |
| 18 | calculator-open | 31 |  | 16/26 | 85 | 598 |  |
| 19 | calculator | 0 |  |  |  | 595 |  |
| 20 | projections-open | 31 |  | 24/39 | 77 | 607 |  |
| 21 | projections | 1 |  |  |  | 605 |  |
| 22 | research-open | 29 |  | 15/34 | 53 | 621 |  |
| 23 | research | 0 |  |  |  | 615 |  |
| 24 | rba-open | 2383 |  | 11/26 | 65 | 644 |  |
| 25 | rba | 0 |  |  |  | 632 |  |
| 26 | rba-scrolled-open | 33 |  | 2/3 | 32 | 636 |  |
| 27 | rba-scrolled | 2185 |  | 44/84 | 65 | 635 |  |
| 28 | rba-response-open | 28 |  | 14/33 | 61 | 647 |  |
| 29 | rba-response | 1 |  |  |  | 643 |  |
| 30 | settings-open | 31 |  | 11/28 | 61 | 656 |  |
| 31 | settings | 0 |  |  |  | 651 |  |
| 32 | about-open | 29 |  | 9/25 | 57 | 657 |  |
| 33 | about | 1 |  |  |  | 656 |  |
| 34 | profile-open | 29 |  | 12/26 | 65 | 668 |  |
| 35 | profile | 1 |  |  |  | 665 |  |
| 36 | terms-open | 31 |  | 10/25 | 61 | 670 |  |
| 37 | terms | 1 |  |  |  | 669 |  |
| 38 | third-party-open | 32 |  | 11/25 | 65 | 674 |  |
| 39 | third-party | 0 |  |  |  | 673 |  |
| 40 | catalogue-open | 27 |  | 29/45 | 85 | 721 |  |
| 41 | catalogue | 1 |  |  |  | 694 |  |

## Errors

### 1 cold start
```
11-24 01:12:49.726 E/australianrates( 4763): Not starting debugger since process cannot load the jdwp agent.
```
