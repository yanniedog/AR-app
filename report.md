# App explorer: 1.0.342 (398)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode crawl | 30 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 2
Baseline 1.0.342

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 15874 | -1991 | 42/55 | 300 | 406 | 1 errors; start 3037ms |
| 2 | /browse | 62 | -1 | 2/2 | 36 | 510 | boot js-start 77927, layout-mounted 78388, cache-read 78502, hydrated 78734, splash-hide 78734, manifest 79715, resolved 80502, core-fetched 82818, core-saved 83235, rows-prepared 83376, search-index-idle 83376, details-start 84038, pricing-ready 87664, last-gate 87756, details-fetched 88891, detail-filters-idle 91713, last-pricing 91713, suitability-built 91985, post-refresh-wait 92118, last-rows 109520, rates-ready 109820 |
| 3 | /watchlist | 69 | -30 | 4/4 | 48 | 613 |  |
| 4 | /market | 71 | -5756 | 5/5 | 65 | 484 |  |
| 5 | /tools | 109 | +72 | 28/39 | 129 | 495 |  |
| 6 | /trends | 43 | +4 | 27/39 | 105 | 508 |  |
| 7 | /search | 40 | -11 | 31/36 | 150 | 564 |  |
| 8 | /banks | 39 | -21 | 36/44 | 101 | 592 |  |
| 9 | /bank-rates | 25 | -63 | 19/25 | 81 | 599 |  |
| 10 | /categories | 31 | -3 | 35/46 | 93 | 657 |  |
| 11 | /catalogue | 52 | +17 | 30/39 | 113 | 680 |  |
| 12 | /compare | 31 | -6 | 10/13 | 150 | 665 |  |
| 13 | /matches | 41 | +6 | 32/46 | 93 | 679 |  |
| 14 | /calculator | 36 | +3 | 14/20 | 89 | 667 |  |
| 15 | /projections | 33 | -3 | 22/30 | 93 | 674 |  |
| 16 | /profile | 31 | -2 | 17/25 | 69 | 681 |  |
| 17 | /research | 34 | -1 | 18/25 | 81 | 644 |  |
| 18 | /rba | 26 | -13 | 17/25 | 69 | 656 |  |
| 19 | /rba-response | 37 | 0 | 19/30 | 81 | 648 |  |
| 20 | /settings | 40 | -1 | 14/22 | 150 | 653 |  |
| 21 | /about | 35 | +2 | 13/23 | 81 | 651 |  |
| 22 | /terms | 30 | -6 | 14/23 | 77 | 653 |  |
| 23 | /privacy | 31 | -6 |  |  | 652 |  |
| 24 | /third-party-notices | 27 | -5 | 14/22 | 77 | 656 |  |
| 25 | /node | 33 | -5 | 33/46 | 89 | 682 |  |
| 26 | /passthrough | 32 | -7 | 28/42 | 109 | 655 |  |
| 27 | /calculation-receipt | 97 | +45 | 14/23 | 69 | 652 |  |
| 28 | /rate-receipt | 33 | -2 | 9/10 | 81 | 649 |  |
| 29 | warm resume | 368 | +38 | 4/4 | 48 | 647 |  |
| 30 | cold relaunch | 9232 | -834 | 22/25 | 450 | 514 | 3 errors; start 3964ms; boot js-start 324640, layout-mounted 324833, hydrated 325004, cache-read 326238, core-ready 326505, rows-prepared 326647, search-index-idle 326647, detail-filters-idle 326647, last-pricing 326647, splash-hide 326648, manifest 328500, resolved 329242, pricing-ready 330028, last-rows 330028, rates-ready 330309 |

## Errors

### 1 cold start
```
11-21 11:09:49.407 E/australianrates( 4824): Not starting debugger since process cannot load the jdwp agent.
```

### 30 cold relaunch
```
11-21 11:13:56.829 E/australianrates( 9226): Not starting debugger since process cannot load the jdwp agent.
11-21 11:14:00.537 E/SurfaceSyncGroup( 9226): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-21 11:14:00.537 E/SurfaceSyncGroup( 9226): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```
