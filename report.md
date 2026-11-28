# App explorer: 1.0.400 (456)

**Real-use session FAIL vs 1.0.399: 5 broken, 24 friction, 6 slower**

- Broken: Nothing to read for 31.9 s on "open app"
- Broken: "expand visible fees again" failed: no reaction to tap on "Show Fees"
- Broken: "leave removed product" failed: Back destination was not observed
- Broken: "require PayID" failed: UI assertion failed: app hierarchy unavailable
- Broken: "clear audit requirements" failed: not found: {"contains":"Clear all saved requirements"}
- Friction: No reaction for 3.8 s after "scroll rates 1"
- Friction: No reaction for 4.2 s after "scroll rates 2"
- Friction: No reaction for 4.1 s after "scroll product"
- Friction: "expand visible fees again" needed a second tap
- Friction: No reaction for 3.1 s after "scroll product fees"
- Friction: No reaction for 3.0 s after "scroll product eligibility"
- Friction: No reaction for 3.1 s after "scroll product sources"
- Friction: No reaction for 4.7 s after "switch to savings and see a priced account"
- Friction: No reaction for 5.3 s after "switch to term deposits and see a priced offer"
- Friction: No reaction for 3.6 s after "switch to home loans"
- Friction: No reaction for 3.3 s after "open filters"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.2 s after "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 3.1 s after "open term deposits"
- Friction: No reaction for 3.5 s after "verify term deposit rates"
- Friction: No reaction for 3.5 s after "restore home loans"
- Friction: No reaction for 8.5 s after "search Macquarie"
- Friction: No reaction for 3.9 s after "return from savings search"
- Friction: No reaction for 3.6 s after "open mortgage filter draft"
- Friction: No reaction for 3.8 s after "open unsaved rate"
- Friction: No reaction for 3.4 s after "open product from saved rates"
- Friction: No reaction for 20.0 s after "leave removed product"
- Slower: Dropped frames 54% to 86% on "scroll rates 1"
- Slower: Dropped frames 58% to 77% on "scroll product sources"
- Slower: "start compare from rates" content 0.0 s to 2.6 s
- Slower: "open savings features" content 0.0 s to 2.8 s
- Slower: "restore audit profile" content 0.0 s to 2.1 s
- Slower: Dropped frames 76% to 91% on "clear audit requirements"

