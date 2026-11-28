# App explorer: 1.0.393 (449)

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-28

Mode script | 44 steps | crashes 0 | step failures 1 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 15593 |  | 39/52 | 250 | 506 | 1 errors; start 2237ms |
| 2 | browse-open | 2687 |  | 2/2 | 32 | 540 | boot js-start 79760, layout-mounted 80057, cache-read 80196, hydrated 80527, splash-hide 80527, manifest 81876, resolved 82355, core-fetched 84544, core-saved 84840, pricing-wait-suitability 84944, search-index-idle 84944, details-start 85563, details-fetched 89297, rows-prepared 91334, detail-filters-idle 91334, leading-requested 91334, last-pricing 91334, suitability-built 91760, post-refresh-wait 91900, leading-scoped 92492, leading-page 92492, pricing-ready 105127, last-rows 105127, rates-ready 105395, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 206, pricing-scope-ms 13392, filter-runs 2, filter-rows 31912, filter-yields 6, filter-ms 124, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 14 |
| 3 | browse | 0 |  |  |  | 716 |  |
| 4 | watchlist-open | 101 |  | 5/5 | 65 | 470 |  |
| 5 | watchlist | 0 |  |  |  | 508 |  |
| 6 | market-open | 87 |  | 12/19 | 69 | 508 |  |
| 7 | market | 0 |  |  |  | 505 |  |
| 8 | tools-open | 47 |  | 14/21 | 109 | 518 |  |
| 9 | tools | 0 |  |  |  | 514 |  |
| 10 | trends-open | 32 |  | 24/34 | 101 | 532 |  |
| 11 | trends | 0 |  |  |  | 532 |  |
| 12 | search-open | 29 |  | 35/42 | 125 | 609 |  |
| 13 | search | 0 |  |  |  | 646 |  |
| 14 | bank-rates-open | 36 |  | 18/30 | 101 | 641 |  |
| 15 | bank-rates | 0 |  |  |  | 637 |  |
| 16 | compare-open | 33 |  | 12/15 | 113 | 641 |  |
| 17 | compare | 0 |  |  |  | 642 |  |
| 18 | calculator-open | 31 |  | 20/25 | 73 | 648 |  |
| 19 | calculator | 0 |  |  |  | 645 |  |
| 20 | projections-open | 29 |  | 27/37 | 101 | 669 |  |
| 21 | projections | 0 |  |  |  | 663 |  |
| 22 | research-open | 32 |  | 19/29 | 81 | 666 |  |
| 23 | research | 0 |  |  |  | 663 |  |
| 24 | rba-open | 34 |  | 16/25 | 105 | 694 |  |
| 25 | rba | 0 |  |  |  | 681 |  |
| 26 | rba-scrolled-open | 28 |  | 2/4 | 32 | 684 |  |
| 27 | rba-scrolled | 2235 |  | 41/60 | 89 | 683 |  |
| 28 | rba-response-open | 36 |  | 19/32 | 65 | 694 |  |
| 29 | rba-response | 0 |  |  |  | 690 |  |
| 30 | settings-open | 32 |  | 17/26 | 93 | 705 |  |
| 31 | settings | 2834 |  | 50/76 | 81 | 700 |  |
| 32 | debug-log-open | 35 |  | 14/22 | 85 | 707 |  |
| 33 | debug-log-tap-1 | 31 |  | 2/2 | 16 | 706 |  |
| 34 | debug-log-tap-2 | 35 |  | 29/50 | 69 | 712 |  |
| 35 | debug-log | 0 |  |  |  | 711 |  |
| 36 | profile-open | 37 |  | 13/23 | 81 | 717 |  |
| 37 | profile | 0 |  |  |  | 716 |  |
| 38 | product-history-open | 3448 |  | 27/35 | 81 | 733 |  |
| 39 | product-history-scroll | 684 |  | 13/23 | 69 | 729 |  |
| 40 | product-history | 1 |  | 1/1 | 16 | 716 | timeout waiting for {"label":"1 year","clickable":true,"enabled":true} |
| 41 | bank-history-open | 32 |  | 25/32 | 101 | 747 |  |
| 42 | bank-history | 1 |  |  |  | 733 |  |
| 43 | catalogue-open | 34 |  | 38/44 | 105 | 778 |  |
| 44 | catalogue | 0 |  |  |  | 736 |  |

## Errors

### 1 cold start
```
11-28 09:12:43.990 E/australianrates( 4885): Not starting debugger since process cannot load the jdwp agent.
```
