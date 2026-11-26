# App explorer: 1.0.388 (444)

Runner payload check: manifest HTTP 200, 3752 bytes, latest published run date 2026-11-27

Mode script | 43 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 21126 |  | 58/79 | 250 | 484 | 4 errors; start 2417ms |
| 2 | browse-open | 4856 |  | 2/2 | 32 | 573 | boot js-start 76516, layout-mounted 76874, cache-read 76964, hydrated 77413, splash-hide 77413, manifest 77773, resolved 78722, core-fetched 80748, core-saved 81148, search-index-idle 81325, leading-requested 81325, leading-scoped 82210, details-start 82244, pricing-ready 84244, details-fetched 85796, rows-prepared 95326, detail-filters-idle 95326, last-pricing 95326, suitability-built 96228, post-refresh-wait 96542, leading-page 97711, last-rows 112543, rates-ready 112785, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 239, pricing-scope-ms 17936, leading-gated 1, filter-runs 3, filter-rows 56880, filter-yields 10, filter-ms 489, sort-runs 4, sort-rows 1191, sort-yields 4, sort-ms 44 |
| 3 | browse | 0 |  |  |  | 630 |  |
| 4 | watchlist-open | 55 |  | 4/4 | 48 | 482 |  |
| 5 | watchlist | 0 |  |  |  | 527 |  |
| 6 | market-open | 2254 |  | 15/23 | 65 | 528 |  |
| 7 | market | 0 |  |  |  | 525 |  |
| 8 | tools-open | 68 |  | 15/22 | 150 | 538 |  |
| 9 | tools | 0 |  |  |  | 534 |  |
| 10 | trends-open | 25 |  | 26/37 | 101 | 552 |  |
| 11 | trends | 0 |  |  |  | 549 |  |
| 12 | search-open | 27 |  | 33/41 | 117 | 623 |  |
| 13 | search | 0 |  |  |  | 660 |  |
| 14 | bank-rates-open | 32 |  | 19/29 | 101 | 658 |  |
| 15 | bank-rates | 0 |  |  |  | 654 |  |
| 16 | compare-open | 30 |  | 13/17 | 113 | 657 |  |
| 17 | compare | 0 |  |  |  | 660 |  |
| 18 | calculator-open | 36 |  | 16/25 | 73 | 669 |  |
| 19 | calculator | 0 |  |  |  | 669 |  |
| 20 | projections-open | 28 |  | 30/40 | 89 | 704 |  |
| 21 | projections | 0 |  |  |  | 699 |  |
| 22 | research-open | 37 |  | 19/29 | 81 | 692 |  |
| 23 | research | 0 |  |  |  | 687 |  |
| 24 | rba-open | 2428 |  | 12/22 | 101 | 683 |  |
| 25 | rba | 0 |  |  |  | 677 |  |
| 26 | rba-scrolled-open | 31 |  | 2/4 | 38 | 672 |  |
| 27 | rba-scrolled | 2233 |  | 49/76 | 77 | 673 |  |
| 28 | rba-response-open | 26 |  | 17/31 | 65 | 678 |  |
| 29 | rba-response | 0 |  |  |  | 674 |  |
| 30 | settings-open | 25 |  | 20/27 | 85 | 681 |  |
| 31 | settings | 2977 |  | 52/90 | 73 | 678 |  |
| 32 | debug-log-open | 32 |  | 13/23 | 81 | 681 |  |
| 33 | debug-log-tap-1 | 22 |  | 2/2 | 16 | 679 |  |
| 34 | debug-log-tap-2 | 21 |  | 27/53 | 73 | 683 |  |
| 35 | debug-log | 0 |  |  |  | 682 |  |
| 36 | profile-open | 29 |  | 15/23 | 77 | 688 |  |
| 37 | profile | 0 |  |  |  | 686 |  |
| 38 | terms-open | 34 |  | 16/23 | 77 | 688 |  |
| 39 | terms | 0 |  |  |  | 687 |  |
| 40 | third-party-open | 31 |  | 13/22 | 77 | 691 |  |
| 41 | third-party | 0 |  |  |  | 689 |  |
| 42 | catalogue-open | 29 |  | 33/44 | 101 | 727 |  |
| 43 | catalogue | 0 |  |  |  | 695 |  |

## Errors

### 1 cold start
```
11-26 22:41:22.630 E/australianrates( 4584): Not starting debugger since process cannot load the jdwp agent.
11-26 22:41:34.002 E/unknown:SurfaceMountingManager( 4584): Stopping surface [1]
11-26 22:41:34.007 E/unknown:SurfaceMountingManager( 4584): Surface [1] was stopped on SurfaceMountingManager.
11-26 22:41:34.036 E/unknown:IntBufferBatchMountItem( 4584): Skipping batch of MountItems; was stopped [1].
```
