# App explorer: 1.0.390 (446)

Runner payload check: manifest HTTP 200, 3752 bytes, latest published run date 2026-11-27

Mode script | 43 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 19588 |  | 56/76 | 250 | 457 | 4 errors; start 2671ms |
| 2 | browse-open | 5248 |  | 2/2 | 36 | 579 | boot js-start 81579, layout-mounted 81900, cache-read 82002, hydrated 82176, splash-hide 82176, manifest 83187, resolved 83941, core-fetched 86007, core-saved 86343, search-index-idle 86528, leading-requested 86528, details-start 87311, leading-scoped 87335, pricing-ready 89593, details-fetched 91603, rows-prepared 97143, detail-filters-idle 97143, last-pricing 97143, suitability-built 97764, post-refresh-wait 98084, leading-page 99759, last-rows 114582, rates-ready 114914, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 221, pricing-scope-ms 19267, leading-gated 1, filter-runs 3, filter-rows 56880, filter-yields 9, filter-ms 253, sort-runs 4, sort-rows 1191, sort-yields 4, sort-ms 56 |
| 3 | browse | 0 |  |  |  | 631 |  |
| 4 | watchlist-open | 83 |  | 4/4 | 48 | 482 |  |
| 5 | watchlist | 0 |  |  |  | 527 |  |
| 6 | market-open | 4677 |  | 13/21 | 48 | 522 |  |
| 7 | market | 1 |  |  |  | 521 |  |
| 8 | tools-open | 32 |  | 15/21 | 129 | 534 |  |
| 9 | tools | 0 |  |  |  | 530 |  |
| 10 | trends-open | 45 |  | 23/34 | 101 | 548 |  |
| 11 | trends | 0 |  |  |  | 546 |  |
| 12 | search-open | 27 |  | 31/40 | 133 | 616 |  |
| 13 | search | 0 |  |  |  | 657 |  |
| 14 | bank-rates-open | 38 |  | 16/26 | 81 | 659 |  |
| 15 | bank-rates | 0 |  |  |  | 653 |  |
| 16 | compare-open | 29 |  | 13/16 | 117 | 658 |  |
| 17 | compare | 0 |  |  |  | 657 |  |
| 18 | calculator-open | 29 |  | 15/26 | 77 | 668 |  |
| 19 | calculator | 0 |  |  |  | 663 |  |
| 20 | projections-open | 32 |  | 22/34 | 97 | 674 |  |
| 21 | projections | 0 |  |  |  | 674 |  |
| 22 | research-open | 4509 |  | 21/31 | 81 | 701 |  |
| 23 | research | 0 |  |  |  | 686 |  |
| 24 | rba-open | 2540 |  | 15/24 | 93 | 714 |  |
| 25 | rba | 0 |  |  |  | 703 |  |
| 26 | rba-scrolled-open | 29 |  | 3/4 | 32 | 706 |  |
| 27 | rba-scrolled | 2316 |  | 46/76 | 77 | 707 |  |
| 28 | rba-response-open | 33 |  | 20/34 | 53 | 719 |  |
| 29 | rba-response | 0 |  |  |  | 715 |  |
| 30 | settings-open | 28 |  | 15/27 | 77 | 697 |  |
| 31 | settings | 3043 |  | 56/91 | 69 | 685 |  |
| 32 | debug-log-open | 34 |  | 16/22 | 73 | 688 |  |
| 33 | debug-log-tap-1 | 26 |  | 3/3 | 16 | 687 |  |
| 34 | debug-log-tap-2 | 27 |  | 28/51 | 69 | 690 |  |
| 35 | debug-log | 0 |  |  |  | 689 |  |
| 36 | profile-open | 25 |  | 16/25 | 85 | 692 |  |
| 37 | profile | 0 |  |  |  | 690 |  |
| 38 | terms-open | 33 |  | 16/26 | 77 | 693 |  |
| 39 | terms | 0 |  |  |  | 692 |  |
| 40 | third-party-open | 32 |  | 17/26 | 77 | 695 |  |
| 41 | third-party | 0 |  |  |  | 694 |  |
| 42 | catalogue-open | 33 |  | 32/41 | 101 | 729 |  |
| 43 | catalogue | 0 |  |  |  | 695 |  |

## Errors

### 1 cold start
```
11-26 23:43:55.188 E/australianrates( 4881): Not starting debugger since process cannot load the jdwp agent.
11-26 23:44:08.068 E/unknown:SurfaceMountingManager( 4881): Stopping surface [1]
11-26 23:44:08.074 E/unknown:SurfaceMountingManager( 4881): Surface [1] was stopped on SurfaceMountingManager.
11-26 23:44:08.087 E/unknown:IntBufferBatchMountItem( 4881): Skipping batch of MountItems; was stopped [1].
```
