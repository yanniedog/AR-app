# App explorer: 1.0.327 (383)

Runner payload check: manifest HTTP 200, 3751 bytes, run_date 

Mode script | 41 steps | crashes 0 | step failures 0 | settle timeouts 12 | steps with JS/native errors 12

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 251375 |  | 308/385 | 73 | 139 | no settle; 80 errors; start 4664ms |
| 2 | browse-open | 49359 |  | 51/72 | 57 | 137 | no settle; 16 errors |
| 3 | browse | 48447 |  | 54/72 | 48 | 135 | no settle; 16 errors |
| 4 | watchlist-open | 48504 |  | 58/73 | 48 | 140 | no settle; 16 errors |
| 5 | watchlist | 63988 |  | 59/81 | 36 | 142 | no settle; 16 errors |
| 6 | market-open | 51747 |  | 55/79 | 48 | 144 | no settle; 16 errors |
| 7 | market | 48743 |  | 54/72 | 57 | 146 | no settle; 16 errors |
| 8 | tools-open | 52042 |  | 64/76 | 48 | 148 | no settle; 16 errors |
| 9 | tools | 48506 |  | 51/66 | 40 | 144 | no settle; 16 errors |
| 10 | trends-open | 51940 |  | 67/83 | 85 | 150 | no settle; 16 errors |
| 11 | trends | 47666 |  | 52/66 | 36 | 147 | no settle; 16 errors |
| 12 | search-open | 21453 |  | 53/65 | 117 | 655 | no settle; 3 errors |
| 13 | search | 2319 |  | 8/12 | 117 | 561 |  |
| 14 | bank-rates-open | 39 |  | 16/26 | 97 | 464 |  |
| 15 | bank-rates | 0 |  |  |  | 446 |  |
| 16 | compare-open | 34 |  | 13/15 | 129 | 442 |  |
| 17 | compare | 0 |  |  |  | 441 |  |
| 18 | calculator-open | 39 |  | 17/21 | 81 | 443 |  |
| 19 | calculator | 0 |  |  |  | 436 |  |
| 20 | projections-open | 33 |  | 24/32 | 129 | 443 |  |
| 21 | projections | 0 |  |  |  | 440 |  |
| 22 | research-open | 40 |  | 20/25 | 77 | 467 |  |
| 23 | research | 0 |  |  |  | 459 |  |
| 24 | rba-open | 37 |  | 18/26 | 73 | 463 |  |
| 25 | rba | 0 |  |  |  | 458 |  |
| 26 | rba-scrolled-open | 35 |  | 3/3 | 32 | 460 |  |
| 27 | rba-scrolled | 0 |  | 42/58 | 77 | 458 |  |
| 28 | rba-response-open | 37 |  | 21/30 | 93 | 468 |  |
| 29 | rba-response | 0 |  |  |  | 464 |  |
| 30 | settings-open | 38 |  | 17/20 | 200 | 478 |  |
| 31 | settings | 0 |  |  |  | 472 |  |
| 32 | about-open | 40 |  | 17/26 | 81 | 475 |  |
| 33 | about | 0 |  |  |  | 474 |  |
| 34 | profile-open | 44 |  | 18/24 | 69 | 482 |  |
| 35 | profile | 0 |  |  |  | 480 |  |
| 36 | terms-open | 39 |  | 15/21 | 97 | 481 |  |
| 37 | terms | 0 |  |  |  | 480 |  |
| 38 | third-party-open | 45 |  | 16/24 | 89 | 484 |  |
| 39 | third-party | 0 |  |  |  | 483 |  |
| 40 | catalogue-open | 37 |  | 34/43 | 89 | 522 |  |
| 41 | catalogue | 0 |  |  |  | 493 |  |

