# App explorer: 1.0.360 (416)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 1

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 21958 |  | 58/71 | 250 | 418 | 17 errors; start 2295ms; boot js-start 81723, layout-mounted 82047, cache-read 82173, hydrated 82499, splash-hide 82500, load-failed 85743 |
| 2 | browse-open | 4992 |  | 2/2 | 32 | 565 |  |
| 3 | browse | 0 |  |  |  | 623 |  |
| 4 | watchlist-open | 61 |  | 4/4 | 48 | 474 |  |
| 5 | watchlist | 0 |  |  |  | 516 |  |
| 6 | market-open | 37 |  | 11/19 | 65 | 522 |  |
| 7 | market | 0 |  |  |  | 517 |  |
| 8 | tools-open | 36 |  | 15/21 | 89 | 525 |  |
| 9 | tools | 0 |  |  |  | 521 |  |
| 10 | trends-open | 26 |  | 23/35 | 133 | 538 |  |
| 11 | trends | 0 |  |  |  | 536 |  |
| 12 | search-open | 27 |  | 34/40 | 150 | 603 |  |
| 13 | search | 0 |  |  |  | 610 |  |
| 14 | bank-rates-open | 27 |  | 18/24 | 77 | 631 |  |
| 15 | bank-rates | 0 |  |  |  | 625 |  |
| 16 | compare-open | 26 |  | 12/14 | 150 | 633 |  |
| 17 | compare | 0 |  |  |  | 631 |  |
| 18 | calculator-open | 33 |  | 18/23 | 93 | 642 |  |
| 19 | calculator | 0 |  |  |  | 639 |  |
| 20 | projections-open | 31 |  | 30/36 | 97 | 669 |  |
| 21 | projections | 0 |  |  |  | 672 |  |
| 22 | research-open | 28 |  | 20/30 | 89 | 667 |  |
| 23 | research | 0 |  |  |  | 665 |  |
| 24 | rba-open | 2482 |  | 16/25 | 73 | 692 |  |
| 25 | rba | 0 |  |  |  | 685 |  |
| 26 | rba-scrolled-open | 32 |  | 2/4 | 22 | 683 |  |
| 27 | rba-scrolled | 2277 |  | 51/69 | 93 | 683 |  |
| 28 | rba-response-open | 35 |  | 19/29 | 77 | 692 |  |
| 29 | rba-response | 0 |  |  |  | 689 |  |
| 30 | settings-open | 25 |  | 15/23 | 81 | 705 |  |
| 31 | settings | 0 |  |  |  | 698 |  |
| 32 | about-open | 33 |  | 14/21 | 81 | 705 |  |
| 33 | about | 0 |  |  |  | 704 |  |
| 34 | profile-open | 27 |  | 19/25 | 85 | 703 |  |
| 35 | profile | 0 |  |  |  | 697 |  |
| 36 | terms-open | 33 |  | 20/25 | 81 | 686 |  |
| 37 | terms | 0 |  |  |  | 684 |  |
| 38 | third-party-open | 29 |  | 13/21 | 73 | 687 |  |
| 39 | third-party | 0 |  |  |  | 686 |  |
| 40 | catalogue-open | 25 |  | 38/44 | 97 | 707 |  |
| 41 | catalogue | 0 |  |  |  | 675 |  |

## Errors

### 1 cold start
```
11-23 20:23:53.943 E/australianrates( 5065): Not starting debugger since process cannot load the jdwp agent.
11-23 20:23:56.476 W/ReactNativeJS( 5065): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-23 20:23:57.101 W/ReactNativeJS( 5065): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-23 20:23:58.647 E/ReactNativeJS( 5065): [AR error] store: refresh failed: asset HTTP 502
11-23 20:23:58.647 W/ReactNativeJS( 5065): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-23 20:23:58.648 E/unknown:ReactNative( 5065): ?anon_0_@1:2027514
11-23 20:23:58.648 E/unknown:ReactNative( 5065): SyntheticError@1:163016
11-23 20:23:58.648 E/unknown:ReactNative( 5065): Wrapper@1:163531
```
