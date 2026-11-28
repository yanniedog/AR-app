# App explorer: 1.0.400 (456)

**Real-use session FAIL vs 1.0.399: 4 broken, 0 friction, 5 slower**

- Broken: "leave removed product" failed: Back destination was not observed
- Broken: No way back on "leave removed product"
- Broken: "require PayID" failed: UI assertion failed: app hierarchy unavailable
- Broken: "clear audit requirements" failed: not found: {"contains":"Clear all saved requirements"}
- Slower: "expand visible fees" content 2.4 s to 7.5 s
- Slower: "leave removed product" content 10.9 s to 20.2 s
- Slower: Dropped frames 69% to 86% on "open savings features"
- Slower: "open savings features" content 0.0 s to 2.6 s
- Slower: Dropped frames 65% to 83% on "clear audit requirements"

**Initial Rates readiness:** 111.1 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 8 passed, 1 failed, 1 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked
- Saved Savings matches: 3 passed, 1 failed, 9 blocked
- Restore Savings profile: 1 passed, 1 failed, 1 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 66 steps | crashes 0 | step failures 3 | settle timeouts 1 | steps with JS/native errors 7
Baseline 1.0.399

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 53414 | -490 | 1774/2421 | 85 | 536 | 4 errors; start 3918ms |
| 2 | scroll rates 1 | 733 | -134 | 32/47 | 85 | 584 | boot js-start 85437, layout-mounted 85761, cache-read 85947, hydrated 86260, splash-hide 86260, manifest 87853, resolved 88428, core-fetched 96384, core-saved 97762, pricing-wait-suitability 98426, search-index-idle 98426, details-start 99842, details-fetched 122697, rows-prepared 143147, detail-filters-idle 143154, leading-requested 143154, last-pricing 143154, suitability-built 148250, post-refresh-wait 149771, leading-scoped 176350, leading-page 176350, refresh-done 184310, pricing-ready 196089, last-rows 196089, rates-ready 196531, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 447, pricing-scope-ms 49440, filter-runs 2, filter-rows 37735, filter-yields 13, filter-ms 306, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 30 |
| 3 | scroll rates 2 | 756 | -33 | 25/36 | 89 | 638 |  |
| 4 | scroll rates back | 691 | -10 |  |  | 505 |  |
| 5 | open product | 88 | +67 | 8/13 | 200 | 578 |  |
| 6 | scroll product | 705 | -42 | 57/94 | 93 | 628 |  |
| 7 | expand visible fees | 4542 | +4518 | 8/17 | 57 | 645 |  |
| 8 | expand product facts | 22 | 0 | 104/178 | 77 | 670 |  |
| 9 | scroll product fees | 729 | +33 | 33/55 | 81 | 657 |  |
| 10 | scroll product eligibility | 743 | +23 | 24/37 | 85 | 632 |  |
| 11 | expand eligibility | 0 | -1 | 204/289 | 81 | 630 |  |
| 12 | expand constraints | 21 | -2222 | 8/14 | 61 | 622 |  |
| 13 | scroll product sources | 734 | -29 | 21/32 | 81 | 630 |  |
| 14 | back to rates | 31 | +2 | 15/22 | 73 | 622 |  |
| 15 | open lenders | 27 | +5 | 18/24 | 200 | 622 |  |
| 16 | scroll lenders | 753 | -9 | 21/22 | 150 | 619 |  |
| 17 | back from lenders | 24 | +4 | 5/8 | 150 | 621 |  |
| 18 | switch to savings and see a priced account | 26 | +1 | 64/90 | 85 | 637 |  |
| 19 | switch to term deposits and see a priced offer | 23 | +4 | 72/104 | 81 | 644 |  |
| 20 | switch to home loans | 27 | +7 | 16/28 | 65 | 658 |  |
| 21 | open filters | 22 | 0 | 24/26 | 150 | 658 |  |
| 22 | close filters | 23 | +3 | 8/9 | 200 | 649 |  |
| 23 | open market | 24 | +2 | 19/28 | 65 | 652 |  |
| 24 | open rba | 2629 | +112 | 59/74 | 65 | 672 |  |
| 25 | scroll rba | 684 | -22 | 32/52 | 77 | 665 |  |
| 26 | back from rba | 27 | +6 | 11/18 | 65 | 665 |  |
| 27 | scroll market | 749 | +35 | 30/40 | 85 | 662 |  |
| 28 | open saved | 23 | 0 | 18/26 | 81 | 668 |  |
| 29 | return to rates | 23 | +2 | 29/46 | 77 | 674 |  |
| 30 | start category switch | 29 | +2 | 1/1 | 16 | 674 |  |
| 31 | open term deposits | 24 | +2 | 20/33 | 73 | 708 |  |
| 32 | verify term deposit rates | 727 | +41 | 36/51 | 89 | 716 |  |
| 33 | restore home loans | 24 | +4 | 14/25 | 69 | 726 |  |
| 34 | start search from rates | 26 | 0 | 1/1 | 16 | 726 |  |
| 35 | open savings search | 22 | +2 | 18/30 | 61 | 751 |  |
| 36 | search Macquarie | 1784 | +91 | 86/98 | 150 | 758 | 1 errors |
| 37 | verify Macquarie result | 1 | +1 | 15/16 | 36 | 747 |  |
| 38 | clear query and restore results | 25 | +4 | 15/20 | 34 | 762 |  |
| 39 | return from savings search | 22 | +3 | 32/40 | 89 | 731 |  |
| 40 | start filter rollback | 28 | +5 | 15/16 | 16 | 723 |  |
| 41 | open mortgage filter draft | 41 | +22 | 29/33 | 150 | 728 |  |
| 42 | select fixed in draft | 26 | +5 | 11/12 | 93 | 724 |  |
| 43 | discard unsaved filter draft | 22 | +3 | 20/23 | 113 | 729 |  |
| 44 | verify fixed was not applied | 20 | +2 | 22/26 | 250 | 732 | 1 errors |
| 45 | close verified filter draft | 21 | +3 | 17/22 | 85 | 730 |  |
| 46 | start save from rates | 30 | +6 | 14/17 | 16 | 729 | 1 errors |
| 47 | open unsaved rate | 21 | +3 | 102/141 | 89 | 763 | 1 errors |
| 48 | save a rate | 24 | +4 | 10/15 | 69 | 749 | 1 errors |
| 49 | leave saved product | 26 | -2 | 14/23 | 73 | 747 |  |
| 50 | restart with a saved rate | 22923 | +8121 | 502/662 | 85 | 610 | 1 errors; start 5978ms; boot js-start 691950, layout-mounted 692393, hydrated 692733, cache-read 694172, core-ready 694998, rows-prepared 695192, search-index-idle 695192, detail-filters-idle 695192, leading-requested 695192, last-pricing 695192, splash-hide 695194, manifest 698567, resolved 699436, leading-scoped 706635, leading-page 706635, pricing-ready 708057, last-rows 708057, rates-ready 708415, pricing-starts 2, pricing-cand-ms 5, pricing-resolve-ms 0, pricing-yields 155, pricing-scope-ms 8906, filter-runs 2, filter-rows 37735, filter-yields 10, filter-ms 221, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 30 |
| 51 | verify saved rate after restart | 30 | +3 | 19/29 | 101 | 425 |  |
| 52 | open product from saved rates | 26 | +8 | 36/55 | 101 | 551 |  |
| 53 | remove saved rate | 24 | -1 | 12/20 | 85 | 608 |  |
| 54 | leave removed product | 20152 | +11259 | 8/10 | 85 | 646 | no settle; Back destination was not observed |
| 55 | start compare from rates | 38 | -4387 | 14/22 | 65 | 632 |  |
| 56 | enter selection mode | 2806 | +2775 | 13/18 | 65 | 673 |  |
| 57 | select first comparison rate | 24 | +4 | 11/13 | 65 | 737 |  |
| 58 | select second comparison rate | 29 | +9 |  |  | 711 |  |
| 59 | open two-rate comparison | 22 | 0 | 33/46 | 101 | 720 |  |
| 60 | return from two-rate comparison | 23 | +4 | 18/27 | 105 | 721 |  |
| 61 | open savings profile | 24 | +2 | 16/28 | 117 | 718 |  |
| 62 | open savings features | 22 | +22 | 19/22 | 200 | 716 |  |
| 63 | require Card access | 24 |  | 10/13 | 85 | 722 |  |
| 64 | require PayID | 22 |  |  |  | 723 | UI assertion failed: app hierarchy unavailable |
| 65 | restore audit profile | 105 | -8087 | 13/16 | 73 | 745 |  |
| 66 | clear audit requirements | 0 | -1 | 48/58 | 113 | 761 | not found: {"contains":"Clear all saved requirements"} |

## Errors

### 1 open app
```
11-28 16:29:22.809 E/australianrates( 5029): Not starting debugger since process cannot load the jdwp agent.
11-28 16:29:38.396 E/unknown:SurfaceMountingManager( 5029): Stopping surface [1]
11-28 16:29:38.404 E/unknown:SurfaceMountingManager( 5029): Surface [1] was stopped on SurfaceMountingManager.
11-28 16:29:38.414 E/unknown:IntBufferBatchMountItem( 5029): Skipping batch of MountItems; was stopped [1].
```

### 36 search Macquarie
```
11-28 16:37:36.373 E/FrameTracker( 5029): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 44 verify fixed was not applied
```
11-28 16:38:41.482 E/FrameTracker( 5029): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 start save from rates
```
11-28 16:38:59.004 E/FrameTracker( 5029): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 47 open unsaved rate
```
11-28 16:39:05.028 E/ImeBackDispatcher( 5029): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 250363502
```

### 48 save a rate
```
11-28 16:39:15.550 E/FrameTracker( 5029): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 50 restart with a saved rate
```
11-28 16:39:30.250 E/australianrates(12261): Not starting debugger since process cannot load the jdwp agent.
```
