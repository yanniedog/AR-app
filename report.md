# App explorer: 1.0.399 (455)

**Real-use session FAIL vs 1.0.399: 5 broken, 23 friction, 4 slower**

- Broken: Nothing to read for 28.0 s on "open app"
- Broken: "switch to savings and see a priced account" failed: UI assertion failed: app hierarchy unavailable
- Broken: "switch to term deposits and see a priced offer" failed: UI assertion failed: app hierarchy unavailable
- Broken: "open savings features" failed: not found: {"id":"profile:Savings:accountFeatures:open"}
- Broken: "clear audit requirements" failed: not found: {"contains":"Clear all saved requirements"}
- Friction: No reaction for 4.4 s after "scroll rates 1"
- Friction: No reaction for 3.4 s after "scroll rates 2"
- Friction: No reaction for 3.2 s after "scroll product"
- Friction: No reaction for 3.1 s after "scroll product fees"
- Friction: No reaction for 3.1 s after "scroll product eligibility"
- Friction: No reaction for 4.5 s after "expand constraints"
- Friction: No reaction for 3.1 s after "scroll product sources"
- Friction: No reaction for 4.0 s after "switch to savings and see a priced account"
- Friction: No reaction for 4.3 s after "switch to term deposits and see a priced offer"
- Friction: No reaction for 3.4 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: No reaction for 3.4 s after "verify term deposit rates"
- Friction: No reaction for 3.1 s after "restore home loans"
- Friction: No reaction for 7.2 s after "search Macquarie"
- Friction: No reaction for 3.4 s after "return from savings search"
- Friction: No reaction for 3.3 s after "open mortgage filter draft"
- Friction: No reaction for 3.1 s after "verify fixed was not applied"
- Friction: No reaction for 3.6 s after "open unsaved rate"
- Friction: No reaction for 10.9 s after "leave removed product"
- Friction: No reaction for 7.3 s after "start compare from rates"
- Friction: No reaction for 3.2 s after "restore audit profile"
- Slower: "expand constraints" content 2.5 s to 4.5 s
- Slower: "expand constraints" reaction 2.5 s to 4.5 s
- Slower: "open saved" content 0.0 s to 2.3 s
- Slower: "start compare from rates" content 0.0 s to 7.3 s

**Initial Rates readiness:** 87.1 s from JS start (at or above the 3 s target) · last blocker: rows

**Extended journeys**

- Product categories: 4 passed, 0 failed, 0 blocked
- Search and clear: 6 passed, 0 failed, 0 blocked
- Discard temporary filters: 6 passed, 0 failed, 0 blocked
- Saved rate lifecycle: 10 passed, 0 failed, 0 blocked
- Compare two rates: 6 passed, 0 failed, 0 blocked
- Saved Savings matches: 1 passed, 1 failed, 11 blocked
- Restore Savings profile: 1 passed, 1 failed, 1 blocked

Runner payload check: manifest HTTP 200, 3751 bytes, latest published run date 2026-11-29

Mode session | 65 steps | crashes 0 | step failures 4 | settle timeouts 0 | steps with JS/native errors 6
Baseline 1.0.399

