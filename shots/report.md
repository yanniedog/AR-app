# App explorer: 1.0.385 (441)

Runner payload check: manifest HTTP 200, 3752 bytes, latest published run date 2026-11-27

Mode script | 43 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 2

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 18490 |  | 41/50 | 200 | 423 | 1 errors; start 3347ms |
| 2 | browse-open | 2785 |  | 1/2 | 36 | 551 | boot js-start 89786, layout-mounted 90343, cache-read 90534, hydrated 90732, splash-hide 90902, manifest 92373, resolved 93004, core-fetched 97194, core-saved 97763, search-index-idle 98042, leading-requested 98042, details-start 98756, leading-scoped 98806, pricing-ready 99126, details-fetched 104109, rows-prepared 106346, detail-filters-idle 106346, last-pricing 106346, suitability-built 106617, post-refresh-wait 106750, leading-page 107215, last-rows 118181, rates-ready 118481, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 202, pricing-scope-ms 11893, leading-gated 1, filter-runs 2, filter-rows 31912, filter-yields 7, filter-ms 147, sort-runs 4, sort-rows 1191, sort-yields 4, sort-ms 60 |
| 3 | browse | 1 |  |  |  | 581 |  |
| 4 | watchlist-open | 60 |  | 1/3 | 29 | 635 |  |
| 5 | watchlist | 1 |  |  |  | 479 |  |
| 6 | market-open | 2266 |  | 13/22 | 57 | 491 |  |
| 7 | market | 1 |  |  |  | 483 |  |
| 8 | tools-open | 27 |  | 14/22 | 150 | 497 | 13 errors |
| 9 | tools | 1 |  |  |  | 493 |  |
| 10 | trends-open | 84 |  | 19/29 | 300 | 511 |  |
| 11 | trends | 0 |  |  |  | 509 |  |
| 12 | search-open | 27 |  | 29/40 | 150 | 582 |  |
| 13 | search | 1 |  |  |  | 624 |  |
| 14 | bank-rates-open | 32 |  | 21/31 | 77 | 623 |  |
| 15 | bank-rates | 1 |  |  |  | 616 |  |
| 16 | compare-open | 26 |  | 11/15 | 150 | 622 |  |
| 17 | compare | 0 |  |  |  | 621 |  |
| 18 | calculator-open | 25 |  | 20/24 | 65 | 633 |  |
| 19 | calculator | 0 |  |  |  | 629 |  |
| 20 | projections-open | 26 |  | 28/37 | 101 | 662 |  |
| 21 | projections | 0 |  |  |  | 658 |  |
| 22 | research-open | 36 |  | 18/28 | 69 | 652 |  |
| 23 | research | 1 |  |  |  | 667 |  |
| 24 | rba-open | 2339 |  | 12/23 | 69 | 676 |  |
| 25 | rba | 1 |  |  |  | 675 |  |
| 26 | rba-scrolled-open | 29 |  | 2/4 | 20 | 676 |  |
| 27 | rba-scrolled | 2182 |  | 49/75 | 77 | 675 |  |
| 28 | rba-response-open | 25 |  | 17/30 | 65 | 685 |  |
| 29 | rba-response | 0 |  |  |  | 681 |  |
| 30 | settings-open | 28 |  | 19/28 | 73 | 695 |  |
| 31 | settings | 2952 |  | 59/86 | 77 | 690 |  |
| 32 | debug-log-open | 30 |  | 11/23 | 73 | 697 |  |
| 33 | debug-log-tap-1 | 28 |  | 1/2 | 16 | 696 |  |
| 34 | debug-log-tap-2 | 21 |  | 27/50 | 61 | 702 |  |
| 35 | debug-log | 0 |  |  |  | 701 |  |
| 36 | profile-open | 24 |  | 17/23 | 93 | 712 |  |
| 37 | profile | 0 |  |  |  | 710 |  |
| 38 | terms-open | 30 |  | 15/24 | 61 | 714 |  |
| 39 | terms | 0 |  |  |  | 713 |  |
| 40 | third-party-open | 26 |  | 14/23 | 73 | 719 |  |
| 41 | third-party | 0 |  |  |  | 718 |  |
| 42 | catalogue-open | 31 |  | 28/42 | 89 | 765 |  |
| 43 | catalogue | 1 |  |  |  | 742 |  |

## Errors

### 1 cold start
```
11-26 16:44:34.688 E/australianrates( 5072): Not starting debugger since process cannot load the jdwp agent.
```

### 8 tools-open
```
11-26 16:45:58.961 E/ReactNativeJS( 5072): [AR error] app-update: check failed: Network request failed
11-26 16:45:58.962 E/unknown:ReactNative( 5072): ?anon_0_@1:2719621
11-26 16:45:58.962 E/unknown:ReactNative( 5072): SyntheticError@1:163048
11-26 16:45:58.962 E/unknown:ReactNative( 5072): Wrapper@1:163563
11-26 16:45:58.962 E/unknown:ReactNative( 5072): _callSuper@1:148436
11-26 16:45:58.962 E/unknown:ReactNative( 5072): _construct@1:163911
11-26 16:45:58.962 E/unknown:ReactNative( 5072): _next@1:594899
11-26 16:45:58.962 E/unknown:ReactNative( 5072): append@1:863796
```
