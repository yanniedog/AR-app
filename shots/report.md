# App explorer: 1.0.363 (419)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 12457 |  | 44/57 | 200 | 427 | 2 errors; start 1721ms; boot js-start 60731, layout-mounted 60944, cache-read 61036, hydrated 61149, splash-hide 61149, manifest 62599, resolved 64076, core-fetched 66144, core-saved 66377, rows-prepared 66447, search-index-idle 66447, leading-requested 66447, details-start 66892, leading-scoped 66932, pricing-ready 67062, last-gate 67106, details-fetched 70371, detail-filters-idle 71420, last-pricing 71420, suitability-built 71522, post-refresh-wait 71642, leading-page 72038, last-rows 79220, rates-ready 79418, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 156, pricing-scope-ms 7796, leading-short 1, leading-short-rows 0, leading-scope-rows 118, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 3, filter-rows 38533, filter-yields 7, filter-ms 130, sort-runs 5, sort-rows 1175, sort-yields 5, sort-ms 16 |
| 2 | browse-open | 111 |  |  |  | 574 |  |
| 3 | browse | 0 |  |  |  | 665 |  |
| 4 | watchlist-open | 2542 |  | 3/3 | 31 | 541 |  |
| 5 | watchlist | 0 |  |  |  | 538 |  |
| 6 | market-open | 25 |  | 10/23 | 48 | 539 |  |
| 7 | market | 0 |  |  |  | 535 |  |
| 8 | tools-open | 24 |  | 12/22 | 81 | 552 |  |
| 9 | tools | 0 |  |  |  | 547 |  |
| 10 | trends-open | 22 |  | 19/36 | 81 | 565 |  |
| 11 | trends | 0 |  |  |  | 565 |  |
| 12 | search-open | 21 |  | 29/46 | 97 | 609 |  |
| 13 | search | 0 |  |  |  | 607 |  |
| 14 | bank-rates-open | 31 |  | 12/26 | 65 | 610 |  |
| 15 | bank-rates | 0 |  |  |  | 606 |  |
| 16 | compare-open | 25 |  | 15/17 | 121 | 611 |  |
| 17 | compare | 0 |  |  |  | 611 |  |
| 18 | calculator-open | 37 |  | 15/25 | 69 | 619 |  |
| 19 | calculator | 0 |  |  |  | 616 |  |
| 20 | projections-open | 32 |  | 23/39 | 97 | 628 |  |
| 21 | projections | 0 |  |  |  | 624 |  |
| 22 | research-open | 22 |  | 14/28 | 73 | 640 |  |
| 23 | research | 0 |  |  |  | 635 |  |
| 24 | rba-open | 2403 |  | 13/24 | 73 | 665 |  |
| 25 | rba | 0 |  |  |  | 652 |  |
| 26 | rba-scrolled-open | 34 |  | 3/4 | 34 | 655 |  |
| 27 | rba-scrolled | 2207 |  | 39/88 | 61 | 654 |  |
| 28 | rba-response-open | 30 |  | 17/31 | 77 | 664 |  |
| 29 | rba-response | 0 |  |  |  | 662 |  |
| 30 | settings-open | 30 |  | 15/27 | 81 | 676 |  |
| 31 | settings | 0 |  |  |  | 671 |  |
| 32 | about-open | 29 |  | 13/27 | 73 | 678 |  |
| 33 | about | 0 |  |  |  | 677 |  |
| 34 | profile-open | 31 |  | 14/28 | 48 | 689 |  |
| 35 | profile | 0 |  |  |  | 686 |  |
| 36 | terms-open | 30 |  | 13/24 | 89 | 690 |  |
| 37 | terms | 0 |  |  |  | 689 |  |
| 38 | third-party-open | 31 |  | 11/24 | 57 | 695 |  |
| 39 | third-party | 0 |  |  |  | 694 |  |
| 40 | catalogue-open | 30 |  | 34/49 | 81 | 742 |  |
| 41 | catalogue | 0 |  |  |  | 715 |  |

## Errors

### 1 cold start
```
11-23 22:03:09.741 E/australianrates( 4538): Not starting debugger since process cannot load the jdwp agent.
11-23 22:03:16.661 W/ReactNativeJS( 4538): [AR warn] degrade: fetch.httpError status=503 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-11-24-r000001/details-2026-11-24-e1fd3ea2ea1… ctx=download
```
