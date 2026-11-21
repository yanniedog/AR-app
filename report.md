# App explorer: 1.0.342 (398)

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode crawl | 30 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 2
Baseline 1.0.342

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | cold start | 15639 | -235 | 40/52 | 300 | 404 | 1 errors; start 3096ms |
| 2 | /browse | 81 | +19 |  |  | 484 |  |
| 3 | /watchlist | 81 | +12 | 3/3 | 81 | 701 |  |
| 4 | /market | 77 | +6 | 5/6 | 150 | 469 |  |
| 5 | /tools | 188 | +79 | 24/32 | 150 | 477 |  |
| 6 | /trends | 58 | +15 | 25/36 | 150 | 485 |  |
| 7 | /search | 30 | -10 | 35/45 | 105 | 543 |  |
| 8 | /banks | 28 | -11 | 31/42 | 101 | 570 |  |
| 9 | /bank-rates | 26 | +1 | 14/23 | 101 | 578 |  |
| 10 | /categories | 25 | -6 | 34/47 | 97 | 608 |  |
| 11 | /catalogue | 34 | -18 | 31/38 | 150 | 638 | boot js-start 76614, layout-mounted 77047, cache-read 77162, hydrated 77483, splash-hide 77483, manifest 78138, resolved 79137, core-fetched 81580, core-saved 81984, rows-prepared 82196, search-index-idle 82196, details-start 83102, pricing-ready 84373, last-gate 85414, details-fetched 87299, detail-filters-idle 90261, last-pricing 90261, suitability-built 90504, post-refresh-wait 90627, refresh-done 112012, details-saved 112867, last-intent 146026, rates-ready 179156 |
| 12 | /compare | 31 | 0 | 12/15 | 150 | 616 |  |
| 13 | /matches | 23 | -18 | 35/48 | 85 | 642 |  |
| 14 | /calculator | 35 | -1 | 15/22 | 73 | 629 |  |
| 15 | /projections | 29 | -4 | 28/41 | 85 | 637 |  |
| 16 | /profile | 31 | 0 | 17/24 | 77 | 643 |  |
| 17 | /research | 25 | -9 | 19/29 | 73 | 657 |  |
| 18 | /rba | 32 | +6 | 11/24 | 69 | 676 |  |
| 19 | /rba-response | 30 | -7 | 17/25 | 77 | 674 |  |
| 20 | /settings | 28 | -12 | 14/23 | 81 | 685 |  |
| 21 | /about | 30 | -5 | 13/23 | 69 | 690 |  |
| 22 | /terms | 23 | -7 | 16/22 | 85 | 692 |  |
| 23 | /privacy | 25 | -6 |  |  | 691 |  |
| 24 | /third-party-notices | 27 | 0 | 13/23 | 65 | 700 |  |
| 25 | /node | 25 | -8 | 36/44 | 93 | 684 |  |
| 26 | /passthrough | 33 | +1 | 36/48 | 89 | 638 |  |
| 27 | /calculation-receipt | 24 | -73 | 13/23 | 69 | 632 |  |
| 28 | /rate-receipt | 29 | -4 | 6/8 | 97 | 629 |  |
| 29 | warm resume | 1353 | +985 | 4/4 | 150 | 627 |  |
| 30 | cold relaunch | 9398 | +166 | 27/34 | 300 | 511 | 3 errors; start 3931ms; boot js-start 321967, layout-mounted 322166, hydrated 322253, cache-read 323595, core-ready 323872, rows-prepared 324018, search-index-idle 324018, detail-filters-idle 324018, last-pricing 324018, splash-hide 324019, manifest 325944, resolved 326706, pricing-ready 327443, last-rows 327443, rates-ready 327699 |

## Errors

### 1 cold start
```
11-21 11:16:56.944 E/australianrates( 4806): Not starting debugger since process cannot load the jdwp agent.
```

### 30 cold relaunch
```
11-21 11:21:03.289 E/australianrates( 9153): Not starting debugger since process cannot load the jdwp agent.
11-21 11:21:06.850 E/SurfaceSyncGroup( 9153): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-21 11:21:06.851 E/SurfaceSyncGroup( 9153): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```
