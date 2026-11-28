# App explorer: 1.0.399 (455)

**Real-use session FAIL vs 1.0.399: 5 broken, 22 friction, 1 slower**

- Broken: Nothing to read for 21.0 s on "open app"
- Broken: "switch to savings and see a priced account" failed: UI assertion failed: app hierarchy unavailable
- Broken: "switch to term deposits and see a priced offer" failed: UI assertion failed: app hierarchy unavailable
- Broken: "open savings features" failed: not found: {"id":"profile:Savings:accountFeatures:open"}
- Broken: "clear audit requirements" failed: not found: {"contains":"Clear all saved requirements"}
- Friction: No reaction for 3.2 s after "scroll rates 1"
- Friction: No reaction for 3.3 s after "scroll rates 2"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.0 s after "scroll product eligibility"
- Friction: No reaction for 3.0 s after "scroll product sources"
- Friction: No reaction for 3.8 s after "switch to savings and see a priced account"
- Friction: No reaction for 4.6 s after "switch to term deposits and see a priced offer"
- Friction: No reaction for 3.3 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "scroll rba"
- Friction: No reaction for 3.1 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 3.2 s after "verify term deposit rates"
- Friction: No reaction for 3.1 s after "restore home loans"
- Friction: No reaction for 5.8 s after "search Macquarie"
- Friction: No reaction for 3.5 s after "return from savings search"
- Friction: No reaction for 3.2 s after "verify fixed was not applied"
- Friction: No reaction for 3.7 s after "open unsaved rate"
- Friction: No reaction for 3.4 s after "remove saved rate"
- Friction: No reaction for 10.9 s after "leave removed product"
- Friction: "No saved rates" shown on "leave removed product"
- Friction: "No saved rates" shown on "follow browse rates recovery"
- Friction: No reaction for 7.5 s after "start compare from rates"
- Slower: "start compare from rates" content 0.0 s to 7.5 s

