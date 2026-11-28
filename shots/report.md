# App explorer: 1.0.395 (451)

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-28

Mode script | 45 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 16669 |  | 43/58 | 300 | 524 | 5 errors; start 3045ms; boot js-start 63045, layout-mounted 63593, cache-read 63829, hydrated 64305, splash-hide 64305, manifest 65261, resolved 66084, core-fetched 68582, core-saved 69042, pricing-wait-suitability 69445, search-index-idle 69445, details-start 70357, details-fetched 74369, rows-prepared 75791, detail-filters-idle 75791, leading-requested 75791, last-pricing 75791, suitability-built 76115, post-refresh-wait 76364, leading-scoped 76960, leading-page 76960, pricing-ready 84362, last-rows 84362, rates-ready 84801, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 152, pricing-scope-ms 8277, filter-runs 2, filter-rows 31912, filter-yields 9, filter-ms 235, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 17 |
| 2 | browse-open | 83 |  |  |  | 456 |  |
| 3 | browse | 0 |  |  |  | 645 |  |
| 4 | watchlist-open | 58 |  |  |  | 540 |  |
| 5 | watchlist | 0 |  | 3/4 | 32 | 522 |  |
| 6 | market-open | 29 |  | 10/25 | 40 | 526 |  |
| 7 | market | 0 |  |  |  | 522 |  |
| 8 | tools-open | 24 |  | 12/23 | 121 | 539 |  |
| 9 | tools | 0 |  |  |  | 534 |  |
| 10 | trends-open | 23 |  | 22/40 | 65 | 553 |  |
| 11 | trends | 1 |  |  |  | 550 |  |
| 12 | search-open | 21 |  | 25/39 | 109 | 593 |  |
| 13 | search | 0 |  |  |  | 593 |  |
| 14 | bank-rates-open | 25 |  | 16/32 | 61 | 599 |  |
| 15 | bank-rates | 0 |  |  |  | 606 |  |
| 16 | compare-open | 30 |  | 9/18 | 69 | 608 |  |
| 17 | compare | 0 |  |  |  | 606 |  |
| 18 | calculator-open | 22 |  | 12/26 | 57 | 616 |  |
| 19 | calculator | 0 |  |  |  | 615 |  |
| 20 | projections-open | 26 |  | 16/32 | 69 | 623 |  |
| 21 | projections | 0 |  |  |  | 621 |  |
| 22 | research-open | 23 |  | 13/29 | 53 | 651 |  |
| 23 | research | 0 |  |  |  | 655 |  |
| 24 | rba-open | 2401 |  | 13/25 | 73 | 668 |  |
| 25 | rba | 0 |  |  |  | 659 |  |
| 26 | rba-scrolled-open | 22 |  | 3/4 | 32 | 661 |  |
| 27 | rba-scrolled | 2133 |  | 30/92 | 53 | 660 |  |
| 28 | rba-response-open | 26 |  | 13/26 | 85 | 672 |  |
| 29 | rba-response | 0 |  |  |  | 668 |  |
| 30 | settings-open | 22 |  | 9/28 | 85 | 683 |  |
| 31 | settings | 2821 |  | 34/106 | 57 | 663 |  |
| 32 | debug-log-open | 28 |  | 8/27 | 61 | 649 |  |
| 33 | debug-log-tap-1 | 23 |  | 1/3 | 16 | 648 |  |
| 34 | debug-log-tap-2 | 16 |  | 22/55 | 48 | 652 |  |
| 35 | debug-log | 0 |  |  |  | 650 |  |
| 36 | profile-open | 29 |  | 14/29 | 81 | 654 |  |
| 37 | profile | 0 |  |  |  | 652 |  |
| 38 | product-history-open | 3180 |  | 26/42 | 53 | 700 |  |
| 39 | product-history-scroll | 686 |  | 29/57 | 69 | 705 |  |
| 40 | product-history | 0 |  |  |  | 685 |  |
| 41 | bank-history-open | 22 |  | 22/34 | 85 | 724 |  |
| 42 | bank-history | 0 |  |  |  | 710 |  |
| 43 | mortgage-history-open | 24 |  | 26/43 | 65 | 759 |  |
| 44 | mortgage-history-scroll | 710 |  | 25/59 | 65 | 796 |  |
| 45 | mortgage-history | 0 |  |  |  | 755 |  |

## Errors

### 1 cold start
```
11-28 12:57:54.943 E/australianrates( 4820): Not starting debugger since process cannot load the jdwp agent.
11-28 12:57:56.896 E/unknown:SurfaceMountingManager( 4820): Stopping surface [1]
11-28 12:57:56.937 E/unknown:IntBufferBatchMountItem( 4820): Skipping batch of MountItems; was stopped [1].
11-28 12:57:56.952 E/unknown:SurfaceMountingManager( 4820): Surface [1] was stopped on SurfaceMountingManager.
11-28 12:58:03.601 W/ReactNativeJS( 4820): [AR warn] degrade: fetch.httpError status=503 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-11-28-r000001/details-2026-11-28-315fb5fe98b… ctx=download
```
