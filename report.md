# App explorer: 1.0.399 (455)

**Real-use session FAIL vs 1.0.398: 1 broken, 22 friction, 5 slower**

- Broken: Nothing to read for 28.6 s on "open app"
- Friction: No reaction for 4.1 s after "scroll rates 1"
- Friction: No reaction for 3.4 s after "scroll rates 2"
- Friction: No reaction for 3.3 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll product fees"
- Friction: No reaction for 3.3 s after "scroll product eligibility"
- Friction: No reaction for 3.1 s after "scroll product sources"
- Friction: No reaction for 4.3 s after "switch to savings"
- Friction: No reaction for 3.5 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.0 s after "scroll rba"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 4.7 s after "open term deposits"
- Friction: No reaction for 3.1 s after "verify term deposit rates"
- Friction: No reaction for 3.4 s after "restore home loans"
- Friction: No reaction for 7.6 s after "search Macquarie"
- Friction: No reaction for 3.5 s after "return from savings search"
- Friction: No reaction for 4.1 s after "open unsaved rate"
- Friction: No reaction for 3.3 s after "open product from saved rates"
- Friction: No reaction for 11.4 s after "leave removed product"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: "No saved rates" shown on "follow browse rates recovery"
- Friction: No reaction for 7.5 s after "start compare from rates"
- Slower: "expand product facts" content 0.0 s to 2.3 s
- Slower: "scroll product fees" content 0.8 s to 3.1 s
- Slower: "scroll product eligibility" content 0.8 s to 3.3 s
- Slower: "start compare from rates" content 2.1 s to 7.5 s
- Slower: "start compare from rates" reaction 2.1 s to 7.5 s

