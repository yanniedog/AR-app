# App explorer: 1.0.342 (398)

**Real-use session FAIL vs 1.0.342: 1 broken, 13 friction, 2 slower**

- Broken: No way back on "verify Macquarie result"
- Friction: No reaction for 3.5 s after "scroll rates 1"
- Friction: No reaction for 3.2 s after "scroll rates 2"
- Friction: No reaction for 3.4 s after "open product"
- Friction: No reaction for 3.0 s after "scroll lenders"
- Friction: "Refresh failed" shown on "open rba"
- Friction: "Refresh failed" shown on "scroll rba"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 3.6 s after "open term deposits"
- Friction: No reaction for 3.2 s after "verify term deposit rates"
- Friction: No reaction for 5.0 s after "search Macquarie"
- Friction: No reaction for 3.4 s after "open unsaved rate"
- Friction: No reaction for 6.4 s after "verify saved rate after restart"
- Friction: "No saved rates" shown on "leave removed product"
- Slower: "verify saved rate after restart" content 2.4 s to 6.4 s
- Slower: "verify saved rate after restart" reaction 2.4 s to 6.4 s

**Initial Rates readiness:** 39.4 s from JS start (at or above the 3 s target) · last blocker: rows

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
| 1 | open app | 2638 | -49545 | 507/1101 | 65 | 463 | 1 errors; start 2556ms |
| 2 | scroll rates 1 | 766 | -14 | 33/64 | 57 | 553 | boot js-start 57847, layout-mounted 58176, cache-read 58334, hydrated 58452, splash-hide 58601, manifest 59687, resolved 60278, core-fetched 65505, core-saved 67329, rows-prepared 67614, search-index-idle 67614, details-start 68492, pricing-ready 69607, last-gate 70274, details-fetched 77861, detail-filters-idle 85325, last-pricing 85325, suitability-built 86428, post-refresh-wait 87009, last-rows 97109, rates-ready 97294 |
| 3 | scroll rates 2 | 708 | +8 | 19/36 | 61 | 711 |  |
| 4 | scroll rates back | 690 | +10 |  |  | 562 |  |
| 5 | open product | 3585 | -1464 | 25/53 | 65 | 634 |  |
| 6 | scroll product | 706 | -57 | 19/68 | 61 | 634 |  |
| 7 | back to rates | 20 | -1 | 10/25 | 69 | 649 |  |
| 8 | open lenders | 16 | -2 | 22/28 | 150 | 655 |  |
| 9 | scroll lenders | 724 | -40 | 17/23 | 89 | 651 |  |
| 10 | back from lenders | 16 | -3 | 8/10 | 117 | 654 |  |
| 11 | switch to savings | 16 | -4 | 17/43 | 69 | 675 |  |
| 12 | switch to home loans | 17 | -3 | 11/34 | 36 | 702 |  |
| 13 | open filters | 17 | -2 | 23/26 | 150 | 714 |  |
| 14 | close filters | 16 | -3 | 6/10 | 125 | 708 |  |
| 15 | open market | 20 | 0 | 14/34 | 44 | 674 |  |
| 16 | open rba | 2367 | -160 | 26/79 | 48 | 674 |  |
| 17 | scroll rba | 691 | -14 | 8/31 | 34 | 668 |  |
| 18 | back from rba | 16 | -9 | 5/23 | 42 | 669 |  |
| 19 | scroll market | 699 | -17 | 18/54 | 57 | 669 |  |
| 20 | open saved | 15 | -3 | 9/23 | 73 | 675 |  |
| 21 | return to rates | 16 | -3 | 12/36 | 48 | 674 |  |
| 22 | start category switch | 22 | 0 |  |  | 673 |  |
| 23 | open term deposits | 16 | -4 | 28/65 | 65 | 687 |  |
| 24 | verify term deposit rates | 679 | -27 | 24/68 | 61 | 686 |  |
| 25 | restore home loans | 16 | -5 | 10/30 | 48 | 689 |  |
| 26 | start search from rates | 20 | -5 |  |  | 688 |  |
| 27 | open savings search | 18 | -2 | 12/34 | 53 | 703 |  |
| 28 | search Macquarie | 1253 | -378 | 59/64 | 109 | 701 |  |
| 29 | verify Macquarie result | 27 | +1 | 15/16 | 16 | 696 |  |
| 30 | clear query and restore results | 16 | -18 | 16/18 | 32 | 705 | 1 errors |
| 31 | return from savings search | 32 | +12 | 23/49 | 36 | 723 |  |
| 32 | start filter rollback | 19 | -14 | 10/15 | 16 | 718 |  |
| 33 | open mortgage filter draft | 17 | -3 | 24/31 | 117 | 721 |  |
| 34 | select fixed in draft | 17 | -3 | 9/14 | 81 | 720 |  |
| 35 | discard unsaved filter draft | 16 | -2 | 17/24 | 81 | 722 |  |
| 36 | verify fixed was not applied | 17 | -3 | 19/28 | 150 | 730 | 1 errors |
| 37 | close verified filter draft | 16 | -3 | 18/23 | 69 | 728 |  |
| 38 | start save from rates | 26 | -16 | 12/15 | 16 | 724 | 1 errors |
| 39 | open unsaved rate | 18 | -16 | 67/138 | 65 | 751 | 1 errors |
| 40 | save a rate | 32 | +12 | 6/18 | 44 | 745 | 1 errors |
| 41 | leave saved product | 27 | -1 | 8/26 | 53 | 747 |  |
| 42 | restart with a saved rate | 19295 | +5283 | 135/262 | 73 | 400 | 1 errors; start 4878ms; boot js-start 441539, layout-mounted 441953, hydrated 442700, cache-read 443279, core-ready 443743, rows-prepared 443846, search-index-idle 443846, detail-filters-idle 443846, last-pricing 443846, splash-hide 443847, manifest 445301, resolved 446963, pricing-ready 449630, last-rows 449630, rates-ready 449818 |
| 43 | verify saved rate after restart | 4406 | +4381 | 13/36 | 53 | 457 |  |
| 44 | open product from saved rates | 17 | -2 | 31/73 | 65 | 506 |  |
| 45 | remove saved rate | 18 | -2 | 7/16 | 38 | 506 |  |
| 46 | leave removed product | 24 | +4 | 6/11 | 61 | 496 |  |
| 47 | follow browse rates recovery | 24 | +5 | 11/32 | 53 | 501 |  |
| 48 | start compare from rates | 23 | -9 |  |  | 501 |  |
| 49 | enter selection mode | 17 | -3 | 5/16 | 44 | 514 |  |
| 50 | select first comparison rate | 19 | -4 | 5/16 | 48 | 515 |  |
| 51 | select second comparison rate | 18 | -1 | 6/15 | 48 | 520 |  |
| 52 | open two-rate comparison | 16 | -3 | 18/36 | 93 | 540 |  |
| 53 | return from two-rate comparison | 26 | +1 | 18/35 | 69 | 520 |  |

## Errors

### 1 open app
```
11-21 10:52:07.698 E/australianrates( 5157): Not starting debugger since process cannot load the jdwp agent.
```

### 30 clear query and restore results
```
11-21 10:56:58.333 E/FrameTracker( 5157): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 36 verify fixed was not applied
```
11-21 10:57:45.279 E/FrameTracker( 5157): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 38 start save from rates
```
11-21 10:58:01.293 E/FrameTracker( 5157): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 39 open unsaved rate
```
11-21 10:58:06.112 E/ImeBackDispatcher( 5157): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 199354873
```

### 40 save a rate
```
11-21 10:58:16.676 E/FrameTracker( 5157): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 42 restart with a saved rate
```
11-21 10:58:30.922 E/australianrates(10574): Not starting debugger since process cannot load the jdwp agent.
```