**Initial Rates readiness:** 99.7 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 8 passed, 1 failed, 1 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked
- Saved Savings matches: 3 passed, 1 failed, 9 blocked
- Restore Savings profile: 1 passed, 1 failed, 1 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 67 steps | crashes 0 | step failures 4 | settle timeouts 1 | steps with JS/native errors 8
Baseline 1.0.399

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 53774 | +450 | 1538/2128 | 85 | 531 | 5 errors; start 4615ms |
| 2 | scroll rates 1 | 799 | -5014 | 18/21 | 89 | 453 | boot js-start 86382, layout-mounted 86766, cache-read 86899, hydrated 87121, splash-hide 87322, manifest 88844, resolved 89780, core-fetched 100077, core-saved 103085, pricing-wait-suitability 103991, search-index-idle 103991, details-start 105987, details-fetched 134143, rows-prepared 145225, detail-filters-idle 145225, leading-requested 145225, last-pricing 145225, suitability-built 148205, post-refresh-wait 151006, leading-scoped 166229, leading-page 166229, refresh-done 176721, pricing-ready 185784, last-rows 185784, rates-ready 186112, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 419, pricing-scope-ms 37895, filter-runs 2, filter-rows 37735, filter-yields 9, filter-ms 219, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 26 |
| 3 | scroll rates 2 | 735 | -4 | 50/67 | 77 | 617 |  |
| 4 | scroll rates back | 714 | +38 |  |  | 515 |  |
| 5 | open product | 36 | +10 |  |  | 601 |  |
| 6 | scroll product | 773 | +58 | 65/100 | 81 | 632 |  |
| 7 | expand visible fees | 24 | +2 | 9/16 | 61 | 648 |  |
| 8 | expand visible fees again | 29 |  | 8/15 | 69 | 627 | no reaction to tap on "Show Fees" |
| 9 | expand product facts | 21 | -1 | 41/68 | 77 | 664 |  |
| 10 | scroll product fees | 690 | -3 | 33/52 | 85 | 659 |  |
| 11 | scroll product eligibility | 703 | -88 | 24/45 | 77 | 650 |  |
| 12 | expand eligibility | 0 | 0 | 205/278 | 89 | 632 |  |
| 13 | expand constraints | 23 | +1 | 8/17 | 48 | 631 |  |
| 14 | scroll product sources | 753 | +62 | 24/31 | 85 | 636 |  |
| 15 | back to rates | 26 | -6 | 16/23 | 69 | 628 |  |
| 16 | open lenders | 24 | +1 | 20/23 | 200 | 632 |  |
| 17 | scroll lenders | 715 | -46 | 21/21 | 150 | 630 |  |
| 18 | back from lenders | 23 | +1 | 6/6 | 150 | 631 |  |
| 19 | switch to savings and see a priced account | 32 | +8 | 58/85 | 85 | 648 |  |
| 20 | switch to term deposits and see a priced offer | 25 | +1 | 74/106 | 81 | 669 |  |
| 21 | switch to home loans | 26 | +1 | 17/30 | 61 | 700 |  |
| 22 | open filters | 22 | -1 | 26/29 | 150 | 703 |  |
| 23 | close filters | 22 | -1 | 8/9 | 121 | 702 |  |
| 24 | open market | 24 | +2 | 20/31 | 73 | 709 |  |
| 25 | open rba | 2617 | +67 | 53/68 | 69 | 725 |  |
| 26 | scroll rba | 732 | +12 | 36/51 | 73 | 718 |  |
| 27 | back from rba | 27 | +5 | 11/20 | 73 | 719 |  |
| 28 | scroll market | 717 | +40 | 26/40 | 81 | 718 |  |
| 29 | open saved | 27 | +5 | 16/25 | 93 | 723 |  |
| 30 | return to rates | 23 | -10 | 19/30 | 77 | 728 |  |
| 31 | start category switch | 34 | +1 |  |  | 686 |  |
| 32 | open term deposits | 34 |  | 17/29 | 81 | 708 |  |
| 33 | verify term deposit rates | 709 |  | 33/52 | 77 | 708 |  |
| 34 | restore home loans | 25 |  | 16/30 | 65 | 703 |  |
| 35 | start search from rates | 29 | -2 |  |  | 697 |  |
| 36 | open savings search | 24 |  | 23/32 | 69 | 713 |  |
| 37 | search Macquarie | 1928 |  | 82/90 | 150 | 709 | 1 errors |
| 38 | verify Macquarie result | 0 |  | 14/15 | 18 | 702 |  |
| 39 | clear query and restore results | 23 |  | 15/20 | 34 | 713 |  |
| 40 | return from savings search | 23 |  | 35/43 | 89 | 723 |  |
| 41 | start filter rollback | 33 | 0 | 15/16 | 16 | 714 |  |
| 42 | open mortgage filter draft | 23 |  | 24/27 | 150 | 720 |  |
| 43 | select fixed in draft | 24 |  | 11/12 | 113 | 711 | 1 errors |
| 44 | discard unsaved filter draft | 25 |  | 20/22 | 150 | 713 |  |
| 45 | verify fixed was not applied | 23 |  | 23/26 | 200 | 716 | 1 errors |
| 46 | close verified filter draft | 22 |  | 20/23 | 73 | 718 |  |
| 47 | start save from rates | 27 | -2 | 14/16 | 31 | 716 | 1 errors |
| 48 | open unsaved rate | 23 |  | 92/129 | 89 | 744 | 1 errors |
| 49 | save a rate | 24 |  | 7/14 | 57 | 739 | 1 errors |
| 50 | leave saved product | 27 |  | 15/22 | 81 | 739 |  |
| 51 | restart with a saved rate | 20636 |  | 457/617 | 85 | 605 | 3 errors; start 6336ms; boot js-start 678489, layout-mounted 678757, hydrated 679000, cache-read 680335, core-ready 681165, rows-prepared 681350, search-index-idle 681350, detail-filters-idle 681350, leading-requested 681350, last-pricing 681350, splash-hide 681351, manifest 684501, resolved 685291, leading-scoped 691473, leading-page 691473, pricing-ready 692835, last-rows 692835, rates-ready 693239, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 136, pricing-scope-ms 7889, filter-runs 2, filter-rows 37735, filter-yields 11, filter-ms 307, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 27 |
| 52 | verify saved rate after restart | 23 |  | 15/26 | 113 | 419 |  |
| 53 | open product from saved rates | 28 |  | 39/61 | 85 | 533 |  |
| 54 | remove saved rate | 33 |  | 10/17 | 101 | 591 |  |
| 55 | leave removed product | 20151 |  | 7/11 | 81 | 639 | no settle; Back destination was not observed |
| 56 | start compare from rates | 34 | +6 | 14/22 | 65 | 629 |  |
| 57 | enter selection mode | 2770 |  | 10/16 | 61 | 662 |  |
| 58 | select first comparison rate | 29 |  | 9/15 | 57 | 734 |  |
| 59 | select second comparison rate | 23 |  |  |  | 707 |  |
| 60 | open two-rate comparison | 22 |  | 32/43 | 109 | 711 |  |
| 61 | return from two-rate comparison | 22 |  | 18/25 | 109 | 712 |  |
| 62 | open savings profile | 24 | -2 | 18/30 | 69 | 709 |  |
| 63 | open savings features | 21 | +21 | 19/22 | 300 | 708 |  |
| 64 | require Card access | 23 |  | 10/13 | 81 | 719 |  |
| 65 | require PayID | 29 |  |  |  | 727 | UI assertion failed: app hierarchy unavailable |
| 66 | restore audit profile | 28 | +3 | 14/16 | 69 | 742 |  |
| 67 | clear audit requirements | 0 | 0 | 51/56 | 109 | 748 | not found: {"contains":"Clear all saved requirements"} |