## Fatal lines
```
12 W/ReactNativeJS( 4732): [AR warn] store: ensureHistoryBanks compact asset failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
12 W/ReactNativeJS( 4732): [AR warn] degrade: store.ensureFailed fn=ensureBankInsights error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
12 W/ReactNativeJS( 4732): [AR warn] store: ensureBankInsights failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
```

## Errors

### 1 cold start
```
11-20 14:11:20.623 E/australianrates( 4732): Not starting debugger since process cannot load the jdwp agent.
11-20 14:11:25.631 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:11:27.021 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-20 14:11:27.746 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-20 14:11:29.225 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/dates-index.json?%E2%80%A6 ctx=download
11-20 14:11:29.226 E/ReactNativeJS( 4732): [AR error] store: refresh failed: cannot verify ingest finalisation for 2026-11-20; try again shortly
11-20 14:11:29.228 E/unknown:ReactNative( 4732): ?anon_0_@1:2015967
11-20 14:11:29.228 E/unknown:ReactNative( 4732): SyntheticError@1:162884
```

### 2 browse-open
```
11-20 14:15:32.236 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:15:32.907 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:15:33.968 E/ReactNativeJS( 4732): [AR error] store: refresh failed: asset HTTP 502
11-20 14:15:33.968 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:15:33.970 E/unknown:ReactNative( 4732): ?anon_0_@1:2015967
11-20 14:15:33.970 E/unknown:ReactNative( 4732): SyntheticError@1:162884
11-20 14:15:33.970 E/unknown:ReactNative( 4732): Wrapper@1:163399
11-20 14:15:33.970 E/unknown:ReactNative( 4732): _callSuper@1:148272
```

### 3 browse
```
11-20 14:16:34.266 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:16:34.657 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:16:35.750 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:16:35.751 E/ReactNativeJS( 4732): [AR error] store: refresh failed: asset HTTP 502
11-20 14:16:35.763 E/unknown:ReactNative( 4732): ?anon_0_@1:2015967
11-20 14:16:35.763 E/unknown:ReactNative( 4732): SyntheticError@1:162884
11-20 14:16:35.763 E/unknown:ReactNative( 4732): Wrapper@1:163399
11-20 14:16:35.763 E/unknown:ReactNative( 4732): _callSuper@1:148272
```

### 4 watchlist-open
```
11-20 14:17:11.957 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:17:12.713 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:17:13.556 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:17:13.558 E/ReactNativeJS( 4732): [AR error] store: refresh failed: asset HTTP 502
11-20 14:17:13.562 E/unknown:ReactNative( 4732): ?anon_0_@1:2015967
11-20 14:17:13.562 E/unknown:ReactNative( 4732): SyntheticError@1:162884
11-20 14:17:13.562 E/unknown:ReactNative( 4732): Wrapper@1:163399
11-20 14:17:13.562 E/unknown:ReactNative( 4732): _callSuper@1:148272
```

### 5 watchlist
```
11-20 14:18:13.858 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:18:14.403 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:18:15.719 E/ReactNativeJS( 4732): [AR error] store: refresh failed: asset HTTP 502
11-20 14:18:15.719 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:18:15.721 E/unknown:ReactNative( 4732): ?anon_0_@1:2015967
11-20 14:18:15.721 E/unknown:ReactNative( 4732): SyntheticError@1:162884
11-20 14:18:15.721 E/unknown:ReactNative( 4732): Wrapper@1:163399
11-20 14:18:15.721 E/unknown:ReactNative( 4732): _callSuper@1:148272
```

### 6 market-open
```
11-20 14:19:05.915 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:19:06.586 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:19:07.884 E/ReactNativeJS( 4732): [AR error] store: refresh failed: asset HTTP 502
11-20 14:19:07.884 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:19:07.886 E/unknown:ReactNative( 4732): ?anon_0_@1:2015967
11-20 14:19:07.886 E/unknown:ReactNative( 4732): SyntheticError@1:162884
11-20 14:19:07.886 E/unknown:ReactNative( 4732): Wrapper@1:163399
11-20 14:19:07.886 E/unknown:ReactNative( 4732): _callSuper@1:148272
```

