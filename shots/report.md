# App explorer: 1.0.394 (450)

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-28

Mode script | 44 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 20325 |  | 49/62 | 250 | 395 | 5 errors; start 3716ms |
| 2 | browse-open | 62 |  | 2/2 | 61 | 524 | boot js-start 73240, layout-mounted 73870, cache-read 74095, hydrated 74602, splash-hide 74602, manifest 77238, resolved 79425, core-fetched 82448, core-saved 83035, pricing-wait-suitability 83389, search-index-idle 83389, details-start 84396, details-fetched 88578, rows-prepared 90666, detail-filters-idle 90666, leading-requested 90666, last-pricing 90666, suitability-built 90987, post-refresh-wait 91143, leading-scoped 91725, leading-page 91725, pricing-ready 100536, last-rows 100536, rates-ready 100961, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 189, pricing-scope-ms 9587, filter-runs 1, filter-rows 6944, filter-yields 8, filter-ms 220, sort-runs 1, sort-rows 1191, sort-yields 1, sort-ms 24 |
| 3 | browse | 0 |  |  |  | 543 |  |
| 4 | watchlist-open | 86 |  | 3/4 | 85 | 594 |  |
| 5 | watchlist | 0 |  |  |  | 462 |  |
| 6 | market-open | 74 |  | 19/22 | 69 | 469 |  |
| 7 | market | 0 |  |  |  | 459 |  |
| 8 | tools-open | 45 |  | 16/20 | 200 | 475 |  |
| 9 | tools | 0 |  |  |  | 471 |  |
| 10 | trends-open | 42 |  | 21/32 | 109 | 492 |  |
| 11 | trends | 0 |  |  |  | 493 |  |
| 12 | search-open | 31 |  | 30/39 | 121 | 570 |  |
| 13 | search | 0 |  |  |  | 610 |  |
| 14 | bank-rates-open | 29 |  | 19/26 | 85 | 603 |  |
| 15 | bank-rates | 0 |  |  |  | 599 |  |
| 16 | compare-open | 44 |  | 13/14 | 117 | 603 |  |
| 17 | compare | 0 |  |  |  | 603 |  |
| 18 | calculator-open | 39 |  | 17/23 | 73 | 611 |  |
| 19 | calculator | 0 |  |  |  | 608 |  |
| 20 | projections-open | 33 |  | 31/43 | 97 | 631 |  |
| 21 | projections | 0 |  |  |  | 623 |  |
| 22 | research-open | 31 |  | 17/25 | 81 | 632 |  |
| 23 | research | 0 |  |  |  | 633 |  |
| 24 | rba-open | 37 |  | 17/26 | 101 | 661 |  |
| 25 | rba | 0 |  |  |  | 648 |  |
| 26 | rba-scrolled-open | 33 |  | 3/4 | 32 | 650 |  |
| 27 | rba-scrolled | 2284 |  | 47/69 | 81 | 650 |  |
| 28 | rba-response-open | 41 |  | 19/29 | 53 | 660 |  |
| 29 | rba-response | 0 |  |  |  | 656 |  |
| 30 | settings-open | 38 |  | 18/24 | 93 | 671 |  |
| 31 | settings | 2928 |  | 47/70 | 101 | 665 |  |
| 32 | debug-log-open | 39 |  | 15/25 | 89 | 672 |  |
| 33 | debug-log-tap-1 | 28 |  | 2/2 | 16 | 671 |  |
| 34 | debug-log-tap-2 | 28 |  | 28/47 | 77 | 678 |  |
| 35 | debug-log | 0 |  |  |  | 676 |  |
| 36 | profile-open | 40 |  | 18/24 | 85 | 683 |  |
| 37 | profile | 0 |  |  |  | 682 |  |
| 38 | product-history-open | 3522 |  | 27/37 | 85 | 711 |  |
| 39 | product-history-scroll | 700 |  | 37/44 | 97 | 715 |  |
| 40 | product-history | 0 |  | 1/1 | 16 | 697 |  |
| 41 | bank-history-open | 3778 |  | 29/33 | 93 | 721 |  |
| 42 | bank-history | 0 |  |  |  | 705 |  |
| 43 | catalogue-open | 34 |  | 31/38 | 133 | 742 |  |
| 44 | catalogue | 0 |  |  |  | 708 |  |

## Errors

### 1 cold start
```
11-28 12:01:28.752 E/australianrates( 4612): Not starting debugger since process cannot load the jdwp agent.
11-28 12:01:32.635 W/ReactNativeJS( 4612): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-28 12:01:33.682 W/ReactNativeJS( 4612): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-28 12:01:34.686 W/ReactNativeJS( 4612): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-28 12:01:35.386 W/ReactNativeJS( 4612): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
```
