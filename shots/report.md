# App explorer: 1.0.398 (454)

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode script | 45 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 17665 |  | 42/55 | 500 | 414 | 1 errors; start 3329ms |
| 2 | browse-open | 94 |  | 2/2 | 30 | 512 | boot js-start 85783, layout-mounted 86460, cache-read 86576, hydrated 86929, splash-hide 86929, manifest 87973, resolved 89081, core-fetched 91735, core-saved 92309, pricing-wait-suitability 92562, search-index-idle 92562, details-start 93164, details-fetched 97505, rows-prepared 99406, detail-filters-idle 99406, leading-requested 99406, last-pricing 99406, suitability-built 99722, post-refresh-wait 99833, leading-scoped 101235, leading-page 101235, pricing-ready 116488, last-rows 116488, rates-ready 117324, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 325, pricing-scope-ms 16790, filter-runs 2, filter-rows 37735, filter-yields 19, filter-ms 571, sort-runs 1, sort-rows 2150, sort-yields 2, sort-ms 104 |
| 3 | browse | 1 |  |  |  | 570 |  |
| 4 | watchlist-open | 94 |  | 4/4 | 85 | 629 |  |
| 5 | watchlist | 0 |  |  |  | 474 |  |
| 6 | market-open | 2448 |  | 16/27 | 57 | 481 |  |
| 7 | market | 0 |  |  |  | 481 |  |
| 8 | tools-open | 31 |  | 14/23 | 85 | 495 |  |
| 9 | tools | 0 |  |  |  | 491 |  |
| 10 | trends-open | 33 |  | 29/41 | 93 | 509 |  |
| 11 | trends | 0 |  |  |  | 507 |  |
| 12 | search-open | 28 |  | 31/43 | 109 | 583 |  |
| 13 | search | 0 |  |  |  | 595 |  |
| 14 | bank-rates-open | 37 |  | 18/31 | 77 | 616 |  |
| 15 | bank-rates | 0 |  |  |  | 610 |  |
| 16 | compare-open | 26 |  | 9/14 | 125 | 617 |  |
| 17 | compare | 0 |  |  |  | 616 |  |
| 18 | calculator-open | 31 |  | 15/25 | 73 | 627 |  |
| 19 | calculator | 0 |  |  |  | 623 |  |
| 20 | projections-open | 25 |  | 23/38 | 101 | 632 |  |
| 21 | projections | 0 |  |  |  | 641 |  |
| 22 | research-open | 4536 |  | 15/27 | 77 | 655 |  |
| 23 | research | 0 |  |  |  | 649 |  |
| 24 | rba-open | 2453 |  | 13/22 | 93 | 676 |  |
| 25 | rba | 0 |  |  |  | 664 |  |
| 26 | rba-scrolled-open | 33 |  | 2/4 | 32 | 666 |  |
| 27 | rba-scrolled | 2304 |  | 47/78 | 73 | 665 |  |
| 28 | rba-response-open | 31 |  | 21/34 | 65 | 678 |  |
| 29 | rba-response | 0 |  |  |  | 674 |  |
| 30 | settings-open | 32 |  | 16/23 | 65 | 685 |  |
| 31 | settings | 3054 |  | 61/91 | 73 | 681 |  |
| 32 | debug-log-open | 29 |  | 15/23 | 73 | 688 |  |
| 33 | debug-log-tap-1 | 24 |  | 2/2 | 16 | 687 |  |
| 34 | debug-log-tap-2 | 24 |  | 28/53 | 65 | 693 |  |
| 35 | debug-log | 0 |  |  |  | 692 |  |
| 36 | profile-open | 32 |  | 17/27 | 77 | 698 |  |
| 37 | profile | 0 |  |  |  | 697 |  |
| 38 | product-history-open | 3388 |  | 28/39 | 65 | 724 |  |
| 39 | product-history-scroll | 729 |  | 30/47 | 81 | 703 |  |
| 40 | product-history | 0 |  | 2/2 | 16 | 716 |  |
| 41 | bank-history-open | 3385 |  | 24/32 | 73 | 730 |  |
| 42 | bank-history | 0 |  |  |  | 716 |  |
| 43 | mortgage-history-open | 34 |  | 31/44 | 77 | 742 |  |
| 44 | mortgage-history-scroll | 732 |  | 38/55 | 81 | 777 |  |
| 45 | mortgage-history | 0 |  |  |  | 739 |  |

## Errors

### 1 cold start
```
11-28 15:17:51.596 E/australianrates( 4991): Not starting debugger since process cannot load the jdwp agent.
```