### 7 market
```
11-20 14:20:08.251 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:20:08.817 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:20:09.858 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:20:09.860 E/ReactNativeJS( 4732): [AR error] store: refresh failed: asset HTTP 502
11-20 14:20:09.864 E/unknown:ReactNative( 4732): ?anon_0_@1:2015967
11-20 14:20:09.864 E/unknown:ReactNative( 4732): SyntheticError@1:162884
11-20 14:20:09.864 E/unknown:ReactNative( 4732): Wrapper@1:163399
11-20 14:20:09.864 E/unknown:ReactNative( 4732): _callSuper@1:148272
```

### 8 tools-open
```
11-20 14:20:48.389 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:20:48.981 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:20:50.185 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:20:50.186 E/ReactNativeJS( 4732): [AR error] store: refresh failed: asset HTTP 502
11-20 14:20:50.189 E/unknown:ReactNative( 4732): ?anon_0_@1:2015967
11-20 14:20:50.189 E/unknown:ReactNative( 4732): SyntheticError@1:162884
11-20 14:20:50.189 E/unknown:ReactNative( 4732): Wrapper@1:163399
11-20 14:20:50.189 E/unknown:ReactNative( 4732): _callSuper@1:148272
```

### 9 tools
```
11-20 14:21:50.582 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:21:51.295 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:21:51.978 E/ReactNativeJS( 4732): [AR error] store: refresh failed: asset HTTP 502
11-20 14:21:51.978 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:21:51.980 E/unknown:ReactNative( 4732): ?anon_0_@1:2015967
11-20 14:21:51.980 E/unknown:ReactNative( 4732): SyntheticError@1:162884
11-20 14:21:51.980 E/unknown:ReactNative( 4732): Wrapper@1:163399
11-20 14:21:51.980 E/unknown:ReactNative( 4732): _callSuper@1:148272
```

### 10 trends-open
```
11-20 14:22:30.597 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:22:31.036 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:22:32.250 E/ReactNativeJS( 4732): [AR error] store: refresh failed: asset HTTP 502
11-20 14:22:32.250 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:22:32.251 E/unknown:ReactNative( 4732): ?anon_0_@1:2015967
11-20 14:22:32.251 E/unknown:ReactNative( 4732): SyntheticError@1:162884
11-20 14:22:32.251 E/unknown:ReactNative( 4732): Wrapper@1:163399
11-20 14:22:32.251 E/unknown:ReactNative( 4732): _callSuper@1:148272
```

### 11 trends
```
11-20 14:23:32.491 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:23:32.897 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:23:34.060 E/ReactNativeJS( 4732): [AR error] store: refresh failed: asset HTTP 502
11-20 14:23:34.060 W/ReactNativeJS( 4732): [AR warn] degrade: fetch.httpError status=502 url=https://github.com/yanniedog/AR-local/releases/download/app-payload-latest/manifest.json?%E2%80%A6 ctx=manifest
11-20 14:23:34.064 E/unknown:ReactNative( 4732): ?anon_0_@1:2015967
11-20 14:23:34.064 E/unknown:ReactNative( 4732): SyntheticError@1:162884
11-20 14:23:34.064 E/unknown:ReactNative( 4732): Wrapper@1:163399
11-20 14:23:34.064 E/unknown:ReactNative( 4732): _callSuper@1:148272
```

### 12 search-open
```
11-20 14:24:27.646 W/ReactNativeJS( 4732): [AR warn] store: ensureHistoryBanks compact asset failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
11-20 14:24:28.001 W/ReactNativeJS( 4732): [AR warn] degrade: store.ensureFailed fn=ensureBankInsights error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
11-20 14:24:28.001 W/ReactNativeJS( 4732): [AR warn] store: ensureBankInsights failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
```
