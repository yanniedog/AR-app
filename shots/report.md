# App explorer: 1.0.378 (434)

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-26

Mode script | 43 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 13020 |  | 37/49 | 350 | 489 | 1 errors; start 2921ms |
| 2 | browse-open | 2477 |  | 2/2 | 93 | 555 | boot js-start 63908, layout-mounted 64491, cache-read 64645, hydrated 64766, splash-hide 64941, manifest 66174, resolved 66457, core-fetched 68144, core-saved 68565, search-index-idle 68689, leading-requested 68689, leading-scoped 69330, details-start 69341, pricing-ready 69793, details-fetched 72924, rows-prepared 75044, detail-filters-idle 75044, last-pricing 75044, suitability-built 75215, post-refresh-wait 75336, leading-page 76031, last-rows 87473, rates-ready 87994, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 206, pricing-scope-ms 12756, leading-gated 1, filter-runs 3, filter-rows 56340, filter-yields 12, filter-ms 1414, sort-runs 4, sort-rows 1183, sort-yields 4, sort-ms 62 |
| 3 | browse | 0 |  |  |  | 624 |  |
| 4 | watchlist-open | 97 |  | 4/4 | 105 | 622 |  |
| 5 | watchlist | 0 |  |  |  | 531 |  |
| 6 | market-open | 59 |  | 13/23 | 65 | 523 |  |
| 7 | market | 0 |  |  |  | 519 |  |
| 8 | tools-open | 25 |  | 12/22 | 117 | 535 |  |
| 9 | tools | 0 |  |  |  | 529 |  |
| 10 | trends-open | 36 |  | 21/38 | 113 | 548 |  |
| 11 | trends | 0 |  |  |  | 544 |  |
| 12 | search-open | 25 |  | 33/47 | 105 | 617 |  |
| 13 | search | 0 |  |  |  | 656 |  |
| 14 | bank-rates-open | 23 |  | 13/26 | 81 | 667 |  |
| 15 | bank-rates | 0 |  |  |  | 649 |  |
| 16 | compare-open | 22 |  | 10/16 | 117 | 654 |  |
| 17 | compare | 0 |  |  |  | 653 |  |
| 18 | calculator-open | 30 |  | 15/22 | 77 | 663 |  |
| 19 | calculator | 0 |  |  |  | 664 |  |
| 20 | projections-open | 27 |  | 22/36 | 85 | 695 |  |
| 21 | projections | 0 |  |  |  | 691 |  |
| 22 | research-open | 27 |  | 16/30 | 65 | 692 |  |
| 23 | research | 0 |  |  |  | 685 |  |
| 24 | rba-open | 2455 |  | 12/25 | 81 | 704 |  |
| 25 | rba | 0 |  |  |  | 695 |  |
| 26 | rba-scrolled-open | 30 |  | 2/4 | 32 | 669 |  |
| 27 | rba-scrolled | 2182 |  | 41/83 | 61 | 663 |  |
| 28 | rba-response-open | 29 |  | 18/32 | 61 | 672 |  |
| 29 | rba-response | 0 |  |  |  | 668 |  |
| 30 | settings-open | 27 |  | 16/29 | 61 | 673 |  |
| 31 | settings | 2815 |  | 46/91 | 69 | 670 |  |
| 32 | debug-log-open | 28 |  | 13/25 | 61 | 674 |  |
| 33 | debug-log-tap-1 | 19 |  | 2/2 | 27 | 672 |  |
| 34 | debug-log-tap-2 | 18 |  | 28/55 | 69 | 676 |  |
| 35 | debug-log | 0 |  |  |  | 675 |  |
| 36 | profile-open | 29 |  | 16/26 | 81 | 682 |  |
| 37 | profile | 0 |  |  |  | 680 |  |
| 38 | terms-open | 24 |  | 15/25 | 57 | 681 |  |
| 39 | terms | 0 |  |  |  | 680 |  |
| 40 | third-party-open | 22 |  | 13/23 | 65 | 684 |  |
| 41 | third-party | 0 |  |  |  | 682 |  |
| 42 | catalogue-open | 29 |  | 35/49 | 89 | 716 |  |
| 43 | catalogue | 0 |  |  |  | 693 |  |

## Errors

### 1 cold start
```
11-26 05:48:54.050 E/australianrates( 4675): Not starting debugger since process cannot load the jdwp agent.
```