| # | step | settle ms | Δ vs base | jank | p90 ms | mem MB | notes |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | open app | 53904 |  | 1450/2152 | 77 | 551 | 1 errors; start 3935ms |
| 2 | scroll rates 1 | 867 |  | 31/49 | 101 | 543 | boot js-start 81948, layout-mounted 82197, cache-read 82367, hydrated 82493, splash-hide 82654, manifest 84351, resolved 84908, core-fetched 93351, core-saved 95425, pricing-wait-suitability 96082, search-index-idle 96082, details-start 96587, details-fetched 113539, rows-prepared 133598, detail-filters-idle 133598, leading-requested 133598, last-pricing 133598, suitability-built 137965, post-refresh-wait 139083, leading-scoped 155955, leading-page 155955, refresh-done 163145, pricing-ready 168607, last-rows 168607, rates-ready 169019, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 348, pricing-scope-ms 32327, filter-runs 2, filter-rows 37735, filter-yields 13, filter-ms 248, sort-runs 1, sort-rows 2150, sort-yields 2, sort-ms 76 |
| 3 | scroll rates 2 | 789 |  | 20/34 | 73 | 649 |  |
| 4 | scroll rates back | 701 |  |  |  | 547 |  |
| 5 | open product | 21 |  | 36/58 | 85 | 638 |  |
| 6 | scroll product | 747 |  | 45/68 | 77 | 646 |  |
| 7 | expand visible fees | 24 |  | 8/14 | 65 | 631 |  |
| 8 | expand product facts | 22 |  | 99/185 | 77 | 641 |  |
| 9 | scroll product fees | 696 |  | 31/56 | 81 | 667 |  |
| 10 | scroll product eligibility | 720 |  | 20/34 | 61 | 642 |  |
| 11 | expand eligibility | 1 |  | 191/308 | 77 | 630 |  |
| 12 | expand constraints | 2243 |  | 9/18 | 65 | 634 |  |
| 13 | scroll product sources | 763 |  | 22/36 | 77 | 639 |  |
| 14 | back to rates | 29 |  | 14/24 | 77 | 632 |  |
| 15 | open lenders | 22 |  | 21/22 | 150 | 637 |  |
| 16 | scroll lenders | 762 |  | 21/23 | 121 | 633 |  |
| 17 | back from lenders | 20 |  | 5/8 | 150 | 634 |  |
| 18 | switch to savings and see a priced account | 25 |  | 41/71 | 81 | 644 | UI assertion failed: app hierarchy unavailable |
| 19 | switch to term deposits and see a priced offer | 19 |  | 50/78 | 85 | 654 | UI assertion failed: app hierarchy unavailable |
| 20 | switch to home loans | 20 |  | 16/32 | 57 | 669 |  |
| 21 | open filters | 22 |  | 23/26 | 133 | 668 |  |
| 22 | close filters | 20 |  | 9/10 | 133 | 662 |  |
| 23 | open market | 22 |  | 19/31 | 65 | 665 |  |
| 24 | open rba | 2517 |  | 75/101 | 53 | 682 |  |
| 25 | scroll rba | 706 |  | 32/58 | 65 | 674 |  |
| 26 | back from rba | 21 |  | 11/20 | 57 | 675 |  |
| 27 | scroll market | 714 |  | 27/41 | 69 | 674 |  |
| 28 | open saved | 23 |  | 8/16 | 65 | 677 |  |
| 29 | return to rates | 21 |  | 18/30 | 73 | 679 |  |
| 30 | start category switch | 27 |  |  |  | 679 |  |
| 31 | open term deposits | 22 |  | 18/31 | 48 | 705 |  |
| 32 | verify term deposit rates | 686 |  | 34/57 | 69 | 710 |  |
| 33 | restore home loans | 20 |  | 14/27 | 48 | 722 |  |
| 34 | start search from rates | 26 |  |  |  | 711 |  |
| 35 | open savings search | 20 |  | 18/33 | 61 | 727 |  |
| 36 | search Macquarie | 1693 |  | 79/90 | 129 | 738 | 1 errors |
| 37 | verify Macquarie result | 0 |  | 14/15 | 17 | 732 |  |
| 38 | clear query and restore results | 21 |  | 17/19 | 32 | 747 |  |
| 39 | return from savings search | 19 |  | 34/43 | 85 | 776 |  |
| 40 | start filter rollback | 23 |  | 14/15 | 16 | 768 |  |
| 41 | open mortgage filter draft | 19 |  | 23/28 | 200 | 779 |  |
| 42 | select fixed in draft | 21 |  | 7/9 | 200 | 778 |  |
| 43 | discard unsaved filter draft | 19 |  | 17/21 | 97 | 784 |  |
| 44 | verify fixed was not applied | 18 |  | 20/26 | 300 | 792 |  |
| 45 | close verified filter draft | 18 |  | 21/23 | 81 | 791 |  |
| 46 | start save from rates | 24 |  | 13/15 | 16 | 791 | 1 errors |
| 47 | open unsaved rate | 18 |  | 69/107 | 81 | 778 | 1 errors |
| 48 | save a rate | 20 |  | 8/16 | 65 | 745 | 1 errors |
| 49 | leave saved product | 28 |  | 14/23 | 69 | 744 |  |
| 50 | restart with a saved rate | 14802 |  | 285/456 | 77 | 412 | 1 errors; start 4940ms; boot js-start 688901, layout-mounted 689053, hydrated 689186, cache-read 690282, core-ready 690906, rows-prepared 691040, search-index-idle 691040, detail-filters-idle 691040, leading-requested 691040, last-pricing 691040, splash-hide 691042, manifest 693387, resolved 693888, leading-scoped 698049, leading-page 698049, pricing-ready 699097, last-rows 699097, rates-ready 699328, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 95, pricing-scope-ms 5620, filter-runs 2, filter-rows 37735, filter-yields 8, filter-ms 146, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 19 |
| 51 | verify saved rate after restart | 27 |  | 21/31 | 77 | 432 |  |
| 52 | open product from saved rates | 18 |  | 37/66 | 81 | 571 |  |
| 53 | remove saved rate | 25 |  | 9/17 | 53 | 609 |  |
| 54 | leave removed product | 8893 |  | 6/10 | 77 | 643 |  |
| 55 | follow browse rates recovery | 20 |  |  |  | 654 |  |
| 56 | start compare from rates | 4425 |  | 17/29 | 65 | 710 |  |
| 57 | enter selection mode | 31 |  | 10/17 | 57 | 715 |  |
| 58 | select first comparison rate | 20 |  | 9/15 | 61 | 709 |  |
| 59 | select second comparison rate | 20 |  | 9/15 | 57 | 708 |  |
| 60 | open two-rate comparison | 22 |  | 22/33 | 129 | 717 |  |
| 61 | return from two-rate comparison | 19 |  | 20/30 | 85 | 720 |  |
| 62 | open savings profile | 22 |  | 14/31 | 81 | 719 |  |
| 63 | open savings features | 0 |  | 210/303 | 77 | 717 | not found: {"id":"profile:Savings:accountFeatures:open"} |
| 64 | restore audit profile | 8192 |  | 10/17 | 32 | 726 |  |
| 65 | clear audit requirements | 1 |  | 209/321 | 73 | 723 | not found: {"contains":"Clear all saved requirements"} |

## Errors

### 1 open app
```
11-28 16:07:12.766 E/australianrates( 5115): Not starting debugger since process cannot load the jdwp agent.
```

### 36 search Macquarie
```
11-28 16:15:31.943 E/FrameTracker( 5115): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 start save from rates
```
11-28 16:16:50.590 E/FrameTracker( 5115): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 47 open unsaved rate
```
11-28 16:16:55.823 E/ImeBackDispatcher( 5115): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 147903882
```

### 48 save a rate
```
11-28 16:17:06.362 E/FrameTracker( 5115): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 50 restart with a saved rate
```
11-28 16:17:20.285 E/australianrates(13087): Not starting debugger since process cannot load the jdwp agent.
```
