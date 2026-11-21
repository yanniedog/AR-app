# App explorer: 1.0.342 (398)

**Real-use session FAIL vs 1.0.342: 1 broken, 22 friction, 35 slower**

- Broken: Nothing to read for 39.8 s on "open app"
- Friction: No reaction for 3.7 s after "scroll rates 1"
- Friction: No reaction for 4.1 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "open product"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll lenders"
- Friction: No reaction for 5.1 s after "switch to savings"
- Friction: No reaction for 3.0 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: "Refresh failed" shown on "open rba"
- Friction: "Forecast unavailable" shown on "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 5.5 s after "open term deposits"
- Friction: No reaction for 3.9 s after "verify term deposit rates"
- Friction: No reaction for 9.2 s after "search Macquarie"
- Friction: No reaction for 3.5 s after "return from savings search"
- Friction: No reaction for 3.6 s after "open mortgage filter draft"
- Friction: No reaction for 3.7 s after "verify fixed was not applied"
- Friction: No reaction for 4.0 s after "open unsaved rate"
- Friction: No reaction for 3.3 s after "open product from saved rates"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: No reaction for 3.4 s after "open two-rate comparison"
- Slower: Dropped frames 46% to 74% on "open app"
- Slower: "open app" content 34.6 s to 93.3 s
- Slower: "open app" reaction 34.6 s to 53.5 s
- Slower: Dropped frames 52% to 74% on "scroll rates 1"
- Slower: Dropped frames 47% to 70% on "open product"
- Slower: Dropped frames 28% to 66% on "scroll product"
- Slower: Dropped frames 40% to 73% on "back to rates"
- Slower: Dropped frames 74% to 90% on "scroll lenders"
- Slower: Dropped frames 40% to 73% on "switch to savings"
- Slower: "switch to savings" content 3.0 s to 5.1 s
- Slower: "switch to savings" reaction 3.0 s to 5.1 s
- Slower: Dropped frames 32% to 59% on "switch to home loans"
- Slower: Dropped frames 33% to 77% on "open rba"
- Slower: Dropped frames 26% to 68% on "scroll rba"
- Slower: Dropped frames 33% to 74% on "scroll market"
- Slower: Dropped frames 39% to 57% on "open saved"
- Slower: Dropped frames 33% to 59% on "return to rates"
- Slower: Dropped frames 43% to 74% on "open term deposits"
- Slower: "open term deposits" content 3.6 s to 5.5 s
- Slower: "open term deposits" reaction 3.6 s to 5.5 s
- Slower: Dropped frames 35% to 67% on "verify term deposit rates"
- Slower: Dropped frames 33% to 57% on "restore home loans"
- Slower: "search Macquarie" content 5.0 s to 9.2 s
- Slower: "search Macquarie" reaction 5.0 s to 9.2 s
- Slower: Dropped frames 47% to 79% on "return from savings search"
- Slower: Dropped frames 71% to 90% on "discard unsaved filter draft"
- Slower: Dropped frames 49% to 77% on "open unsaved rate"
- Slower: Dropped frames 31% to 61% on "leave saved product"
- Slower: Dropped frames 52% to 74% on "restart with a saved rate"
- Slower: Dropped frames 36% to 66% on "verify saved rate after restart"
- Slower: Dropped frames 42% to 68% on "open product from saved rates"
- Slower: Dropped frames 34% to 56% on "follow browse rates recovery"
- Slower: "start compare from rates" content 0.0 s to 2.5 s
- Slower: Dropped frames 50% to 73% on "open two-rate comparison"
- Slower: Dropped frames 51% to 67% on "return from two-rate comparison"

**Initial Rates readiness:** 106.9 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked

Runner payload check: manifest HTTP 200, 3752 bytes, run_date 

