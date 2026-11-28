# App explorer: 1.0.399 (455)

**Real-use session FAIL vs 1.0.398: 6 broken, 22 friction, 4 slower**

- Broken: Spinner 49.6 s on "open app"
- Broken: Nothing to read for 64.3 s on "open app"
- Broken: "switch to savings and see a priced account" failed: UI assertion failed: app hierarchy unavailable
- Broken: "switch to term deposits and see a priced offer" failed: UI assertion failed: app hierarchy unavailable
- Broken: "open savings features" failed: not found: {"id":"profile:Savings:accountFeatures:open"}
- Broken: "clear audit requirements" failed: not found: {"contains":"Clear all saved requirements"}
- Friction: No reaction for 3.3 s after "scroll rates 1"
- Friction: No reaction for 3.5 s after "scroll rates 2"
- Friction: No reaction for 4.2 s after "scroll product"
- Friction: No reaction for 3.2 s after "scroll product fees"
- Friction: No reaction for 3.1 s after "scroll product eligibility"
- Friction: No reaction for 3.0 s after "scroll product sources"
- Friction: No reaction for 4.1 s after "switch to savings and see a priced account"
- Friction: No reaction for 5.2 s after "switch to term deposits and see a priced offer"
- Friction: No reaction for 3.3 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 3.6 s after "verify term deposit rates"
- Friction: No reaction for 3.3 s after "restore home loans"
- Friction: No reaction for 6.8 s after "search Macquarie"
- Friction: No reaction for 3.6 s after "return from savings search"
- Friction: No reaction for 3.5 s after "verify fixed was not applied"
- Friction: No reaction for 4.1 s after "open unsaved rate"
- Friction: No reaction for 3.2 s after "open product from saved rates"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: No reaction for 6.8 s after "follow browse rates recovery"
- Slower: "open app" content 49.0 s to 77.8 s
- Slower: "open product" content 0.0 s to 2.6 s
- Slower: "expand visible fees" content 0.0 s to 2.4 s
- Slower: "start compare from rates" content 0.0 s to 2.1 s

