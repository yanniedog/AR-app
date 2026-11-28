# App explorer: 1.0.400 (456)

**Real-use session FAIL vs 1.0.399: 4 broken, 22 friction, 26 slower**

- Broken: Nothing to read for 53.0 s on "open app"
- Broken: "leave removed product" failed: Back destination was not observed
- Broken: "require PayID" failed: UI assertion failed: app hierarchy unavailable
- Broken: "clear audit requirements" failed: not found: {"contains":"Clear all saved requirements"}
- Friction: No reaction for 3.7 s after "scroll rates 1"
- Friction: No reaction for 3.3 s after "scroll rates 2"
- Friction: No reaction for 4.6 s after "open product"
- Friction: No reaction for 3.1 s after "scroll product"
- Friction: No reaction for 3.0 s after "scroll product fees"
- Friction: No reaction for 3.2 s after "scroll product eligibility"
- Friction: No reaction for 3.2 s after "scroll product sources"
- Friction: No reaction for 5.2 s after "switch to savings and see a priced account"
- Friction: No reaction for 5.5 s after "switch to term deposits and see a priced offer"
- Friction: No reaction for 3.6 s after "switch to home loans"
- Friction: No reaction for 3.1 s after "open market"
- Friction: No reaction for 3.0 s after "scroll rba"
- Friction: No reaction for 3.2 s after "scroll market"
- Friction: "No saved rates" shown on "open saved"
- Friction: No reaction for 3.8 s after "verify term deposit rates"
- Friction: No reaction for 3.3 s after "restore home loans"
- Friction: No reaction for 7.9 s after "search Macquarie"
- Friction: No reaction for 3.5 s after "open mortgage filter draft"
- Friction: No reaction for 3.0 s after "verify fixed was not applied"
- Friction: No reaction for 4.4 s after "open unsaved rate"
- Friction: No reaction for 3.3 s after "open product from saved rates"
- Friction: No reaction for 20.0 s after "leave removed product"
- Slower: "open app" content 4.4 s to 106.0 s
- Slower: "scroll rates 1" content 0.7 s to 3.7 s
- Slower: "scroll rates 2" content 0.7 s to 3.3 s
- Slower: "open product" content 0.0 s to 4.6 s
- Slower: "scroll product" content 0.7 s to 3.1 s
- Slower: "expand visible fees" content 0.0 s to 2.4 s
- Slower: "expand product facts" content 0.0 s to 2.4 s
- Slower: "scroll product fees" content 0.7 s to 3.0 s
- Slower: "scroll product eligibility" content 0.8 s to 3.2 s
- Slower: Dropped frames 56% to 74% on "expand eligibility"
- Slower: "expand constraints" content 0.0 s to 2.4 s
- Slower: Dropped frames 56% to 76% on "scroll product sources"
- Slower: "scroll product sources" content 0.7 s to 3.2 s
- Slower: "open lenders" content 0.0 s to 2.7 s
- Slower: "back from lenders" content 0.0 s to 2.5 s
- Slower: "switch to home loans" content 0.0 s to 3.6 s
- Slower: "open filters" content 0.0 s to 2.8 s
- Slower: "open market" content 0.0 s to 3.1 s
- Slower: "open rba" content 0.0 s to 2.6 s
- Slower: "scroll rba" content 0.9 s to 3.0 s
- Slower: "scroll market" content 0.8 s to 3.2 s
- Slower: "return to rates" content 0.0 s to 2.7 s
- Slower: "search Macquarie" content 4.8 s to 7.9 s
- Slower: "search Macquarie" reaction 4.8 s to 7.9 s
- Slower: "open unsaved rate" content 2.7 s to 4.4 s
- Slower: "open unsaved rate" reaction 2.7 s to 4.4 s