## Errors

### 1 open app
```
11-28 16:27:44.259 E/australianrates( 4938): Not starting debugger since process cannot load the jdwp agent.
11-28 16:27:45.894 E/unknown:ReactNative( 4938): Tried to remove non-existent frame callback
11-28 16:27:46.516 E/unknown:SurfaceMountingManager( 4938): Stopping surface [1]
11-28 16:27:46.518 E/unknown:IntBufferBatchMountItem( 4938): Skipping batch of MountItems; was stopped [1].
11-28 16:27:46.518 E/unknown:SurfaceMountingManager( 4938): Surface [1] was stopped on SurfaceMountingManager.
```

### 37 search Macquarie
```
11-28 16:35:42.784 E/FrameTracker( 4938): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 43 select fixed in draft
```
11-28 16:36:30.357 E/FrameTracker( 4938): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 45 verify fixed was not applied
```
11-28 16:36:47.945 E/FrameTracker( 4938): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 47 start save from rates
```
11-28 16:37:04.993 E/FrameTracker( 4938): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 48 open unsaved rate
```
11-28 16:37:10.815 E/ImeBackDispatcher( 4938): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 88922344
```

### 49 save a rate
```
11-28 16:37:21.419 E/FrameTracker( 4938): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 51 restart with a saved rate
```
11-28 16:37:36.884 E/australianrates(12162): Not starting debugger since process cannot load the jdwp agent.
11-28 16:37:42.918 E/SurfaceSyncGroup(12162): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(wmsSync-VRI[MainActivity]#0) as ready
11-28 16:37:42.921 E/SurfaceSyncGroup(12162): Failed to receive transaction ready in 1000ms. Marking SurfaceSyncGroup(VRI[MainActivity]#1) as ready
```