**Initial Rates readiness:** 78.4 s from JS start (at or above the 3 s target) · last blocker: rows

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
| 1 | open app | 53446 |  | 1337/2003 | 77 | 516 | 3 errors; start 4114ms |
| 2 | scroll rates 1 | 773 |  | 18/27 | 69 | 491 | boot js-start 71848, layout-mounted 72262, cache-read 72494, hydrated 72910, splash-hide 72910, manifest 74738, resolved 75426, core-fetched 83698, core-saved 86954, pricing-wait-suitability 87855, search-index-idle 87855, details-start 88676, details-fetched 113006, rows-prepared 125706, detail-filters-idle 125706, leading-requested 125706, last-pricing 125706, suitability-built 128192, post-refresh-wait 128523, leading-scoped 140731, leading-page 140731, pricing-ready 149518, last-rows 149518, refresh-done 150235, rates-ready 150268, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 289, pricing-scope-ms 21499, filter-runs 2, filter-rows 37735, filter-yields 9, filter-ms 194, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 377 |
| 3 | scroll rates 2 | 677 |  | 34/53 | 69 | 700 |  |
| 4 | scroll rates back | 682 |  |  |  | 567 |  |
| 5 | open product | 24 |  | 34/56 | 89 | 641 |  |
| 6 | scroll product | 699 |  | 36/68 | 65 | 653 |  |
| 7 | expand visible fees | 20 |  | 7/12 | 69 | 628 |  |
| 8 | expand product facts | 19 |  | 95/194 | 73 | 642 |  |
| 9 | scroll product fees | 731 |  | 13/29 | 69 | 640 |  |
| 10 | scroll product eligibility | 746 |  | 23/40 | 73 | 641 |  |
| 11 | expand eligibility | 0 |  | 188/312 | 77 | 629 |  |
| 12 | expand constraints | 17 |  | 7/15 | 61 | 635 |  |
| 13 | scroll product sources | 749 |  | 23/35 | 77 | 635 |  |
| 14 | back to rates | 25 |  | 15/23 | 81 | 629 |  |
| 15 | open lenders | 24 |  | 21/25 | 200 | 635 |  |
| 16 | scroll lenders | 745 |  | 22/23 | 133 | 633 |  |
| 17 | back from lenders | 19 |  | 7/9 | 150 | 634 |  |
| 18 | switch to savings and see a priced account | 19 |  | 40/60 | 73 | 645 | UI assertion failed: app hierarchy unavailable |
| 19 | switch to term deposits and see a priced offer | 23 |  | 54/91 | 77 | 657 | UI assertion failed: app hierarchy unavailable |
| 20 | switch to home loans | 27 |  | 16/29 | 53 | 689 |  |
| 21 | open filters | 19 |  | 22/25 | 150 | 691 |  |
| 22 | close filters | 19 |  | 6/10 | 150 | 684 |  |
| 23 | open market | 20 |  | 15/30 | 57 | 690 |  |
| 24 | open rba | 2585 |  | 70/88 | 65 | 711 |  |
| 25 | scroll rba | 714 |  | 29/58 | 69 | 705 |  |
| 26 | back from rba | 24 |  | 10/20 | 65 | 706 |  |
| 27 | scroll market | 714 |  | 26/42 | 73 | 705 |  |
| 28 | open saved | 21 |  | 13/24 | 69 | 709 |  |
| 29 | return to rates | 19 |  | 17/30 | 69 | 714 |  |
| 30 | start category switch | 26 |  |  |  | 715 |  |
| 31 | open term deposits | 19 |  | 18/32 | 57 | 741 |  |
| 32 | verify term deposit rates | 705 |  | 28/52 | 65 | 740 |  |
| 33 | restore home loans | 20 |  | 13/28 | 65 | 765 |  |
| 34 | start search from rates | 28 |  |  |  | 761 |  |
| 35 | open savings search | 22 |  | 16/28 | 57 | 784 |  |
| 36 | search Macquarie | 1743 |  | 61/68 | 150 | 794 |  |
| 37 | verify Macquarie result | 0 |  | 14/15 | 16 | 787 |  |
| 38 | clear query and restore results | 20 |  | 17/19 | 29 | 803 |  |
| 39 | return from savings search | 19 |  | 31/39 | 81 | 753 |  |
| 40 | start filter rollback | 30 |  | 13/15 | 32 | 744 |  |
| 41 | open mortgage filter draft | 18 |  | 22/22 | 200 | 750 |  |
| 42 | select fixed in draft | 19 |  | 10/14 | 150 | 748 |  |
| 43 | discard unsaved filter draft | 19 |  | 19/23 | 129 | 750 |  |
| 44 | verify fixed was not applied | 19 |  | 27/30 | 150 | 753 | 1 errors |
| 45 | close verified filter draft | 19 |  | 19/23 | 89 | 752 |  |
| 46 | start save from rates | 29 |  | 12/15 | 17 | 750 | 1 errors |
| 47 | open unsaved rate | 50 |  | 80/121 | 65 | 770 | 1 errors |
| 48 | save a rate | 18 |  | 7/16 | 61 | 772 | 1 errors |
| 49 | leave saved product | 18 |  | 13/25 | 65 | 771 |  |
| 50 | restart with a saved rate | 15838 |  | 319/483 | 77 | 612 | 1 errors; start 5529ms; boot js-start 658984, layout-mounted 659522, hydrated 660264, cache-read 661047, core-ready 661673, rows-prepared 661812, search-index-idle 661812, detail-filters-idle 661812, leading-requested 661812, last-pricing 661812, splash-hide 661814, manifest 664440, resolved 665075, leading-scoped 669057, leading-page 669057, pricing-ready 670101, last-rows 670101, rates-ready 670363, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 95, pricing-scope-ms 5294, filter-runs 2, filter-rows 37735, filter-yields 8, filter-ms 166, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 20 |
| 51 | verify saved rate after restart | 25 |  | 18/26 | 65 | 425 |  |
| 52 | open product from saved rates | 23 |  | 41/66 | 69 | 580 |  |
| 53 | remove saved rate | 25 |  | 10/17 | 61 | 616 |  |
| 54 | leave removed product | 8866 |  | 6/11 | 61 | 634 |  |
| 55 | follow browse rates recovery | 24 |  |  |  | 685 |  |
| 56 | start compare from rates | 4447 |  | 17/26 | 61 | 708 |  |
| 57 | enter selection mode | 24 |  | 7/14 | 61 | 709 |  |
| 58 | select first comparison rate | 19 |  | 9/18 | 48 | 715 |  |
| 59 | select second comparison rate | 20 |  | 8/13 | 73 | 713 |  |
| 60 | open two-rate comparison | 18 |  | 20/32 | 85 | 722 |  |
| 61 | return from two-rate comparison | 18 |  | 21/31 | 77 | 725 |  |
| 62 | open savings profile | 23 |  | 15/31 | 69 | 724 |  |
| 63 | open savings features | 0 |  | 197/313 | 77 | 722 | not found: {"id":"profile:Savings:accountFeatures:open"} |
| 64 | restore audit profile | 27 |  | 0/1 | 7 | 722 |  |
| 65 | clear audit requirements | 0 |  | 200/311 | 77 | 723 | not found: {"contains":"Clear all saved requirements"} |

## Fatal lines
```
1 W/ReactNativeJS( 4912): [AR warn] degrade: store.ensureFailed fn=ensureDetails error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
1 W/ReactNativeJS( 4912): [AR warn] store: ensureDetails failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
```

## Errors

### 1 open app
```
11-28 15:59:45.960 E/australianrates( 4912): Not starting debugger since process cannot load the jdwp agent.
11-28 16:00:14.043 W/ReactNativeJS( 4912): [AR warn] degrade: store.ensureFailed fn=ensureDetails error="Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget"
11-28 16:00:14.043 W/ReactNativeJS( 4912): [AR warn] store: ensureDetails failed: Call to function 'ArHistoryCodec.inflatePayloadAsync' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: History exceeds safe native heap budget
```

### 44 verify fixed was not applied
```
11-28 16:08:46.915 E/FrameTracker( 4912): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 start save from rates
```
11-28 16:09:03.749 E/FrameTracker( 4912): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 47 open unsaved rate
```
11-28 16:09:09.207 E/ImeBackDispatcher( 4912): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 163363238
```

### 48 save a rate
```
11-28 16:09:19.739 E/FrameTracker( 4912): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 50 restart with a saved rate
```
11-28 16:09:33.837 E/australianrates(12304): Not starting debugger since process cannot load the jdwp agent.
```