**Initial Rates readiness:** 81.7 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked
- Saved Savings matches: 1 passed, 1 failed, 11 blocked
- Restore Savings profile: 1 passed, 1 failed, 1 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 65 steps | crashes 0 | step failures 4 | settle timeouts 0 | steps with JS/native errors 7
Baseline 1.0.398

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 63285 | -36178 | 1388/2057 | 81 | 559 | 1 errors; start 4279ms |
| 2 | scroll rates 1 | 762 | -3244 | 25/36 | 73 | 621 | boot js-start 73470, layout-mounted 73879, cache-read 74099, hydrated 74634, splash-hide 74634, manifest 76047, resolved 76695, core-fetched 89279, core-saved 91494, pricing-wait-suitability 92175, search-index-idle 92175, details-start 92911, details-fetched 106290, rows-prepared 119868, detail-filters-idle 119868, leading-requested 119868, last-pricing 119868, suitability-built 123855, post-refresh-wait 125602, leading-scoped 144764, leading-page 144764, refresh-done 149291, pricing-ready 154847, last-rows 154847, rates-ready 155141, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 329, pricing-scope-ms 32121, filter-runs 2, filter-rows 37735, filter-yields 10, filter-ms 174, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 40 |
| 3 | scroll rates 2 | 781 | +23 | 31/54 | 77 | 590 |  |
| 4 | scroll rates back | 712 | -3 |  |  | 612 |  |
| 5 | open product | 26 | -9 | 36/51 | 85 | 661 |  |
| 6 | scroll product | 696 | -19 | 36/68 | 77 | 644 |  |
| 7 | expand visible fees | 31 | +31 | 8/14 | 69 | 641 |  |
| 8 | expand product facts | 23 | -2 | 100/179 | 77 | 650 |  |
| 9 | scroll product fees | 741 | +13 | 31/58 | 77 | 681 |  |
| 10 | scroll product eligibility | 706 | -23 | 18/33 | 85 | 647 |  |
| 11 | expand eligibility | 0 | -22 | 211/310 | 77 | 643 |  |
| 12 | expand constraints | 22 | -4 | 9/15 | 57 | 649 |  |
| 13 | scroll product sources | 728 | +3 | 21/34 | 77 | 649 |  |
| 14 | back to rates | 28 | -10 | 11/24 | 69 | 644 |  |
| 15 | open lenders | 27 | +3 | 21/24 | 200 | 650 |  |
| 16 | scroll lenders | 740 | +29 | 19/23 | 121 | 649 |  |
| 17 | back from lenders | 24 | -2 | 6/8 | 250 | 648 |  |
| 18 | switch to savings and see a priced account | 24 |  | 52/77 | 69 | 660 | UI assertion failed: app hierarchy unavailable |
| 19 | switch to term deposits and see a priced offer | 23 |  | 72/106 | 77 | 674 | UI assertion failed: app hierarchy unavailable |
| 20 | switch to home loans | 26 | +2 | 14/28 | 61 | 698 |  |
| 21 | open filters | 25 | -2 | 24/28 | 129 | 704 |  |
| 22 | close filters | 25 | +2 | 8/10 | 150 | 694 |  |
| 23 | open market | 26 | +3 | 17/34 | 65 | 702 |  |
| 24 | open rba | 2687 | -88 | 60/83 | 65 | 724 |  |
| 25 | scroll rba | 713 | -20 | 30/56 | 65 | 716 |  |
| 26 | back from rba | 26 | +2 | 9/20 | 53 | 718 |  |
| 27 | scroll market | 719 | +30 | 26/42 | 69 | 716 |  |
| 28 | open saved | 25 | +2 | 9/15 | 65 | 722 |  |
| 29 | return to rates | 24 | -1 | 15/30 | 73 | 726 |  |
| 30 | start category switch | 33 | +2 |  |  | 727 |  |
| 31 | open term deposits | 26 |  | 16/30 | 69 | 759 |  |
| 32 | verify term deposit rates | 701 |  | 32/54 | 77 | 757 |  |
| 33 | restore home loans | 26 |  | 16/31 | 53 | 718 |  |
| 34 | start search from rates | 35 | +4 |  |  | 711 |  |
| 35 | open savings search | 26 |  | 14/27 | 69 | 725 |  |
| 36 | search Macquarie | 1817 |  | 68/80 | 133 | 722 | 1 errors |
| 37 | verify Macquarie result | 0 |  | 13/15 | 16 | 715 |  |
| 38 | clear query and restore results | 26 |  | 12/20 | 28 | 727 |  |
| 39 | return from savings search | 23 |  | 30/43 | 89 | 736 |  |
| 40 | start filter rollback | 34 | 0 | 10/15 | 16 | 726 |  |
| 41 | open mortgage filter draft | 24 |  | 24/27 | 150 | 732 |  |
| 42 | select fixed in draft | 22 |  | 11/12 | 93 | 730 |  |
| 43 | discard unsaved filter draft | 25 |  | 17/22 | 89 | 733 |  |
| 44 | verify fixed was not applied | 24 |  | 24/29 | 250 | 738 | 1 errors |
| 45 | close verified filter draft | 23 |  | 15/22 | 81 | 736 |  |
| 46 | start save from rates | 28 | -1 | 14/16 | 18 | 736 | 1 errors |
| 47 | open unsaved rate | 25 |  | 63/101 | 85 | 784 | 1 errors |
| 48 | save a rate | 24 |  | 7/16 | 57 | 753 | 1 errors |
| 49 | leave saved product | 22 |  | 13/24 | 73 | 752 |  |
| 50 | restart with a saved rate | 15768 |  | 317/488 | 81 | 428 | 1 errors; start 6092ms; boot js-start 681617, layout-mounted 682153, hydrated 682450, cache-read 683561, core-ready 684161, rows-prepared 684306, search-index-idle 684306, detail-filters-idle 684306, leading-requested 684306, last-pricing 684306, splash-hide 684307, manifest 686019, resolved 686638, leading-scoped 691258, leading-page 691258, pricing-ready 692268, last-rows 692268, rates-ready 692475, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 104, pricing-scope-ms 5860, filter-runs 1, filter-rows 12767, filter-yields 5, filter-ms 136, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 19 |
| 51 | verify saved rate after restart | 26 |  | 28/45 | 69 | 523 |  |
| 52 | open product from saved rates | 27 |  | 41/62 | 81 | 655 |  |
| 53 | remove saved rate | 24 |  |  |  | 623 |  |
| 54 | leave removed product | 25 |  | 19/30 | 61 | 704 |  |
| 55 | follow browse rates recovery | 4448 |  | 13/26 | 73 | 693 |  |
| 56 | start compare from rates | 30 | -1 | 2/2 | 32 | 701 |  |
| 57 | enter selection mode | 30 |  | 7/14 | 61 | 716 |  |
| 58 | select first comparison rate | 23 |  | 10/15 | 53 | 710 |  |
| 59 | select second comparison rate | 28 |  | 8/13 | 53 | 710 |  |
| 60 | open two-rate comparison | 24 |  | 20/31 | 125 | 718 |  |
| 61 | return from two-rate comparison | 23 |  | 18/27 | 105 | 722 |  |
| 62 | open savings profile | 35 |  | 14/29 | 69 | 720 |  |
| 63 | open savings features | 0 |  | 204/304 | 77 | 719 | not found: {"id":"profile:Savings:accountFeatures:open"} |
| 64 | restore audit profile | 29 |  | 2/2 | 32 | 718 |  |
| 65 | clear audit requirements | 0 |  | 212/299 | 81 | 719 | not found: {"contains":"Clear all saved requirements"} |

## Errors

### 1 open app
```
11-28 15:37:40.878 E/australianrates( 4886): Not starting debugger since process cannot load the jdwp agent.
```

### 36 search Macquarie
```
11-28 15:45:58.398 E/FrameTracker( 4886): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 44 verify fixed was not applied
```
11-28 15:47:00.827 E/FrameTracker( 4886): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 start save from rates
```
11-28 15:47:18.149 E/FrameTracker( 4886): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 47 open unsaved rate
```
11-28 15:47:24.085 E/ImeBackDispatcher( 4886): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 159896659
```

### 48 save a rate
```
11-28 15:47:34.607 E/FrameTracker( 4886): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 50 restart with a saved rate
```
11-28 15:47:49.479 E/australianrates(12342): Not starting debugger since process cannot load the jdwp agent.
```