Mode session | 53 steps | crashes 0 | step failures 0 | settle timeouts 0 | steps with JS/native errors 7
Baseline 1.0.342

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 53608 |  | 1722/2330 | 85 | 473 | 1 errors; start 3692ms |
| 2 | scroll rates 1 | 798 |  | 20/27 | 81 | 684 | boot js-start 79461, layout-mounted 79796, cache-read 79969, hydrated 80280, splash-hide 80280, manifest 81478, resolved 82286, core-fetched 94209, core-saved 95614, rows-prepared 96220, search-index-idle 96220, details-start 97286, pricing-ready 107463, last-gate 111394, details-fetched 121810, detail-filters-idle 150636, last-pricing 150636, suitability-built 154016, post-refresh-wait 155681, refresh-done 179426, last-rows 185916, rates-ready 186348 |
| 3 | scroll rates 2 | 757 |  | 33/51 | 81 | 577 |  |
| 4 | scroll rates back | 722 |  |  |  | 505 |  |
| 5 | open product | 6459 |  | 39/56 | 81 | 646 |  |
| 6 | scroll product | 712 |  | 35/53 | 81 | 655 |  |
| 7 | back to rates | 30 |  | 16/22 | 81 | 614 |  |
| 8 | open lenders | 26 |  | 21/23 | 250 | 620 |  |
| 9 | scroll lenders | 753 |  | 18/20 | 121 | 617 |  |
| 10 | back from lenders | 22 |  | 8/8 | 200 | 618 |  |
| 11 | switch to savings | 22 |  | 67/92 | 85 | 630 |  |
| 12 | switch to home loans | 23 |  | 17/29 | 65 | 644 |  |
| 13 | open filters | 23 |  | 23/26 | 133 | 650 |  |
| 14 | close filters | 22 |  | 8/9 | 200 | 640 |  |
| 15 | open market | 22 |  | 17/31 | 61 | 642 |  |
| 16 | open rba | 2470 |  | 43/56 | 65 | 643 |  |
| 17 | scroll rba | 703 |  | 25/37 | 69 | 641 |  |
| 18 | back from rba | 24 |  | 12/18 | 57 | 642 |  |
| 19 | scroll market | 719 |  | 26/35 | 89 | 641 |  |
| 20 | open saved | 23 |  | 13/23 | 89 | 646 |  |
| 21 | return to rates | 22 |  | 19/32 | 65 | 648 |  |
| 22 | start category switch | 36 |  |  |  | 647 |  |
| 23 | open term deposits | 28 |  | 78/105 | 85 | 670 |  |
| 24 | verify term deposit rates | 744 |  | 38/57 | 77 | 672 |  |
| 25 | restore home loans | 23 |  | 16/28 | 69 | 682 |  |
| 26 | start search from rates | 26 |  |  |  | 677 |  |
| 27 | open savings search | 25 |  | 12/26 | 73 | 688 |  |
| 28 | search Macquarie | 2015 |  | 91/104 | 150 | 690 | 1 errors |
| 29 | verify Macquarie result | 0 |  | 13/15 | 16 | 682 |  |
| 30 | clear query and restore results | 25 |  | 17/21 | 31 | 693 |  |
| 31 | return from savings search | 24 |  | 33/42 | 97 | 706 |  |
| 32 | start filter rollback | 37 |  | 13/16 | 16 | 696 |  |
| 33 | open mortgage filter draft | 24 |  | 23/28 | 150 | 706 |  |
| 34 | select fixed in draft | 24 |  | 13/15 | 117 | 706 |  |
| 35 | discard unsaved filter draft | 23 |  | 19/21 | 105 | 707 |  |
| 36 | verify fixed was not applied | 31 |  | 24/29 | 250 | 717 | 1 errors |
| 37 | close verified filter draft | 25 |  | 17/22 | 93 | 717 |  |
| 38 | start save from rates | 30 |  | 16/16 | 19 | 714 | 1 errors |
| 39 | open unsaved rate | 48 |  | 116/150 | 101 | 768 | 1 errors |
| 40 | save a rate | 24 |  | 9/16 | 65 | 749 | 1 errors |
| 41 | leave saved product | 32 |  | 14/23 | 77 | 753 |  |
| 42 | restart with a saved rate | 14555 |  | 203/274 | 97 | 500 | 3 errors; start 5395ms; boot js-start 554215, layout-mounted 554479, hydrated 554753, cache-read 556097, core-ready 556884, rows-prepared 557049, search-index-idle 557049, detail-filters-idle 557049, last-pricing 557049, splash-hide 557050, manifest 559282, resolved 561687, pricing-ready 564566, last-rows 564566, rates-ready 564847 |
| 43 | verify saved rate after restart | 31 |  | 25/38 | 81 | 428 |  |
| 44 | open product from saved rates | 29 |  | 44/65 | 77 | 448 |  |
| 45 | remove saved rate | 25 |  | 9/15 | 61 | 450 |  |
| 46 | leave removed product | 32 |  | 8/11 | 81 | 450 |  |
| 47 | follow browse rates recovery | 23 |  | 14/25 | 81 | 450 |  |
| 48 | start compare from rates | 28 |  | 2/2 | 32 | 459 |  |
| 49 | enter selection mode | 26 |  | 10/14 | 65 | 486 |  |
| 50 | select first comparison rate | 23 |  | 12/17 | 61 | 474 |  |
| 51 | select second comparison rate | 26 |  | 11/14 | 65 | 456 |  |
| 52 | open two-rate comparison | 25 |  | 22/30 | 150 | 464 |  |
| 53 | return from two-rate comparison | 22 |  | 18/27 | 97 | 466 |  |

## Errors

### 1 open app
```
11-21 11:03:06.149 E/australianrates( 4892): Not starting debugger since process cannot load the jdwp agent.
```

### 28 search Macquarie
```
11-21 11:09:07.039 E/FrameTracker( 4892): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 36 verify fixed was not applied
```
11-21 11:10:12.483 E/FrameTracker( 4892): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 38 start save from rates
```
11-21 11:10:30.179 E/FrameTracker( 4892): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 39 open unsaved rate
```
11-21 11:10:36.114 E/ImeBackDispatcher( 4892): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 132925487
```

### 40 save a rate
```
11-21 11:10:46.565 E/FrameTracker( 4892): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 42 restart with a saved rate
```
11-21 11:11:01.906 E/australianrates(10518): Not starting debugger since process cannot load the jdwp agent.
11-21 11:11:07.180 E/SurfaceSyncGroup(10518): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
11-21 11:11:07.180 E/SurfaceSyncGroup(10518): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
```