**Initial Rates readiness:** 96.0 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 60 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 7
Baseline 1.0.398

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 55148 | -49302 | 1449/2211 | 81 | 529 | 1 errors; start 4759ms |
| 2 | scroll rates 1 | 6584 | -1 | 42/72 | 77 | 637 | boot js-start 72294, layout-mounted 72857, cache-read 73198, hydrated 73810, splash-hide 73810, manifest 76245, resolved 77013, core-fetched 92787, core-saved 96089, pricing-wait-suitability 97018, search-index-idle 97018, details-start 97709, details-fetched 114151, rows-prepared 129070, detail-filters-idle 129070, leading-requested 129070, last-pricing 129070, suitability-built 132519, post-refresh-wait 134640, leading-scoped 149701, leading-page 149701, refresh-done 161036, pricing-ready 167703, last-rows 167703, rates-ready 168269, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 349, pricing-scope-ms 36042, filter-runs 2, filter-rows 37735, filter-yields 16, filter-ms 355, sort-runs 1, sort-rows 2150, sort-yields 2, sort-ms 95 |
| 3 | scroll rates 2 | 736 | -3 | 24/35 | 77 | 659 |  |
| 4 | scroll rates back | 710 | -20 |  |  | 557 |  |
| 5 | open product | 22 | -99 | 39/51 | 93 | 637 |  |
| 6 | scroll product | 735 | -31 | 36/56 | 77 | 647 |  |
| 7 | expand visible fees | 22 | -4491 | 8/14 | 57 | 633 |  |
| 8 | expand product facts | 22 | +6 | 82/160 | 73 | 674 |  |
| 9 | scroll product fees | 791 | +10 | 30/59 | 69 | 667 |  |
| 10 | scroll product eligibility | 698 | -87 | 28/46 | 81 | 649 |  |
| 11 | expand eligibility | 0 | -16 | 207/304 | 81 | 629 |  |
| 12 | expand constraints | 24 | -30 | 9/15 | 69 | 637 |  |
| 13 | scroll product sources | 693 | -56 | 21/34 | 81 | 635 |  |
| 14 | back to rates | 28 | -17 | 12/21 | 73 | 630 |  |
| 15 | open lenders | 45 | 0 | 18/20 | 350 | 636 |  |
| 16 | scroll lenders | 701 | -210 | 22/23 | 150 | 635 |  |
| 17 | back from lenders | 23 | -17 | 8/9 | 150 | 635 |  |
| 18 | switch to savings | 23 | -21 | 49/84 | 73 | 645 |  |
| 19 | switch to home loans | 24 | -33 | 18/30 | 61 | 662 |  |
| 20 | open filters | 27 | -14 | 21/28 | 150 | 655 |  |
| 21 | close filters | 24 | -19 | 8/10 | 150 | 653 |  |
| 22 | open market | 23 | -19 | 15/32 | 48 | 657 |  |
| 23 | open rba | 2571 | -84 | 57/82 | 61 | 674 |  |
| 24 | scroll rba | 732 | -66 | 26/55 | 73 | 667 |  |
| 25 | back from rba | 32 | -8 | 11/21 | 65 | 666 |  |
| 26 | scroll market | 710 | -108 | 13/27 | 53 | 666 |  |
| 27 | open saved | 24 | -20 | 11/16 | 85 | 669 |  |
| 28 | return to rates | 22 | -25 | 16/31 | 73 | 671 |  |
| 29 | start category switch | 33 | -14446 |  |  | 670 |  |
| 30 | open term deposits | 23 | -49 | 55/84 | 77 | 691 |  |
| 31 | verify term deposit rates | 695 | -81 | 22/35 | 61 | 692 |  |
| 32 | restore home loans | 23 |  | 15/31 | 57 | 714 |  |
| 33 | start search from rates | 33 | -24 |  |  | 705 |  |
| 34 | open savings search | 31 | -34 | 16/31 | 57 | 722 |  |
| 35 | search Macquarie | 1947 |  | 74/86 | 133 | 744 | 1 errors |
| 36 | verify Macquarie result | 0 |  | 12/16 | 29 | 731 |  |
| 37 | clear query and restore results | 46 |  | 14/21 | 32 | 735 |  |
| 38 | return from savings search | 22 |  | 31/40 | 77 | 763 |  |
| 39 | start filter rollback | 43 | -64 | 13/16 | 36 | 755 |  |
| 40 | open mortgage filter draft | 47 | +7 | 21/24 | 200 | 764 |  |
| 41 | select fixed in draft | 22 |  | 11/12 | 117 | 765 |  |
| 42 | discard unsaved filter draft | 23 |  | 18/22 | 57 | 768 |  |
| 43 | verify fixed was not applied | 22 |  | 23/25 | 150 | 775 | 1 errors |
| 44 | close verified filter draft | 23 |  | 18/22 | 109 | 777 |  |
| 45 | start save from rates | 31 | -19 | 9/15 | 16 | 775 | 1 errors |
| 46 | open unsaved rate | 21 |  | 73/111 | 85 | 849 | 1 errors |
| 47 | save a rate | 24 |  | 9/16 | 61 | 799 | 1 errors |
| 48 | leave saved product | 21 |  | 16/25 | 77 | 745 |  |
| 49 | restart with a saved rate | 15153 |  | 308/449 | 81 | 421 | 3 errors; start 4951ms; boot js-start 644377, layout-mounted 644562, hydrated 644732, cache-read 646010, core-ready 646687, rows-prepared 646861, search-index-idle 646861, detail-filters-idle 646861, leading-requested 646861, last-pricing 646861, splash-hide 646863, manifest 648862, resolved 649466, leading-scoped 653132, leading-page 653132, pricing-ready 654455, last-rows 654455, rates-ready 654819, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 96, pricing-scope-ms 6357, filter-runs 2, filter-rows 37735, filter-yields 10, filter-ms 178, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 50 |
| 50 | verify saved rate after restart | 28 |  | 20/32 | 85 | 440 |  |
| 51 | open product from saved rates | 26 |  | 38/58 | 85 | 589 |  |
| 52 | remove saved rate | 29 |  | 11/16 | 77 | 610 |  |
| 53 | leave removed product | 8948 |  | 6/11 | 65 | 641 |  |
| 54 | follow browse rates recovery | 26 |  |  |  | 680 |  |
| 55 | start compare from rates | 4475 | +4425 | 18/29 | 53 | 701 |  |
| 56 | enter selection mode | 25 |  | 7/16 | 48 | 708 |  |
| 57 | select first comparison rate | 22 |  | 11/16 | 61 | 708 |  |
| 58 | select second comparison rate | 23 |  | 12/14 | 65 | 707 |  |
| 59 | open two-rate comparison | 23 |  | 18/28 | 150 | 719 |  |
| 60 | return from two-rate comparison | 31 |  | 20/29 | 89 | 718 |  |

## Errors

### 1 open app
```
11-28 15:44:42.054 E/australianrates( 4856): Not starting debugger since process cannot load the jdwp agent.
```

### 35 search Macquarie
```
11-28 15:52:25.263 E/FrameTracker( 4856): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 43 verify fixed was not applied
```
11-28 15:53:27.885 E/FrameTracker( 4856): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 45 start save from rates
```
11-28 15:53:44.699 E/FrameTracker( 4856): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 open unsaved rate
```
11-28 15:53:50.399 E/ImeBackDispatcher( 4856): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 69344715
```

### 47 save a rate
```
11-28 15:54:01.031 E/FrameTracker( 4856): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 49 restart with a saved rate
```
11-28 15:54:15.514 E/australianrates(12146): Not starting debugger since process cannot load the jdwp agent.
11-28 15:54:20.198 E/SurfaceSyncGroup(12146): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-28 15:54:20.198 E/SurfaceSyncGroup(12146): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```
