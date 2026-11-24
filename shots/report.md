# App explorer: 1.0.372 (428)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 19216 |  | 42/51 | 200 | 403 | 2 errors; start 3249ms |
| 2 | browse-open | 2499 |  | 2/2 | 48 | 548 | boot js-start 71347, layout-mounted 72021, cache-read 72275, hydrated 72433, splash-hide 72622, manifest 74140, resolved 74462, core-fetched 77649, core-saved 78422, rows-prepared 78701, search-index-idle 78701, leading-requested 78701, details-start 79384, leading-scoped 79499, pricing-ready 79938, last-gate 80000, details-fetched 86002, detail-filters-idle 88202, last-pricing 88202, suitability-built 88355, post-refresh-wait 88602, leading-page 89189, last-rows 101015, rates-ready 101553, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 225, pricing-scope-ms 13032, leading-short 1, leading-short-rows 0, leading-scope-rows 123, leading-visible-rows 0, leading-nonstd-rows 11, filter-runs 4, filter-rows 63484, filter-yields 13, filter-ms 401, sort-runs 5, sort-rows 1177, sort-yields 5, sort-ms 24 |
| 3 | browse | 0 |  |  |  | 561 |  |
| 4 | watchlist-open | 57 |  | 3/3 | 38 | 617 |  |
| 5 | watchlist | 0 |  |  |  | 481 |  |
| 6 | market-open | 59 |  | 14/20 | 61 | 486 |  |
| 7 | market | 0 |  |  |  | 482 |  |
| 8 | tools-open | 49 |  | 15/22 | 89 | 491 |  |
| 9 | tools | 0 |  |  |  | 485 |  |
| 10 | trends-open | 27 |  | 24/35 | 150 | 503 |  |
| 11 | trends | 0 |  |  |  | 500 |  |
| 12 | search-open | 25 |  | 27/35 | 150 | 566 |  |
| 13 | search | 0 |  |  |  | 595 |  |
| 14 | bank-rates-open | 24 |  | 19/27 | 97 | 609 |  |
| 15 | bank-rates | 0 |  |  |  | 606 |  |
| 16 | compare-open | 28 |  | 11/16 | 109 | 611 |  |
| 17 | compare | 0 |  |  |  | 611 |  |
| 18 | calculator-open | 25 |  | 13/22 | 73 | 620 |  |
| 19 | calculator | 0 |  |  |  | 620 |  |
| 20 | projections-open | 25 |  | 30/38 | 97 | 656 |  |
| 21 | projections | 0 |  |  |  | 652 |  |
| 22 | research-open | 24 |  | 15/28 | 77 | 651 |  |
| 23 | research | 0 |  |  |  | 639 |  |
| 24 | rba-open | 2423 |  | 9/19 | 150 | 673 |  |
| 25 | rba | 0 |  |  |  | 666 |  |
| 26 | rba-scrolled-open | 31 |  | 2/4 | 23 | 666 |  |
| 27 | rba-scrolled | 2162 |  | 53/77 | 77 | 665 |  |
| 28 | rba-response-open | 26 |  | 20/34 | 73 | 676 |  |
| 29 | rba-response | 0 |  |  |  | 672 |  |
| 30 | settings-open | 27 |  | 14/22 | 105 | 688 |  |
| 31 | settings | 0 |  |  |  | 682 |  |
| 32 | about-open | 29 |  | 13/23 | 69 | 688 |  |
| 33 | about | 0 |  |  |  | 687 |  |
| 34 | profile-open | 31 |  | 15/24 | 89 | 699 |  |
| 35 | profile | 0 |  |  |  | 697 |  |
| 36 | terms-open | 28 |  | 14/23 | 69 | 701 |  |
| 37 | terms | 0 |  |  |  | 700 |  |
| 38 | third-party-open | 30 |  | 15/23 | 73 | 705 |  |
| 39 | third-party | 0 |  |  |  | 704 |  |
| 40 | catalogue-open | 28 |  | 39/49 | 97 | 752 |  |
| 41 | catalogue | 0 |  |  |  | 726 |  |

## Errors

### 1 cold start
```
11-24 22:46:44.078 E/australianrates( 4740): Not starting debugger since process cannot load the jdwp agent.
11-24 22:46:53.436 W/ReactNativeJS( 4740): [AR warn] degrade: fetch.httpError status=503 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-11-25-r000001/search-index-2026-11-25-8a36c7… ctx=download
```
