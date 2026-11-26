# App explorer: 1.0.387 (443)

Runner payload check: manifest HTTP 200, 3752 bytes, latest published run date 2026-11-27

Mode script | 43 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 20555 |  | 43/55 | 400 | 416 | 1 errors; start 4034ms |
| 2 | browse-open | 6219 |  | 2/2 | 48 | 533 | boot js-start 73390, layout-mounted 73859, cache-read 74040, hydrated 74525, splash-hide 74525, manifest 75822, resolved 76646, core-fetched 79797, core-saved 80409, search-index-idle 80715, leading-requested 80715, details-start 82143, leading-scoped 82521, pricing-ready 85830, details-fetched 89672, rows-prepared 92506, detail-filters-idle 92506, last-pricing 92506, suitability-built 92711, post-refresh-wait 92804, leading-page 93503, last-rows 108968, rates-ready 110173, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 268, pricing-scope-ms 19984, leading-gated 1, filter-runs 2, filter-rows 31912, filter-yields 15, filter-ms 811, sort-runs 4, sort-rows 1191, sort-yields 6, sort-ms 226 |
| 3 | browse | 0 |  |  |  | 556 |  |
| 4 | watchlist-open | 70 |  | 3/4 | 40 | 623 |  |
| 5 | watchlist | 1 |  |  |  | 480 |  |
| 6 | market-open | 4856 |  | 15/25 | 65 | 475 |  |
| 7 | market | 0 |  |  |  | 474 |  |
| 8 | tools-open | 38 |  | 13/20 | 300 | 489 |  |
| 9 | tools | 1 |  |  |  | 485 |  |
| 10 | trends-open | 43 |  | 22/32 | 150 | 503 |  |
| 11 | trends | 1 |  |  |  | 502 |  |
| 12 | search-open | 32 |  | 30/34 | 150 | 574 |  |
| 13 | search | 1 |  |  |  | 600 |  |
| 14 | bank-rates-open | 26 |  | 17/26 | 81 | 614 |  |
| 15 | bank-rates | 1 |  |  |  | 612 |  |
| 16 | compare-open | 25 |  | 13/16 | 101 | 615 |  |
| 17 | compare | 0 |  |  |  | 617 |  |
| 18 | calculator-open | 25 |  | 16/22 | 85 | 624 |  |
| 19 | calculator | 1 |  |  |  | 621 |  |
| 20 | projections-open | 34 |  | 27/35 | 93 | 636 |  |
| 21 | projections | 1 |  |  |  | 636 |  |
| 22 | research-open | 33 |  | 22/32 | 81 | 649 |  |
| 23 | research | 1 |  |  |  | 647 |  |
| 24 | rba-open | 2507 |  | 12/18 | 150 | 674 |  |
| 25 | rba | 1 |  |  |  | 662 |  |
| 26 | rba-scrolled-open | 31 |  | 2/4 | 28 | 664 |  |
| 27 | rba-scrolled | 2167 |  | 47/76 | 69 | 664 |  |
| 28 | rba-response-open | 33 |  | 21/30 | 81 | 676 |  |
| 29 | rba-response | 1 |  |  |  | 672 |  |
| 30 | settings-open | 33 |  | 17/29 | 69 | 685 |  |
| 31 | settings | 2940 |  | 57/88 | 73 | 681 |  |
| 32 | debug-log-open | 36 |  | 15/23 | 77 | 687 |  |
| 33 | debug-log-tap-1 | 23 |  | 1/2 | 16 | 686 |  |
| 34 | debug-log-tap-2 | 25 |  | 28/52 | 69 | 692 |  |
| 35 | debug-log | 0 |  |  |  | 691 |  |
| 36 | profile-open | 32 |  | 17/23 | 77 | 701 |  |
| 37 | profile | 1 |  |  |  | 699 |  |
| 38 | terms-open | 38 |  | 13/23 | 77 | 705 |  |
| 39 | terms | 1 |  |  |  | 703 |  |
| 40 | third-party-open | 34 |  | 12/23 | 69 | 709 |  |
| 41 | third-party | 1 |  |  |  | 707 |  |
| 42 | catalogue-open | 29 |  | 34/45 | 97 | 759 |  |
| 43 | catalogue | 1 |  |  |  | 734 |  |

## Errors

### 1 cold start
```
11-26 19:43:45.549 E/australianrates( 4545): Not starting debugger since process cannot load the jdwp agent.
```