**Initial Rates readiness:** 116.2 s from JS start (at or above the 3 s target) · last blocker: rows

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
| 1 | open app | 103231 | +98852 | 1946/2666 | 85 | 543 | 1 errors; start 3914ms |
| 2 | scroll rates 1 | 3812 | +3065 | 33/47 | 73 | 617 | boot js-start 81463, layout-mounted 82405, cache-read 82547, hydrated 83132, splash-hide 83132, manifest 84839, resolved 85776, core-fetched 96118, core-saved 97472, pricing-wait-suitability 97993, search-index-idle 97993, details-start 98418, details-fetched 121680, rows-prepared 144175, detail-filters-idle 144175, leading-requested 144175, last-pricing 144175, suitability-built 147352, post-refresh-wait 148004, leading-scoped 181681, leading-page 181693, refresh-done 188480, pricing-ready 197280, last-rows 197280, rates-ready 197679, pricing-starts 1, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 406, pricing-scope-ms 51015, filter-runs 2, filter-rows 37735, filter-yields 12, filter-ms 241, sort-runs 1, sort-rows 2150, sort-yields 1, sort-ms 46 |
| 3 | scroll rates 2 | 704 | +7 | 20/31 | 89 | 487 |  |
| 4 | scroll rates back | 690 | -13 |  |  | 595 |  |
| 5 | open product | 2352 | +2352 | 37/57 | 81 | 650 |  |
| 6 | scroll product | 704 | +3 | 42/68 | 85 | 641 |  |
| 7 | expand visible fees | 26 | +26 | 8/15 | 73 | 635 |  |
| 8 | expand product facts | 22 | +22 | 99/180 | 81 | 677 |  |
| 9 | scroll product fees | 707 | -25 | 16/25 | 69 | 644 |  |
| 10 | scroll product eligibility | 699 | -59 | 27/42 | 81 | 653 |  |
| 11 | expand eligibility | 0 | 0 | 216/291 | 85 | 647 |  |
| 12 | expand constraints | 22 | +22 | 8/14 | 65 | 639 |  |
| 13 | scroll product sources | 743 | +56 | 25/33 | 89 | 645 |  |
| 14 | back to rates | 23 | -20129 | 15/22 | 81 | 639 |  |
| 15 | open lenders | 22 | +22 | 19/23 | 200 | 644 |  |
| 16 | scroll lenders | 768 | +55 | 21/23 | 150 | 642 |  |
| 17 | back from lenders | 22 | 0 | 7/8 | 150 | 642 |  |
| 18 | switch to savings and see a priced account | 26 |  | 78/103 | 81 | 656 |  |
| 19 | switch to term deposits and see a priced offer | 23 |  | 81/111 | 85 | 667 |  |
| 20 | switch to home loans | 24 | +24 | 14/30 | 57 | 697 |  |
| 21 | open filters | 23 | +23 | 24/27 | 150 | 703 |  |
| 22 | close filters | 24 | -20127 | 7/9 | 101 | 699 |  |
| 23 | open market | 23 | +23 | 17/30 | 77 | 705 |  |
| 24 | open rba | 2719 | +2718 | 103/127 | 65 | 726 |  |
| 25 | scroll rba | 704 | -192 | 13/23 | 73 | 719 |  |
| 26 | back from rba | 23 | -20128 | 10/20 | 77 | 721 |  |
| 27 | scroll market | 694 | -118 | 25/40 | 81 | 719 |  |
| 28 | open saved | 22 | +22 | 8/16 | 65 | 724 |  |
| 29 | return to rates | 23 | +23 | 21/34 | 77 | 730 |  |
| 30 | start category switch | 28 | -23065 |  |  | 731 |  |
| 31 | open term deposits | 23 |  | 18/28 | 73 | 762 |  |
| 32 | verify term deposit rates | 705 |  | 30/48 | 77 | 760 |  |
| 33 | restore home loans | 24 |  | 16/27 | 65 | 756 |  |
| 34 | start search from rates | 27 | -4602 |  |  | 719 |  |
| 35 | open savings search | 22 | -1 | 16/30 | 57 | 732 |  |
| 36 | search Macquarie | 2077 | -411 | 85/96 | 150 | 733 | 1 errors |
| 37 | verify Macquarie result | 0 | -1 | 13/16 | 18 | 723 |  |
| 38 | clear query and restore results | 48 | +27 | 17/20 | 32 | 733 |  |
| 39 | return from savings search | 2789 | -1732 | 37/42 | 89 | 740 |  |
| 40 | start filter rollback | 28 | -3 | 12/16 | 17 | 733 |  |
| 41 | open mortgage filter draft | 32 | -2 | 22/25 | 250 | 740 |  |
| 42 | select fixed in draft | 22 | -1 | 13/15 | 105 | 738 |  |
| 43 | discard unsaved filter draft | 22 | 0 | 16/23 | 150 | 743 |  |
| 44 | verify fixed was not applied | 21 | 0 | 25/28 | 133 | 747 | 1 errors |
| 45 | close verified filter draft | 22 | +2 | 17/22 | 97 | 746 |  |
| 46 | start save from rates | 32 | 0 | 16/16 | 20 | 744 | 1 errors |
| 47 | open unsaved rate | 25 | -16 | 103/142 | 81 | 764 | 1 errors |
| 48 | save a rate | 22 | -2 | 9/16 | 65 | 762 | 1 errors |
| 49 | leave saved product | 25 | -6620 | 13/23 | 77 | 760 |  |
| 50 | restart with a saved rate | 20016 | +1139 | 445/608 | 85 | 611 | 1 errors; start 5054ms; boot js-start 698221, layout-mounted 698451, hydrated 698704, cache-read 699968, core-ready 700890, rows-prepared 701058, search-index-idle 701058, detail-filters-idle 701058, leading-requested 701058, last-pricing 701058, splash-hide 701059, manifest 704745, resolved 705312, leading-scoped 711732, leading-page 711732, pricing-ready 713013, last-rows 713013, rates-ready 713369, pricing-starts 2, pricing-cand-ms 0, pricing-resolve-ms 0, pricing-yields 132, pricing-scope-ms 7935, filter-runs 2, filter-rows 37735, filter-yields 10, filter-ms 184, sort-runs 1, sort-rows 2150, sort-yields 2, sort-ms 80 |
| 51 | verify saved rate after restart | 23 | -32 | 20/29 | 101 | 432 |  |
| 52 | open product from saved rates | 30 | -1 | 38/59 | 101 | 534 |  |
| 53 | remove saved rate | 23 | 0 | 14/21 | 73 | 589 |  |
| 54 | leave removed product | 20150 | +143 | 6/10 | 93 | 656 | no settle; Back destination was not observed |
| 55 | start compare from rates | 30 | +3 | 12/21 | 85 | 643 |  |
| 56 | enter selection mode | 2487 | -219 | 11/15 | 57 | 660 |  |
| 57 | select first comparison rate | 28 | -11 | 10/17 | 61 | 731 |  |
| 58 | select second comparison rate | 29 | -5 |  |  | 712 |  |
| 59 | open two-rate comparison | 24 |  | 26/43 | 101 | 724 |  |
| 60 | return from two-rate comparison | 30 |  | 22/29 | 105 | 720 |  |
| 61 | open savings profile | 24 |  | 16/29 | 85 | 718 |  |
| 62 | open savings features | 22 |  | 18/23 | 350 | 716 |  |
| 63 | require Card access | 21 |  | 12/14 | 81 | 730 |  |
| 64 | require PayID | 24 |  |  |  | 738 | UI assertion failed: app hierarchy unavailable |
| 65 | restore audit profile | 27 |  | 12/14 | 101 | 725 |  |
| 66 | clear audit requirements | 0 |  | 58/65 | 105 | 751 | not found: {"contains":"Clear all saved requirements"} |

## Errors

### 1 open app
```
11-28 16:23:56.218 E/australianrates( 4915): Not starting debugger since process cannot load the jdwp agent.
```

### 36 search Macquarie
```
11-28 16:32:18.349 E/FrameTracker( 4915): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 44 verify fixed was not applied
```
11-28 16:33:24.309 E/FrameTracker( 4915): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 46 start save from rates
```
11-28 16:33:41.132 E/FrameTracker( 4915): force finish cuj, time out: J<IME_INSETS_ANIMATION::0@0@com.eyex.australianrates>
```

### 47 open unsaved rate
```
11-28 16:33:47.020 E/ImeBackDispatcher( 4915): Ime callback not found. Ignoring unregisterReceivedCallback. callbackId: 101365053
```

### 48 save a rate
```
11-28 16:33:57.531 E/FrameTracker( 4915): force finish cuj, time out: J<IME_INSETS_ANIMATION::1@0@com.eyex.australianrates>
```

### 50 restart with a saved rate
```
11-28 16:34:13.525 E/australianrates(12495): Not starting debugger since process cannot load the jdwp agent.
```
