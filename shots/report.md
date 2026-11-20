# App explorer: 1.0.330 (386)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 34337 |  | 67/84 | 250 | 699 | 5 errors; start 2531ms |
| 2 | browse-open | 2812 |  | 2/2 | 32 | 373 | boot js-start 81219, layout-mounted 81503, cache-read 81650, hydrated 81856, splash-hide 81856, core-ready 119187, rates-ready 128403 |
| 3 | browse | 0 |  |  |  | 380 |  |
| 4 | watchlist-open | 49 |  | 3/3 | 48 | 452 |  |
| 5 | watchlist | 0 |  |  |  | 449 |  |
| 6 | market-open | 27 |  | 15/22 | 81 | 453 |  |
| 7 | market | 1 |  |  |  | 450 |  |
| 8 | tools-open | 26 |  | 16/21 | 129 | 463 |  |
| 9 | tools | 1 |  |  |  | 460 |  |
| 10 | trends-open | 27 |  | 29/38 | 125 | 477 |  |
| 11 | trends | 1 |  |  |  | 476 |  |
| 12 | search-open | 31 |  | 29/34 | 150 | 519 |  |
| 13 | search | 1 |  |  |  | 518 |  |
| 14 | bank-rates-open | 34 |  | 19/28 | 93 | 519 |  |
| 15 | bank-rates | 0 |  |  |  | 515 |  |
| 16 | compare-open | 26 |  | 11/16 | 109 | 519 |  |
| 17 | compare | 1 |  |  |  | 521 |  |
| 18 | calculator-open | 36 |  | 14/25 | 73 | 526 |  |
| 19 | calculator | 0 |  |  |  | 524 |  |
| 20 | projections-open | 32 |  | 25/39 | 105 | 556 |  |
| 21 | projections | 1 |  |  |  | 553 |  |
| 22 | research-open | 32 |  | 24/32 | 93 | 553 |  |
| 23 | research | 1 |  |  |  | 547 |  |
| 24 | rba-open | 27 |  | 13/21 | 81 | 560 |  |
| 25 | rba | 1 |  |  |  | 552 |  |
| 26 | rba-scrolled-open | 32 |  | 2/4 | 27 | 555 |  |
| 27 | rba-scrolled | 2166 |  | 30/57 | 61 | 553 |  |
| 28 | rba-response-open | 33 |  | 21/29 | 73 | 565 |  |
| 29 | rba-response | 0 |  |  |  | 562 |  |
| 30 | settings-open | 31 |  | 12/23 | 101 | 576 |  |
| 31 | settings | 1 |  |  |  | 572 |  |
| 32 | about-open | 30 |  | 17/26 | 61 | 578 |  |
| 33 | about | 0 |  |  |  | 577 |  |
| 34 | profile-open | 30 |  | 16/21 | 77 | 588 |  |
| 35 | profile | 0 |  |  |  | 586 |  |
| 36 | terms-open | 33 |  | 15/24 | 77 | 589 |  |
| 37 | terms | 1 |  |  |  | 588 |  |
| 38 | third-party-open | 34 |  | 12/22 | 69 | 594 |  |
| 39 | third-party | 1 |  |  |  | 592 |  |
| 40 | catalogue-open | 31 |  | 32/49 | 89 | 627 |  |
| 41 | catalogue | 1 |  |  |  | 594 |  |

## Fatal lines
```
1 W/ReactNativeJS( 4974): [AR warn] store: ensureHistoryBanks compact asset failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
```

## Errors

### 1 cold start
```
11-20 22:35:35.500 E/australianrates( 4974): Not starting debugger since process cannot load the jdwp agent.
11-20 22:35:48.087 E/unknown:SurfaceMountingManager( 4974): Stopping surface [1]
11-20 22:35:48.104 E/unknown:IntBufferBatchMountItem( 4974): Skipping batch of MountItems; was stopped [1].
11-20 22:35:48.105 E/unknown:SurfaceMountingManager( 4974): Surface [1] was stopped on SurfaceMountingManager.
11-20 22:36:09.840 W/ReactNativeJS( 4974): [AR warn] store: ensureHistoryBanks compact asset failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
```
