# App explorer: 1.0.322 (378)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 28539 |  | 36/46 | 350 | 641 | 4 errors; start 4375ms |
| 2 | browse-open | 2642 |  | 8/11 | 150 | 526 |  |
| 3 | browse | 0 |  |  |  | 543 |  |
| 4 | watchlist-open | 135 |  | 3/4 | 61 | 573 |  |
| 5 | watchlist | 0 |  |  |  | 402 |  |
| 6 | market-open | 54 |  | 18/23 | 48 | 410 |  |
| 7 | market | 0 |  |  |  | 404 |  |
| 8 | tools-open | 53 |  | 15/25 | 200 | 413 |  |
| 9 | tools | 0 |  |  |  | 409 |  |
| 10 | trends-open | 112 |  | 25/40 | 133 | 422 |  |
| 11 | trends | 0 |  |  |  | 421 |  |
| 12 | search-open | 42 |  | 29/38 | 133 | 466 |  |
| 13 | search | 0 |  |  |  | 491 |  |
| 14 | bank-rates-open | 42 |  | 21/29 | 93 | 489 |  |
| 15 | bank-rates | 0 |  |  |  | 482 |  |
| 16 | compare-open | 37 |  | 13/16 | 129 | 488 |  |
| 17 | compare | 0 |  |  |  | 487 |  |
| 18 | calculator-open | 41 |  | 18/22 | 81 | 497 |  |
| 19 | calculator | 0 |  |  |  | 494 |  |
| 20 | projections-open | 38 |  | 27/35 | 113 | 503 |  |
| 21 | projections | 0 |  |  |  | 503 |  |
| 22 | research-open | 6734 |  | 35/51 | 77 | 553 |  |
| 23 | research | 0 |  |  |  | 521 |  |
| 24 | rba-open | 40 |  | 15/23 | 69 | 532 |  |
| 25 | rba | 0 |  |  |  | 526 |  |
| 26 | rba-scrolled-open | 43 |  | 2/3 | 31 | 529 |  |
| 27 | rba-scrolled | 0 |  | 32/47 | 73 | 528 |  |
| 28 | rba-response-open | 41 |  | 19/27 | 69 | 540 |  |
| 29 | rba-response | 0 |  |  |  | 536 |  |
| 30 | settings-open | 43 |  | 27/38 | 69 | 554 |  |
| 31 | settings | 0 |  |  |  | 549 |  |
| 32 | about-open | 39 |  | 14/19 | 109 | 556 |  |
| 33 | about | 0 |  |  |  | 555 |  |
| 34 | profile-open | 43 |  | 17/20 | 105 | 566 |  |
| 35 | profile | 0 |  |  |  | 564 |  |
| 36 | terms-open | 41 |  | 12/22 | 85 | 569 |  |
| 37 | terms | 0 |  |  |  | 568 |  |
| 38 | third-party-open | 44 |  | 17/22 | 77 | 575 |  |
| 39 | third-party | 0 |  |  |  | 574 |  |
| 40 | catalogue-open | 39 |  | 33/42 | 105 | 625 |  |
| 41 | catalogue | 0 |  |  |  | 621 |  |

## Fatal lines
```
1 W/ReactNativeJS( 4586): [AR warn] store: ensureHistoryBanks compact asset failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
1 W/ReactNativeJS( 4586): [AR warn] store: ensureBankInsights failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
1 W/ReactNativeJS( 4586): [AR warn] degrade: store.ensureFailed fn=ensureBankInsights error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
```

## Errors

### 1 cold start
```
11-20 10:52:20.873 E/australianrates( 4586): Not starting debugger since process cannot load the jdwp agent.
11-20 10:52:49.505 W/ReactNativeJS( 4586): [AR warn] store: ensureHistoryBanks compact asset failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
11-20 10:52:49.743 W/ReactNativeJS( 4586): [AR warn] store: ensureBankInsights failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
11-20 10:52:49.744 W/ReactNativeJS( 4586): [AR warn] degrade: store.ensureFailed fn=ensureBankInsights error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
```
