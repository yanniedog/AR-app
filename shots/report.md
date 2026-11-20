# App explorer: 1.0.321 (377)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 22354 |  | 38/48 | 250 | 647 | 4 errors; start 2166ms |
| 2 | browse-open | 58 |  |  |  | 536 |  |
| 3 | browse | 0 |  |  |  | 439 |  |
| 4 | watchlist-open | 45 |  | 2/4 | 32 | 432 |  |
| 5 | watchlist | 0 |  |  |  | 418 |  |
| 6 | market-open | 23 |  | 12/20 | 53 | 440 |  |
| 7 | market | 0 |  |  |  | 436 |  |
| 8 | tools-open | 23 |  | 15/22 | 85 | 440 |  |
| 9 | tools | 0 |  |  |  | 436 |  |
| 10 | trends-open | 23 |  | 24/36 | 101 | 451 |  |
| 11 | trends | 0 |  |  |  | 448 |  |
| 12 | search-open | 58 |  | 33/41 | 101 | 485 |  |
| 13 | search | 0 |  |  |  | 483 |  |
| 14 | bank-rates-open | 23 |  | 14/26 | 77 | 476 |  |
| 15 | bank-rates | 0 |  |  |  | 470 |  |
| 16 | compare-open | 32 |  | 11/16 | 150 | 472 |  |
| 17 | compare | 0 |  |  |  | 471 |  |
| 18 | calculator-open | 29 |  | 16/24 | 81 | 477 |  |
| 19 | calculator | 0 |  |  |  | 473 |  |
| 20 | projections-open | 30 |  | 27/42 | 93 | 507 |  |
| 21 | projections | 1 |  |  |  | 502 |  |
| 22 | research-open | 28 |  | 16/29 | 65 | 501 |  |
| 23 | research | 0 |  |  |  | 489 |  |
| 24 | rba-open | 26 |  | 10/23 | 77 | 496 |  |
| 25 | rba | 0 |  |  |  | 495 |  |
| 26 | rba-scrolled-open | 29 |  | 3/4 | 25 | 494 |  |
| 27 | rba-scrolled | 0 |  | 30/65 | 48 | 492 |  |
| 28 | rba-response-open | 26 |  | 14/32 | 65 | 502 |  |
| 29 | rba-response | 0 |  |  |  | 498 |  |
| 30 | settings-open | 32 |  | 12/22 | 113 | 509 |  |
| 31 | settings | 0 |  |  |  | 505 |  |
| 32 | about-open | 27 |  | 14/24 | 61 | 510 |  |
| 33 | about | 0 |  |  |  | 509 |  |
| 34 | profile-open | 30 |  | 12/25 | 69 | 516 |  |
| 35 | profile | 0 |  |  |  | 514 |  |
| 36 | terms-open | 36 |  | 16/27 | 65 | 516 |  |
| 37 | terms | 0 |  |  |  | 514 |  |
| 38 | third-party-open | 27 |  | 11/24 | 81 | 519 |  |
| 39 | third-party | 0 |  |  |  | 518 |  |
| 40 | catalogue-open | 23 |  | 32/51 | 81 | 564 |  |
| 41 | catalogue | 0 |  |  |  | 539 |  |

## Fatal lines
```
1 W/ReactNativeJS( 4756): [AR warn] store: ensureHistoryBanks compact asset failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
1 W/ReactNativeJS( 4756): [AR warn] degrade: store.ensureFailed fn=ensureBankInsights error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
1 W/ReactNativeJS( 4756): [AR warn] store: ensureBankInsights failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
```

## Errors

### 1 cold start
```
11-20 10:31:00.859 E/australianrates( 4756): Not starting debugger since process cannot load the jdwp agent.
11-20 10:31:23.049 W/ReactNativeJS( 4756): [AR warn] store: ensureHistoryBanks compact asset failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
11-20 10:31:23.465 W/ReactNativeJS( 4756): [AR warn] degrade: store.ensureFailed fn=ensureBankInsights error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
11-20 10:31:23.465 W/ReactNativeJS( 4756): [AR warn] store: ensureBankInsights failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
```
